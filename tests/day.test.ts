import { describe, it, expect } from "vitest";
import { LIMITS, checkTakeToday, checkStartWork, checkActivate, scoreCandidate, rankCandidates, streakFromDays, capacityState } from "@/lib/day";

/**
 * Контур дня. Лимиты держит сервер, а не интерфейс — иначе их можно обойти,
 * и «мне всё интересно» побеждает. Это прямое требование ТЗ.
 */

describe("лимиты дня", () => {
  it("три задачи в день можно", () => {
    expect(checkTakeToday(2).allowed).toBe(true);
  });

  it("четвёртую не даёт и предлагает обмен, а не просто отказ", () => {
    const r = checkTakeToday(3);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/три задачи/i);
    expect(r.offerSwap).toBe(true);
  });

  it("в работе одновременно только одна", () => {
    expect(checkStartWork(0).allowed).toBe(true);
    expect(checkStartWork(1).allowed).toBe(false);
  });

  it("шестой активный проект не открывается", () => {
    expect(checkActivate(4).allowed).toBe(true);
    expect(checkActivate(5).allowed).toBe(false);
    expect(checkActivate(5).reason).toMatch(/пять/i);
  });

  it("лимиты те, что в задании", () => {
    expect(LIMITS).toEqual({ tasksPerDay: 3, inProgress: 1, activeProjects: 5, streams: 7 });
  });
});

describe("скоринг кандидатов дня", () => {
  const base = { potentialUsd: 0, hellYeah: 5, leverage: 0, urgency: 3, hoursCost: 1, overdueDays: 0, ageDays: 0 };

  it("деньги весят больше азарта", () => {
    const money = scoreCandidate({ ...base, potentialUsd: 10000 });
    const fire = scoreCandidate({ ...base, hellYeah: 10 });
    expect(money).toBeGreaterThan(fire);
  });

  it("просрочка поднимает задачу", () => {
    expect(scoreCandidate({ ...base, overdueDays: 3 })).toBeGreaterThan(scoreCandidate(base));
  });

  it("залежавшаяся задача поднимается — иначе она не всплывёт никогда", () => {
    expect(scoreCandidate({ ...base, ageDays: 30 })).toBeGreaterThan(scoreCandidate({ ...base, ageDays: 1 }));
  });

  it("дорогая по времени задача опускается", () => {
    expect(scoreCandidate({ ...base, hoursCost: 8 })).toBeLessThan(scoreCandidate(base));
  });

  it("возвращает ровно три кандидата и у каждого есть причина", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      title: `Задача ${i}`,
      ...base,
      potentialUsd: i * 1000,
    }));
    const top = rankCandidates(items);
    expect(top).toHaveLength(3);
    expect(top[0].id).toBe("9");
    expect(top[0].why.length).toBeGreaterThan(0);
  });

  it("если задач меньше трёх — отдаёт сколько есть, а не падает", () => {
    expect(rankCandidates([{ id: "a", title: "Одна", ...base }])).toHaveLength(1);
  });
});

describe("серия дней", () => {
  const day = (n: number) => new Date(2026, 6, n, 12);

  it("считает подряд идущие дни с фактами", () => {
    const s = streakFromDays([day(26), day(27), day(28)], day(28), 0);
    expect(s.days).toBe(3);
  });

  it("пропуск рвёт серию, если заморозок не осталось", () => {
    const s = streakFromDays([day(25), day(27), day(28)], day(28), 0);
    expect(s.days).toBe(2);
  });

  it("заморозка спасает серию — прощение, а не обнуление", () => {
    const s = streakFromDays([day(25), day(27), day(28)], day(28), 2);
    expect(s.days).toBe(4);
    expect(s.freezesUsed).toBe(1);
  });

  it("заморозка закрывает дыру, но дальше двух подряд пропусков серия кончается", () => {
    // есть 22, 25, 27, 28. Дыра 26 закрывается заморозкой → серия 25-28.
    // Дальше 23 и 24 пустые подряд — там серия и оборвалась, до 22 не дотягиваем.
    const s = streakFromDays([day(22), day(25), day(27), day(28)], day(28), 1);
    expect(s.days).toBe(4);
    expect(s.freezesUsed).toBe(1);
  });

  it("сегодня без факта серию не рвёт — день ещё не кончился", () => {
    const s = streakFromDays([day(26), day(27)], day(28), 0);
    expect(s.days).toBe(2);
    expect(s.todayDone).toBe(false);
  });
});

describe("ёмкость дня", () => {
  it("укладываемся — спокойно", () => {
    expect(capacityState(120, 180).state).toBe("ok");
  });

  it("перебор помечается, но не запрещается", () => {
    const c = capacityState(220, 180);
    expect(c.state).toBe("over");
    expect(c.overBy).toBe(40);
  });
});
