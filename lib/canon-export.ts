/**
 * Обратный экспорт в старый канон `vault/leo-os/leo-os-tasks.js`.
 *
 * Зачем: дашборд :8765, бот Альфред и дайджест читают этот файл. Решение Лео —
 * ничего не гасить, поэтому база мостика остаётся источником правды, а файл
 * генерируется из неё после каждого изменения.
 *
 * Поля, которых нет в новой схеме (тема, происхождение, приоритет), берутся
 * из сохранённой исходной записи — так они не теряются при переносе туда-обратно.
 */

export interface TaskForCanon {
  legacyId: number | null;
  legacyRaw: string | null;
  title: string;
  status: string;
  bucket: string | null;
  due: Date | null;
  doneAt: Date | null;
  who: string;
}

export interface CanonRecord {
  text: string;
  topic: string | null;
  date: string | null;
  who: string | null;
  deadline: string | null;
  priority: boolean;
  done: boolean;
  status: string;
  id: number;
  day: string | null;
  bucket: string | null;
  origin?: string;
  done_at?: string;
  /** внутренняя пометка: такие записи в файл не попадают */
  _skip?: boolean;
}

const two = (n: number) => String(n).padStart(2, "0");
const ddmm = (d: Date) => `${two(d.getDate())}.${two(d.getMonth() + 1)}`;
const ddmmyyyy = (d: Date) => `${two(d.getDate())}.${two(d.getMonth() + 1)}.${d.getFullYear()}`;

/** Стабильный числовой id для задач, родившихся уже в мостике. */
function syntheticId(title: string): number {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.codePointAt(0)!) % 100000;
  return 900000 + h; // диапазон, который не пересекается со старыми id
}

export function buildCanonRecord(t: TaskForCanon): CanonRecord {
  const raw: Partial<CanonRecord> = t.legacyRaw ? JSON.parse(t.legacyRaw) : {};
  const done = t.status === "done";

  const rec: CanonRecord = {
    ...raw,
    text: t.title,
    topic: raw.topic ?? null,
    date: raw.date ?? (t.due ? ddmm(t.due) : null),
    who: t.who === "Лео" ? (raw.who ?? null) : t.who,
    deadline: raw.deadline ?? null,
    priority: raw.priority ?? false,
    done,
    // поле status в старом каноне мёртвое: у всех записей "inbox".
    // Старые читатели ориентируются на done, поэтому чужое значение сохраняем как есть.
    status: raw.status ?? "inbox",
    id: t.legacyId ?? syntheticId(t.title),
    day: t.due ? ddmm(t.due) : (raw.day ?? null),
    bucket: t.bucket ?? raw.bucket ?? null,
  };

  if (done && t.doneAt) rec.done_at = ddmmyyyy(t.doneAt);
  // замороженное и слитые дубли в старый файл не отдаём: там нет такого статуса,
  // и они выглядели бы как живые задачи
  if (t.status === "frozen") rec._skip = true;

  return rec;
}

export function renderCanonFile(records: CanonRecord[]): string {
  const visible = records
    .filter((r) => !r._skip)
    .map(({ _skip, ...rest }) => rest); // eslint-disable-line @typescript-eslint/no-unused-vars
  return `window.LEO_TASKS=${JSON.stringify(visible)};\n`;
}
