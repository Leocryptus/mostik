import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adequacyComplete, checkTakeGoal } from "@/lib/simple";

/**
 * Разбор одной записи: ответы адекватизации + место, куда она уходит.
 *
 * Четыре места: шаг в подпроект · новый подпроект · новая задача месяца ·
 * морозилка с датой возврата. Удаления нет — «в морозилку» и есть отказ.
 *
 * Запись никогда не исчезает: при превращении в подпроект или задачу месяца
 * она остаётся первым шагом внутри, иначе формулировка Лео потеряется.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as {
    becomesTrue?: string;
    who?: string;
    blocker?: string;
    firstStep?: string;
    place?: { kind?: string; goalId?: string; subId?: string; until?: string };
  };

  const task = await db.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });

  const draft = { becomesTrue: b.becomesTrue, who: b.who, blocker: b.blocker, firstStep: b.firstStep };
  if (!adequacyComplete(draft)) {
    return NextResponse.json(
      { error: "Нужны две вещи: что станет правдой и с чего начать. Остальное необязательно" },
      { status: 400 },
    );
  }

  const who = b.who?.trim() || "Лео";
  const base = {
    becomesTrue: b.becomesTrue!.trim(),
    blocker: b.blocker?.trim() || null,
    firstStep: b.firstStep!.trim(),
    who,
    delegated: who !== "Лео" && who !== "я",
    adequacyAt: new Date(),
  };

  const kind = b.place?.kind ?? "step";

  // ── в морозилку: не отказ навсегда, а дата возврата ──
  if (kind === "freeze") {
    const until = b.place?.until ? new Date(b.place.until) : new Date(Date.now() + 30 * 86_400_000);
    const updated = await db.task.update({
      where: { id },
      data: { ...base, status: "frozen", frozenUntil: until },
    });
    return NextResponse.json({ task: updated, placed: "морозилка", until });
  }

  // ── новая задача месяца: запись становится её первым шагом ──
  if (kind === "goal") {
    const active = await db.project.count({ where: { status: "work" } });
    const check = checkTakeGoal(active);
    const project = await db.project.create({
      data: {
        title: task.title,
        monthGoal: base.becomesTrue,
        status: check.allowed ? "work" : "candidate",
      },
    });
    const updated = await db.task.update({ where: { id }, data: { ...base, projectId: project.id } });
    return NextResponse.json({
      task: updated,
      placed: check.allowed ? `новая задача месяца «${project.title}»` : `кандидат «${project.title}» — мест в месяце нет`,
      goalId: project.id,
      note: check.reason ?? null,
    });
  }

  // ── новый подпроект внутри задачи месяца ──
  if (kind === "subproject") {
    if (!b.place?.goalId) return NextResponse.json({ error: "Не указана задача месяца" }, { status: 400 });
    const count = await db.stream.count({ where: { projectId: b.place.goalId } });
    const stream = await db.stream.create({
      data: { projectId: b.place.goalId, title: task.title, nextStep: base.firstStep, sort: count },
    });
    const updated = await db.task.update({
      where: { id },
      data: { ...base, projectId: b.place.goalId, streamId: stream.id },
    });
    return NextResponse.json({ task: updated, placed: `новый подпроект «${stream.title}»`, subId: stream.id });
  }

  // ── шаг в существующий подпроект (или прямо в задачу месяца) ──
  if (!b.place?.goalId) return NextResponse.json({ error: "Не указано, куда кладём" }, { status: 400 });

  const updated = await db.task.update({
    where: { id },
    data: { ...base, projectId: b.place.goalId, streamId: b.place.subId || null },
  });

  const goal = await db.project.findUnique({ where: { id: b.place.goalId }, select: { title: true } });
  const sub = b.place.subId ? await db.stream.findUnique({ where: { id: b.place.subId }, select: { title: true } }) : null;

  return NextResponse.json({
    task: updated,
    placed: sub ? `${goal?.title} · ${sub.title}` : (goal?.title ?? "задача месяца"),
  });
}
