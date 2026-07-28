/**
 * Перенос задач из старого канона (vault/leo-os/leo-os-tasks.js) в базу.
 *
 * Принцип: ничего не теряем и ничего не додумываем. Битые данные не проглатываем
 * молча — либо переносим как есть, либо падаем с понятной ошибкой.
 */

export interface LegacyTask {
  id: number;
  /** заголовок: в реальном каноне поле называется text */
  text?: string | null;
  title?: string | null;
  date?: string | null;
  day?: string | null;
  deadline?: string | null; // 2026-07-07
  done_at?: string | null;  // 27.07.2026
  status?: string | null;
  done?: boolean;
  bucket?: string | null;
  topic?: string | null;
  who?: string | null;
  origin?: string | null;
}

export interface MappedTask {
  legacyId: number;
  title: string;
  status: "inbox" | "done";
  bucket: string | null;
  due: Date | null;
  doneAt: Date | null;
  createdAt: Date | null;
  who: string;
  topic: string | null;
}

/** Достаёт массив задач из JS-файла с любой обёрткой и комментариями. */
export function parseLegacyFile(text: string): LegacyTask[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("В файле не найден массив задач — переносить нечего, проверь путь и формат");
  }
  const raw = text.slice(start, end + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Массив задач не разбирается как JSON: ${(e as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Разобранное значение — не массив задач");
  }
  return parsed as LegacyTask[];
}

/** «2026-07-07» → дата. Не подошло — null. */
export function parseIsoDate(v?: string | null): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

/** «27.07.2026» → дата. Не подошло — null. */
export function parseRuDate(v?: string | null): Date | null {
  if (!v) return null;
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v.trim());
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12, 0, 0);
}

/** «05.07» → дата текущего года. Всё, что не подходит, даёт null, а не мусор. */
export function parseLegacyDay(day?: string | null, year = new Date().getFullYear()): Date | null {
  if (!day) return null;
  const m = /^(\d{1,2})\.(\d{1,2})$/.exec(day.trim());
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
  return new Date(year, mo - 1, d, 12, 0, 0);
}

export function mapLegacyTask(raw: LegacyTask): MappedTask {
  const title = (raw.text ?? raw.title ?? "").trim();
  if (!title) {
    throw new Error(`Задача ${raw.id} без заголовка — чиним руками, молча не теряем`);
  }
  const done = raw.done === true;
  // срок: сначала явный дедлайн, потом день из старого формата
  const due = parseIsoDate(raw.deadline) ?? parseLegacyDay(raw.day);
  // дата закрытия: берём из файла, а не «сейчас» — иначе история переписывается
  const doneAt = done ? (parseRuDate(raw.done_at) ?? new Date()) : null;
  return {
    legacyId: raw.id,
    title,
    status: done ? "done" : "inbox",
    bucket: raw.bucket ?? null,
    due,
    doneAt,
    // когда задача появилась: в каноне это поле date. Без него все задачи
    // выглядят созданными сегодня, и детектор залежавшихся слепнет.
    createdAt: parseLegacyDay(raw.date),
    who: raw.who?.trim() || "Лео",
    topic: raw.topic ?? null,
  };
}

export interface DuplicatePair {
  keep: MappedTask;
  merge: MappedTask;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/[«»"'.,!?]/g, "").trim();

/**
 * Дубли по нормализованному заголовку. Оставляем задачу с меньшим старым id
 * (она появилась раньше), вторую помечаем на слияние — но не удаляем.
 */
export function findDuplicates(tasks: MappedTask[]): DuplicatePair[] {
  const byTitle = new Map<string, MappedTask[]>();
  for (const t of tasks) {
    const k = norm(t.title);
    byTitle.set(k, [...(byTitle.get(k) ?? []), t]);
  }
  const pairs: DuplicatePair[] = [];
  for (const group of byTitle.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.legacyId - b.legacyId);
    const [keep, ...rest] = sorted;
    for (const merge of rest) pairs.push({ keep, merge });
  }
  return pairs;
}
