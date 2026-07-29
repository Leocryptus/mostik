/**
 * Ядро простой версии мостика (ТЗ «Мостик, простая версия v1.0»).
 *
 * Иерархия ровно такая: запись инбокса → адекватизация → задача месяца →
 * подпроект → шаг → день. Недели здесь нет намеренно.
 *
 * Всё, что можно посчитать формулой, считается здесь и у Лео не спрашивается.
 */

export const SIMPLE_LIMITS = {
  /** шагов в день */
  stepsPerDay: 3,
  /** шагов в работе одновременно */
  inProgress: 1,
  /** задач месяца */
  goalsPerMonth: 5,
} as const;

// ─────────────────────── адекватизация ───────────────────────

/** Четыре вопроса разбора. Порядок важен: сначала смысл, потом исполнитель, потом риск, потом действие. */
export const ADEQUACY_STEPS = [
  {
    key: "becomesTrue",
    question: "Что конкретно станет правдой, когда сделаешь?",
    hint: "Не «поработать над сайтом», а «на сайте висит новая цена»",
  },
  {
    key: "who",
    question: "Точно ли это должен делать ты?",
    hint: "Если делает кто-то другой — запись уйдёт делегированной",
  },
  {
    key: "blocker",
    question: "Что вероятнее всего помешает?",
    hint: "Одна строка. Названное вслух мешает меньше",
  },
  {
    key: "firstStep",
    question: "Какое действие можно начать не раздумывая?",
    hint: "До десяти минут: открыть, написать, позвонить",
  },
] as const;

export type AdequacyKey = (typeof ADEQUACY_STEPS)[number]["key"];

export interface AdequacyDraft {
  becomesTrue?: string | null;
  who?: string | null;
  blocker?: string | null;
  firstStep?: string | null;
}

/** Разбор закончен, когда есть смысл и первое действие. Риск и исполнитель необязательны. */
export function adequacyComplete(d: AdequacyDraft): boolean {
  return Boolean(d.becomesTrue?.trim()) && Boolean(d.firstStep?.trim());
}

/** Сколько из четырёх вопросов закрыто — для полосы прогресса на экране разбора. */
export function adequacyProgress(d: AdequacyDraft): number {
  return [d.becomesTrue, d.who, d.blocker, d.firstStep].filter((v) => Boolean(v && v.trim())).length;
}

// ─────────────────────── куда положить разобранное ───────────────────────

/**
 * Подсказка места. Считается по пересечению слов записи с тем, что у задачи
 * месяца уже накоплено: название, цель, подпроекты, уже лежащие там шаги.
 *
 * Принципиально: система НЕ знает предметную область Лео и ничего не выдумывает —
 * она лишь замечает, что похожее уже лежит вот здесь. Чем больше он разложит
 * руками, тем точнее подсказка.
 */
export interface PlacementCandidate {
  id: string;
  title: string;
  /** всё, что уже связано с этой задачей месяца, одной строкой */
  corpus: string;
}

export interface Placement {
  goalId: string;
  goalTitle: string;
  /** сколько общих слов нашлось */
  hits: number;
  /** слова, по которым совпало — показываем их, чтобы подсказка не была магией */
  matched: string[];
}

const STOP = new Set([
  "этот", "этого", "который", "которая", "чтобы", "нужно", "надо", "если", "было",
  "тоже", "также", "потом", "когда", "туда", "сюда", "себе", "себя", "them", "with",
  "быть", "есть", "мочь", "весь", "всех", "всё", "для", "под", "над", "про", "без",
]);

/** Слова длиннее трёх букв, без стоп-слов и без цифр-мусора. */
export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-zа-яё0-9]{4,}/gi) ?? [])
    .map((w) => w.replace(/(ами|ями|ов|ев|ий|ый|ая|ое|ые|ам|ям|ах|ях|ом|ем|у|е|а|я|и|ы|ь)$/u, ""))
    .filter((w) => w.length >= 4 && !STOP.has(w));
}

/** Лучшее место или null, если ничего похожего нет — тогда Лео выбирает сам. */
export function suggestPlacement(text: string, candidates: PlacementCandidate[]): Placement | null {
  const words = new Set(tokens(text));
  if (words.size === 0) return null;

  let best: Placement | null = null;
  for (const c of candidates) {
    const corpus = new Set(tokens(`${c.title} ${c.corpus}`));
    const matched = [...words].filter((w) => corpus.has(w));
    if (matched.length === 0) continue;
    if (!best || matched.length > best.hits) {
      best = { goalId: c.id, goalTitle: c.title, hits: matched.length, matched: matched.slice(0, 3) };
    }
  }
  return best;
}

// ─────────────────────── прогресс задачи месяца ───────────────────────

export interface KeyResult {
  name: string;
  current: number;
  target: number;
  unit?: string | null;
}

/**
 * Прогресс задачи месяца — среднее по ключевым результатам, каждый не выше 100%.
 * Один перевыполненный результат не должен маскировать три застрявших.
 */
export function goalProgress(krs: KeyResult[]): number {
  const usable = krs.filter((k) => k.target > 0);
  if (usable.length === 0) return 0;
  const sum = usable.reduce((s, k) => s + Math.min(1, k.current / k.target), 0);
  return Math.round((sum / usable.length) * 100);
}

/** Три состояния вместо семи: идёт · отстаёт · молчит (ТЗ простой версии §6). */
export type SimpleState = "moving" | "behind" | "silent";

export function goalState(progressPercent: number, monthPercent: number, silentDays: number | null): SimpleState {
  if (silentDays === null || silentDays > 14) return "silent";
  // отстаём, если прошло заметно больше месяца, чем сделано
  return progressPercent + 15 < monthPercent ? "behind" : "moving";
}

export const STATE_LABEL: Record<SimpleState, string> = {
  moving: "идёт",
  behind: "отстаёт",
  silent: "молчит",
};

// ─────────────────────── лимиты дня ───────────────────────

export interface LimitVerdict {
  allowed: boolean;
  reason?: string;
}

/** Четвёртый шаг — не запрет, а предложение, что снять. Причина формулируется здесь. */
export function checkTakeStep(currentSteps: number): LimitVerdict {
  if (currentSteps < SIMPLE_LIMITS.stepsPerDay) return { allowed: true };
  return { allowed: false, reason: "На день берём три шага. Сними один — и этот встанет на его место" };
}

export function checkTakeGoal(currentGoals: number): LimitVerdict {
  if (currentGoals < SIMPLE_LIMITS.goalsPerMonth) return { allowed: true };
  return { allowed: false, reason: "Задач месяца уже пять. Новая — только вместо старой" };
}
