import { db } from "@/lib/db";
import { DayBoard } from "@/app/components/day-board";

export const dynamic = "force-dynamic";

/**
 * Инбокс и день — отдельная страница. Сюда приходят, когда основное по проектам
 * сделано: мелочёвка идёт десертом, а не вместо главного.
 */
export default async function InboxPage() {
  const [inbox, noDay, done] = await Promise.all([
    db.task.count({ where: { status: "inbox" } }),
    db.task.count({ where: { status: "inbox", due: null } }),
    db.task.count({ where: { status: "done" } }),
  ]);

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "36px 18px 80px" }}>
      <p className="num" style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--dim)", margin: "0 0 9px" }}>
        <a href="/" style={{ color: "var(--dim)" }}>← мостик</a> · инбокс
      </p>
      <h1 style={{ fontSize: 30, letterSpacing: "-.035em", lineHeight: 1.06, margin: "0 0 8px" }}>Мелочёвка и входящие</h1>
      <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "0 0 18px", maxWidth: "62ch" }}>
        Всё, что не относится к проектам месяца. Система подняла наверх просроченное и залежавшееся — можно разобрать пачкой.
      </p>

      <div className="card" style={{ marginBottom: 14, display: "flex", gap: 22, flexWrap: "wrap" }}>
        <span className="num" style={{ fontSize: 13.5, color: "var(--s-behind)" }}>
          в инбоксе <b style={{ fontSize: 19 }}>{inbox}</b>
        </span>
        <span className="num" style={{ fontSize: 13.5, color: "var(--s-gap)" }}>
          без дня <b style={{ fontSize: 19 }}>{noDay}</b>
        </span>
        <span className="num" style={{ fontSize: 13.5, color: "var(--s-over)" }}>
          закрыто <b style={{ fontSize: 19 }}>{done}</b>
        </span>
      </div>

      <DayBoard />
    </main>
  );
}
