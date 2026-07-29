import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rankCandidates, capacityState, streakFromDays, LIMITS, type Candidate } from "@/lib/day";
import { weekStartOf, rankWeekCandidates, type WeekCandidate } from "@/lib/week";

/**
 * Состояние дня: что уже взято, из чего собирать и сколько влезет.
 *
 * Порядок сбора задан иерархией (ТЗ §19.5): день собирается ИЗ НЕДЕЛЬНЫХ задач,
 * а инбокс — это мелочёвка, которая открывается после основного. Поэтому
 * недельные и инбокс приходят двумя разными списками, а не одной кучей.
 *
 * Отсюда же кормится утренняя карточка в Telegram — одна ручка на все поверхности.
 */
export async function GET() {
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  const capacity = settings?.dayCapacity ?? 180;
  const freezes = settings?.freezesPerWeek ?? 2;

  const now = Date.now();
  const dayMs = 86_400_000;
  const weekStart = weekStartOf(new Date());

  const today = await db.task.findMany({
    where: { status: { in: ["today", "doing"] } },
    orderBy: { isTopGoal: "desc" },
  });

  // ── основное: задачи, выбранные на эту неделю и ещё не взятые в день ──
  const weekly = await db.task.findMany({
    where: { status: "inbox", weekStart },
    include: { project: { select: { potentialUsd: true, hellYeah: true, title: true, icon: true } } },
  });

  const weeklyRanked = rankWeekCandidates(
    weekly.map<WeekCandidate>((t) => ({
      id: t.id,
      title: t.title,
      potentialUsd: t.project?.potentialUsd ?? undefined,
      hellYeah: t.project?.hellYeah ?? undefined,
      estimateMin: t.estimateMin ?? undefined,
      overdueDays: t.due && t.due.getTime() < now ? Math.floor((now - t.due.getTime()) / dayMs) : 0,
    })),
  ).map((c) => {
    const src = weekly.find((t) => t.id === c.id);
    return {
      ...c,
      firstStep: src?.firstStep ?? null,
      projectTitle: src?.project?.title ?? null,
      projectIcon: src?.project?.icon ?? null,
    };
  });

  // ── мелочёвка: остальной инбокс, недельные из него исключены ──
  const inbox = await db.task.findMany({
    where: { status: "inbox", OR: [{ weekStart: null }, { weekStart: { not: weekStart } }] },
    include: { project: { select: { potentialUsd: true, hellYeah: true, title: true } } },
    take: 200,
  });

  const candidates: Candidate[] = inbox.map((t) => ({
    id: t.id,
    title: t.title,
    potentialUsd: t.project?.potentialUsd ?? undefined,
    hellYeah: t.project?.hellYeah ?? undefined,
    hoursCost: t.estimateMin ? t.estimateMin / 60 : 1,
    overdueDays: t.due && t.due.getTime() < now ? Math.floor((now - t.due.getTime()) / dayMs) : 0,
    ageDays: Math.floor((now - t.createdAt.getTime()) / dayMs),
  }));

  const facts = await db.activity.findMany({
    where: { createdAt: { gte: new Date(now - 90 * dayMs) } },
    select: { createdAt: true },
  });

  const plannedMin = today.reduce((s, t) => s + (t.estimateMin ?? 30), 0);

  return NextResponse.json({
    limits: LIMITS,
    today: today.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      isTopGoal: t.isTopGoal,
      estimateMin: t.estimateMin,
      firstStep: t.firstStep,
      fromWeek: t.weekStart?.getTime() === weekStart.getTime(),
    })),
    freeSlots: Math.max(0, LIMITS.tasksPerDay - today.length),
    weekly: weeklyRanked,
    weeklyTotal: weekly.length,
    candidates: rankCandidates(candidates),
    capacity: capacityState(plannedMin, capacity),
    streak: streakFromDays(facts.map((f) => f.createdAt), new Date(), freezes),
    inboxTotal: inbox.length,
  });
}
