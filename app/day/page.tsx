import { db } from "@/lib/db";
import { DayBoard } from "@/app/components/day-board";
import { Nav } from "@/app/components/nav";
import { weekStartOf } from "@/lib/week";

export const dynamic = "force-dynamic";

/**
 * Вкладка «День» — третий уровень иерархии: неделя выбрала главное, день решает,
 * что из этого делаю сегодня (ТЗ §19.5). Инбокс тоже здесь, но ниже основного.
 */
export default async function DayPage() {
  const weekStart = weekStartOf(new Date());
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [weekLeft, inbox, doneToday] = await Promise.all([
    db.task.count({ where: { weekStart, status: "inbox" } }),
    db.task.count({ where: { status: "inbox", OR: [{ weekStart: null }, { weekStart: { not: weekStart } }] } }),
    db.task.count({ where: { status: "done", doneAt: { gte: todayStart } } }),
  ]);

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 18px 70px" }}>
      <p className="num" style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--dim)", margin: "0 0 9px" }}>
        {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
      </p>
      <Nav active="day" />
      <h1 style={{ fontSize: 26, letterSpacing: "-.035em", lineHeight: 1.06, margin: "0 0 8px" }}>Собрать день</h1>
      <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "0 0 18px", maxWidth: "62ch" }}>
        До трёх задач из недельных — утром они уже будут на главном экране. Мелочёвка из инбокса ждёт внизу и не мешает
        основному.
      </p>

      <div className="card" style={{ marginBottom: 14, display: "flex", gap: 22, flexWrap: "wrap" }}>
        <span className="num" style={{ fontSize: 13.5, color: "var(--s-ok)" }}>
          недельных свободно <b style={{ fontSize: 19 }}>{weekLeft}</b>
        </span>
        <span className="num" style={{ fontSize: 13.5, color: "var(--s-behind)" }}>
          в инбоксе <b style={{ fontSize: 19 }}>{inbox}</b>
        </span>
        <span className="num" style={{ fontSize: 13.5, color: "var(--s-over)" }}>
          закрыто сегодня <b style={{ fontSize: 19 }}>{doneToday}</b>
        </span>
      </div>

      <DayBoard />
    </main>
  );
}
