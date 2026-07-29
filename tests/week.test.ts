import { describe, it, expect } from "vitest";
import {
  MAX_STONES,
  weekStartOf,
  nextWeekStart,
  weekLabel,
  daysLeftInWeek,
  parseList,
  serializeList,
  normalizeStones,
  score2080,
  isLowHanging,
  rankWeekCandidates,
} from "@/lib/week";

/**
 * Контур недели. Неделя решает, ЧТО из целей месяца делаю, — поэтому здесь
 * проверяется только выбор: границы недели, рамки и разбор 20/80.
 */

describe("границы недели", () => {
  it("неделя начинается с понедельника", () => {
    // среда 29 июля 2026
    const start = weekStartOf(new Date(2026, 6, 29));
    expect(start.getDay()).toBe(1);
    expect(start.getDate()).toBe(27);
  });

  it("воскресенье относится к уходящей неделе, а не к следующей", () => {
    // воскресенье 2 августа 2026 → понедельник 27 июля
    const start = weekStartOf(new Date(2026, 7, 2));
    expect(start.getMonth()).toBe(6);
    expect(start.getDate()).toBe(27);
  });

  it("понедельник сам себе начало и время обнуляется", () => {
    const start = weekStartOf(new Date(2026, 6, 27, 23, 45));
    expect(start.getDate()).toBe(27);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
  });

  it("следующая неделя ровно через семь дней", () => {
    const next = nextWeekStart(new Date(2026, 6, 29));
    expect(next.getDate()).toBe(3);
    expect(next.getMonth()).toBe(7);
  });

  it("подпись недели показывает оба месяца, когда неделя их пересекает", () => {
    expect(weekLabel(new Date(2026, 6, 27))).toBe("27 июля — 2 августа");
  });

  it("внутри одного месяца месяц пишется один раз", () => {
    expect(weekLabel(new Date(2026, 6, 6))).toBe("6 — 12 июля");
  });

  it("в среду недели осталось пять дней вместе с сегодняшним", () => {
    const start = weekStartOf(new Date(2026, 6, 29));
    expect(daysLeftInWeek(new Date(2026, 6, 29), start)).toBe(5);
  });
});

describe("рамки недели: камни и стоп-лист", () => {
  it("камней не больше трёх — лишнее отсекает сервер", () => {
    expect(normalizeStones(["а", "б", "в", "г"])).toEqual(["а", "б", "в"]);
    expect(MAX_STONES).toBe(3);
  });

  it("пустые строки и пробелы не становятся камнями", () => {
    expect(normalizeStones([" ", "оффер биржам", "  "])).toEqual(["оффер биржам"]);
  });

  it("список читается из json и переживает мусор в базе", () => {
    expect(parseList('["не беру новые проекты"]')).toEqual(["не беру новые проекты"]);
    expect(parseList("не json")).toEqual([]);
    expect(parseList(null)).toEqual([]);
    expect(parseList('{"a":1}')).toEqual([]);
    expect(parseList('["ок", 5, null]')).toEqual(["ок"]);
  });

  it("запись и чтение дают то же самое", () => {
    const items = ["первый камень", "второй камень"];
    expect(parseList(serializeList(items))).toEqual(items);
  });
});

describe("разбор 20/80", () => {
  it("при равной отдаче дешёвое по усилию выигрывает", () => {
    const cheap = score2080({ potentialUsd: 5000, hellYeah: 8, estimateMin: 30 });
    const heavy = score2080({ potentialUsd: 5000, hellYeah: 8, estimateMin: 240 });
    expect(cheap).toBeGreaterThan(heavy);
  });

  it("деньги проекта весят больше азарта", () => {
    const money = score2080({ potentialUsd: 10_000, hellYeah: 1, estimateMin: 60 });
    const fire = score2080({ potentialUsd: 0, hellYeah: 10, estimateMin: 60 });
    expect(money).toBeGreaterThan(fire);
  });

  it("низко висящее яблоко — до получаса и с заметной отдачей", () => {
    expect(isLowHanging({ potentialUsd: 8000, hellYeah: 8, estimateMin: 20 })).toBe(true);
    expect(isLowHanging({ potentialUsd: 8000, hellYeah: 8, estimateMin: 180 })).toBe(false);
    expect(isLowHanging({ potentialUsd: 0, hellYeah: 3, estimateMin: 20 })).toBe(false);
  });

  it("задача без оценки не выигрывает у оценённой дешёвой", () => {
    const unknown = score2080({ potentialUsd: 5000, hellYeah: 5 });
    const cheap = score2080({ potentialUsd: 5000, hellYeah: 5, estimateMin: 15 });
    expect(cheap).toBeGreaterThan(unknown);
  });

  it("список всегда с рангом и причиной — сырых списков в интерфейсе нет", () => {
    const ranked = rankWeekCandidates([
      { id: "a", title: "долгая", potentialUsd: 5000, hellYeah: 5, estimateMin: 300 },
      { id: "b", title: "быстрая", potentialUsd: 5000, hellYeah: 5, estimateMin: 20 },
    ]);
    expect(ranked[0].id).toBe("b");
    expect(ranked[0].why.length).toBeGreaterThan(0);
    expect(ranked[0].lowHanging).toBe(true);
  });

  it("причина есть даже у пустой задачи", () => {
    const [r] = rankWeekCandidates([{ id: "x", title: "без данных" }]);
    expect(r.why).toEqual(["по порядку проекта"]);
  });

  it("можно ограничить выдачу", () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ id: String(i), title: `з${i}`, estimateMin: 10 + i }));
    expect(rankWeekCandidates(items, 5)).toHaveLength(5);
  });
});
