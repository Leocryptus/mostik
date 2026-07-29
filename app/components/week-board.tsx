"use client";

import { useEffect, useState } from "react";

/**
 * Неделя: рамки и выбор основных задач.
 *
 * Порядок на экране = порядок решения: сначала рамки (три камня и чего НЕ делаю),
 * потом выбор задач из проектов месяца. Кандидаты приходят с ранга 20/80 и с
 * причиной словами — приоритизировать руками Лео не должен.
 */

interface WeekTask {
  id: string;
  title: string;
  status: string;
  estimateMin: number | null;
  projectTitle: string | null;
  projectIcon: string | null;
  inDay: boolean;
  done: boolean;
}

interface Candidate {
  id: string;
  title: string;
  why: string[];
  lowHanging: boolean;
}

interface PoolProject {
  id: string;
  title: string;
  icon: string | null;
  monthGoal: string | null;
  leadMetric: string | null;
  candidates: Candidate[];
  total: number;
}

interface WeekState {
  weekStart: string;
  label: string;
  daysLeft: number;
  stones: string[];
  stopList: string[];
  tasks: WeekTask[];
  projects: PoolProject[];
  unassigned: Candidate[];
  unassignedTotal: number;
}

export function WeekBoard() {
  const [state, setState] = useState<WeekState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  /** какому проекту отдать задачу из старого инбокса при взятии в неделю */
  const [assign, setAssign] = useState<Record<string, string>>({});

  const load = async () => setState(await (await fetch("/api/week")).json());
  useEffect(() => {
    load();
  }, []);

  async function saveFrames(patch: { stones?: string[]; stopList?: string[] }) {
    setBusy("frames");
    const res = await fetch("/api/week", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = await res.json();
      setState((s) => (s ? { ...s, stones: data.stones, stopList: data.stopList } : s));
    }
    setBusy(null);
  }

  async function toggleTask(taskId: string, on: boolean, projectId?: string) {
    setBusy(taskId);
    await fetch("/api/week/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, on, projectId }),
    });
    await load();
    setBusy(null);
  }

  async function addTask(projectId: string, title: string, estimateMin?: number) {
    setBusy(projectId);
    await fetch("/api/week/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, title, estimateMin }),
    });
    setAdding(null);
    await load();
    setBusy(null);
  }

  if (!state) return <div className="card" style={{ color: "var(--muted)" }}>Собираю неделю…</div>;

  const closed = state.tasks.filter((t) => t.done).length;

  return (
    <>
      {/* рамки недели */}
      <div className="card" style={{ marginBottom: 13 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 3px" }}>Три камня недели</h2>
        <p style={{ color: "var(--muted)", fontSize: 12.5, margin: "0 0 11px" }}>
          Крупное, ради чего неделя. Если сделано только это — неделя удалась.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            saveFrames({ stones: [0, 1, 2].map((i) => String(f.get(`stone${i}`) ?? "")) });
          }}
        >
          {[0, 1, 2].map((i) => (
            <input
              key={i}
              name={`stone${i}`}
              defaultValue={state.stones[i] ?? ""}
              placeholder={`Камень ${i + 1}`}
              style={inputStyle}
            />
          ))}
          <button className="btn btn-primary" type="submit" disabled={busy === "frames"} style={{ marginTop: 9, padding: "7px 15px" }}>
            Сохранить рамки
          </button>
        </form>
      </div>

      {/* стоп-лист */}
      <div className="card" style={{ marginBottom: 13 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 3px" }}>Чего на этой неделе не делаю</h2>
        <p style={{ color: "var(--muted)", fontSize: 12.5, margin: "0 0 10px" }}>
          Названное вслух не тянет внимание. Это не отказ навсегда — только на неделю.
        </p>

        {state.stopList.map((s, i) => (
          <div key={`${s}-${i}`} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 0", borderTop: "1px solid var(--line)" }}>
            <span className="t-struck" style={{ flex: 1, minWidth: 0, fontSize: 13.5 }}>{s}</span>
            <button
              className="btn"
              style={{ padding: "4px 10px", fontSize: 12 }}
              disabled={busy === "frames"}
              onClick={() => saveFrames({ stopList: state.stopList.filter((_, j) => j !== i) })}
            >
              Вернуть
            </button>
          </div>
        ))}

        <form
          style={{ display: "flex", gap: 8, marginTop: 10 }}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const v = String(f.get("stop") ?? "").trim();
            if (v) saveFrames({ stopList: [...state.stopList, v] });
            e.currentTarget.reset();
          }}
        >
          <input name="stop" placeholder="Например: не открываю новые проекты" style={{ ...inputStyle, marginTop: 0, flex: 1 }} />
          <button className="btn" type="submit" disabled={busy === "frames"} style={{ flex: "none" }}>
            Добавить
          </button>
        </form>
      </div>

      {/* выбранные основные задачи */}
      <div className="card" style={{ marginBottom: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Основные задачи недели</h2>
          <span className="num" style={{ fontSize: 12, color: "var(--muted)" }}>
            выбрано {state.tasks.length}
            {closed ? ` · закрыто ${closed}` : ""}
          </span>
        </div>

        {state.tasks.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13.5 }}>
            Пока пусто. Возьми главное из проектов месяца ниже — эти задачи станут ядром главного экрана.
          </div>
        ) : (
          state.tasks.map((t) => (
            <div key={t.id} style={{ display: "flex", gap: 11, alignItems: "center", padding: "9px 0", borderTop: "1px solid var(--line)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: t.done ? "var(--dim)" : "var(--txt)", textDecoration: t.done ? "line-through" : "none" }}>
                  {t.title}
                </div>
                <div className="num" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                  {[
                    t.projectTitle && `${t.projectIcon ?? ""} ${t.projectTitle}`.trim(),
                    t.estimateMin && `${t.estimateMin} мин`,
                    t.done ? "закрыта" : t.inDay ? "в дне" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "без проекта"}
                </div>
              </div>
              <button className="btn" style={{ padding: "5px 11px", fontSize: 12 }} disabled={busy === t.id} onClick={() => toggleTask(t.id, false)}>
                Снять с недели
              </button>
            </div>
          ))
        )}
      </div>

      {/* пул: что можно взять из проектов месяца */}
      <div className="num" style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--dim)", margin: "18px 0 9px" }}>
        взять из проектов месяца
      </div>

      {state.projects.length === 0 && (
        <div className="card" style={{ color: "var(--muted)", fontSize: 13.5 }}>
          Активных проектов нет. Возьми три-пять в месяц на вкладке <a href="/projects">Проекты</a>.
        </div>
      )}

      {state.projects.map((p) => (
        <div key={p.id} className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
            <span style={{ fontSize: 15.5, fontWeight: 650 }}>
              {p.icon} {p.title}
            </span>
            <span className="num" style={{ fontSize: 11.5, color: "var(--muted)", marginLeft: "auto" }}>
              {p.total > p.candidates.length ? `${p.candidates.length} из ${p.total}` : `${p.total} в запасе`}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: p.monthGoal ? "var(--muted)" : "var(--dim)", marginTop: 3 }}>
            🎯 {p.monthGoal || "цель месяца не задана"}
          </div>

          {p.candidates.map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 11, alignItems: "center", padding: "9px 0", borderTop: "1px solid var(--line)", marginTop: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14 }}>{c.title}</div>
                <div className="num" style={{ fontSize: 11.5, color: c.lowHanging ? "var(--s-over)" : "var(--s-behind)", marginTop: 2 }}>
                  {c.why.join(" · ")}
                </div>
              </div>
              <button
                className="btn btn-primary"
                style={{ padding: "5px 12px", fontSize: 12 }}
                disabled={busy === c.id}
                onClick={() => toggleTask(c.id, true)}
              >
                В неделю
              </button>
            </div>
          ))}

          {adding === p.id ? (
            <form
              style={{ display: "flex", gap: 8, marginTop: 10 }}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const title = String(f.get("title") ?? "").trim();
                const min = Number(f.get("min") ?? 0);
                if (title) addTask(p.id, title, min > 0 ? min : undefined);
              }}
            >
              <input name="title" autoFocus placeholder="Что сделать" style={{ ...inputStyle, marginTop: 0, flex: 1 }} />
              <input name="min" inputMode="numeric" placeholder="мин" style={{ ...inputStyle, marginTop: 0, width: 68, flex: "none" }} />
              <button className="btn btn-primary" type="submit" disabled={busy === p.id} style={{ flex: "none" }}>
                В неделю
              </button>
              <button className="btn" type="button" onClick={() => setAdding(null)} style={{ flex: "none" }}>
                Отмена
              </button>
            </form>
          ) : (
            <button className="btn" style={{ marginTop: 10, padding: "5px 12px", fontSize: 12 }} onClick={() => setAdding(p.id)}>
              + своя задача
            </button>
          )}
        </div>
      ))}

      {/* инбокс без проекта — здесь же можно дать задаче родителя */}
      {state.unassignedTotal > 0 && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>Без проекта</h2>
            <span className="num" style={{ fontSize: 11.5, color: "var(--muted)" }}>
              {state.unassigned.length} из {state.unassignedTotal}
            </span>
          </div>
          <p style={{ color: "var(--muted)", fontSize: 12.5, margin: "0 0 4px" }}>
            Старый инбокс — у этих задач нет проекта. Можно сразу выбрать родителя: тогда задача начнёт двигать цель
            месяца, а не висеть отдельно.
          </p>

          {state.unassigned.map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 9, alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 170 }}>
                <div style={{ fontSize: 14 }}>{c.title}</div>
                <div className="num" style={{ fontSize: 11.5, color: c.lowHanging ? "var(--s-over)" : "var(--muted)", marginTop: 2 }}>
                  {c.why.join(" · ")}
                </div>
              </div>

              <select
                value={assign[c.id] ?? ""}
                onChange={(e) => setAssign((a) => ({ ...a, [c.id]: e.target.value }))}
                style={{
                  background: "var(--card-2)",
                  border: "1px solid var(--line)",
                  borderRadius: 9,
                  color: "var(--txt)",
                  font: "inherit",
                  fontSize: 12.5,
                  padding: "6px 9px",
                  flex: "none",
                }}
              >
                <option value="">без проекта</option>
                {state.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>

              <button
                className="btn btn-primary"
                style={{ padding: "5px 12px", fontSize: 12, flex: "none" }}
                disabled={busy === c.id}
                onClick={() => toggleTask(c.id, true, assign[c.id] || undefined)}
              >
                В неделю
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 7,
  background: "var(--card-2)",
  border: "1px solid var(--line)",
  borderRadius: 9,
  color: "var(--txt)",
  font: "inherit",
  fontSize: 13.5,
  padding: "8px 11px",
};
