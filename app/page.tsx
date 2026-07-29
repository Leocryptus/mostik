import { db } from "@/lib/db";
import { Nav } from "@/app/components/nav";
import { TodayTasks, type DayTask } from "@/app/components/today-tasks";
import { signalBySilence, SIGNALS } from "@/lib/signals";
import { streakFromDays } from "@/lib/day";

export const dynamic = "force-dynamic";

const money = (n: number) => "$" + n.toLocaleString("ru-RU").replace(/,/g, " ");

/**
 * Главный экран — ровно три блока (ТЗ §19.1):
 * задачи, выбранные на день · ключевые цифры одной строкой · дорожки месяца.
 * Списки, формы и разбор — на вкладках. Здесь только решения.
 */
export default async function Main() {
  const month = new Date().toISOString().slice(0, 7);
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 86_400_000);

  const [today, projects, contracts, moneyMonth, facts, doneWeek, settings, inboxCount] = await Promise.all([
    db.task.findMany({ where: { status: { in: ["today", "doing"] } }, orderBy: [{ isTopGoal: "desc" }, { createdAt: "asc" }] }),
    db.project.findMany({ where: { status: "work" }, orderBy: { potentialUsd: "desc" } }),
    db.monthContract.findMany({ where: { month } }),
    db.moneyMonth.findFirst({ where: { month } }),
    db.activity.findMany({ where: { createdAt: { gte: new Date(now - 90 * 86_400_000) } }, select: { createdAt: true } }),
    db.activity.count({ where: { type: "task_done", createdAt: { gte: weekAgo } } }),
    db.settings.findUnique({ where: { id: 1 } }),
    db.task.count({ where: { status: "inbox" } }),
  ]);

  const lastByProject = new Map(
    (await db.activity.groupBy({ by: ["projectId"], _max: { createdAt: true } })).map((f) => [f.projectId, f._max.createdAt]),
  );

  const streak = streakFromDays(facts.map((f) => f.createdAt), new Date(), settings?.freezesPerWeek ?? 2);
  const goal = moneyMonth?.goalUsd ?? 0;
  const fact = moneyMonth?.factUsd ?? 0;
  const gap = goal - fact;
  const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();

  const tasks: DayTask[] = today.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    forWhom: t.forWhom,
    firstStep: t.firstStep,
    estimateMin: t.estimateMin,
  }));

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "32px 18px 70px" }}>
      <p className="num" style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--dim)", margin: "0 0 9px" }}>
        {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
      </p>
      <Nav active="main" />

      {/* 1 — задачи дня */}
      <TodayTasks tasks={tasks} />

      {/* 2 — ключевые цифры одной строкой */}
      <div className="card" style={{ marginBottom: 13, display: "flex", gap: 22, flexWrap: "wrap", alignItems: "baseline" }}>
        <span className="num" style={{ fontSize: 13 }}>
          месяц <b style={{ fontSize: 18 }}>{money(fact)}</b>
          <span style={{ color: "var(--muted)" }}> из {money(goal)}</span>
        </span>
        {gap > 0 && (
          <span className="num" style={{ fontSize: 13, color: "var(--s-gap)" }}>
            не хватает <b style={{ fontSize: 18 }}>{money(gap)}</b>
          </span>
        )}
        <span className="num" style={{ fontSize: 13, color: streak.days ? "var(--s-over)" : "var(--dim)" }}>
          серия <b style={{ fontSize: 18 }}>{streak.days}</b>
          {streak.days ? " 🔥" : ""}
        </span>
        <span className="num" style={{ fontSize: 13, color: "var(--muted)" }}>
          за неделю закрыто <b style={{ fontSize: 18, color: "var(--txt)" }}>{doneWeek}</b>
        </span>
        <span className="num" style={{ fontSize: 12.5, color: "var(--dim)", marginLeft: "auto" }}>
          до конца месяца {daysLeft} дн
        </span>
      </div>

      {/* 3 — дорожки месяца */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 11 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Проекты месяца</h2>
          <a href="/projects" style={{ fontSize: 12.5, color: "var(--muted)" }}>подробно →</a>
        </div>

        {projects.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: 13.5 }}>
            Ни один проект не взят в месяц. Выбери три-пять на вкладке <a href="/projects">Проекты</a>.
          </div>
        )}

        {projects.map((p) => {
          const c = contracts.find((x) => x.projectId === p.id);
          const last = lastByProject.get(p.id);
          const silent = last ? Math.floor((now - last.getTime()) / 86_400_000) : 999;
          const sig = last ? signalBySilence(silent) : "none";
          const pct = c?.leadTarget ? Math.min(100, Math.round((c.leadFact / c.leadTarget) * 100)) : 0;
          const color = SIGNALS[c && c.leadTarget && c.leadFact >= c.leadTarget ? "over" : sig].color;

          return (
            <div key={p.id} style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 14.5, fontWeight: 600 }}>
                  {p.icon} {p.title}
                </span>
                <span className="num" style={{ fontSize: 12, color }}>
                  {c?.leadMetric ? `${c.leadFact} / ${c.leadTarget ?? "—"} ${c.leadMetric}` : sig === "dead" ? `молчит ${silent} дн` : "числа нет"}
                </span>
              </div>
              <div className="rail" style={{ height: 18 }}>
                <div
                  className="rail-seg"
                  style={{
                    width: `${Math.max(pct, sig === "dead" ? 8 : 3)}%`,
                    background: color,
                    boxShadow: `0 0 12px ${color}55`,
                  }}
                />
              </div>
              <div style={{ fontSize: 13, marginTop: 6, color: p.nextStep ? "var(--txt)" : "var(--dim)" }}>
                ➡️ {p.nextStep ?? "следующий шаг не задан"}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ color: "var(--dim)", fontSize: 12.5, marginTop: 16 }}>
        В инбоксе {inboxCount} — разбор на вкладке <a href="/inbox">День</a>
      </p>
    </main>
  );
}
