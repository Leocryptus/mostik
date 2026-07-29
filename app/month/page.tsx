import { db } from "@/lib/db";
import { Nav } from "@/app/components/nav";
import { GoalsBoard } from "@/app/components/goals-board";

export const dynamic = "force-dynamic";

/** Вкладка «Месяц» (ТЗ §4.2): 3–5 задач месяца с метрикой, OKR и подпроектами. */
export default async function MonthPage() {
  const inbox = await db.task.count({ where: { status: "inbox", adequacyAt: null } });
  const now = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 18px 70px" }}>
      <p className="num" style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--dim)", margin: "0 0 9px" }}>
        {now.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })} · осталось {daysLeft} дн
      </p>
      <Nav active="month" inbox={inbox} />
      <h1 style={{ fontSize: 26, letterSpacing: "-.035em", lineHeight: 1.06, margin: "0 0 8px" }}>Ради чего этот месяц</h1>
      <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "0 0 18px", maxWidth: "62ch" }}>
        Три-пять крупных задач. У каждой — что станет правдой, метрика, которая это докажет, ключевые результаты и
        подпроекты. День собирается из их шагов.
      </p>

      <GoalsBoard />
    </main>
  );
}
