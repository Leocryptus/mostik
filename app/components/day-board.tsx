"use client";

import { useEffect, useState } from "react";

/**
 * Контур дня: главная задача, сбор из недельных, мелочёвка отдельно.
 *
 * Порядок жёсткий (ТЗ §19.5 и §5.3): день собирается ИЗ ЗАДАЧ НЕДЕЛИ, а инбокс
 * открывается после основного — мелочёвка идёт десертом, а не вместо главного.
 *
 * Правило подачи: один ход за раз. Наверху крупно одна задача, у кандидатов —
 * причина словами. Отказ по лимиту не запрет, а предложение, что снять.
 */

interface DayTask {
  id: string;
  title: string;
  status: string;
  isTopGoal: boolean;
  estimateMin: number | null;
  firstStep: string | null;
  fromWeek: boolean;
}
interface WeeklyCandidate {
  id: string;
  title: string;
  why: string[];
  lowHanging: boolean;
  firstStep: string | null;
  projectTitle: string | null;
  projectIcon: string | null;
}
interface Candidate {
  id: string;
  title: string;
  why: string[];
}
interface DayState {
  today: DayTask[];
  freeSlots: number;
  weekly: WeeklyCandidate[];
  weeklyTotal: number;
  candidates: Candidate[];
  capacity: { state: "ok" | "over"; overBy: number; percent: number };
  streak: { days: number; freezesUsed: number; todayDone: boolean };
  inboxTotal: number;
}

export function DayBoard() {
  const [state, setState] = useState<DayState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [swap, setSwap] = useState<{ message: string; options: { id: string; title: string }[] } | null>(null);
  const [showSmall, setShowSmall] = useState(false);

  const load = async () => setState(await (await fetch("/api/day")).json());
  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: string) {
    setBusy(id);
    const res = await fetch(`/api/tasks/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) {
      setSwap({ message: data.error, options: data.offerSwap ?? [] });
    } else {
      setSwap(null);
      await load();
    }
    setBusy(null);
  }

  if (!state) return <div className="card" style={{ color: "var(--muted)" }}>Собираю день…</div>;

  const top = state.today.find((t) => t.isTopGoal) ?? state.today[0];
  const rest = state.today.filter((t) => t.id !== top?.id);

  return (
    <>
      {/* серия и ёмкость */}
      <div className="card" style={{ marginBottom: 14, display: "flex", gap: 26, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>Серия</div>
          <div className="num" style={{ fontSize: 24, fontWeight: 750, color: state.streak.days ? "var(--s-over)" : "var(--s-none)" }}>
            {state.streak.days} {state.streak.days ? "🔥" : ""}
          </div>
          {state.streak.freezesUsed > 0 && (
            <div style={{ fontSize: 11.5, color: "var(--s-frozen)" }}>заморозок потрачено: {state.streak.freezesUsed}</div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 190 }}>
          <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>
            Ёмкость дня
          </div>
          <div className="track">
            <div
              className="track-fill"
              style={{
                width: `${Math.min(100, state.capacity.percent)}%`,
                background: state.capacity.state === "over" ? "var(--s-behind)" : "var(--s-ok)",
              }}
            />
            {state.capacity.percent < 100 && <div className="track-rest" style={{ left: `${state.capacity.percent}%` }} />}
          </div>
          <div className="num" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 5 }}>
            {state.capacity.percent}% {state.capacity.state === "over" ? `· перебор на ${state.capacity.overBy} мин` : ""}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>Свободно слотов</div>
          <div className="num" style={{ fontSize: 24, fontWeight: 750 }}>{state.freeSlots} / 3</div>
        </div>
      </div>

      {/* главная задача дня */}
      {top ? (
        <div className="card" style={{ marginBottom: 14, borderColor: "rgba(34,211,238,.35)" }}>
          <div className="num" style={{ fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--s-ok)" }}>
            Главная задача дня
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, margin: "6px 0 4px", letterSpacing: "-.015em" }}>{top.title}</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {[
              top.status === "doing" ? "в работе" : "взята в день",
              top.estimateMin ? `${top.estimateMin} мин` : null,
              top.fromWeek ? "из недельных" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          {top.firstStep && <div style={{ fontSize: 13.5, marginTop: 7 }}>▶︎ {top.firstStep}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {top.status !== "doing" && (
              <button className="btn btn-primary" disabled={busy === top.id} onClick={() => setStatus(top.id, "doing")}>
                Взять в фокус
              </button>
            )}
            <button className="btn" disabled={busy === top.id} onClick={() => setStatus(top.id, "done")}>
              Готово
            </button>
            <button className="btn" disabled={busy === top.id} onClick={() => setStatus(top.id, "inbox")}>
              Снять с дня
            </button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 650, marginBottom: 4 }}>День ещё не собран</div>
          <div style={{ color: "var(--muted)", fontSize: 13.5 }}>
            {state.weekly.length
              ? "Возьми задачу из недельных ниже — они уже отранжированы."
              : "На неделю ничего не выбрано. Начни с вкладки «Неделя» — там задаются рамки и основные задачи."}
          </div>
        </div>
      )}

      {/* остальные задачи дня */}
      {rest.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 4 }}>Ещё в дне:</div>
          {rest.map((t) => (
            <div key={t.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--line)", fontSize: 14 }}>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
              <button className="btn" style={{ padding: "5px 11px", fontSize: 12 }} disabled={busy === t.id} onClick={() => setStatus(t.id, "done")}>
                Готово
              </button>
            </div>
          ))}
        </div>
      )}

      {/* предложение обмена при переборе лимита */}
      {swap && (
        <div className="card" style={{ marginBottom: 14, borderColor: "rgba(251,191,36,.4)" }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>{swap.message}</div>
          {swap.options.map((o) => (
            <div key={o.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 0", borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.title}</span>
              <button className="btn" style={{ padding: "5px 11px", fontSize: 12 }} onClick={() => setStatus(o.id, "inbox")}>
                Снять эту
              </button>
            </div>
          ))}
        </div>
      )}

      {/* основное: из задач недели */}
      {state.freeSlots > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <h2 style={{ fontSize: 17, margin: 0 }}>Из недельных</h2>
            <a href="/week" style={{ fontSize: 12.5, color: "var(--muted)" }}>изменить неделю →</a>
          </div>

          {state.weekly.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13.5 }}>
              {state.weeklyTotal === 0
                ? "Основные задачи недели ещё не выбраны — начни с вкладки «Неделя»."
                : "Все недельные уже в дне или закрыты."}
            </div>
          ) : (
            state.weekly.map((c) => (
              <div key={c.id} style={{ display: "flex", gap: 11, alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--line)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14 }}>{c.title}</div>
                  <div className="num" style={{ fontSize: 11.5, color: c.lowHanging ? "var(--s-over)" : "var(--muted)", marginTop: 2 }}>
                    {[c.projectTitle && `${c.projectIcon ?? ""} ${c.projectTitle}`.trim(), ...c.why].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  style={{ padding: "6px 13px", fontSize: 12.5 }}
                  disabled={busy === c.id}
                  onClick={() => setStatus(c.id, "today")}
                >
                  Беру
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* мелочёвка: открывается после основного */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <h2 style={{ fontSize: 17, margin: 0 }}>Мелочёвка из инбокса</h2>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>
              {state.inboxTotal} записей · открывается, когда основное разобрано
            </div>
          </div>
          <button className="btn" style={{ flex: "none" }} onClick={() => setShowSmall((v) => !v)}>
            {showSmall ? "Свернуть" : "Показать"}
          </button>
        </div>

        {showSmall &&
          (state.candidates.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 10 }}>Инбокс пуст — это редкость, поздравляю.</div>
          ) : (
            <div style={{ marginTop: 6 }}>
              {state.candidates.map((c) => (
                <div key={c.id} style={{ display: "flex", gap: 11, alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--line)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                    <div className="num" style={{ fontSize: 11.5, color: "var(--s-behind)", marginTop: 2 }}>{c.why.join(" · ")}</div>
                  </div>
                  <button
                    className="btn"
                    style={{ padding: "6px 13px", fontSize: 12.5 }}
                    disabled={busy === c.id}
                    onClick={() => setStatus(c.id, "today")}
                  >
                    Беру
                  </button>
                </div>
              ))}
            </div>
          ))}
      </div>
    </>
  );
}
