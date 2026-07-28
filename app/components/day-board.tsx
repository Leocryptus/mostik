"use client";

import { useEffect, useState } from "react";
import { SignalMark } from "@/app/components/signal-mark";

/**
 * Контур дня на мостике: главная задача, кандидаты кнопками, ёмкость, серия.
 *
 * Правило подачи: один ход за раз. Наверху крупно одна задача, кандидатов
 * ровно три с причиной, почему они наверху. Отказ по лимиту — не запрет,
 * а предложение, что снять.
 */

interface DayTask {
  id: string;
  title: string;
  status: string;
  isTopGoal: boolean;
  estimateMin: number | null;
}
interface Candidate {
  id: string;
  title: string;
  why: string[];
}
interface DayState {
  today: DayTask[];
  freeSlots: number;
  candidates: Candidate[];
  capacity: { state: "ok" | "over"; overBy: number; percent: number };
  streak: { days: number; freezesUsed: number; todayDone: boolean };
  inboxTotal: number;
}

export function DayBoard() {
  const [state, setState] = useState<DayState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [swap, setSwap] = useState<{ message: string; options: { id: string; title: string }[] } | null>(null);

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
    const data = await res.json();
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
            {top.status === "doing" ? "в работе" : "взята в день"}
            {top.estimateMin ? ` · ${top.estimateMin} мин` : ""}
          </div>
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
            Возьми одну из трёх задач ниже — система уже посчитала, какие важнее.
          </div>
        </div>
      )}

      {/* остальные задачи дня */}
      {rest.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8 }}>Ещё в дне:</div>
          {rest.map((t) => (
            <div key={t.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--line)", fontSize: 14 }}>
              <SignalMark signal="ok" />
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

      {/* кандидаты */}
      {state.freeSlots > 0 && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <h2 style={{ fontSize: 17, margin: 0 }}>Что взять</h2>
            <span className="num" style={{ fontSize: 12.5, color: "var(--muted)" }}>из {state.inboxTotal} в инбоксе</span>
          </div>
          {state.candidates.map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 11, alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--line)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                <div className="num" style={{ fontSize: 11.5, color: "var(--s-behind)", marginTop: 2 }}>{c.why.join(" · ")}</div>
              </div>
              <button className="btn btn-primary" style={{ padding: "6px 13px", fontSize: 12.5 }} disabled={busy === c.id} onClick={() => setStatus(c.id, "today")}>
                Беру
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
