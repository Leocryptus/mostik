import { db } from "@/lib/db";
import { MonthBoard, type ProjectCard } from "@/app/components/month-board";
import { signalBySilence } from "@/lib/signals";

export const dynamic = "force-dynamic";

const money = (n: number) => "$" + n.toLocaleString("ru-RU").replace(/,/g, " ");

/**
 * Мостик. Сверху — проекты месяца: цель, ведущее число, один следующий шаг.
 * Инбокс сюда не лезет: он отдельной страницей и открывается, когда основное
 * сделано. Это прямое правило из ТЗ — мелочёвка идёт десертом, не закуской.
 */
export default async function Bridge() {
  const month = new Date().toISOString().slice(0, 7);
  const now = Date.now();

  const [projects, contracts, moneyMonth, todayCount, inboxCount, doneToday] = await Promise.all([
    db.project.findMany({ orderBy: [{ status: "asc" }, { potentialUsd: "desc" }] }),
    db.monthContract.findMany({ where: { month } }),
    db.moneyMonth.findFirst({ where: { month } }),
    db.task.count({ where: { status: { in: ["today", "doing"] } } }),
    db.task.count({ where: { status: "inbox" } }),
    db.activity.count({ where: { type: "task_done", createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
  ]);

  const lastFacts = await db.activity.groupBy({
    by: ["projectId"],
    _max: { createdAt: true },
  });
  const lastByProject = new Map(lastFacts.map((f) => [f.projectId, f._max.createdAt]));

  const cards: ProjectCard[] = projects.map((p) => {
    const last = lastByProject.get(p.id);
    const silentDays = last ? Math.floor((now - last.getTime()) / 86_400_000) : 999;
    const c = contracts.find((x) => x.projectId === p.id);
    return {
      id: p.id,
      title: p.title,
      icon: p.icon,
      status: p.status,
      monthGoal: p.monthGoal,
      nextStep: p.nextStep,
      potentialUsd: p.potentialUsd,
      owner: p.owner,
      leadMetric: c?.leadMetric ?? null,
      leadTarget: c?.leadTarget ?? null,
      leadFact: c?.leadFact ?? 0,
      signal: last ? signalBySilence(silentDays) : "none",
      silentDays: last ? silentDays : 0,
    };
  });

  const activeCount = cards.filter((c) => c.status === "work").length;
  const potential = cards.filter((c) => c.status === "work").reduce((s, p) => s + (p.potentialUsd ?? 0), 0);

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "36px 18px 80px" }}>
      <p className="num" style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--dim)", margin: "0 0 9px" }}>
        Мостик · {new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
      </p>
      <h1 style={{ fontSize: 30, letterSpacing: "-.035em", lineHeight: 1.06, margin: "0 0 8px" }}>Проекты месяца</h1>
      <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "0 0 20px", maxWidth: "62ch" }}>
        Три-пять штук, за которые рубишься. У каждого цель, ведущее число и один следующий шаг.
      </p>

      {/* деньги — одной строкой, без графиков */}
      <div className="card" style={{ marginBottom: 14, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "baseline" }}>
        <span className="num" style={{ fontSize: 13.5 }}>
          цель месяца <b style={{ fontSize: 19 }}>{money(moneyMonth?.goalUsd ?? 0)}</b>
        </span>
        <span className="num" style={{ fontSize: 13.5, color: "var(--s-ok)" }}>
          в работе <b style={{ fontSize: 19 }}>{money(potential)}</b>
        </span>
        <span className="num" style={{ fontSize: 13.5, color: "var(--muted)" }}>
          факт <b style={{ fontSize: 19 }}>{moneyMonth?.factUsd ? money(moneyMonth.factUsd) : "—"}</b>
        </span>
        <span className="num" style={{ fontSize: 12.5, color: activeCount > 5 ? "var(--s-behind)" : "var(--dim)", marginLeft: "auto" }}>
          активных проектов {activeCount} / 5
        </span>
      </div>

      <MonthBoard projects={cards} />

      {/* мелочёвка — после основного, отдельной страницей */}
      <div className="card" style={{ marginTop: 18, background: "transparent", borderStyle: "dashed" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Мелочёвка и входящие</div>
            <div style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 2 }}>
              {inboxCount} записей ждут разбора. Открывается, когда основное сделано — сегодня закрыто {doneToday}.
            </div>
          </div>
          <a className="btn" href="/inbox" style={{ textDecoration: "none", padding: "7px 14px", fontSize: 12.5 }}>
            Открыть инбокс
          </a>
        </div>
      </div>

      <p style={{ color: "var(--dim)", fontSize: 12.5, marginTop: 20 }}>
        В дне сейчас {todayCount} из 3 задач · стиль — <a href="/dev/tokens">дизайн-ядро</a>
      </p>
    </main>
  );
}
