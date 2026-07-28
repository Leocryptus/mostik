import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkTakeToday, checkStartWork } from "@/lib/day";

/**
 * Смена статуса задачи. Лимиты проверяются ЗДЕСЬ, на сервере:
 * интерфейс можно обойти, сервер нет. При отказе отдаём 409 и предложение
 * обмена — сухой запрет ощущается как клетка, а не как помощь.
 *
 * Удаления нет и не будет: вместо него статус «заморожено».
 */

const ALLOWED = ["inbox", "today", "doing", "done", "frozen"] as const;
type Status = (typeof ALLOWED)[number];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { status?: string };
  const status = body.status as Status | undefined;

  if (!status || !ALLOWED.includes(status)) {
    return NextResponse.json({ error: `Статус должен быть одним из: ${ALLOWED.join(", ")}` }, { status: 400 });
  }

  const task = await db.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });

  // ── лимиты ──
  if (status === "today" && task.status !== "today") {
    const count = await db.task.count({ where: { status: "today" } });
    const check = checkTakeToday(count);
    if (!check.allowed) {
      const swap = await db.task.findMany({ where: { status: "today" }, select: { id: true, title: true } });
      return NextResponse.json({ error: check.reason, offerSwap: swap }, { status: 409 });
    }
  }

  if (status === "doing" && task.status !== "doing") {
    const count = await db.task.count({ where: { status: "doing" } });
    const check = checkStartWork(count);
    if (!check.allowed) {
      const swap = await db.task.findMany({ where: { status: "doing" }, select: { id: true, title: true } });
      return NextResponse.json({ error: check.reason, offerSwap: swap }, { status: 409 });
    }
  }

  const doneNow = status === "done" && task.status !== "done";

  const updated = await db.task.update({
    where: { id },
    data: { status, doneAt: doneNow ? new Date() : status === "done" ? task.doneAt : null },
  });

  // Факт движения пишем только при реальном закрытии. «Взял в работу» —
  // не движение, это принципиально: иначе светофоры начнут врать.
  if (doneNow) {
    await db.activity.create({
      data: { type: "task_done", taskId: task.id, projectId: task.projectId, note: task.title },
    });
  }

  return NextResponse.json({ task: updated, factRecorded: doneNow });
}
