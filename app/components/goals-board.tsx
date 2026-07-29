"use client";

import { useEffect, useState } from "react";
import { STATE_LABEL, type SimpleState } from "@/lib/simple";
import type { GoalView } from "@/lib/goals";

/**
 * Вкладка «Месяц» (ТЗ §4.2): 3–5 карточек задач месяца.
 *
 * На карточке ровно то, что нужно для решения: что станет правдой, кольцо
 * прогресса по OKR, ключевые результаты и подпроекты со следующим шагом.
 * Вся глубина — по клику, на странице задачи.
 */

/** Форма данных задаётся на сервере в lib/goals.ts — здесь только тип, чтобы
 *  экраны не расходились с тем, что реально приходит из ручки. */
export type Goal = GoalView;

const money = (n: number) => "$" + n.toLocaleString("ru-RU").replace(/,/g, " ");
const STATE_COLOR: Record<SimpleState, string> = {
  moving: "var(--s-ok)",
  behind: "var(--s-behind)",
  silent: "var(--s-dead)",
};

export function GoalsBoard() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [swap, setSwap] = useState<{ message: string; options: { id: string; title: string }[] } | null>(null);

  const load = async () => setGoals((await (await fetch("/api/goals")).json()).goals);
  useEffect(() => {
    load();
  }, []);

  async function patch(id: string, body: Record<string, string>) {
    setBusy(id);
    const res = await fetch(`/api/goals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) setSwap({ message: data.error, options: data.offerSwap ?? [] });
    else {
      setSwap(null);
      setEdit(null);
      await load();
    }
    setBusy(null);
  }

  async function act(id: string, body: Record<string, unknown>) {
    setBusy(id);
    await fetch(`/api/goals/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await load();
    setBusy(null);
  }

  async function create(title: string) {
    setBusy("new");
    await fetch("/api/goals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    setAdding(false);
    await load();
    setBusy(null);
  }

  if (!goals) return <div className="card" style={{ color: "var(--muted)" }}>Собираю месяц…</div>;

  const active = goals.filter((g) => g.status === "work");
  const rest = goals.filter((g) => g.status !== "work");

  return (
    <>
      {swap && (
        <div className="card" style={{ marginBottom: 13, borderColor: "var(--edge-warn)" }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>{swap.message}</div>
          {swap.options.map((o) => (
            <div key={o.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 0", borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
              <span style={{ flex: 1, minWidth: 0 }}>{o.title}</span>
              <button className="btn" style={{ padding: "5px 11px", fontSize: 12 }} onClick={() => patch(o.id, { status: "pause" })}>
                Снять эту
              </button>
            </div>
          ))}
        </div>
      )}

      {active.length === 0 && (
        <div className="card" style={{ marginBottom: 13, borderColor: "var(--edge-warn)" }}>
          <div style={{ fontSize: 17, fontWeight: 650, marginBottom: 4 }}>Задач месяца нет</div>
          <div style={{ color: "var(--muted)", fontSize: 13.5 }}>
            Заведи три-пять крупных штук, ради которых этот месяц вообще есть.
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12, marginBottom: 20 }}>
        {active.map((g) => {
          const metricPct = g.metricTarget ? Math.min(100, Math.round((g.metricFact / g.metricTarget) * 100)) : 0;
          const openSteps = g.subprojects.reduce((s, x) => s + x.openCount, 0) + g.looseSteps.length;

          return (
            <div key={g.id} className="card" style={{ borderColor: "var(--edge-ok)" }}>
              <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
                <Ring percent={g.progress} color={STATE_COLOR[g.state]} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a href={`/goal/${g.id}`} style={{ fontSize: 16, fontWeight: 650, color: "var(--txt)", textDecoration: "none" }}>
                    {g.icon} {g.title}
                  </a>
                  <div className="num" style={{ fontSize: 11.5, color: STATE_COLOR[g.state], marginTop: 3 }}>
                    {STATE_LABEL[g.state]}
                    {g.silentDays !== null && g.silentDays > 14 ? ` · ${g.silentDays} дн без фактов` : ""}
                  </div>
                  <div className="num" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                    {[g.potentialUsd ? `${money(g.potentialUsd)} / мес` : null, g.owner].filter(Boolean).join(" · ") || "цифры нет"}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: 13.5, color: g.becomesTrue ? "var(--txt)" : "var(--dim)" }}>
                🎯 {g.becomesTrue || "что станет правдой — не задано"}
              </div>

              {g.metricName && (
                <div style={{ marginTop: 9 }}>
                  <div className="track">
                    <div className="track-fill" style={{ width: `${metricPct}%`, background: STATE_COLOR[g.state] }} />
                    {metricPct < 100 && <div className="track-rest" style={{ left: `${metricPct}%` }} />}
                  </div>
                  <div className="num" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 5 }}>
                    {g.metricName}: {g.metricFact}
                    {g.metricTarget ? ` из ${g.metricTarget}` : ""}
                  </div>
                </div>
              )}

              {g.krs.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  {g.krs.map((k) => (
                    <div key={k.id} className="num" style={{ fontSize: 12, color: "var(--muted)", padding: "2px 0" }}>
                      · {k.name} — <b style={{ color: "var(--txt)" }}>{k.current}</b> из {k.target} {k.unit ?? ""}
                    </div>
                  ))}
                </div>
              )}

              <div className="num" style={{ fontSize: 11.5, color: "var(--dim)", marginTop: 9 }}>
                подпроектов {g.subprojects.length} · открытых шагов {openSteps}
              </div>

              <div style={{ display: "flex", gap: 7, marginTop: 11, flexWrap: "wrap" }}>
                <a href={`/goal/${g.id}`} className="btn btn-primary" style={{ padding: "6px 13px", fontSize: 12.5, textDecoration: "none" }}>
                  Открыть
                </a>
                <button className="btn" disabled={busy === g.id} onClick={() => act(g.id, { action: "fact" })} style={{ padding: "6px 13px", fontSize: 12.5 }}>
                  Сделал шаг
                </button>
                <button className="btn" onClick={() => setEdit(edit === g.id ? null : g.id)} style={{ padding: "6px 13px", fontSize: 12.5 }}>
                  {edit === g.id ? "Свернуть" : "Править"}
                </button>
              </div>

              {edit === g.id && (
                <form
                  style={{ marginTop: 12, display: "grid", gap: 8 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    patch(g.id, {
                      title: String(f.get("title") ?? ""),
                      icon: String(f.get("icon") ?? ""),
                      becomesTrue: String(f.get("becomesTrue") ?? ""),
                      owner: String(f.get("owner") ?? ""),
                      potentialUsd: String(f.get("potentialUsd") ?? ""),
                      metricName: String(f.get("metricName") ?? ""),
                      metricTarget: String(f.get("metricTarget") ?? ""),
                    });
                  }}
                >
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ width: 64 }}><Field name="icon" label="Значок" def={g.icon ?? ""} /></div>
                    <div style={{ flex: 1 }}><Field name="title" label="Название" def={g.title} /></div>
                  </div>
                  <Field name="becomesTrue" label="Что станет правдой к концу месяца" def={g.becomesTrue ?? ""} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 2 }}><Field name="metricName" label="Метрика — что докажет движение" def={g.metricName ?? ""} /></div>
                    <div style={{ width: 88 }}><Field name="metricTarget" label="Сколько" def={g.metricTarget ? String(g.metricTarget) : ""} /></div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}><Field name="owner" label="Кто ведёт" def={g.owner ?? ""} /></div>
                    <div style={{ width: 120 }}><Field name="potentialUsd" label="$ в месяц" def={g.potentialUsd ? String(g.potentialUsd) : ""} /></div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn btn-primary" type="submit" disabled={busy === g.id} style={{ padding: "7px 15px" }}>
                      Сохранить
                    </button>
                    <button className="btn" type="button" disabled={busy === g.id} onClick={() => patch(g.id, { status: "pause" })} style={{ padding: "7px 15px" }}>
                      Снять с месяца
                    </button>
                  </div>
                </form>
              )}
            </div>
          );
        })}
      </div>

      {/* завести новую */}
      {adding ? (
        <form
          className="card"
          style={{ marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap" }}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const t = String(f.get("title") ?? "").trim();
            if (t) create(t);
          }}
        >
          <input name="title" autoFocus placeholder="Ради чего этот месяц" style={{ ...inputStyle, marginTop: 0, flex: 1, minWidth: 200 }} />
          <button className="btn btn-primary" type="submit" disabled={busy === "new"}>Завести</button>
          <button className="btn" type="button" onClick={() => setAdding(false)}>Отмена</button>
        </form>
      ) : (
        <button className="btn" onClick={() => setAdding(true)} style={{ marginBottom: 18 }}>
          + задача месяца
        </button>
      )}

      {rest.length > 0 && (
        <>
          <div className="num" style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--dim)", margin: "0 0 9px" }}>
            не в этом месяце · {rest.length}
          </div>
          <div className="card">
            {rest.map((g) => (
              <div key={g.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 0", borderTop: "1px solid var(--line)" }}>
                <a href={`/goal/${g.id}`} style={{ flex: 1, minWidth: 0, fontSize: 14, color: "var(--muted)", textDecoration: "none" }}>
                  {g.icon} {g.title}
                </a>
                <span className="num" style={{ fontSize: 11.5, color: "var(--s-none)" }}>
                  {g.potentialUsd ? money(g.potentialUsd) : ""}
                </span>
                <button className="btn" disabled={busy === g.id} onClick={() => patch(g.id, { status: "work" })} style={{ padding: "5px 12px", fontSize: 12 }}>
                  Взять в месяц
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** Кольцо прогресса по ключевым результатам. Внутри — процент, он тут честный. */
function Ring({ percent, color }: { percent: number; color: string }) {
  const r = 25;
  const c = 2 * Math.PI * r;
  return (
    <svg width="62" height="62" viewBox="0 0 62 62" role="img" aria-label={`выполнено ${percent}%`} style={{ flex: "none" }}>
      <circle cx="31" cy="31" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
      <circle
        cx="31" cy="31" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${(c * percent) / 100} ${c}`} transform="rotate(-90 31 31)"
        style={{ filter: `drop-shadow(0 0 5px ${color}66)` }}
      />
      <text x="31" y="36" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--txt)" fontFamily="var(--mono)">
        {percent}
      </text>
    </svg>
  );
}

export const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  background: "var(--card-2)",
  border: "1px solid var(--line)",
  borderRadius: 9,
  color: "var(--txt)",
  font: "inherit",
  fontSize: 13.5,
  padding: "8px 11px",
};

export function Field({ name, label, def }: { name: string; label: string; def: string }) {
  return (
    <label style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>
      {label}
      <input name={name} defaultValue={def} style={inputStyle} />
    </label>
  );
}
