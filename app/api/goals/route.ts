import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadGoals } from "@/lib/goals";
import { checkTakeGoal, SIMPLE_LIMITS } from "@/lib/simple";

/** Все задачи месяца с OKR, подпроектами и шагами — один источник для всех экранов. */
export async function GET() {
  const goals = await loadGoals();
  return NextResponse.json({
    goals,
    active: goals.filter((g) => g.status === "work").length,
    limits: SIMPLE_LIMITS,
  });
}

/** Новая задача месяца. Сразу активной, если есть свободное место из пяти. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { title?: string; icon?: string };
  const title = b.title?.trim();
  if (!title) return NextResponse.json({ error: "Задача месяца без названия не заводится" }, { status: 400 });

  const active = await db.project.count({ where: { status: "work" } });
  const check = checkTakeGoal(active);

  const project = await db.project.create({
    data: { title, icon: b.icon?.trim() || null, status: check.allowed ? "work" : "candidate" },
  });

  return NextResponse.json({ project, activated: check.allowed, note: check.reason ?? null });
}
