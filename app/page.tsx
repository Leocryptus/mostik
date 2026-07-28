import { db } from "@/lib/db";
import { DayBoard } from "@/app/components/day-board";
import { SignalMark } from "@/app/components/signal-mark";

export const dynamic = "force-dynamic"; // мостик всегда показывает свежее состояние

const money = (n: number) => "$" + n.toLocaleString("ru-RU").replace(/,/g, " ");

export default async function Bridge() {
  const month = new Date().toISOString().slice(0, 7);

  const [projects, moneyMonth, total, inbox, done, noDay, people] = await Promise.all([
    db.project.findMany({ orderBy: { potentialUsd: "desc" } }),
    db.moneyMonth.findFirst({ where: { month } }),
    db.task.count(),
    db.task.count({ where: { status: "inbox" } }),
    db.task.count({ where: { status: "done" } }),
    db.task.count({ where: { status: "inbox", due: null } }),
    db.person.count({ where: { active: true } }),
  ]);

  const potential = projects.reduce((s, p) => s + (p.potentialUsd ?? 0), 0);
  const goal = moneyMonth?.goalUsd ?? 0;
  const fact = moneyMonth?.factUsd ?? null;

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 20px 80px" }}>
      <p className="num" style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--dim)", margin: "0 0 10px" }}>
        Мостик · {new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
      </p>
      <h1 style={{ fontSize: 34, letterSpacing: "-.035em", lineHeight: 1.06, margin: "0 0 26px" }}>Где мы сейчас</h1>

      {/* контур дня — первое, что видно */}
      <DayBoard />


      {/* ДЕНЬГИ МЕСЯЦА */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>Цель месяца</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 750, marginTop: 3 }}>{money(goal)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>Потенциал проектов</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 750, marginTop: 3, color: "var(--s-ok)" }}>{money(potential)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>Факт</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 750, marginTop: 3, color: fact === null ? "var(--s-none)" : "var(--s-ok)" }}>
              {fact === null ? "—" : money(fact)}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--dim)", marginTop: 2 }}>вводится в конце месяца</div>
          </div>
        </div>
      </div>

      {/* ЗАДАЧИ */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <h2 style={{ fontSize: 17, margin: 0 }}>Задачи</h2>
          <span className="num" style={{ fontSize: 12.5, color: "var(--muted)" }}>перенесено из старого канона</span>
        </div>
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginBottom: 12 }}>
          <span className="num" style={{ fontSize: 15 }}>
            всего <b style={{ fontSize: 19 }}>{total}</b>
          </span>
          <span className="num" style={{ fontSize: 15, color: "var(--s-behind)" }}>
            в инбоксе <b style={{ fontSize: 19 }}>{inbox}</b>
          </span>
          <span className="num" style={{ fontSize: 15, color: "var(--s-over)" }}>
            закрыто <b style={{ fontSize: 19 }}>{done}</b>
          </span>
          <span className="num" style={{ fontSize: 15, color: "var(--s-gap)" }}>
            без дня <b style={{ fontSize: 19 }}>{noDay}</b>
          </span>
        </div>

        <div className="t-note" style={{ borderLeftColor: "var(--s-gap)", background: "rgba(255,46,136,.06)", margin: "0 0 12px" }}>
          Из {total} задач {inbox} лежат в инбоксе, у {noDay} нет дня. Это и есть та куча, ради которой всё строится — контур дня начнёт разбирать её на следующем шаге.
        </div>

      </div>

      {/* ПРОЕКТЫ */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <h2 style={{ fontSize: 17, margin: 0 }}>Проекты</h2>
          <span className="num" style={{ fontSize: 12.5, color: "var(--muted)" }}>{people} человек в команде</span>
        </div>
        {projects.map((p) => (
          <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 0", borderTop: "1px solid var(--line)", fontSize: 14 }}>
            <SignalMark signal={p.status === "candidate" ? "none" : "ok"} />
            <span style={{ flex: 1 }}>
              {p.icon} {p.title}
              {p.owner && <span style={{ color: "var(--muted)", fontSize: 12.5 }}> · ведёт {p.owner}</span>}
            </span>
            <span className="num" style={{ fontSize: 13, color: p.potentialUsd ? "var(--s-ok)" : "var(--s-none)" }}>
              {p.potentialUsd ? money(p.potentialUsd) + " / мес" : "цифры нет"}
            </span>
          </div>
        ))}
        <div className="t-note" style={{ marginBottom: 0 }}>
          Все проекты пока кандидаты: активными они станут после прожарки, где у каждого появятся ведущее число, владелец и контракт месяца.
        </div>
      </div>

      <p style={{ color: "var(--dim)", fontSize: 12.5, marginTop: 22 }}>
        Данные живые, из базы мостика. Стиль — <a href="/dev/tokens">дизайн-ядро</a>.
      </p>
    </main>
  );
}
