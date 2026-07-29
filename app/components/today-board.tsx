"use client";

import { useEffect, useState } from "react";

/**
 * Главный экран простой версии (ТЗ §4.1): что делаю сегодня и ради чего.
 *
 * Добор шагов живёт здесь же, но появляется только когда день не полон —
 * иначе экран превращается в список, а он должен оставаться решением.
 * Брать можно только из шагов подпроектов: инбокс в день не заходит.
 */

interface Step {
  id: string;
  title: string;
  status: string;
  isTopGoal: boolean;
  firstStep: string | null;
  becomesTrue: string | null;
  estimateMin: number | null;
  goalTitle: string | null;
  goalIcon: string | null;
  subTitle: string | null;
}
interface Available {
  goalId: string;
  goalTitle: string;
  goalIcon: string | null;
  steps: { id: string; title: string; firstStep: string | null; estimateMin: number | null; subTitle: string | null }[];
}
interface GoalName {
  id: string;
  title: string;
  icon: string | null;
  becomesTrue: string | null;
}
interface DayState {
  today: Step[];
  freeSlots: number;
  available: Available[];
  goalNames: GoalName[];
  inboxTotal: number;
}

export function TodayBoard() {
  const [state, setState] = useState<DayState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [swap, setSwap] = useState<{ message: string; options: { id: string; title: string }[] } | null>(null);

  const load = async () => setState(await (await fetch("/api/day")).json());
  useEffect(() => {
    load();
  }, []);

  async function move(id: string, status: string) {
    setBusy(id);
    const res = await fetch(`/api/tasks/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) setSwap({ message: data.error, options: data.offerSwap ?? [] });
    else {
      setSwap(null);
      await load();
    }
    setBusy(null);
  }

  if (!state) return <div className="card" style={{ color: "var(--muted)" }}>Собираю день…</div>;

  const [main, ...rest] = state.today;
  const nothingToTake = state.available.length === 0;

  return (
    <>
      {/* ① что делаю сегодня */}
      {main ? (
        <div className="card" style={{ marginBottom: 11, borderColor: "var(--edge-ok)" }}>
          <div className="num" style={{ fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--s-ok)" }}>
            сейчас
          </div>
          <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.02em", margin: "7px 0 5px" }}>{main.title}</div>
          <div className="num" style={{ fontSize: 12, color: "var(--muted)" }}>
            {[
              main.goalTitle && `${main.goalIcon ?? ""} ${main.goalTitle}`.trim(),
              main.subTitle,
              main.estimateMin && `${main.estimateMin} мин`,
              main.status === "doing" && "в работе",
            ]
              .filter(Boolean)
              .join(" · ") || "без родителя"}
          </div>
          {main.becomesTrue && (
            <div style={{ fontSize: 13, marginTop: 8, color: "var(--muted)" }}>станет правдой: {main.becomesTrue}</div>
          )}
          {main.firstStep && <div style={{ fontSize: 14, marginTop: 6 }}>▶︎ {main.firstStep}</div>}

          <div style={{ display: "flex", gap: 7, marginTop: 13, flexWrap: "wrap" }}>
            {main.status !== "doing" && (
              <button className="btn btn-primary" disabled={busy === main.id} onClick={() => move(main.id, "doing")}>
                В фокус
              </button>
            )}
            <button className="btn" disabled={busy === main.id} onClick={() => move(main.id, "done")}>
              Готово
            </button>
            <button className="btn" disabled={busy === main.id} onClick={() => move(main.id, "inbox")}>
              Снять
            </button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 11 }}>
          <div style={{ fontSize: 17, fontWeight: 650, marginBottom: 4 }}>День ещё не собран</div>
          <div style={{ color: "var(--muted)", fontSize: 13.5 }}>
            {nothingToTake
              ? "Брать нечего: у задач месяца нет шагов. Заведи их на вкладке «Месяц» или разбери инбокс."
              : "Возьми шаг ниже — до трёх на день."}
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <div className="card" style={{ marginBottom: 11 }}>
          {rest.map((t) => (
            <div key={t.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 0", borderTop: "1px solid var(--line)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14 }}>{t.title}</div>
                <div className="num" style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  {[t.goalTitle, t.subTitle].filter(Boolean).join(" · ")}
                </div>
              </div>
              <button className="btn" style={{ padding: "5px 11px", fontSize: 12 }} disabled={busy === t.id} onClick={() => move(t.id, "done")}>
                Готово
              </button>
            </div>
          ))}
        </div>
      )}

      {swap && (
        <div className="card" style={{ marginBottom: 11, borderColor: "var(--edge-warn)" }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>{swap.message}</div>
          {swap.options.map((o) => (
            <div key={o.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 0", borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
              <span style={{ flex: 1, minWidth: 0 }}>{o.title}</span>
              <button className="btn" style={{ padding: "5px 11px", fontSize: 12 }} onClick={() => move(o.id, "inbox")}>
                Снять эту
              </button>
            </div>
          ))}
        </div>
      )}

      {/* добор — только пока есть свободные слоты */}
      {state.freeSlots > 0 && state.available.length > 0 && (
        <div className="card" style={{ marginBottom: 11 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <h2 style={{ fontSize: 15.5, margin: 0 }}>Чем добрать день</h2>
            <span className="num" style={{ fontSize: 11.5, color: "var(--muted)" }}>свободно {state.freeSlots} из 3</span>
          </div>

          {state.available.map((g) => (
            <div key={g.goalId} style={{ marginTop: 9 }}>
              <div className="num" style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--dim)" }}>
                {g.goalIcon} {g.goalTitle}
              </div>
              {g.steps.slice(0, 4).map((s) => (
                <div key={s.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14 }}>{s.title}</div>
                    {(s.subTitle || s.estimateMin) && (
                      <div className="num" style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        {[s.subTitle, s.estimateMin && `${s.estimateMin} мин`].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ padding: "5px 12px", fontSize: 12 }}
                    disabled={busy === s.id}
                    onClick={() => move(s.id, "today")}
                  >
                    Беру
                  </button>
                </div>
              ))}
              {g.steps.length > 4 && (
                <div style={{ paddingTop: 6 }}>
                  <a href={`/goal/${g.goalId}`} style={{ fontSize: 12.5, color: "var(--muted)" }}>
                    ещё {g.steps.length - 4} в задаче →
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ② задачи месяца — только названия */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: state.goalNames.length ? 7 : 0 }}>
          <h2 style={{ fontSize: 15.5, margin: 0 }}>Задачи месяца</h2>
          <a href="/month" style={{ fontSize: 12.5, color: "var(--muted)" }}>открыть →</a>
        </div>

        {state.goalNames.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 7 }}>
            Ни одной задачи месяца. Заведи три-пять на вкладке <a href="/month">Месяц</a>.
          </div>
        ) : (
          state.goalNames.map((g) => (
            <a
              key={g.id}
              href={`/goal/${g.id}`}
              style={{ display: "flex", gap: 9, padding: "6px 0", fontSize: 14, alignItems: "baseline", color: "var(--txt)", textDecoration: "none" }}
            >
              <span style={{ flex: "none" }}>{g.icon ?? "•"}</span>
              <span style={{ color: g.becomesTrue ? "var(--txt)" : "var(--dim)", minWidth: 0 }}>
                {g.becomesTrue || `${g.title} — что станет правдой, не задано`}
              </span>
            </a>
          ))
        )}
      </div>

      {state.inboxTotal > 0 && (
        <p style={{ color: "var(--dim)", fontSize: 12.5, marginTop: 14 }}>
          Не разобрано: {state.inboxTotal} — <a href="/inbox">разобрать</a>
        </p>
      )}
    </>
  );
}
