/**
 * Контур недели: рамки, три камня, стоп-лист и разбор 20/80.
 *
 * Место недели в иерархии (ТЗ §3 и §19.5): месяц задаёт цели → неделя решает,
 * что из них делаю → день выделяет время. Поэтому здесь нет ни денег, ни
 * светофоров: неделя работает только с выбором задач.
 */

/** Сколько камней держит неделя. Больше трёх — это уже список, а не рамки (ТЗ §5.5). */
export const MAX_STONES = 3;

/**
 * Неделя начинается с понедельника: разбор Лео проводит в воскресенье вечером
 * и рамки ставит на следующую (ТЗ §7, сценарий «Неделя»).
 */
export function weekStartOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const shift = (x.getDay() + 6) % 7; // воскресенье = 0 → отступ 6 дней назад
  x.setDate(x.getDate() - shift);
  return x;
}

/** Понедельник следующей недели — «собрать неделю заранее». */
export function nextWeekStart(d: Date): Date {
  const x = weekStartOf(d);
  x.setDate(x.getDate() + 7);
  return x;
}

/** «28 июля — 3 августа». Месяц у первой даты пишем только если недели разные. */
export function weekLabel(start: Date): string {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const fmt = (d: Date, withMonth: boolean) =>
    d.toLocaleDateString("ru-RU", withMonth ? { day: "numeric", month: "long" } : { day: "numeric" });
  return `${fmt(start, !sameMonth)} — ${fmt(end, true)}`;
}

/** Сколько дней недели осталось, включая сегодняшний. */
export function daysLeftInWeek(today: Date, start: Date): number {
  const passed = Math.floor((weekStartOf(today).getTime() === start.getTime()
    ? today.getTime() - start.getTime()
    : 0) / 86_400_000);
  return Math.max(0, 7 - passed);
}

// ─────────────────────── камни и стоп-лист ───────────────────────

/** Списки хранятся строкой json — в SQLite нет массивов. Мусор молча отбрасываем. */
export function parseList(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const v: unknown = JSON.parse(json);
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function serializeList(items: string[]): string {
  return JSON.stringify(items.map((s) => s.trim()).filter(Boolean));
}

/** Камней не больше трёх — лишнее отсекаем здесь, а не в интерфейсе. */
export function normalizeStones(items: string[]): string[] {
  return items.map((s) => s.trim()).filter(Boolean).slice(0, MAX_STONES);
}

// ─────────────────────── разбор 20/80 ───────────────────────

export interface WeekCandidateInput {
  /** сколько проект должен приносить в месяц */
  potentialUsd?: number;
  /** азарт проекта 1..10 */
  hellYeah?: number;
  /** оценка задачи в минутах */
  estimateMin?: number;
  /** просрочена на столько дней */
  overdueDays?: number;
}

export interface WeekCandidate extends WeekCandidateInput {
  id: string;
  title: string;
}

export interface RankedWeekCandidate extends WeekCandidate {
  score: number;
  /** почему она наверху — словами, без формул на экране */
  why: string[];
  /** дёшево по усилию и заметно по результату */
  lowHanging: boolean;
}

/** Оценка усилия в часах. Без оценки считаем 45 минут — средняя задача Лео. */
const effortHours = (c: WeekCandidateInput) => Math.max((c.estimateMin ?? 45) / 60, 0.25);

/**
 * 20/80 = результат на единицу усилия: важность × влияние ÷ усилия (ТЗ §3, контур недели).
 * Деньги проекта весят больше азарта, просрочка добавляет вес, но не решает.
 */
export function score2080(c: WeekCandidateInput): number {
  const money = Math.min((c.potentialUsd ?? 0) / 1000, 20); // 0..20
  const fire = (c.hellYeah ?? 5) / 2; // 0..5
  const overdue = Math.min(c.overdueDays ?? 0, 14) / 4; // до 3.5
  return (money + fire + overdue) / effortHours(c);
}

/** Низко висящее яблоко: до получаса работы и заметная отдача. */
export function isLowHanging(c: WeekCandidateInput): boolean {
  return (c.estimateMin ?? 45) <= 30 && score2080(c) >= 8;
}

function whyLabels(c: WeekCandidate): string[] {
  const w: string[] = [];
  if (isLowHanging(c)) w.push("дёшево и заметно");
  if ((c.potentialUsd ?? 0) >= 1000) w.push(`$${Math.round((c.potentialUsd ?? 0) / 1000)}k`);
  if ((c.hellYeah ?? 0) >= 8) w.push(`азарт ${c.hellYeah}`);
  if ((c.overdueDays ?? 0) > 0) w.push(`просрочена на ${c.overdueDays}`);
  if (c.estimateMin) w.push(`${c.estimateMin} мин`);
  return w.length ? w : ["по порядку проекта"];
}

/** Ранжируем всегда: сырой список больше пяти строк без ранга — запрет ТЗ §8. */
export function rankWeekCandidates(items: WeekCandidate[], take?: number): RankedWeekCandidate[] {
  const ranked = items
    .map((c) => ({ ...c, score: score2080(c), why: whyLabels(c), lowHanging: isLowHanging(c) }))
    .sort((a, b) => b.score - a.score);
  return take ? ranked.slice(0, take) : ranked;
}
