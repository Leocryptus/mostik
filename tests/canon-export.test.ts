import { describe, it, expect } from "vitest";
import { buildCanonRecord, renderCanonFile } from "@/lib/canon-export";

/**
 * Обратный экспорт в старый канон (window.LEO_TASKS=[...]).
 * Дашборд :8765, бот и дайджест читают именно этот файл — сломать его нельзя.
 * Поэтому поля, которых нет в новой базе (тема, происхождение, приоритет),
 * берутся из сохранённой исходной записи и не теряются.
 */

const RAW = {
  text: "Дописать ТЗ по блоку нетворкинг",
  topic: "разное",
  date: "04.07",
  who: null,
  deadline: null,
  priority: false,
  done: false,
  status: "inbox",
  id: 65,
  day: "04.07",
  bucket: null,
  origin: "inbox",
};

const task = {
  legacyId: 65,
  legacyRaw: JSON.stringify(RAW),
  title: "Дописать ТЗ по блоку нетворкинг",
  status: "inbox",
  bucket: null,
  due: null,
  doneAt: null,
  who: "Лео",
};

describe("сборка записи канона", () => {
  it("сохраняет поля, которых нет в новой базе", () => {
    const r = buildCanonRecord(task as never);
    expect(r.topic).toBe("разное");
    expect(r.origin).toBe("inbox");
    expect(r.priority).toBe(false);
    expect(r.date).toBe("04.07");
  });

  it("подставляет актуальный заголовок и флаг закрытия, но НЕ переписывает чужое поле статуса", () => {
    const r = buildCanonRecord({ ...task, title: "Новый заголовок", status: "done" } as never);
    expect(r.text).toBe("Новый заголовок");
    expect(r.done).toBe(true);
    // в старом каноне поле status мёртвое (везде inbox) — старые читатели смотрят на done,
    // поэтому чужое значение не трогаем
    expect(r.status).toBe("inbox");
  });

  it("закрытая задача получает дату закрытия в русском формате", () => {
    const r = buildCanonRecord({ ...task, status: "done", doneAt: new Date(2026, 6, 27, 12) } as never);
    expect(r.done_at).toBe("27.07.2026");
  });

  it("задача, созданная уже в мостике, экспортируется без исходной записи", () => {
    const r = buildCanonRecord({
      legacyId: null,
      legacyRaw: null,
      title: "Родилась в мостике",
      status: "inbox",
      bucket: "chore",
      due: new Date(2026, 6, 30, 12),
      doneAt: null,
      who: "Гео",
    } as never);
    expect(r.text).toBe("Родилась в мостике");
    expect(r.bucket).toBe("chore");
    expect(r.who).toBe("Гео");
    expect(r.day).toBe("30.07");
    expect(r.id).toBeTypeOf("number"); // дашборду нужен числовой id
  });

  it("замороженные и слитые дубли в старый файл не уезжают", () => {
    const file = renderCanonFile([
      buildCanonRecord(task as never),
      buildCanonRecord({ ...task, legacyId: 66, status: "frozen" } as never),
    ]);
    expect(file).toContain("Дописать ТЗ");
    expect(file.match(/"id":/g) ?? []).toHaveLength(1);
  });
});

describe("сборка файла", () => {
  it("собирает ровно ту обёртку, которую ждёт дашборд", () => {
    const file = renderCanonFile([buildCanonRecord(task as never)]);
    expect(file.startsWith("window.LEO_TASKS=[")).toBe(true);
    expect(file.trimEnd().endsWith("];")).toBe(true);
  });

  it("файл разбирается обратно как валидный JSON", () => {
    const file = renderCanonFile([buildCanonRecord(task as never)]);
    const json = file.slice(file.indexOf("["), file.lastIndexOf("]") + 1);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
