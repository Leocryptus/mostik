import { SIGNALS, type SignalKey } from "@/lib/signals";

/**
 * Значок сигнала. Форма несёт то же значение, что и цвет —
 * поэтому состояние читается и без различения цветов.
 */
export function SignalMark({ signal, size = 12 }: { signal: SignalKey; size?: number }) {
  const s = SIGNALS[signal];
  const c = s.color;

  const shape = {
    circle: <circle cx="6" cy="6" r="5" fill={c} />,
    triangle: <path d="M6 0l6 10H0z" fill={c} />,
    bar: <rect x="1" y="4" width="10" height="4" rx="1" fill={c} />,
    pulse: <path d="M1 6h3l2-4 2 8 2-4h1" stroke={c} strokeWidth="1.6" fill="none" />,
    ring: (
      <>
        <circle cx="6" cy="6" r="5" fill="none" stroke={c} strokeWidth="2" />
        <circle cx="6" cy="6" r="1.6" fill={c} />
      </>
    ),
    snow: <path d="M6 1v10M1.5 3.5l9 5M10.5 3.5l-9 5" stroke={c} strokeWidth="1.5" />,
    dash: <path d="M2 6h8" stroke={c} strokeWidth="2" strokeDasharray="2 2" />,
  }[s.shape];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      role="img"
      aria-label={s.label}
      style={{ flex: "none" }}
    >
      {shape}
    </svg>
  );
}
