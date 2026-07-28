/**
 * Семь сигналов системы. Канон — ТЗ §18.2.
 *
 * Правило, которое нельзя нарушать: цвет НИКОГДА не работает один.
 * У каждого состояния есть форма — на солнце, в усталости и при плохом
 * зрении цветовая разница пропадает первой, форма остаётся.
 */

export type SignalKey =
  | "ok"       // идём как обещали
  | "over"     // перевыполнено
  | "behind"   // отстаём, но догоняем
  | "gap"      // план и факт разошлись
  | "dead"     // тишина, ничего не происходит
  | "frozen"   // отложено осознанно, с датой возврата
  | "none";    // показатель не задан

export interface Signal {
  key: SignalKey;
  label: string;
  color: string;
  /** чем показываем помимо цвета */
  shape: "circle" | "triangle" | "bar" | "pulse" | "ring" | "snow" | "dash";
  /** когда система его ставит */
  when: string;
}

export const SIGNALS: Record<SignalKey, Signal> = {
  ok:     { key: "ok",     label: "В графике",     color: "var(--s-ok)",     shape: "circle",   when: "идём как обещали" },
  over:   { key: "over",   label: "Перевыполнено", color: "var(--s-over)",   shape: "triangle", when: "обогнали план" },
  behind: { key: "behind", label: "Отстаём",       color: "var(--s-behind)", shape: "bar",      when: "темп ниже нужного, ещё догоняем" },
  gap:    { key: "gap",    label: "Разрыв",        color: "var(--s-gap)",    shape: "pulse",    when: "план и факт разошлись" },
  dead:   { key: "dead",   label: "Тишина",        color: "var(--s-dead)",   shape: "ring",     when: "больше 14 дней без фактов" },
  frozen: { key: "frozen", label: "Заморожено",    color: "var(--s-frozen)", shape: "snow",     when: "отложено с датой возврата" },
  none:   { key: "none",   label: "Нет цифры",     color: "var(--s-none)",   shape: "dash",     when: "показатель не задан" },
};

/**
 * Светофор по возрасту последнего факта движения.
 * Пороги из ТЗ: до 7 дней — идём, 8–14 — отстаём, больше — тишина.
 */
export function signalBySilence(daysSinceLastFact: number): SignalKey {
  if (daysSinceLastFact <= 7) return "ok";
  if (daysSinceLastFact <= 14) return "behind";
  return "dead";
}

/**
 * Сигнал показателя: сравниваем факт с планом.
 * `gapThreshold` — с какой доли отставания это уже разрыв, а не «отстаём».
 */
export function signalByProgress(
  fact: number | null,
  plan: number | null,
  gapThreshold = 0.5,
): SignalKey {
  if (plan === null || plan === 0 || fact === null) return "none";
  const ratio = fact / plan;
  if (ratio >= 1) return ratio > 1 ? "over" : "ok";
  return ratio < gapThreshold ? "gap" : "behind";
}

/** Сколько не хватает до плана — словами, без штриховки на полосе. */
export function shortfallLabel(fact: number, plan: number, unit = ""): string | null {
  const left = plan - fact;
  if (left <= 0) return null;
  const u = unit ? ` ${unit}` : "";
  return `не хватает ${Number.isInteger(left) ? left : left.toFixed(1)}${u}`;
}
