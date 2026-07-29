import { db } from "@/lib/db";
import { Nav } from "@/app/components/nav";
import { GoalDetail } from "@/app/components/goal-detail";

export const dynamic = "force-dynamic";

/** Страница одной задачи месяца (ТЗ §4.3). Подстраница «Месяца», своей вкладки не имеет. */
export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inbox = await db.task.count({ where: { status: "inbox", adequacyAt: null } });

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "32px 18px 70px" }}>
      <p className="num" style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--dim)", margin: "0 0 9px" }}>
        задача месяца
      </p>
      <Nav active="month" inbox={inbox} />
      <GoalDetail id={id} />
    </main>
  );
}
