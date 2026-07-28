"use client";

import { useState } from "react";
import { SignalMark } from "@/app/components/signal-mark";
import type { SignalKey } from "@/lib/signals";

/**
 * Главный экран: проекты месяца. Три-пять штук, у каждого одна строка цели,
 * ведущее число и ОДИН следующий шаг. Всё остальное — глубже, по клику.
 *
 * Инбокс сюда не лезет: мелочёвка открывается после основного (ТЗ §5.3).
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

  async function save(id: string, patch: Record<string, string>) {
    setBusy(true);
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const { project } = await res.json();
      setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...project, leadMetric: patch.leadMetric ?? p.leadMetric, leadTarget: patch.leadTarget ? Number(patch.leadTarget) : p.leadTarget } : p)));
      setEdit(null);
    }
    setBusy(false);
  }

  async function step(id: string) {
    setBusy(true);
    await fetch(`/api/projects/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
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
            Отметь три-пять, за которые рубишься этот месяц. По каждому задай цель, ведущее число и один следующий шаг — дальше система будет держать их сама.
          </div>
        </div>
      )}

      {[...active, ...rest].map((p) => {
        const isEditing = edit === p.id;
        const isActive = p.status === "work";
        return (
          <div
            key={p.id}
            className="card"
            style={{ marginBottom: 12, opacity: isActive ? 1 : 0.72, borderColor: isActive ? "rgba(34,211,238,.28)" : "var(--line)" }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <SignalMark signal={isActive ? p.signal : "none"} />
              <span style={{ fontSize: 17, fontWeight: 650, flex: 1, minWidth: 0 }}>
                {p.icon} {p.title}
              </span>
              <span className="num" style={{ fontSize: 12.5, color: p.potentialUsd ? "var(--s-ok)" : "var(--s-none)" }}>
                {p.potentialUsd ? money(p.potentialUsd) + " / мес" : "цифры нет"}
              </span>
            </div>

            {isActive && (
              <div style={{ marginTop: 8, fontSize: 13.5 }}>
                <div style={{ color: p.monthGoal ? "var(--txt)" : "var(--dim)" }}>
                  🎯 {p.monthGoal || "цель месяца не задана"}
                </div>
                {p.leadMetric && (
                  <div className="num" style={{ marginTop: 4, color: "var(--muted)", fontSize: 13 }}>
                    📈 {p.leadMetric}: <b style={{ color: "var(--s-ok)" }}>{p.leadFact}</b>
                    {p.leadTarget ? ` из ${p.leadTarget} за неделю` : ""}
                  </div>
                )}
                <div style={{ marginTop: 6, color: p.nextStep ? "var(--txt)" : "var(--dim)" }}>
                  ➡️ {p.nextStep || "следующий шаг не задан"}
                </div>
                {p.silentDays > 7 && (
                  <div className="num" style={{ marginTop: 5, fontSize: 12.5, color: "var(--s-dead)" }}>
                    молчит {p.silentDays} дней
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
              {isActive ? (
                <>
                  <button className="btn btn-primary" disabled={busy} onClick={() => step(p.id)} style={{ padding: "6px 13px", fontSize: 12.5 }}>
                    Сделал шаг
                  </button>
                  <button className="btn" onClick={() => setEdit(isEditing ? null : p.id)} style={{ padding: "6px 13px", fontSize: 12.5 }}>
                    {isEditing ? "Свернуть" : "Править"}
                  </button>
                </>
              ) : (
                <button className="btn" disabled={busy} onClick={() => save(p.id, { status: "work" })} style={{ padding: "6px 13px", fontSize: 12.5 }}>
                  Взять в месяц
                </button>
              )}
            </div>

            {isEditing && (
              <form
                style={{ marginTop: 12, display: "grid", gap: 8 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  save(p.id, {
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
                <button className="btn btn-primary" disabled={busy} type="submit" style={{ justifySelf: "start", padding: "7px 15px" }}>
                  Сохранить
                </button>
              </form>
            )}
          </div>
        );
      })}
    </>
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
