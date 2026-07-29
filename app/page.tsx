import { db } from "@/lib/db";
import { Nav } from "@/app/components/nav";
import { MainBoard, type MainTask, type MonthGoal } from "@/app/components/main-board";
import { weekStartOf, weekLabel, daysLeftInWeek } from "@/lib/week";

export const dynamic = "force-dynamic";

/**
 * Главный экран — ровно три блока (ТЗ §19.5), в этом порядке:
 * ① основные задачи недели · ② названия целей месяца · ③ что делаю сегодня.
 *
 * Ни статистики, ни денег, ни прогресс-баров: всё, что нужно «посмотреть и
 * подумать», живёт на вкладках. Здесь только то, что определяет действие сейчас.
 */
export default async function Main() {
  const now = new Date();
  const weekStart = weekStartOf(now);

  const [week, today, projects] = await Promise.all([
    db.task.findMany({
      where: { weekStart, status: { not: "frozen" } },
      include: { project: { select: { title: true, icon: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    }),
    db.task.findMany({
      where: { status: { in: ["today", "doing"] } },
      include: { project: { select: { title: true, icon: true } } },
      orderBy: [{ isTopGoal: "desc" }, { createdAt: "asc" }],
    }),
    db.project.findMany({ where: { status: "work" }, orderBy: { potentialUsd: "desc" } }),
  ]);

  // Недельные и сегодняшние пересекаются — держим их одним списком без дублей.
  const merged = new Map<string, MainTask>();
  for (const t of [...week, ...today]) {
    merged.set(t.id, {
      id: t.id,
      title: t.title,
      status: t.status,
      estimateMin: t.estimateMin,
      firstStep: t.firstStep,
      forWhom: t.forWhom,
      projectTitle: t.project?.title ?? null,
      projectIcon: t.project?.icon ?? null,
      isTopGoal: t.isTopGoal,
      inWeek: t.weekStart?.getTime() === weekStart.getTime(),
    });
  }

  const goals: MonthGoal[] = projects.map((p) => ({
    id: p.id,
    title: p.title,
    icon: p.icon,
    monthGoal: p.monthGoal,
  }));

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "32px 18px 70px" }}>
      <p className="num" style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--dim)", margin: "0 0 9px" }}>
        {now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })} · неделя {weekLabel(weekStart)} · осталось{" "}
        {daysLeftInWeek(now, weekStart)} дн
      </p>
      <Nav active="main" />

      <MainBoard tasks={[...merged.values()]} goals={goals} />
    </main>
  );
}
