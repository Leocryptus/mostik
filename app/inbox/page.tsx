import { db } from "@/lib/db";
import { Nav } from "@/app/components/nav";
import { InboxBoard } from "@/app/components/inbox-board";

export const dynamic = "force-dynamic";

/** Вкладка «Инбокс» (ТЗ §4.4): захват одной строкой и разбор по одному вопросу. */
export default async function InboxPage() {
  const inbox = await db.task.count({ where: { status: "inbox", adequacyAt: null } });

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "32px 18px 70px" }}>
      <p className="num" style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--dim)", margin: "0 0 9px" }}>
        инбокс
      </p>
      <Nav active="inbox" inbox={inbox} />
      <h1 style={{ fontSize: 26, letterSpacing: "-.035em", lineHeight: 1.06, margin: "0 0 8px" }}>Что не разобрано</h1>
      <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "0 0 18px", maxWidth: "62ch" }}>
        Записывай сюда всё подряд — разбор отдельно. Каждая запись после разбора обязательно куда-то ложится: шагом в
        задачу месяца, новым подпроектом, новой задачей месяца или в морозилку с датой возврата.
      </p>

      <InboxBoard />
    </main>
  );
}
