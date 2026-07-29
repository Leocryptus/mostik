"use client";

import { useState } from "react";

/** Задачи, выбранные на день. Главный экран — только они, кнопками (ТЗ §19.1). */
export interface DayTask {
  id: string;
  title: string;
  status: string;
  forWhom: string | null;
  firstStep: string | null;
  estimateMin: number | null;
}

export function TodayTasks({ tasks }: { tasks: DayTask[] }) {
  const [items, setItems] = useState(tasks);
  const [busy, setBusy] = useState<string | null>(null);

  async function set(id: string, status: string) {
    setBusy(id);
    const res = await fetch(`/api/tasks/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setItems((prev) => (status === "doing" ? prev.map((t) => (t.id === id ? { ...t, status } : t)) : prev.filter((t) => t.id !== id)));
    }
    setBusy(null);
  }

  if (items.length === 0) {
    return (
      <div className="card" style={{ marginBottom: 13 }}>
        <div style={{ fontSize: 17, fontWeight: 650 }}>На сегодня ничего не выбрано</div>
        <div style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 4 }}>
          Собери день на вкладке <a href="/inbox">День</a> — система покажет, что важнее всего из инбокса.
        </div>
      </div>
    );
  }

  const [main, ...rest] = items;

  return (
    <>
      <div className="card" style={{ marginBottom: 11, borderColor: "rgba(34,211,238,.32)" }}>
        <div className="num" style={{ fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--s-ok)" }}>
          Главная задача
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.02em", margin: "7px 0 5px" }}>{main.title}</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
          {[main.forWhom && `ждёт ${main.forWhom}`, main.estimateMin && `${main.estimateMin} мин`, main.status === "doing" && "в работе"]
            .filter(Boolean)
            .join(" · ") || "без срока"}
        </div>
        {main.firstStep && <div style={{ fontSize: 13.5, marginTop: 6 }}>▶︎ {main.firstStep}</div>}
        <div style={{ display: "flex", gap: 7, marginTop: 12, flexWrap: "wrap" }}>
          {main.status !== "doing" && (
            <button className="btn btn-primary" disabled={busy === main.id} onClick={() => set(main.id, "doing")}>
              В фокус
            </button>
          )}
          <button className="btn" disabled={busy === main.id} onClick={() => set(main.id, "done")}>
            Готово
          </button>
          <button className="btn" disabled={busy === main.id} onClick={() => set(main.id, "inbox")}>
            Снять
          </button>
        </div>
      </div>

      {rest.length > 0 && (
        <div className="card" style={{ marginBottom: 13 }}>
          {rest.map((t) => (
            <div key={t.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 0", borderTop: "1px solid var(--line)", fontSize: 14 }}>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
              <button className="btn" style={{ padding: "5px 11px", fontSize: 12 }} disabled={busy === t.id} onClick={() => set(t.id, "done")}>
                Готово
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
