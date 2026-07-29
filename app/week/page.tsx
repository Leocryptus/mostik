import { Nav } from "@/app/components/nav";
import { WeekBoard } from "@/app/components/week-board";
import { weekStartOf, weekLabel, daysLeftInWeek } from "@/lib/week";

export const dynamic = "force-dynamic";

/**
 * Вкладка «Неделя» — второй уровень иерархии: месяц задал цели, неделя решает,
 * что из них делаю (ТЗ §19.5). Здесь выбор и рамки, здесь же заводятся задачи.
 */
export default function WeekPage() {
  const now = new Date();
  const start = weekStartOf(now);

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 18px 70px" }}>
      <p className="num" style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--dim)", margin: "0 0 9px" }}>
        неделя {weekLabel(start)} · осталось {daysLeftInWeek(now, start)} дн
      </p>
      <Nav active="week" />
      <h1 style={{ fontSize: 26, letterSpacing: "-.035em", lineHeight: 1.06, margin: "0 0 8px" }}>Что делаю на этой неделе</h1>
      <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "0 0 18px", maxWidth: "62ch" }}>
        Месяц задал цели, неделя выбирает из них главное. Выбранное станет ядром главного экрана, а день будет собираться
        из этих задач.
      </p>

      <WeekBoard />
    </main>
  );
}
