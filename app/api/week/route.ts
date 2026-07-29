import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  weekStartOf,
  weekLabel,
  daysLeftInWeek,
  parseList,
  serializeList,
  normalizeStones,
  rankWeekCandidates,
  type WeekCandidate,
} from "@/lib/week";

/**
 * Неделя: рамки (три камня и стоп-лист) и выбор основных задач из проектов месяца.
 *
 * Пул кандидатов приходит уже с рангом и причинами — сырой список без ранга
 * запрещён заданием, Лео не должен приоритизировать руками.
 */

const dayMs = 86_400_000;

export async function GET() {
  const now = new Date();
  const weekStart = weekStartOf(now);
  const month = now.toISOString().slice(0, 7);

  const [commitment, chosen, active, monthGoals] = await Promise.all([
    db.weeklyCommitment.findUnique({ where: { weekStart } }),
    db.task.findMany({
      where: { weekStart, status: { not: "frozen" } },
      include: { project: { select: { title: true, icon: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    }),
    db.project.findMany({ where: { status: "work" }, orderBy: { potentialUsd: "desc" } }),
    db.monthContract.findMany({ where: { month } }),
  ]);

  // Пул — задачи активных проектов, ещё не взятые в эту неделю.
  const pool = await db.task.findMany({
    where: {
      status: "inbox",
      projectId: { in: active.map((p) => p.id) },
      OR: [{ weekStart: null }, { weekStart: { not: weekStart } }],
    },
    take: 300,
  });

  const byProject = active.map((p) => {
    const items: WeekCandidate[] = pool
      .filter((t) => t.projectId === p.id)
      .map((t) => ({
        id: t.id,
        title: t.title,
        potentialUsd: p.potentialUsd ?? undefined,
        hellYeah: p.hellYeah ?? undefined,
        estimateMin: t.estimateMin ?? undefined,
        overdueDays: t.due && t.due.getTime() < now.getTime()
          ? Math.floor((now.getTime() - t.due.getTime()) / dayMs)
          : 0,
      }));

    return {
      id: p.id,
      title: p.title,
      icon: p.icon,
      monthGoal: p.monthGoal,
      // ведущее число живёт в контракте месяца — на неделе оно нужно как ориентир
      leadMetric: monthGoals.find((c) => c.projectId === p.id)?.leadMetric ?? null,
      candidates: rankWeekCandidates(items, 5),
      total: items.length,
    };
  });

  // Инбокс без проекта. Без этой группы экран был бы тупиком: почти весь инбокс
  // Лео пришёл из старого канона задач, где проекта у задачи не было вообще.
  const loose = await db.task.findMany({
    where: {
      status: "inbox",
      projectId: null,
      OR: [{ weekStart: null }, { weekStart: { not: weekStart } }],
    },
    take: 200,
  });

  const looseRanked = rankWeekCandidates(
    loose.map<WeekCandidate>((t) => ({
      id: t.id,
      title: t.title,
      estimateMin: t.estimateMin ?? undefined,
      overdueDays: t.due && t.due.getTime() < now.getTime()
        ? Math.floor((now.getTime() - t.due.getTime()) / dayMs)
        : 0,
    })),
    8,
  );

  return NextResponse.json({
    weekStart: weekStart.toISOString(),
    label: weekLabel(weekStart),
    daysLeft: daysLeftInWeek(now, weekStart),
    unassigned: looseRanked,
    unassignedTotal: loose.length,
    stones: parseList(commitment?.stones),
    stopList: parseList(commitment?.stopList),
    tasks: chosen.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      estimateMin: t.estimateMin,
      firstStep: t.firstStep,
      forWhom: t.forWhom,
      projectId: t.projectId,
      projectTitle: t.project?.title ?? null,
      projectIcon: t.project?.icon ?? null,
      inDay: t.status === "today" || t.status === "doing",
      done: t.status === "done",
    })),
    projects: byProject,
  });
}

/** Рамки недели. Приходят целиком — Лео правит их одной формой, а не по одной строке. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { stones?: string[]; stopList?: string[] };
  const weekStart = weekStartOf(new Date());

  const stones = Array.isArray(body.stones) ? serializeList(normalizeStones(body.stones)) : undefined;
  const stopList = Array.isArray(body.stopList) ? serializeList(body.stopList) : undefined;

  const existing = await db.weeklyCommitment.findUnique({ where: { weekStart } });
  const saved = existing
    ? await db.weeklyCommitment.update({
        where: { weekStart },
        data: { ...(stones !== undefined ? { stones } : {}), ...(stopList !== undefined ? { stopList } : {}) },
      })
    : await db.weeklyCommitment.create({
        data: { weekStart, stones: stones ?? "[]", stopList: stopList ?? "[]" },
      });

  return NextResponse.json({ stones: parseList(saved.stones), stopList: parseList(saved.stopList) });
}
