import { describe, it, expect } from "vitest";
import {
  SIMPLE_LIMITS,
  ADEQUACY_STEPS,
  adequacyComplete,
  adequacyProgress,
  tokens,
  suggestPlacement,
  goalProgress,
  goalState,
  checkTakeStep,
  checkTakeGoal,
} from "@/lib/simple";

/**
 * Простая версия: инбокс → адекватизация → задача месяца → подпроект → шаг.
 * Проверяем ровно то, что система считает сама и никогда не спрашивает у Лео.
 */

describe("адекватизация", () => {
  it("четыре вопроса, смысл идёт первым, действие последним", () => {
    expect(ADEQUACY_STEPS).toHaveLength(4);
    expect(ADEQUACY_STEPS[0].key).toBe("becomesTrue");
    expect(ADEQUACY_STEPS[3].key).toBe("firstStep");
  });

  it("разбор закончен, когда есть смысл и первое действие", () => {
    expect(adequacyComplete({ becomesTrue: "оффер у пяти бирж", firstStep: "открыть список" })).toBe(true);
  });

  it("без первого действия разбор не закрывается — иначе запись снова зависнет", () => {
    expect(adequacyComplete({ becomesTrue: "оффер у пяти бирж" })).toBe(false);
  });

  it("без смысла разбор не закрывается", () => {
    expect(adequacyComplete({ firstStep: "открыть список" })).toBe(false);
  });

  it("пробелы за ответ не считаются", () => {
    expect(adequacyComplete({ becomesTrue: "   ", firstStep: "открыть" })).toBe(false);
  });

  it("прогресс считает закрытые вопросы", () => {
    expect(adequacyProgress({})).toBe(0);
    expect(adequacyProgress({ becomesTrue: "а", blocker: "б" })).toBe(2);
    expect(adequacyProgress({ becomesTrue: "а", who: "я", blocker: "б", firstStep: "в" })).toBe(4);
  });
});

describe("подсказка места", () => {
  const goals = [
    { id: "g1", title: "Cryptus", corpus: "оффер биржам партнёрство листинг" },
    { id: "g2", title: "Обменка", corpus: "перевод клиенту курс наличные" },
  ];

  it("кладёт запись туда, где уже лежит похожее", () => {
    const p = suggestPlacement("Отправить оффер ещё двум биржам", goals);
    expect(p?.goalId).toBe("g1");
    expect(p?.hits).toBeGreaterThan(0);
  });

  it("показывает слова, по которым совпало — подсказка не должна быть магией", () => {
    const p = suggestPlacement("Посчитать курс для клиента", goals);
    expect(p?.goalId).toBe("g2");
    expect(p?.matched.length).toBeGreaterThan(0);
  });

  it("когда похожего нет, молчит и не выдумывает", () => {
    expect(suggestPlacement("Записаться к стоматологу", goals)).toBeNull();
  });

  it("пустой текст не даёт подсказки", () => {
    expect(suggestPlacement("   ", goals)).toBeNull();
  });

  it("выигрывает тот, у кого совпадений больше", () => {
    const p = suggestPlacement("оффер биржам листинг", goals);
    expect(p?.goalId).toBe("g1");
    expect(p!.hits).toBeGreaterThanOrEqual(2);
  });

  it("короткие слова и мусор в счёт не идут", () => {
    expect(tokens("я и мы для под без 42")).toEqual([]);
  });

  it("окончания не мешают совпадению", () => {
    expect(tokens("биржам")).toEqual(tokens("биржа"));
  });
});

describe("прогресс задачи месяца", () => {
  it("среднее по ключевым результатам", () => {
    expect(goalProgress([{ name: "a", current: 1, target: 2 }, { name: "b", current: 1, target: 4 }])).toBe(38);
  });

  it("перевыполненный результат не маскирует застрявшие", () => {
    const p = goalProgress([
      { name: "a", current: 100, target: 1 },
      { name: "b", current: 0, target: 10 },
    ]);
    expect(p).toBe(50);
  });

  it("без результатов прогресс ноль, а не ошибка", () => {
    expect(goalProgress([])).toBe(0);
    expect(goalProgress([{ name: "a", current: 3, target: 0 }])).toBe(0);
  });
});

describe("три состояния вместо семи", () => {
  it("без фактов — молчит", () => {
    expect(goalState(50, 50, null)).toBe("silent");
  });

  it("больше двух недель тишины — молчит, даже если проценты красивые", () => {
    expect(goalState(90, 50, 20)).toBe("silent");
  });

  it("идёт вровень с календарём — идёт", () => {
    expect(goalState(48, 50, 2)).toBe("moving");
  });

  it("отстаёт, когда месяц ушёл заметно вперёд", () => {
    expect(goalState(20, 60, 3)).toBe("behind");
  });
});

describe("лимиты", () => {
  it("три шага в день, четвёртый предлагает обмен", () => {
    expect(checkTakeStep(2).allowed).toBe(true);
    const v = checkTakeStep(3);
    expect(v.allowed).toBe(false);
    expect(v.reason).toMatch(/три шага/i);
  });

  it("шестая задача месяца не открывается", () => {
    expect(checkTakeGoal(4).allowed).toBe(true);
    expect(checkTakeGoal(5).allowed).toBe(false);
  });

  it("лимиты те, что в задании", () => {
    expect(SIMPLE_LIMITS).toEqual({ stepsPerDay: 3, inProgress: 1, goalsPerMonth: 5 });
  });
});
