import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkTakeGoal } from "@/lib/simple";

/**
 * Одна задача месяца: правка полей и все действия внутри неё.
 *
 * Действия собраны в одну ручку намеренно — иначе на каждый чих появляется
 * свой роут, и правила (лимиты, факты движения) начинают расходиться.
 */

/** Правка полей: название, что станет правдой, метрика, владелец, статус. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as Record<string, string>;

  if (b.status === "work") {
    const current = await db.project.findUnique({ where: { id } });
    if (current?.status !== "work") {
      const active = await db.project.count({ where: { status: "work" } });
      const check = checkTakeGoal(active);
      if (!check.allowed) {
        const swap = await db.project.findMany({ where: { status: "work" }, select: { id: true, title: true } });
        return NextResponse.json({ error: check.reason, offerSwap: swap }, { status: 409 });
      }
    }
  }

  const project = await db.project.update({
    where: { id },
    data: {
      ...(b.title !== undefined && b.title.trim() ? { title: b.title.trim() } : {}),
      ...(b.icon !== undefined ? { icon: b.icon.trim() || null } : {}),
      ...(b.becomesTrue !== undefined ? { monthGoal: b.becomesTrue.trim() || null } : {}),
      ...(b.owner !== undefined ? { owner: b.owner.trim() || null } : {}),
      ...(b.potentialUsd !== undefined ? { potentialUsd: b.potentialUsd ? Number(b.potentialUsd) : null } : {}),
      ...(b.status ? { status: b.status } : {}),
    },
  });

  // метрика живёт в контракте месяца
  if (b.metricName !== undefined || b.metricTarget !== undefined) {
    const month = new Date().toISOString().slice(0, 7);
    const existing = await db.monthContract.findFirst({ where: { projectId: id, month } });
    const data = {
      becomesTrue: b.becomesTrue ?? project.monthGoal ?? "",
      leadMetric: b.metricName?.trim() || null,
      leadTarget: b.metricTarget ? Number(b.metricTarget) : null,
    };
    if (existing) await db.monthContract.update({ where: { id: existing.id }, data });
    else await db.monthContract.create({ data: { ...data, projectId: id, month } });
  }

  return NextResponse.json({ project });
}

/** Действия внутри задачи месяца. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as {
    action?: string;
    krId?: string;
    subId?: string;
    name?: string;
    title?: string;
    target?: number;
    current?: number;
    unit?: string;
    nextStep?: string;
    ownerName?: string;
    firstStep?: string;
    estimateMin?: number;
    note?: string;
  };

  switch (b.action) {
    // ── ключевые результаты ──
    case "kr.add": {
      const name = b.name?.trim();
      if (!name) return NextResponse.json({ error: "Результат без названия не заводится" }, { status: 400 });
      const kr = await db.kR.create({
        data: { projectId: id, name, target: Number(b.target) || 1, current: 0, unit: b.unit?.trim() || null },
      });
      return NextResponse.json({ kr });
    }
    case "kr.set": {
      if (!b.krId) return NextResponse.json({ error: "Не указан результат" }, { status: 400 });
      const kr = await db.kR.update({
        where: { id: b.krId },
        data: {
          ...(b.current !== undefined ? { current: Math.max(0, Number(b.current)) } : {}),
          ...(b.target !== undefined ? { target: Math.max(1, Number(b.target)) } : {}),
          ...(b.name !== undefined && b.name.trim() ? { name: b.name.trim() } : {}),
        },
      });
      // движение по результату — это факт
      if (b.current !== undefined) {
        await db.activity.create({ data: { type: "kr_tick", projectId: id, note: `${kr.name}: ${kr.current}` } });
      }
      return NextResponse.json({ kr });
    }

    // ── подпроекты ──
    case "sub.add": {
      const title = b.title?.trim();
      if (!title) return NextResponse.json({ error: "Подпроект без названия не заводится" }, { status: 400 });
      const count = await db.stream.count({ where: { projectId: id } });
      const stream = await db.stream.create({
        data: { projectId: id, title, nextStep: b.nextStep?.trim() || null, ownerName: b.ownerName?.trim() || null, sort: count },
      });
      return NextResponse.json({ stream });
    }
    case "sub.patch": {
      if (!b.subId) return NextResponse.json({ error: "Не указан подпроект" }, { status: 400 });
      const stream = await db.stream.update({
        where: { id: b.subId },
        data: {
          ...(b.title !== undefined && b.title.trim() ? { title: b.title.trim() } : {}),
          ...(b.nextStep !== undefined ? { nextStep: b.nextStep.trim() || null } : {}),
          ...(b.ownerName !== undefined ? { ownerName: b.ownerName.trim() || null } : {}),
        },
      });
      return NextResponse.json({ stream });
    }
    case "sub.close": {
      if (!b.subId) return NextResponse.json({ error: "Не указан подпроект" }, { status: 400 });
      // не удаляем, а закрываем: шаги внутри остаются в истории
      const stream = await db.stream.update({ where: { id: b.subId }, data: { active: false } });
      return NextResponse.json({ stream });
    }

    // ── шаги ──
    case "step.add": {
      const title = b.title?.trim();
      if (!title) return NextResponse.json({ error: "Шаг без названия не заводится" }, { status: 400 });
      const task = await db.task.create({
        data: {
          title,
          projectId: id,
          streamId: b.subId || null,
          firstStep: b.firstStep?.trim() || null,
          estimateMin: b.estimateMin ? Number(b.estimateMin) : null,
          status: "inbox",
          adequacyAt: new Date(), // заведён руками внутри проекта — разбор уже не нужен
        },
      });
      return NextResponse.json({ task });
    }

    // ── факт движения без закрытия шага (позвонил, договорился) ──
    case "fact": {
      await db.activity.create({ data: { type: "kr_tick", projectId: id, note: b.note?.trim() || "шаг по задаче месяца" } });
      const month = new Date().toISOString().slice(0, 7);
      const contract = await db.monthContract.findFirst({ where: { projectId: id, month } });
      if (contract) await db.monthContract.update({ where: { id: contract.id }, data: { leadFact: contract.leadFact + 1 } });
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: `Неизвестное действие: ${b.action}` }, { status: 400 });
  }
}
