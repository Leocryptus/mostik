import { db } from "@/lib/db";
import { Nav } from "@/app/components/nav";
import { SignalMark } from "@/app/components/signal-mark";
import { SIGNALS, signalBySilence, signalByProgress, shortfallLabel } from "@/lib/signals";

export const dynamic = "force-dynamic";

const money = (n: number) => "$" + n.toLocaleString("ru-RU").replace(/,/g, " ");
const dayMs = 86_400_000;

/**
 * Вкладка «Месяц» — вся статистика разом (ТЗ §19.5): деньги, цели с барами,
 * ведущие числа, дорожки и движение по проектам.
 *
 * Здесь только чтение: править цели и шаги — на вкладке «Проекты». Разделение
 * намеренное, чтобы экран обзора не превращался в форму.
 */
export default async function MonthPage() {
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate();
  const monthProgress = Math.round((now.getDate() / daysInMonth) * 100);

  const [projects, contracts, moneyMonth, monthFacts, doneMonth] = await Promise.all([
    db.project.findMany({ where: { status: "work" }, orderBy: { potentialUsd: "desc" } }),
    db.monthContract.findMany({ where: { month } }),
    db.moneyMonth.findFirst({ where: { month } }),
    db.activity.findMany({
      where: { createdAt: { gte: monthStart } },
      select: { projectId: true, createdAt: true, type: true, note: true },
      orderBy: { createdAt: "desc" },
    }),
    db.task.count({ where: { status: "done", doneAt: { gte: monthStart } } }),
  ]);

  const goal = moneyMonth?.goalUsd ?? 0;
  const fact = moneyMonth?.factUsd ?? 0;
  const gap = goal - fact;
  const moneyPct = goal ? Math.min(100, Math.round((fact / goal) * 100)) : 0;
  const potential = projects.reduce((s, p) => s + (p.potentialUsd ?? 0), 0);

  const lastByProject = new Map<string, Date>();
  const countByProject = new Map<string, number>();
  for (const f of monthFacts) {
    if (!f.projectId) continue;
    if (!lastByProject.has(f.projectId)) lastByProject.set(f.projectId, f.createdAt);
    countByProject.set(f.projectId, (countByProject.get(f.projectId) ?? 0) + 1);
  }

  const rows = projects.map((p) => {
    const c = contracts.find((x) => x.projectId === p.id);
    const last = lastByProject.get(p.id);
    const silent = last ? Math.floor((now.getTime() - last.getTime()) / dayMs) : null;
    const pct = c?.leadTarget ? Math.min(100, Math.round((c.leadFact / c.leadTarget) * 100)) : 0;
    const signal = c?.leadTarget
      ? signalByProgress(c.leadFact, c.leadTarget)
      : silent === null
        ? "none"
        : signalBySilence(silent);
    return { p, c, last, silent, pct, signal, facts: countByProject.get(p.id) ?? 0 };
  });

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 18px 70px" }}>
      <p className="num" style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--dim)", margin: "0 0 9px" }}>
        {now.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })} · прошло {monthProgress}% · осталось {daysLeft} дн
      </p>
      <Nav active="month" />
      <h1 style={{ fontSize: 26, letterSpacing: "-.035em", lineHeight: 1.06, margin: "0 0 8px" }}>Как идёт месяц</h1>
      <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "0 0 18px", maxWidth: "62ch" }}>
        Все цифры собраны здесь, чтобы на главном их не было. Править цели и шаги —{" "}
        <a href="/projects">на вкладке Проекты</a>.
      </p>

      {/* ── деньги ── */}
      <section className="card" style={{ marginBottom: 13 }}>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "baseline", marginBottom: 11 }}>
          <span className="num" style={{ fontSize: 13 }}>
            факт <b style={{ fontSize: 22 }}>{money(fact)}</b>
          </span>
          <span className="num" style={{ fontSize: 13, color: "var(--muted)" }}>
            цель <b style={{ fontSize: 18, color: "var(--txt)" }}>{money(goal)}</b>
          </span>
          {gap > 0 && (
            <span className="num" style={{ fontSize: 13, color: "var(--s-gap)" }}>
              разрыв <b style={{ fontSize: 18 }}>{money(gap)}</b>
            </span>
          )}
          {gap > 0 && daysLeft > 0 && (
            <span className="num" style={{ fontSize: 12.5, color: "var(--dim)", marginLeft: "auto" }}>
              {money(Math.round(gap / daysLeft))} в день до конца месяца
            </span>
          )}
        </div>

        <div className="track" style={{ height: 11 }}>
          <div className="track-fill" style={{ width: `${moneyPct}%`, background: moneyPct >= 100 ? "var(--s-over)" : "var(--s-ok)" }} />
          {moneyPct < 100 && <div className="track-rest" style={{ left: `${moneyPct}%` }} />}
          <div className="track-plan" style={{ left: `${monthProgress}%` }} title="где мы по календарю" />
        </div>
        <div className="num" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>
          {moneyPct}% цели · календарь прошёл на {monthProgress}%
          {potential ? ` · потенциал активных проектов ${money(potential)} в месяц` : ""}
        </div>
      </section>

      {/* ── цели месяца с прогрессом по ведущему числу ── */}
      <section className="card" style={{ marginBottom: 13 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 3px" }}>Цели месяца</h2>
        <p style={{ color: "var(--muted)", fontSize: 12.5, margin: "0 0 6px" }}>
          Ведущее число — то, что ты делаешь сам на неделе. Оно и двигает цель.
        </p>

        {rows.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 8 }}>
            Активных проектов нет — <a href="/projects">возьми три-пять в месяц</a>.
          </div>
        )}

        {rows.map(({ p, c, pct, signal }) => (
          <div key={p.id} style={{ padding: "11px 0", borderTop: "1px solid var(--line)" }}>
            <div style={{ display: "flex", gap: 9, alignItems: "center", marginBottom: 5 }}>
              <SignalMark signal={signal} />
              <span style={{ fontSize: 14.5, fontWeight: 600, flex: 1, minWidth: 0 }}>
                {p.icon} {p.title}
              </span>
              <span className="num" style={{ fontSize: 12, color: "var(--muted)" }}>
                {p.potentialUsd ? `${money(p.potentialUsd)} / мес` : "цифры нет"}
              </span>
            </div>

            <div style={{ fontSize: 13.5, color: p.monthGoal ? "var(--txt)" : "var(--dim)", marginBottom: 7 }}>
              🎯 {p.monthGoal || "цель месяца не задана"}
            </div>

            {c?.leadMetric ? (
              <>
                <div className="track">
                  <div className="track-fill" style={{ width: `${pct}%`, background: SIGNALS[signal].color }} />
                  {pct < 100 && <div className="track-rest" style={{ left: `${pct}%` }} />}
                </div>
                <div className="num" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 5 }}>
                  {c.leadMetric}: {c.leadFact}
                  {c.leadTarget ? ` из ${c.leadTarget}` : ""}
                  {c.leadTarget ? ` · ${shortfallLabel(c.leadFact, c.leadTarget) ?? "цель взята"}` : ""}
                </div>
              </>
            ) : (
              <div className="num" style={{ fontSize: 11.5, color: "var(--s-none)" }}>
                ведущее число не задано — <a href="/projects">задать</a>
              </div>
            )}
          </div>
        ))}
      </section>

      {/* ── дорожки месяца ── */}
      <section className="card" style={{ marginBottom: 13 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>Дорожки месяца</h2>

        {rows.map(({ p, c, pct, signal, silent }) => (
          <div key={p.id} style={{ padding: "9px 0", borderTop: "1px solid var(--line)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                {p.icon} {p.title}
              </span>
              <span className="num" style={{ fontSize: 11.5, color: SIGNALS[signal].color }}>
                {c?.leadMetric
                  ? `${c.leadFact} / ${c.leadTarget ?? "—"} ${c.leadMetric}`
                  : silent === null
                    ? "фактов нет"
                    : `молчит ${silent} дн`}
              </span>
            </div>
            <div className="rail" style={{ height: 18 }}>
              <div
                className="rail-seg"
                style={{
                  width: `${Math.max(pct, 4)}%`,
                  background: SIGNALS[signal].color,
                  boxShadow: `0 0 12px ${SIGNALS[signal].color}55`,
                }}
              />
            </div>
            <div style={{ fontSize: 12.5, marginTop: 6, color: p.nextStep ? "var(--txt)" : "var(--dim)" }}>
              ➡️ {p.nextStep ?? "следующий шаг не задан"}
            </div>
          </div>
        ))}
      </section>

      {/* ── движение по проектам ── */}
      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Движение за месяц</h2>
          <span className="num" style={{ fontSize: 12, color: "var(--muted)" }}>
            фактов {monthFacts.length} · задач закрыто {doneMonth}
          </span>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 12.5, margin: "0 0 4px" }}>
          Факт — только закрытая задача или отмеченный шаг. «Подумал» и «поговорил» сюда не попадают.
        </p>

        {rows.map(({ p, facts, last, silent, signal }) => (
          <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 0", borderTop: "1px solid var(--line)" }}>
            <SignalMark signal={signal} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
              {p.icon} {p.title}
            </span>
            <span className="num" style={{ fontSize: 12, color: facts ? "var(--txt)" : "var(--s-dead)" }}>
              {facts ? `${facts} факт(ов)` : "тишина"}
            </span>
            <span className="num" style={{ fontSize: 11.5, color: "var(--dim)", width: 96, textAlign: "right" }}>
              {last ? (silent === 0 ? "сегодня" : `${silent} дн назад`) : "—"}
            </span>
          </div>
        ))}

        {monthFacts.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 8 }}>
            В этом месяце фактов ещё нет. Закрой первую задачу на вкладке <a href="/day">День</a>.
          </div>
        )}
      </section>
    </main>
  );
}
