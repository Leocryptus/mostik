"use client";

import { useEffect, useState } from "react";
import { ADEQUACY_STEPS, adequacyComplete } from "@/lib/simple";
import { inputStyle } from "@/app/components/goals-board";

/**
 * Инбокс и адекватизация (ТЗ §4.4 и §3).
 *
 * Захват — одно поле и одна кнопка, без обязательных полей: мысль на ходу не
 * должна ломать день. Разбор — отдельно и по одному вопросу на экран, в конце
 * запись обязательно куда-то ложится. Удаления нет: отказ — это морозилка.
 */

interface Suggestion {
  goalId: string;
  goalTitle: string;
  hits: number;
  matched: string[];
}
interface Item {
  id: string;
  title: string;
  ageDays: number;
  suggestion: Suggestion | null;
}
interface GoalRef {
  id: string;
  title: string;
  icon: string | null;
  subprojects: { id: string; title: string }[];
}
interface InboxState {
  total: number;
  sortedToday: number;
  items: Item[];
  goals: GoalRef[];
}

type Answers = { becomesTrue: string; who: string; blocker: string; firstStep: string };
const EMPTY: Answers = { becomesTrue: "", who: "Лео", blocker: "", firstStep: "" };

export function InboxBoard() {
  const [state, setState] = useState<InboxState | null>(null);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<Item | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [goalId, setGoalId] = useState("");
  const [subId, setSubId] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = async () => setState(await (await fetch("/api/inbox")).json());
  useEffect(() => {
    load();
  }, []);

  function startSorting(item: Item) {
    setActive(item);
    setStepIndex(0);
    setAnswers(EMPTY);
    setGoalId(item.suggestion?.goalId ?? "");
    setSubId("");
    setNote(null);
  }

  async function capture(text: string) {
    setBusy(true);
    await fetch("/api/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    await load();
    setBusy(false);
  }

  async function place(kind: string) {
    if (!active) return;
    setBusy(true);
    const res = await fetch(`/api/inbox/${active.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...answers, place: { kind, goalId: goalId || undefined, subId: subId || undefined } }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNote(data.error ?? "Не получилось");
      setBusy(false);
      return;
    }
    setNote(`Легло: ${data.placed}`);
    setActive(null);
    await load();
    setBusy(false);
  }

  if (!state) return <div className="card" style={{ color: "var(--muted)" }}>Открываю инбокс…</div>;

  const goal = state.goals.find((g) => g.id === goalId);
  const ready = adequacyComplete(answers);

  return (
    <>
      {/* захват */}
      <form
        className="card"
        style={{ marginBottom: 13, display: "flex", gap: 8, flexWrap: "wrap" }}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const t = String(f.get("text") ?? "").trim();
          if (t) capture(t);
          e.currentTarget.reset();
        }}
      >
        <input name="text" placeholder="Что пришло в голову" style={{ ...inputStyle, marginTop: 0, flex: 1, minWidth: 220 }} />
        <button className="btn btn-primary" type="submit" disabled={busy}>Записать</button>
      </form>

      <div className="card" style={{ marginBottom: 13, display: "flex", gap: 22, flexWrap: "wrap" }}>
        <span className="num" style={{ fontSize: 13.5, color: "var(--s-behind)" }}>
          не разобрано <b style={{ fontSize: 19 }}>{state.total}</b>
        </span>
        <span className="num" style={{ fontSize: 13.5, color: "var(--s-over)" }}>
          разобрано сегодня <b style={{ fontSize: 19 }}>{state.sortedToday}</b>
        </span>
      </div>

      {note && <div className="t-note" style={{ marginBottom: 13 }}>{note}</div>}

      {/* разбор */}
      {active && (
        <div className="card" style={{ marginBottom: 13, borderColor: "var(--edge-ok)" }}>
          <div className="num" style={{ fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--s-ok)" }}>
            разбираем · шаг {Math.min(stepIndex + 1, 5)} из 5
          </div>
          <div style={{ fontSize: 17, fontWeight: 650, margin: "7px 0 12px" }}>{active.title}</div>

          {stepIndex < ADEQUACY_STEPS.length ? (
            <Question
              index={stepIndex}
              value={answers[ADEQUACY_STEPS[stepIndex].key as keyof Answers]}
              onChange={(v) => setAnswers((a) => ({ ...a, [ADEQUACY_STEPS[stepIndex].key]: v }))}
              onNext={() => setStepIndex((i) => i + 1)}
              onBack={stepIndex > 0 ? () => setStepIndex((i) => i - 1) : undefined}
              onCancel={() => setActive(null)}
            />
          ) : (
            <>
              <div style={{ fontSize: 14, marginBottom: 4 }}>Куда это ложится?</div>
              {active.suggestion && (
                <div className="num" style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 9 }}>
                  похоже на «{active.suggestion.goalTitle}» — совпало: {active.suggestion.matched.join(", ")}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 11 }}>
                <select value={goalId} onChange={(e) => { setGoalId(e.target.value); setSubId(""); }} style={selectStyle}>
                  <option value="">— задача месяца —</option>
                  {state.goals.map((g) => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>

                {goal && goal.subprojects.length > 0 && (
                  <select value={subId} onChange={(e) => setSubId(e.target.value)} style={selectStyle}>
                    <option value="">— без подпроекта —</option>
                    {goal.subprojects.map((s) => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                )}
              </div>

              {!ready && (
                <div style={{ fontSize: 12.5, color: "var(--s-behind)", marginBottom: 9 }}>
                  Нужны две вещи: что станет правдой и с чего начать. Вернись назад и допиши.
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-primary" disabled={busy || !ready || !goalId} onClick={() => place("step")}>
                  Шагом в задачу
                </button>
                <button className="btn" disabled={busy || !ready || !goalId} onClick={() => place("subproject")}>
                  Новым подпроектом
                </button>
                <button className="btn" disabled={busy || !ready} onClick={() => place("goal")}>
                  Новой задачей месяца
                </button>
                <button className="btn" disabled={busy || !ready} onClick={() => place("freeze")}>
                  В морозилку на месяц
                </button>
                <button className="btn" type="button" onClick={() => setStepIndex(ADEQUACY_STEPS.length - 1)}>
                  Назад
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* поток */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Не разобрано</h2>
          <span className="num" style={{ fontSize: 11.5, color: "var(--muted)" }}>
            {state.items.length === state.total ? state.total : `${state.items.length} из ${state.total}`}
          </span>
        </div>

        {state.items.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 8 }}>
            Инбокс разобран. Это редкость — иди <a href="/">делать день</a>.
          </div>
        ) : (
          state.items.map((it) => (
            <div key={it.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--line)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14 }}>{it.title}</div>
                <div className="num" style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  {[
                    it.ageDays > 0 ? `лежит ${it.ageDays} дн` : "сегодня",
                    it.suggestion ? `похоже на ${it.suggestion.goalTitle}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <button
                className={active?.id === it.id ? "btn" : "btn btn-primary"}
                style={{ padding: "5px 12px", fontSize: 12 }}
                disabled={busy}
                onClick={() => startSorting(it)}
              >
                {active?.id === it.id ? "Разбираем" : "Разобрать"}
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function Question({
  index,
  value,
  onChange,
  onNext,
  onBack,
  onCancel,
}: {
  index: number;
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack?: () => void;
  onCancel: () => void;
}) {
  const q = ADEQUACY_STEPS[index];
  const isWho = q.key === "who";

  return (
    <div>
      <div style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 3 }}>{q.question}</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 9 }}>{q.hint}</div>

      {isWho ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 11 }}>
          {["Лео", "делегат", "никто"].map((opt) => (
            <button
              key={opt}
              type="button"
              className={value === opt || (opt === "делегат" && value !== "Лео" && value !== "никто" && value !== "") ? "btn btn-primary" : "btn"}
              onClick={() => onChange(opt === "делегат" ? "" : opt)}
            >
              {opt === "Лео" ? "я сам" : opt === "делегат" ? "делегат" : "никто, в морозилку"}
            </button>
          ))}
          {value !== "Лео" && value !== "никто" && (
            <input
              autoFocus
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="имя"
              style={{ ...inputStyle, marginTop: 0, width: 150 }}
            />
          )}
        </div>
      ) : (
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onNext();
            }
          }}
          style={{ ...inputStyle, marginTop: 0, marginBottom: 11 }}
        />
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={onNext}>Дальше</button>
        {onBack && <button className="btn" onClick={onBack}>Назад</button>}
        <button className="btn" onClick={onCancel} style={{ marginLeft: "auto" }}>Отложить</button>
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: "var(--card-2)",
  border: "1px solid var(--line)",
  borderRadius: 9,
  color: "var(--txt)",
  font: "inherit",
  fontSize: 13,
  padding: "8px 10px",
};
