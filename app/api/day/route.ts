import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadGoals } from "@/lib/goals";
import { SIMPLE_LIMITS } from "@/lib/simple";

/**
 * День простой версии: что уже взято и из чего выбирать.
 *
 * Выбирать можно ТОЛЬКО из шагов подпроектов активных задач месяца — в этом
 * вся суть иерархии. Инбокс в день не попадает: сначала разбор, потом работа.
 */
export async function GET() {
  const goals = (await loadGoals()).filter((g) => g.status === "work");

  const today = await db.task.findMany({
    where: { status: { in: ["today", "doing"] } },
    include: { project: { select: { title: true, icon: true } }, stream: { select: { title: true } } },
    orderBy: [{ isTopGoal: "desc" }, { createdAt: "asc" }],
  });

  const takenIds = new Set(today.map((t) => t.id));

  // доступные шаги, сгруппированные по задаче месяца — чтобы на экране было видно, ради чего
  const available = goals
    .map((g) => ({
      goalId: g.id,
      goalTitle: g.title,
      goalIcon: g.icon,
      state: g.state,
      steps: [
        ...g.subprojects.flatMap((s) =>
          s.steps
            .filter((t) => t.status === "inbox" && !takenIds.has(t.id))
            .map((t) => ({ ...t, subTitle: s.title })),
        ),
        ...g.looseSteps
          .filter((t) => t.status === "inbox" && !takenIds.has(t.id))
          .map((t) => ({ ...t, subTitle: null as string | null })),
      ],
    }))
    .filter((g) => g.steps.length > 0);

  return NextResponse.json({
    limits: SIMPLE_LIMITS,
    freeSlots: Math.max(0, SIMPLE_LIMITS.stepsPerDay - today.length),
    today: today.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      isTopGoal: t.isTopGoal,
      firstStep: t.firstStep,
      becomesTrue: t.becomesTrue,
      estimateMin: t.estimateMin,
      goalTitle: t.project?.title ?? null,
      goalIcon: t.project?.icon ?? null,
      subTitle: t.stream?.title ?? null,
    })),
    available,
    goalNames: goals.map((g) => ({ id: g.id, title: g.title, icon: g.icon, becomesTrue: g.becomesTrue })),
    inboxTotal: await db.task.count({ where: { status: "inbox", adequacyAt: null } }),
  });
}
