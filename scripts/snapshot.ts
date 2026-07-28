/**
 * Снимок мостика в одну самодостаточную HTML-страницу.
 *
 *   npx tsx scripts/snapshot.ts [путь]
 *
 * Зачем: открыть состояние с любого устройства без Tailscale и без сервера.
 * Стили инлайновые, данные — из базы на момент запуска. Кнопки в снимке
 * не работают: это фотография, а не приложение.
 *
 * Этот же рендер станет основой картинок-отчётов для Телеграма (ТЗ §16.4).
 */
import { writeFileSync } from "node:fs";
import { db } from "../lib/db";
import { rankCandidates, capacityState, streakFromDays, type Candidate } from "../lib/day";
import { signalBySilence, SIGNALS } from "../lib/signals";

const money = (n: number) => "$" + n.toLocaleString("ru-RU").replace(/,/g, " ");
const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);

const MARK: Record<string, string> = {
  ok: `<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="#22d3ee"/></svg>`,
  over: `<svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 0l6 10H0z" fill="#34d399"/></svg>`,
  behind: `<svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="4" width="10" height="4" rx="1" fill="#fbbf24"/></svg>`,
  gap: `<svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 6h3l2-4 2 8 2-4h1" stroke="#ff2e88" stroke-width="1.6" fill="none"/></svg>`,
  dead: `<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="none" stroke="#f43f5e" stroke-width="2"/><circle cx="6" cy="6" r="1.6" fill="#f43f5e"/></svg>`,
  frozen: `<svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1v10M1.5 3.5l9 5M10.5 3.5l-9 5" stroke="#818cf8" stroke-width="1.5"/></svg>`,
  none: `<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6h8" stroke="#64748b" stroke-width="2" stroke-dasharray="2 2"/></svg>`,
};

async function main() {
  const out = process.argv[2] ?? "snapshot.html";
  const month = new Date().toISOString().slice(0, 7);
  const now = Date.now();
  const dayMs = 86_400_000;

  const [projects, moneyMonth, total, inbox, done, noDay, people, settings, todayTasks, inboxTasks, facts] = await Promise.all([
    db.project.findMany({ orderBy: { potentialUsd: "desc" } }),
    db.moneyMonth.findFirst({ where: { month } }),
    db.task.count(),
    db.task.count({ where: { status: "inbox" } }),
    db.task.count({ where: { status: "done" } }),
    db.task.count({ where: { status: "inbox", due: null } }),
    db.person.count({ where: { active: true } }),
    db.settings.findUnique({ where: { id: 1 } }),
    db.task.findMany({ where: { status: { in: ["today", "doing"] } } }),
    db.task.findMany({ where: { status: "inbox" }, include: { project: true }, take: 200 }),
    db.activity.findMany({ where: { createdAt: { gte: new Date(now - 90 * dayMs) } }, select: { createdAt: true } }),
  ]);

  const candidates: Candidate[] = inboxTasks.map((t) => ({
    id: t.id,
    title: t.title,
    potentialUsd: t.project?.potentialUsd ?? undefined,
    hellYeah: t.project?.hellYeah ?? undefined,
    hoursCost: t.estimateMin ? t.estimateMin / 60 : 1,
    overdueDays: t.due && t.due.getTime() < now ? Math.floor((now - t.due.getTime()) / dayMs) : 0,
    ageDays: Math.floor((now - t.createdAt.getTime()) / dayMs),
  }));

  const top3 = rankCandidates(candidates);
  const cap = capacityState(todayTasks.reduce((s, t) => s + (t.estimateMin ?? 30), 0), settings?.dayCapacity ?? 180);
  const streak = streakFromDays(facts.map((f) => f.createdAt), new Date(), settings?.freezesPerWeek ?? 2);
  const potential = projects.reduce((s, p) => s + (p.potentialUsd ?? 0), 0);

  const oldest = [...inboxTasks]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, 6)
    .map((t) => ({ title: t.title, age: Math.floor((now - t.createdAt.getTime()) / dayMs) }));

  const stamp = new Date().toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

  const html = `<title>Мостик — снимок ${stamp}</title>
<style>
:root{--bg:#070c12;--card:#0b1117;--line:#16222e;--txt:#e8f4f8;--muted:#7d93a1;--dim:#546b7c;
--ok:#22d3ee;--over:#34d399;--behind:#fbbf24;--gap:#ff2e88;--dead:#f43f5e;--none:#64748b;
--mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;--sans:-apple-system,"Helvetica Neue",system-ui,sans-serif}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--txt);font:16px/1.6 var(--sans);-webkit-font-smoothing:antialiased;
background-image:radial-gradient(620px 240px at 14% 0,rgba(34,211,238,.14),transparent 66%),radial-gradient(560px 220px at 84% 4%,rgba(255,46,136,.09),transparent 64%)}
.wrap{max-width:900px;margin:0 auto;padding:34px 18px 70px}
.num{font-family:var(--mono);font-variant-numeric:tabular-nums}
.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);margin:0 0 9px}
h1{font-size:clamp(26px,6vw,34px);letter-spacing:-.035em;line-height:1.06;margin:0 0 22px}
h2{font-size:17px;margin:0}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px 16px;margin-bottom:13px}
.row{display:flex;gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--line);font-size:14px}
.row:first-of-type{border-top:none}
.flex{display:flex;gap:24px;flex-wrap:wrap}
.lb{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.vl{font-size:24px;font-weight:750;margin-top:3px}
.track{position:relative;height:9px;border-radius:5px;background:#13202b;margin-top:6px}
.fill{position:absolute;inset:0 auto 0 0;border-radius:5px}
.ttl{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.why{font-family:var(--mono);font-size:11.5px;color:var(--behind);margin-top:2px}
.note{border-left:3px solid var(--ok);background:rgba(34,211,238,.06);padding:10px 13px;border-radius:0 11px 11px 0;font-size:13.5px;margin-top:11px}
.note.warn{border-left-color:var(--gap);background:rgba(255,46,136,.06)}
footer{color:var(--dim);font-size:12.5px;margin-top:20px}
@media(max-width:520px){.flex{gap:16px}.vl{font-size:20px}}
</style>
<div class="wrap">
<p class="eyebrow">Мостик · снимок ${stamp}</p>
<h1>Где мы сейчас</h1>

<div class="card">
  <div class="flex">
    <div><div class="lb">Серия</div><div class="vl num" style="color:${streak.days ? "var(--over)" : "var(--none)"}">${streak.days}${streak.days ? " 🔥" : ""}</div></div>
    <div><div class="lb">В дне</div><div class="vl num">${todayTasks.length} / 3</div></div>
    <div style="flex:1;min-width:170px"><div class="lb">Ёмкость дня</div>
      <div class="track"><div class="fill" style="width:${Math.min(100, cap.percent)}%;background:${cap.state === "over" ? "var(--behind)" : "var(--ok)"}"></div></div>
      <div class="num" style="font-size:11.5px;color:var(--muted);margin-top:5px">${cap.percent}%${cap.state === "over" ? ` · перебор на ${cap.overBy} мин` : ""}</div>
    </div>
  </div>
</div>

<div class="card">
  <div class="flex">
    <div><div class="lb">Цель месяца</div><div class="vl num">${money(moneyMonth?.goalUsd ?? 0)}</div></div>
    <div><div class="lb">Потенциал проектов</div><div class="vl num" style="color:var(--ok)">${money(potential)}</div></div>
    <div><div class="lb">Факт</div><div class="vl num" style="color:var(--none)">${moneyMonth?.factUsd ? money(moneyMonth.factUsd) : "—"}</div></div>
  </div>
</div>

<div class="card">
  <h2>Что взять</h2>
  <div style="font-size:12.5px;color:var(--muted);margin:2px 0 8px">система посчитала из ${inbox} задач в инбоксе</div>
  ${top3.map((c) => `<div class="row"><div class="ttl"><div>${esc(c.title)}</div><div class="why">${esc(c.why.join(" · "))}</div></div></div>`).join("")}
</div>

<div class="card">
  <h2>Задачи</h2>
  <div class="flex" style="margin:10px 0 0;gap:20px">
    <span class="num">всего <b style="font-size:19px">${total}</b></span>
    <span class="num" style="color:var(--behind)">в инбоксе <b style="font-size:19px">${inbox}</b></span>
    <span class="num" style="color:var(--over)">закрыто <b style="font-size:19px">${done}</b></span>
    <span class="num" style="color:var(--gap)">без дня <b style="font-size:19px">${noDay}</b></span>
  </div>
  <div class="note warn">Из ${total} задач ${inbox} лежат в инбоксе, у ${noDay} нет дня.</div>
  <div style="font-size:12.5px;color:var(--muted);margin:12px 0 4px">Дольше всех ждут:</div>
  ${oldest.map((t) => {
    const sig = signalBySilence(t.age);
    return `<div class="row">${MARK[sig]}<span class="ttl">${esc(t.title)}</span><span class="num" style="font-size:12.5px;color:${SIGNALS[sig].color.replace("var(--s-", "var(--").replace(")", ")")}">${t.age} дн</span></div>`;
  }).join("")}
</div>

<div class="card">
  <h2>Проекты</h2>
  <div style="font-size:12.5px;color:var(--muted);margin:2px 0 8px">${people} человек в команде</div>
  ${projects.map((p) => `<div class="row">${MARK[p.status === "candidate" ? "none" : "ok"]}<span class="ttl">${p.icon ?? ""} ${esc(p.title)}${p.owner ? `<span style="color:var(--muted);font-size:12.5px"> · ведёт ${esc(p.owner)}</span>` : ""}</span><span class="num" style="font-size:13;color:${p.potentialUsd ? "var(--ok)" : "var(--none)"}">${p.potentialUsd ? money(p.potentialUsd) + " / мес" : "цифры нет"}</span></div>`).join("")}
  <div class="note">Проекты пока кандидаты: активными станут после прожарки, где появятся ведущее число, владелец и контракт месяца.</div>
</div>

<footer>Это снимок на ${stamp}, кнопки в нём не работают. Живая версия с кнопками — на маке, порт 8793.</footer>
</div>`;

  writeFileSync(out, html, "utf8");
  console.log(`Снимок готов: ${out} (${Math.round(html.length / 1024)} КБ)`);
  console.log(`В нём: ${total} задач, ${projects.length} проектов, серия ${streak.days}`);
}

main()
  .catch((e) => {
    console.error("Ошибка снимка:", e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
