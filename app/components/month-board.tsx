"use client";

import { useState } from "react";
import { SignalMark } from "@/app/components/signal-mark";
import { SIGNALS, type SignalKey } from "@/lib/signals";

/**
 * Вкладка «Проекты»: плитки с кольцами (визуал одобрен Лео, ТЗ §19.4).
 *
 * Кольцо = ведущее число за неделю: то, что Лео делает сам и контролирует.
 * Всё, что правится руками — цель, шаг, ведущее число — правится прямо здесь,
 * чтобы экран обзора «Месяц» оставался только цифрами.
 */

export interface ProjectCard {
  id: string;
  title: string;
  icon: string | null;
  status: string;
  monthGoal: string | null;
  nextStep: string | null;
  potentialUsd: number | null;
  owner: string | null;
  leadMetric: string | null;
  leadTarget: number | null;
  leadFact: number;
  signal: SignalKey;
  silentDays: number;
}

const money = (n: number) => "$" + n.toLocaleString("ru-RU").replace(/,/g, " ");

export function MonthBoard({ projects }: { projects: ProjectCard[] }) {
  const [items, setItems] = useState(projects);
  const [edit, setEdit] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [swap, setSwap] = useState<{ message: string; options: { id: string; title: string }[] } | null>(null);

  async function save(id: string, patch: Record<string, string>) {
    setBusy(true);
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 409) {
      setSwap({ message: data.error, options: data.offerSwap ?? [] });
    } else if (res.ok) {
      setSwap(null);
      setItems((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                ...data.project,
                leadMetric: patch.leadMetric ?? p.leadMetric,
                leadTarget: patch.leadTarget ? Number(patch.leadTarget) : p.leadTarget,
              }
            : p,
        ),
      );
      setEdit(null);
    }
    setBusy(false);
  }

  async function step(id: string) {
    setBusy(true);
    await fetch(`/api/projects/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, leadFact: p.leadFact + 1, signal: "ok", silentDays: 0 } : p)));
    setBusy(false);
  }

  const active = items.filter((p) => p.status === "work");
  const rest = items.filter((p) => p.status !== "work");

  return (
    <>
      {active.length === 0 && (
        <div className="card" style={{ marginBottom: 14, borderColor: "rgba(251,191,36,.35)" }}>
          <div style={{ fontSize: 17, fontWeight: 650, marginBottom: 4 }}>Проекты месяца ещё не выбраны</div>
          <div style={{ color: "var(--muted)", fontSize: 13.5 }}>
            Отметь три-пять, за которые рубишься этот месяц. По каждому задай цель, ведущее число и один следующий шаг —
            дальше система будет держать их сама.
          </div>
        </div>
      )}

      {swap && (
        <div className="card" style={{ marginBottom: 14, borderColor: "rgba(251,191,36,.4)" }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>{swap.message}</div>
          {swap.options.map((o) => (
            <div key={o.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 0", borderTop: "1px solid var(--line)", fontSize: 13.5 }}>
              <span style={{ flex: 1, minWidth: 0 }}>{o.title}</span>
              <button className="btn" style={{ padding: "5px 11px", fontSize: 12 }} onClick={() => save(o.id, { status: "pause" })}>
                Снять этот
              </button>
            </div>
          ))}
        </div>
      )}

      {/* активные — плитки с кольцами */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(272px, 1fr))", gap: 12, marginBottom: 20 }}>
        {active.map((p) => {
          const isEditing = edit === p.id;
          const pct = p.leadTarget ? Math.min(100, Math.round((p.leadFact / p.leadTarget) * 100)) : 0;

          return (
            <div key={p.id} className="card" style={{ borderColor: "rgba(34,211,238,.28)" }}>
              <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
                <Ring percent={pct} color={SIGNALS[p.signal].color} label={p.leadTarget ? `${p.leadFact}/${p.leadTarget}` : "—"} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                    <SignalMark signal={p.signal} />
                    <span style={{ fontSize: 15.5, fontWeight: 650, minWidth: 0 }}>
                      {p.icon} {p.title}
                    </span>
                  </div>
                  <div className="num" style={{ fontSize: 11.5, color: p.potentialUsd ? "var(--s-ok)" : "var(--s-none)", marginTop: 3 }}>
                    {p.potentialUsd ? `${money(p.potentialUsd)} / мес` : "цифры нет"}
                    {p.owner ? ` · ${p.owner}` : ""}
                  </div>
                  <div className="num" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                    {p.leadMetric ? `${p.leadMetric} за неделю` : "ведущее число не задано"}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: 13.5, color: p.monthGoal ? "var(--txt)" : "var(--dim)" }}>
                🎯 {p.monthGoal || "цель месяца не задана"}
              </div>
              <div style={{ marginTop: 5, fontSize: 13, color: p.nextStep ? "var(--txt)" : "var(--dim)" }}>
                ➡️ {p.nextStep || "следующий шаг не задан"}
              </div>
              {p.silentDays > 7 && (
                <div className="num" style={{ marginTop: 6, fontSize: 12, color: "var(--s-dead)" }}>
                  молчит {p.silentDays} дней
                </div>
              )}

              <div style={{ display: "flex", gap: 7, marginTop: 12, flexWrap: "wrap" }}>
                <button className="btn btn-primary" disabled={busy} onClick={() => step(p.id)} style={{ padding: "6px 13px", fontSize: 12.5 }}>
                  Сделал шаг
                </button>
                <button className="btn" onClick={() => setEdit(isEditing ? null : p.id)} style={{ padding: "6px 13px", fontSize: 12.5 }}>
                  {isEditing ? "Свернуть" : "Править"}
                </button>
                <a
                  href="/week"
                  className="btn"
                  style={{ padding: "6px 13px", fontSize: 12.5, textDecoration: "none", color: "var(--txt)" }}
                >
                  Задачи недели
                </a>
              </div>

              {isEditing && <EditForm p={p} busy={busy} onSave={(patch) => save(p.id, patch)} />}
            </div>
          );
        })}
      </div>

      {/* остальные — свёрнуты, берутся в месяц одной кнопкой */}
      {rest.length > 0 && (
        <>
          <div className="num" style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--dim)", margin: "0 0 9px" }}>
            не в этом месяце · {rest.length}
          </div>
          <div className="card">
            {rest.map((p) => (
              <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 0", borderTop: "1px solid var(--line)" }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: "var(--muted)" }}>
                  {p.icon} {p.title}
                </span>
                <span className="num" style={{ fontSize: 11.5, color: "var(--s-none)" }}>
                  {p.potentialUsd ? money(p.potentialUsd) : ""}
                </span>
                <button className="btn" disabled={busy} onClick={() => save(p.id, { status: "work" })} style={{ padding: "5px 12px", fontSize: 12 }}>
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

/** Кольцо ведущего числа. Цифра внутри — факт из цели, а не абстрактный процент. */
function Ring({ percent, color, label }: { percent: number; color: string; label: string }) {
  const r = 25;
  const c = 2 * Math.PI * r;
  return (
    <svg width="62" height="62" viewBox="0 0 62 62" role="img" aria-label={`выполнено ${percent}%`} style={{ flex: "none" }}>
      <circle cx="31" cy="31" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
      <circle
        cx="31"
        cy="31"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${(c * percent) / 100} ${c}`}
        transform="rotate(-90 31 31)"
        style={{ filter: `drop-shadow(0 0 5px ${color}66)` }}
      />
      <text x="31" y="35" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--txt)" fontFamily="var(--mono)">
        {label}
      </text>
    </svg>
  );
}

function EditForm({ p, busy, onSave }: { p: ProjectCard; busy: boolean; onSave: (patch: Record<string, string>) => void }) {
  return (
    <form
      style={{ marginTop: 12, display: "grid", gap: 8 }}
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave({
          monthGoal: String(f.get("monthGoal") ?? ""),
          nextStep: String(f.get("nextStep") ?? ""),
          leadMetric: String(f.get("leadMetric") ?? ""),
          leadTarget: String(f.get("leadTarget") ?? ""),
        });
      }}
    >
      <Field name="monthGoal" label="Цель месяца — что станет правдой к концу" def={p.monthGoal ?? ""} />
      <Field name="nextStep" label="Следующий шаг — одно действие" def={p.nextStep ?? ""} />
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 2 }}>
          <Field name="leadMetric" label="Ведущее число — что делаешь на неделе" def={p.leadMetric ?? ""} />
        </div>
        <div style={{ width: 92 }}>
          <Field name="leadTarget" label="Сколько" def={p.leadTarget ? String(p.leadTarget) : ""} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-primary" disabled={busy} type="submit" style={{ padding: "7px 15px" }}>
          Сохранить
        </button>
        <button className="btn" disabled={busy} type="button" onClick={() => onSave({ status: "pause" })} style={{ padding: "7px 15px" }}>
          Снять с месяца
        </button>
      </div>
    </form>
  );
}

function Field({ name, label, def }: { name: string; label: string; def: string }) {
  return (
    <label style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>
      {label}
      <input
        name={name}
        defaultValue={def}
        style={{
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
        }}
      />
    </label>
  );
}
