import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadGoals, placementCorpus } from "@/lib/goals";
import { suggestPlacement, type PlacementCandidate } from "@/lib/simple";

const dayMs = 86_400_000;

/**
 * Инбокс: всё неразобранное плюс подсказка, куда это положить.
 *
 * Неразобранное — это записи без отметки адекватизации. Заведённые руками
 * внутри проекта такой отметкой помечаются сразу и сюда не попадают.
 */
export async function GET() {
  const goals = (await loadGoals()).filter((g) => g.status === "work");
  const candidates: PlacementCandidate[] = goals.map((g) => ({ id: g.id, title: g.title, corpus: placementCorpus(g) }));

  const [raw, total, sortedToday] = await Promise.all([
    db.task.findMany({
      where: { status: "inbox", adequacyAt: null },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    db.task.count({ where: { status: "inbox", adequacyAt: null } }),
    db.task.count({
      where: { adequacyAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
  ]);

  const now = Date.now();

  return NextResponse.json({
    total,
    sortedToday,
    items: raw.map((t) => ({
      id: t.id,
      title: t.title,
      ageDays: Math.floor((now - t.createdAt.getTime()) / dayMs),
      due: t.due,
      suggestion: suggestPlacement(t.title, candidates),
    })),
    goals: goals.map((g) => ({
      id: g.id,
      title: g.title,
      icon: g.icon,
      subprojects: g.subprojects.map((s) => ({ id: s.id, title: s.title })),
    })),
  });
}

/** Новая запись. Одно действие, никаких обязательных полей — разбор потом. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { text?: string };
  const title = b.text?.trim();
  if (!title) return NextResponse.json({ error: "Пустую запись не сохраняю" }, { status: 400 });

  const task = await db.task.create({ data: { title, status: "inbox" } });
  return NextResponse.json({ task });
}
