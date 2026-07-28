import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkActivate } from "@/lib/day";

/**
 * Правка проекта прямо с мостика: цель месяца, ведущее число, следующий шаг.
 * Систему считает сама, но курс задаёт Лео — поэтому эти поля правятся руками.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as Record<string, string>;

  if (b.status === "work") {
    const current = await db.project.findUnique({ where: { id } });
    if (current?.status !== "work") {
      const active = await db.project.count({ where: { status: "work" } });
      const check = checkActivate(active);
      if (!check.allowed) {
        const swap = await db.project.findMany({ where: { status: "work" }, select: { id: true, title: true } });
        return NextResponse.json({ error: check.reason, offerSwap: swap }, { status: 409 });
      }
    }
  }

  const project = await db.project.update({
    where: { id },
    data: {
      ...(b.monthGoal !== undefined ? { monthGoal: b.monthGoal || null } : {}),
      ...(b.nextStep !== undefined ? { nextStep: b.nextStep || null } : {}),
      ...(b.status ? { status: b.status } : {}),
    },
  });

  // ведущее число живёт в контракте месяца
  if (b.leadMetric !== undefined || b.leadTarget !== undefined) {
    const month = new Date().toISOString().slice(0, 7);
    const existing = await db.monthContract.findFirst({ where: { projectId: id, month } });
    const data = {
      becomesTrue: b.monthGoal ?? project.monthGoal ?? "",
      leadMetric: b.leadMetric || null,
      leadTarget: b.leadTarget ? Number(b.leadTarget) : null,
    };
    if (existing) await db.monthContract.update({ where: { id: existing.id }, data });
    else await db.monthContract.create({ data: { ...data, projectId: id, month } });
  }

  return NextResponse.json({ project });
}

/** Отметить движение по проекту — это и есть факт, от которого живут светофоры. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as { note?: string };
  await db.activity.create({ data: { type: "kr_tick", projectId: id, note: b.note ?? "шаг по проекту" } });

  const month = new Date().toISOString().slice(0, 7);
  const contract = await db.monthContract.findFirst({ where: { projectId: id, month } });
  if (contract) {
    await db.monthContract.update({ where: { id: contract.id }, data: { leadFact: contract.leadFact + 1 } });
  }
  return NextResponse.json({ ok: true });
}
