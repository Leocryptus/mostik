import { describe, it, expect } from "vitest";
import { parseLegacyFile, mapLegacyTask, findDuplicates } from "@/lib/legacy";

/**
 * Старый канон — JS-файл с массивом задач (vault/leo-os/leo-os-tasks.js).
 * В нём 114 задач, у всех status "inbox", у 81 нет дня, 9 закрыты.
 * Терять при переносе нельзя ничего — отсюда тесты.
 */

// Реальный формат канона: заголовок лежит в поле text, а не title
const SAMPLE = `// комментарий сверху
const LEO_TASKS = [
  {"text":"Отправить оффер биржам","topic":"работа","date":"05.07","who":null,"deadline":null,"priority":false,"done":false,"status":"inbox","id":100,"day":"05.07","bucket":null},
  {"text":"Заплатить за домен","topic":null,"date":"04.07","who":null,"deadline":"2026-07-07","priority":false,"done":true,"status":"inbox","id":101,"day":null,"bucket":"chore","done_at":"27.07.2026"},
  {"text":"Отправить оффер биржам","topic":null,"date":"06.07","who":"Гео","deadline":null,"priority":false,"done":false,"status":"inbox","id":102,"day":null,"bucket":null}
];
`;

describe("разбор старого канона", () => {
  it("достаёт все задачи из файла с обёрткой и комментариями", () => {
    const rows = parseLegacyFile(SAMPLE);
    expect(rows).toHaveLength(3);
    expect(rows[0].text).toBe("Отправить оффер биржам");
  });

  it("падает понятной ошибкой, если массива нет — молча ноль задач вернуть нельзя", () => {
    expect(() => parseLegacyFile("const X = 1;")).toThrow(/массив/i);
  });
});

describe("перенос задачи", () => {
  it("берёт заголовок из поля text — так устроен реальный канон", () => {
    const t = mapLegacyTask({ id: 100, text: "Отправить оффер биржам", day: "05.07", done: false } as never);
    expect(t.legacyId).toBe(100);
    expect(t.title).toBe("Отправить оффер биржам");
  });

  it("закрытая задача получает статус «сделано» и дату закрытия", () => {
    const t = mapLegacyTask({ id: 101, text: "Заплатить за домен", done: true, done_at: "27.07.2026" } as never);
    expect(t.status).toBe("done");
    expect(t.doneAt).toBeInstanceOf(Date);
    expect(t.doneAt?.getDate()).toBe(27); // дата закрытия берётся из done_at, а не «сейчас»
  });

  it("открытая задача остаётся в инбоксе и без даты закрытия", () => {
    const t = mapLegacyTask({ id: 102, text: "Что-то", done: false } as never);
    expect(t.status).toBe("inbox");
    expect(t.doneAt).toBeNull();
  });

  it("мелочёвка переносится как есть", () => {
    const t = mapLegacyTask({ id: 103, text: "Мелочь", done: false, bucket: "chore" } as never);
    expect(t.bucket).toBe("chore");
  });

  it("день из старого формата 05.07 превращается в дату этого года", () => {
    const t = mapLegacyTask({ id: 104, text: "С днём", done: false, day: "05.07" } as never);
    expect(t.due?.getMonth()).toBe(6); // июль
    expect(t.due?.getDate()).toBe(5);
  });

  it("битый день не роняет перенос, а просто остаётся пустым", () => {
    const t = mapLegacyTask({ id: 105, text: "Битый день", done: false, day: "29.06.2025 кривой" } as never);
    expect(t.due).toBeNull();
  });

  it("пустой заголовок не проходит — такие задачи чинятся руками, а не молча теряются", () => {
    expect(() => mapLegacyTask({ id: 106, text: "   ", done: false } as never)).toThrow(/заголов/i);
  });
});

describe("дубли в реальном файле", () => {
  it("находит задачи с одинаковым заголовком без учёта регистра и пробелов", () => {
    const rows = parseLegacyFile(SAMPLE);
    const dups = findDuplicates(rows.map(mapLegacyTask));
    expect(dups).toHaveLength(1);
    expect(dups[0].keep.legacyId).toBe(100); // оставляем старшую
    expect(dups[0].merge.legacyId).toBe(102);
  });

  it("исполнитель берётся из поля who, если он указан", () => {
    const t = mapLegacyTask({ id: 107, text: "Задача Гео", done: false, who: "Гео" } as never);
    expect(t.who).toBe("Гео");
  });

  it("дата создания берётся из поля date — иначе все задачи выглядят новыми", () => {
    const t = mapLegacyTask({ id: 109, text: "Старая задача", done: false, date: "04.07" } as never);
    expect(t.createdAt?.getMonth()).toBe(6);
    expect(t.createdAt?.getDate()).toBe(4);
  });

  it("срок берётся из deadline в формате с дефисами", () => {
    const t = mapLegacyTask({ id: 108, text: "Со сроком", done: false, deadline: "2026-07-07" } as never);
    expect(t.due?.getFullYear()).toBe(2026);
    expect(t.due?.getDate()).toBe(7);
  });
});

describe("поиск дублей", () => {
  it("не считает дублями разные задачи", () => {
    const dups = findDuplicates([
      mapLegacyTask({ id: 1, text: "Первая", done: false } as never),
      mapLegacyTask({ id: 2, text: "Вторая", done: false } as never),
    ]);
    expect(dups).toHaveLength(0);
  });
});
