"use client";

import { useState } from "react";

/**
 * Главный экран: основные задачи недели и то, что из них делаю сегодня.
 *
 * Оба блока держат одно состояние — когда задача уходит из недели в день,
 * она сразу появляется внизу, без перезагрузки. Это важнее аккуратности кода:
 * пропавшая на секунду задача читается как «потерялась».
 */

export interface MainTask {
  id: string;
  title: string;
  status: string;
  estimateMin: number | null;
  firstStep: string | null;
  forWhom: string | null;
  projectTitle: string | null;
  projectIcon: string | null;
  isTopGoal: boolean;
  inWeek: boolean;
}

/** Цель месяца на главном — только название. Цифры и бары живут на вкладке «Месяц». */
export interface MonthGoal {
  id: string;
  title: string;
  icon: string | null;
  monthGoal: string | null;
}

export function MainBoard({ tasks, goals }: { tasks: MainTask[]; goals: MonthGoal[] }) {
  const [items, setItems] = useState(tasks);
  const [busy, setBusy] = useState<string | null>(null);
  const [swap, setSwap] = useState<{ message: string; options: { id: string; title: string }[] } | null>(null);

  async function move(id: string, status: string) {
    setBusy(id);
    const res = await fetch(`/api/tasks/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 409) {
      setSwap({ message: data.error, options: data.offerSwap ?? [] });
    } else if (res.ok) {
      setSwap(null);
      setItems((prev) =>
        prev
          .map((t) => (t.id === id ? { ...t, status } : t))
          // задача не из недели, снятая с дня, с главного уходит: её место — в инбоксе
          .filter((t) => t.inWeek || t.status === "today" || t.status === "doing"),
      );
    }
    setBusy(null);
  }

  const week = items.filter((t) => t.inWeek);
  const today = items.filter((t) => t.status === "today" || t.status === "doing");
  const [main, ...rest] = [...today].sort((a, b) => Number(b.isTopGoal) - Number(a.isTopGoal));

  return (
    <>
      {/* ① основные задачи недели — ядро экрана */}
      <section className="card" style={{ marginBottom: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Основные задачи недели</h2>
          <a href="/week" style={{ fontSize: 12.5, color: "var(--muted)" }}>изменить →</a>
        </div>

        {week.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13.5 }}>
            На эту неделю ничего не выбрано. Возьми главное из проектов месяца на вкладке <a href="/week">Неделя</a> —
            дальше день будет собираться из них.
          </div>
        ) : (
          week.map((t) => {
            const inDay = t.status === "today" || t.status === "doing";
            return (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  gap: 11,
                  alignItems: "center",
                  padding: "10px 0",
                  borderTop: "1px solid var(--line)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14.5,
                      color: t.status === "done" ? "var(--dim)" : "var(--txt)",
                      textDecoration: t.status === "done" ? "line-through" : "none",
                    }}
                  >
                    {t.title}
                  </div>
                  <div className="num" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                    {[
                      t.projectTitle && `${t.projectIcon ?? ""} ${t.projectTitle}`.trim(),
                      t.estimateMin && `${t.estimateMin} мин`,
                      t.status === "doing" ? "в работе" : inDay ? "в дне" : null,
                      t.status === "done" ? "закрыта" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "без проекта"}
                  </div>
                </div>

                {t.status === "done" ? (
                  <span className="chip" style={{ color: "var(--s-over)" }}>готово</span>
                ) : inDay ? (
                  <span className="chip">сегодня</span>
                ) : (
                  <button
                    className="btn"
                    style={{ padding: "5px 12px", fontSize: 12 }}
                    disabled={busy === t.id}
                    onClick={() => move(t.id, "today")}
                  >
                    В день
                  </button>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* предложение обмена, если день уже полон */}
      {swap && (
        <div className="card" style={{ marginBottom: 13, borderColor: "var(--edge-warn)" }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>{swap.message}</div>
          {swap.options.map((o) => (
            <div
              key={o.id}
              style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 0", borderTop: "1px solid var(--line)", fontSize: 13.5 }}
            >
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.title}</span>
              <button className="btn" style={{ padding: "5px 11px", fontSize: 12 }} onClick={() => move(o.id, "inbox")}>
                Снять эту
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ② цели месяца — только названия, ради чего эта неделя */}
      <section className="card" style={{ marginBottom: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: goals.length ? 8 : 0 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Цели месяца</h2>
          <a href="/month" style={{ fontSize: 12.5, color: "var(--muted)" }}>цифры →</a>
        </div>

        {goals.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 8 }}>
            Цели месяца не заданы. Выбери три-пять проектов на вкладке <a href="/projects">Проекты</a> и напиши по каждому,
            что станет правдой к концу месяца.
          </div>
        ) : (
          goals.map((g) => (
            <div key={g.id} style={{ display: "flex", gap: 9, padding: "6px 0", fontSize: 14, alignItems: "baseline" }}>
              <span style={{ flex: "none" }}>{g.icon ?? "•"}</span>
              <span style={{ color: g.monthGoal ? "var(--txt)" : "var(--dim)", minWidth: 0 }}>
                {g.monthGoal || `${g.title} — цель месяца не задана`}
              </span>
            </div>
          ))
        )}
      </section>

      {/* ③ что делаю сегодня */}
      <section style={{ marginTop: 4 }}>
        <div className="num" style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--dim)", margin: "0 0 8px" }}>
          что делаю сегодня
        </div>

        {!main ? (
          <div className="card" style={{ color: "var(--muted)", fontSize: 13.5 }}>
            Сегодня ещё ничего не взято. Возьми одну из недельных выше кнопкой «в день» — или собери день целиком на
            вкладке <a href="/day">День</a>.
          </div>
        ) : (
          <>
            <div className="card" style={{ marginBottom: 11, borderColor: "var(--edge-ok)" }}>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.02em", marginBottom: 5 }}>{main.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                {[
                  main.projectTitle && `${main.projectIcon ?? ""} ${main.projectTitle}`.trim(),
                  main.forWhom && `ждёт ${main.forWhom}`,
                  main.estimateMin && `${main.estimateMin} мин`,
                  main.status === "doing" && "в работе",
                ]
                  .filter(Boolean)
                  .join(" · ") || "без срока"}
              </div>
              {main.firstStep && <div style={{ fontSize: 13.5, marginTop: 7 }}>▶︎ {main.firstStep}</div>}

              <div style={{ display: "flex", gap: 7, marginTop: 12, flexWrap: "wrap" }}>
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

            {rest.length > 0 && (
              <div className="card">
                {rest.map((t) => (
                  <div
                    key={t.id}
                    style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 0", borderTop: "1px solid var(--line)", fontSize: 14 }}
                  >
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                    <button
                      className="btn"
                      style={{ padding: "5px 11px", fontSize: 12 }}
                      disabled={busy === t.id}
                      onClick={() => move(t.id, "done")}
                    >
                      Готово
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
