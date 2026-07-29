"use client";

import { useEffect, useState } from "react";
import { STATE_LABEL, type SimpleState } from "@/lib/simple";
import { Field, inputStyle, type Goal } from "@/app/components/goals-board";

/**
 * Страница одной задачи месяца (ТЗ §4.3): OKR, подпроекты, шаги.
 *
 * Здесь заводится вся конкретика и отсюда шаг уходит в день. Это единственный
 * экран, где список длинный — и это нормально: сюда приходят работать, а не решать.
 */

const STATE_COLOR: Record<SimpleState, string> = {
  moving: "var(--s-ok)",
  behind: "var(--s-behind)",
  silent: "var(--s-dead)",
};

export function GoalDetail({ id }: { id: string }) {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [addStepTo, setAddStepTo] = useState<string | null>(null);
  const [addingSub, setAddingSub] = useState(false);
  const [addingKr, setAddingKr] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = async () => {
    const data = await (await fetch("/api/goals")).json();
    const found = (data.goals as Goal[]).find((g) => g.id === id) ?? null;
    setGoal(found);
    setMissing(!found);
  };
  useEffect(() => {
    load();
  }, [id]);

  async function act(body: Record<string, unknown>, tag = "act") {
    setBusy(tag);
    const res = await fetch(`/api/goals/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setNote(data.error ?? "Не получилось");
    else setNote(null);
    setAddStepTo(null);
    setAddingSub(false);
    setAddingKr(false);
    await load();
    setBusy(null);
  }

  async function take(stepId: string) {
    setBusy(stepId);
    const res = await fetch(`/api/tasks/${stepId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "today" }),
    });
    const data = await res.json().catch(() => ({}));
    setNote(res.status === 409 ? data.error : res.ok ? "Взято в день" : "Не получилось");
    await load();
    setBusy(null);
  }

  async function closeStep(stepId: string) {
    setBusy(stepId);
    await fetch(`/api/tasks/${stepId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    await load();
    setBusy(null);
  }

  if (missing) {
    return (
      <div className="card">
        <div style={{ fontSize: 17, fontWeight: 650, marginBottom: 4 }}>Такой задачи месяца нет</div>
        <div style={{ color: "var(--muted)", fontSize: 13.5 }}>
          Возможно, она переименована или снята. Вернись <a href="/month">на месяц</a>.
        </div>
      </div>
    );
  }
  if (!goal) return <div className="card" style={{ color: "var(--muted)" }}>Открываю задачу…</div>;

  const metricPct = goal.metricTarget ? Math.min(100, Math.round((goal.metricFact / goal.metricTarget) * 100)) : 0;

  return (
    <>
      {note && (
        <div className="t-note" style={{ marginBottom: 12 }}>
          {note}
        </div>
      )}

      {/* шапка */}
      <div className="card" style={{ marginBottom: 13, borderColor: "var(--edge-ok)" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 24, letterSpacing: "-.03em", margin: 0 }}>
            {goal.icon} {goal.title}
          </h1>
          <span className="num" style={{ fontSize: 12, color: STATE_COLOR[goal.state] }}>
            {STATE_LABEL[goal.state]}
            {goal.silentDays !== null && goal.silentDays > 14 ? ` · ${goal.silentDays} дн без фактов` : ""}
          </span>
        </div>
        <div style={{ fontSize: 14, marginTop: 8, color: goal.becomesTrue ? "var(--txt)" : "var(--dim)" }}>
          🎯 {goal.becomesTrue || "что станет правдой — не задано, поправь на «Месяце»"}
        </div>

        {goal.metricName && (
          <div style={{ marginTop: 11 }}>
            <div className="track">
              <div className="track-fill" style={{ width: `${metricPct}%`, background: STATE_COLOR[goal.state] }} />
              {metricPct < 100 && <div className="track-rest" style={{ left: `${metricPct}%` }} />}
            </div>
            <div className="num" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 5 }}>
              {goal.metricName}: {goal.metricFact}
              {goal.metricTarget ? ` из ${goal.metricTarget}` : ""}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 7, marginTop: 12, flexWrap: "wrap" }}>
          <button className="btn" disabled={busy === "fact"} onClick={() => act({ action: "fact" }, "fact")} style={{ padding: "6px 13px", fontSize: 12.5 }}>
            Сделал шаг
          </button>
          <a href="/month" className="btn" style={{ padding: "6px 13px", fontSize: 12.5, textDecoration: "none", color: "var(--txt)" }}>
            Все задачи месяца
          </a>
        </div>
      </div>

      {/* ключевые результаты */}
      <div className="card" style={{ marginBottom: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Ключевые результаты</h2>
          <span className="num" style={{ fontSize: 11.5, color: "var(--muted)" }}>прогресс {goal.progress}%</span>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 12.5, margin: "3px 0 4px" }}>
          Два-три числа, по которым видно, что задача месяца двигается.
        </p>

        {goal.krs.map((k) => {
          const pct = k.target > 0 ? Math.min(100, Math.round((k.current / k.target) * 100)) : 0;
          return (
            <div key={k.id} style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>{k.name}</span>
                <span className="num" style={{ fontSize: 13 }}>
                  <b>{k.current}</b> / {k.target} {k.unit ?? ""}
                </span>
                <button
                  className="btn"
                  style={{ padding: "3px 10px", fontSize: 13 }}
                  disabled={busy === k.id || k.current === 0}
                  onClick={() => act({ action: "kr.set", krId: k.id, current: k.current - 1 }, k.id)}
                >
                  −
                </button>
                <button
                  className="btn btn-primary"
                  style={{ padding: "3px 10px", fontSize: 13 }}
                  disabled={busy === k.id}
                  onClick={() => act({ action: "kr.set", krId: k.id, current: k.current + 1 }, k.id)}
                >
                  +
                </button>
              </div>
              <div className="track" style={{ marginTop: 7 }}>
                <div className="track-fill" style={{ width: `${pct}%`, background: pct >= 100 ? "var(--s-over)" : "var(--s-ok)" }} />
                {pct < 100 && <div className="track-rest" style={{ left: `${pct}%` }} />}
              </div>
            </div>
          );
        })}

        {addingKr ? (
          <form
            style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap" }}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const name = String(f.get("name") ?? "").trim();
              if (name) act({ action: "kr.add", name, target: Number(f.get("target")) || 1, unit: String(f.get("unit") ?? "") }, "kr-new");
            }}
          >
            <input name="name" autoFocus placeholder="Что считаем" style={{ ...inputStyle, marginTop: 0, flex: 1, minWidth: 170 }} />
            <input name="target" inputMode="numeric" placeholder="сколько" style={{ ...inputStyle, marginTop: 0, width: 90 }} />
            <input name="unit" placeholder="ед." style={{ ...inputStyle, marginTop: 0, width: 80 }} />
            <button className="btn btn-primary" type="submit" disabled={busy === "kr-new"}>Добавить</button>
            <button className="btn" type="button" onClick={() => setAddingKr(false)}>Отмена</button>
          </form>
        ) : (
          <button className="btn" style={{ marginTop: 11, padding: "5px 12px", fontSize: 12 }} onClick={() => setAddingKr(true)}>
            + результат
          </button>
        )}
      </div>

      {/* подпроекты */}
      <div className="num" style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--dim)", margin: "18px 0 9px" }}>
        подпроекты · {goal.subprojects.length}
      </div>

      {goal.subprojects.map((s) => (
        <div key={s.id} className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
            <span style={{ fontSize: 15.5, fontWeight: 650, flex: 1, minWidth: 0 }}>{s.title}</span>
            <span className="num" style={{ fontSize: 11.5, color: "var(--muted)" }}>
              открыто {s.openCount}
              {s.doneCount ? ` · закрыто ${s.doneCount}` : ""}
            </span>
          </div>
          {s.nextStep && <div style={{ fontSize: 13, marginTop: 4, color: "var(--muted)" }}>➡️ {s.nextStep}</div>}

          {s.steps.map((t) => (
            <StepRow
              key={t.id}
              step={t}
              busy={busy === t.id}
              onTake={() => take(t.id)}
              onClose={() => closeStep(t.id)}
            />
          ))}

          {addStepTo === s.id ? (
            <StepForm busy={busy === "step"} onCancel={() => setAddStepTo(null)} onSubmit={(v) => act({ action: "step.add", subId: s.id, ...v }, "step")} />
          ) : (
            <button className="btn" style={{ marginTop: 10, padding: "5px 12px", fontSize: 12 }} onClick={() => setAddStepTo(s.id)}>
              + шаг
            </button>
          )}
        </div>
      ))}

      {/* шаги без подпроекта */}
      {goal.looseSteps.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 650 }}>Пока без подпроекта</div>
          <div style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 3 }}>
            Эти шаги привязаны к задаче месяца, но ещё не разложены по кускам работы.
          </div>
          {goal.looseSteps.map((t) => (
            <StepRow key={t.id} step={t} busy={busy === t.id} onTake={() => take(t.id)} onClose={() => closeStep(t.id)} />
          ))}
        </div>
      )}

      {/* новый подпроект */}
      {addingSub ? (
        <form
          className="card"
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const title = String(f.get("title") ?? "").trim();
            if (title) act({ action: "sub.add", title, nextStep: String(f.get("nextStep") ?? "") }, "sub");
          }}
        >
          <input name="title" autoFocus placeholder="Кусок работы" style={{ ...inputStyle, marginTop: 0, flex: 1, minWidth: 180 }} />
          <input name="nextStep" placeholder="Следующий шаг" style={{ ...inputStyle, marginTop: 0, flex: 1, minWidth: 180 }} />
          <button className="btn btn-primary" type="submit" disabled={busy === "sub"}>Добавить</button>
          <button className="btn" type="button" onClick={() => setAddingSub(false)}>Отмена</button>
        </form>
      ) : (
        <button className="btn" onClick={() => setAddingSub(true)}>+ подпроект</button>
      )}
    </>
  );
}

function StepRow({
  step,
  busy,
  onTake,
  onClose,
}: {
  step: { id: string; title: string; status: string; firstStep: string | null; estimateMin: number | null; becomesTrue: string | null };
  busy: boolean;
  onTake: () => void;
  onClose: () => void;
}) {
  const done = step.status === "done";
  const inDay = step.status === "today" || step.status === "doing";

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 0", borderTop: "1px solid var(--line)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: done ? "var(--dim)" : "var(--txt)", textDecoration: done ? "line-through" : "none" }}>
          {step.title}
        </div>
        {(step.firstStep || step.estimateMin) && !done && (
          <div className="num" style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            {[step.firstStep && `▶︎ ${step.firstStep}`, step.estimateMin && `${step.estimateMin} мин`].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>

      {done ? (
        <span className="chip" style={{ color: "var(--s-over)" }}>готово</span>
      ) : inDay ? (
        <>
          <span className="chip">в дне</span>
          <button className="btn" style={{ padding: "5px 11px", fontSize: 12 }} disabled={busy} onClick={onClose}>
            Готово
          </button>
        </>
      ) : (
        <button className="btn btn-primary" style={{ padding: "5px 12px", fontSize: 12 }} disabled={busy} onClick={onTake}>
          В день
        </button>
      )}
    </div>
  );
}

function StepForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (v: { title: string; firstStep: string; estimateMin: number }) => void;
}) {
  return (
    <form
      style={{ marginTop: 11, display: "grid", gap: 8 }}
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const title = String(f.get("title") ?? "").trim();
        if (title) {
          onSubmit({
            title,
            firstStep: String(f.get("firstStep") ?? ""),
            estimateMin: Number(f.get("estimateMin")) || 0,
          });
        }
      }}
    >
      <Field name="title" label="Что сделать" def="" />
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}><Field name="firstStep" label="С чего начать не раздумывая" def="" /></div>
        <div style={{ width: 92 }}><Field name="estimateMin" label="минут" def="" /></div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ padding: "7px 15px" }}>Добавить</button>
        <button className="btn" type="button" onClick={onCancel} style={{ padding: "7px 15px" }}>Отмена</button>
      </div>
    </form>
  );
}
