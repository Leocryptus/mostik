import { db } from "@/lib/db";
import { Nav } from "@/app/components/nav";
import { MonthBoard, type ProjectCard } from "@/app/components/month-board";
import { signalBySilence } from "@/lib/signals";

export const dynamic = "force-dynamic";

/** Вкладка «Проекты»: плитки с полями и правкой. Вся детальная работа — здесь. */
export default async function ProjectsPage() {
  const month = new Date().toISOString().slice(0, 7);
  const now = Date.now();

  const [projects, contracts, lastFacts] = await Promise.all([
    db.project.findMany({ orderBy: [{ status: "asc" }, { potentialUsd: "desc" }] }),
    db.monthContract.findMany({ where: { month } }),
    db.activity.groupBy({ by: ["projectId"], _max: { createdAt: true } }),
  ]);
  const lastByProject = new Map(lastFacts.map((f) => [f.projectId, f._max.createdAt]));

  const cards: ProjectCard[] = projects.map((p) => {
    const last = lastByProject.get(p.id);
    const silent = last ? Math.floor((now - last.getTime()) / 86_400_000) : 999;
    const c = contracts.find((x) => x.projectId === p.id);
    return {
      id: p.id, title: p.title, icon: p.icon, status: p.status,
      monthGoal: p.monthGoal, nextStep: p.nextStep, potentialUsd: p.potentialUsd, owner: p.owner,
      leadMetric: c?.leadMetric ?? null, leadTarget: c?.leadTarget ?? null, leadFact: c?.leadFact ?? 0,
      signal: last ? signalBySilence(silent) : "none", silentDays: last ? silent : 0,
    };
  });

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 18px 70px" }}>
      <p className="num" style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--dim)", margin: "0 0 9px" }}>
        проекты
      </p>
      <Nav active="projects" />
      <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "0 0 16px", maxWidth: "62ch" }}>
        Три-пять в месяц. У каждого цель, ведущее число и один следующий шаг — они и попадают на главный экран.
      </p>
      <MonthBoard projects={cards} />
    </main>
  );
}
