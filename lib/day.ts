/**
 * Контур дня: лимиты, скоринг кандидатов, серия, ёмкость.
 *
 * Всё, что здесь считается формулой, у Лео не спрашивается — это граница
 * автоматики из ТЗ §6. Лимиты держит сервер: интерфейс можно обойти, сервер нет.
 */

export const LIMITS = {
  tasksPerDay: 3,
  inProgress: 1,
  activeProjects: 5,
  streams: 7,
} as const;

export interface LimitCheck {
  allowed: boolean;
  reason?: string;
  /** предлагаем обмен, а не сухой отказ — иначе это ощущается как клетка */
  offerSwap?: boolean;
}

export function checkTakeToday(currentCount: number): LimitCheck {
  if (currentCount < LIMITS.tasksPerDay) return { allowed: true };
  return {
    allowed: false,
    reason: "На день берём три задачи. Что-то одно надо снять — тогда возьмём эту",
    offerSwap: true,
  };
}

export function checkStartWork(currentInProgress: number): LimitCheck {
  if (currentInProgress < LIMITS.inProgress) return { allowed: true };
  return {
    allowed: false,
    reason: "Одна задача в работе. Закончи или отложи текущую",
    offerSwap: true,
  };
}

export function checkActivate(currentActive: number): LimitCheck {
  if (currentActive < LIMITS.activeProjects) return { allowed: true };
  return {
    allowed: false,
    reason: "Активных проектов уже пять. Новый — только вместо старого",
    offerSwap: true,
  };
}

// ─────────────────────── скоринг кандидатов дня ───────────────────────

export interface CandidateInput {
  potentialUsd?: number; // сколько проект приносит в месяц
  hellYeah?: number; // 1..10
  leverage?: number; // 0..10, растёт ли без моего времени
  urgency?: number; // 1 высшая .. 5
  hoursCost?: number; // сколько часов съест
  overdueDays?: number; // на сколько просрочена
  ageDays?: number; // сколько лежит без движения
}

export interface Candidate extends CandidateInput {
  id: string;
  title: string;
}

export interface RankedCandidate extends Candidate {
  score: number;
  /** короткие причины, почему она наверху — их видно на карточке */
  why: string[];
}

/** Деньги весят больше азарта, залежавшееся и просроченное поднимается. */
export function scoreCandidate(c: CandidateInput): number {
  const money = Math.min((c.potentialUsd ?? 0) / 1000, 20); // 0..20
  const fire = c.hellYeah ?? 5; // 0..10
  const leverage = c.leverage ?? 0; // 0..10
  const urgencyInv = 6 - (c.urgency ?? 3); // 1..5
  const overdue = Math.min(c.overdueDays ?? 0, 14);
  const age = Math.min((c.ageDays ?? 0) / 7, 4); // до 4 за месяц лежания
  const cost = c.hoursCost ?? 1;

  return money * 3 + fire * 2 + leverage * 2 + urgencyInv + overdue * 1.5 + age * 2 - cost;
}

function reasons(c: Candidate): string[] {
  const w: string[] = [];
  if ((c.potentialUsd ?? 0) >= 1000) w.push(`$${Math.round((c.potentialUsd ?? 0) / 1000)}k`);
  if ((c.hellYeah ?? 0) >= 8) w.push(`азарт ${c.hellYeah}`);
  if ((c.overdueDays ?? 0) > 0) w.push(`просрочена на ${c.overdueDays}`);
  if ((c.ageDays ?? 0) >= 14) w.push(`лежит ${c.ageDays} дней`);
  if ((c.leverage ?? 0) >= 7) w.push("растёт без тебя");
  return w.length ? w : ["ближайшая по сроку"];
}

/** Показываем ровно три кандидата: больше — это уже список, который надо разбирать. */
export function rankCandidates(items: Candidate[], take = 3): RankedCandidate[] {
  return items
    .map((c) => ({ ...c, score: scoreCandidate(c), why: reasons(c) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, take);
}

// ─────────────────────── серия дней ───────────────────────

export interface Streak {
  days: number;
  freezesUsed: number;
  todayDone: boolean;
}

const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * Серия: сколько дней подряд был хотя бы один факт движения.
 * Пропуски прощаются заморозками — их немного, иначе серия перестаёт значить
 * что-либо (так устроено у Duolingo, и это единственное, что удерживает привычку).
 * Сегодняшний день без факта серию не рвёт: он ещё не закончился.
 */
/** Есть ли факт хотя бы за один из ближайших дней до указанного. */
function hasFactBefore(set: Set<string>, from: Date, lookback = 1): boolean {
  const c = new Date(from);
  for (let i = 0; i < lookback; i++) {
    c.setDate(c.getDate() - 1);
    if (set.has(key(c))) return true;
  }
  return false;
}

export function streakFromDays(factDays: Date[], today: Date, freezesLeft: number): Streak {
  const set = new Set(factDays.map(key));
  const todayDone = set.has(key(today));

  let days = 0;
  let freezesUsed = 0;
  const cursor = new Date(today);
  if (!todayDone) cursor.setDate(cursor.getDate() - 1);

  while (true) {
    if (set.has(key(cursor))) {
      days++;
    } else if (freezesUsed < freezesLeft && hasFactBefore(set, cursor)) {
      // заморозка закрывает дыру ВНУТРИ серии. Если дальше в прошлом фактов нет,
      // серия там и закончилась — продлевать её в пустоту нечестно.
      freezesUsed++;
      days++;
    } else {
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return { days, freezesUsed, todayDone };
}

// ─────────────────────── ёмкость дня ───────────────────────

export function capacityState(plannedMin: number, capacityMin: number) {
  const over = plannedMin - capacityMin;
  return {
    state: over > 0 ? ("over" as const) : ("ok" as const),
    overBy: over > 0 ? over : 0,
    percent: Math.round((plannedMin / capacityMin) * 100),
  };
}
