import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { weekStartOf } from "@/lib/week";

/**
 * Что попадает в основные задачи недели.
 *
 * Две операции: взять готовую задачу проекта в неделю (или снять) и завести
 * новую прямо здесь. Второе важно: ввод задач живёт в мостике, заводить их
 * где-то ещё запрещено заданием.
 *
 * Снятие с недели не удаляет задачу и не трогает её статус — она возвращается
 * в пул проекта. Удаления в системе нет вообще.
 */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as {
    taskId?: string;
    on?: boolean;
    projectId?: string;
    title?: string;
    estimateMin?: number;
    firstStep?: string;
    forWhom?: string;
  };
  const weekStart = weekStartOf(new Date());

  // ── новая задача сразу в неделю ──
  if (b.title !== undefined) {
    const title = b.title.trim();
    if (!title) return NextResponse.json({ error: "Задача без названия не заводится" }, { status: 400 });

    const task = await db.task.create({
      data: {
        title,
        projectId: b.projectId || null,
        estimateMin: typeof b.estimateMin === "number" && b.estimateMin > 0 ? b.estimateMin : null,
        firstStep: b.firstStep?.trim() || null,
        forWhom: b.forWhom?.trim() || null,
        weekStart,
        status: "inbox",
      },
    });
    return NextResponse.json({ task, created: true });
  }

  // ── взять существующую в неделю или снять ──
  if (!b.taskId) return NextResponse.json({ error: "Не указано, какую задачу берём" }, { status: 400 });

  const task = await db.task.findUnique({ where: { id: b.taskId } });
  if (!task) return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });

  // Проект можно привязать в момент выбора: почти весь инбокс Лео пришёл из
  // старого канона без проекта, а без родителя задача теряет смысл на месяце.
  const updated = await db.task.update({
    where: { id: task.id },
    data: {
      weekStart: b.on === false ? null : weekStart,
      ...(b.projectId ? { projectId: b.projectId } : {}),
    },
  });

  return NextResponse.json({ task: updated });
}
