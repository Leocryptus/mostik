import { db } from "@/lib/db";
import { Nav } from "@/app/components/nav";
import { TodayBoard } from "@/app/components/today-board";

export const dynamic = "force-dynamic";

/**
 * Главный экран простой версии: что делаю сегодня и ради чего (ТЗ §4.1).
 * Ни цифр, ни баров, ни статистики — всё это на «Месяце».
 */
export default async function Today() {
  const inbox = await db.task.count({ where: { status: "inbox", adequacyAt: null } });

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 18px 70px" }}>
      <p className="num" style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--dim)", margin: "0 0 9px" }}>
        {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
      </p>
      <Nav active="today" inbox={inbox} />
      <TodayBoard />
    </main>
  );
}
