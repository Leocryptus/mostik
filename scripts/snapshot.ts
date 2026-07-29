/**
 * Снимок мостика в одну самодостаточную HTML-страницу.
 *
 *   npx tsx scripts/snapshot.ts [путь]
 *
 * Зачем: открыть состояние с любого устройства без Tailscale и без сервера.
 * Стили инлайновые, данные — из базы на момент запуска. Кнопки в снимке
 * не работают: это фотография, а не приложение.
 *
 * Порядок блоков повторяет порядок экранов (ТЗ §19.5): неделя → цели месяца →
 * сегодня → цифры месяца. Снимок должен читаться так же, как сам мостик.
 *
 * Этот же рендер станет основой картинок-отчётов для Телеграма (ТЗ §16.4).
 */
import { writeFileSync } from "node:fs";
import { db } from "../lib/db";
import { capacityState, streakFromDays } from "../lib/day";
import { weekStartOf, weekLabel, daysLeftInWeek, parseList } from "../lib/week";
import { signalBySilence, signalByProgress, SIGNALS } from "../lib/signals";

const money = (n: number) => "$" + n.toLocaleString("ru-RU").replace(/,/g, " ");
const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);
/** цвета сигналов в снимке свои: переменных --s-* здесь нет */
const COLOR: Record<string, string> = {
  ok: "#00ff9c", over: "#a3e635", behind: "#f5c542",
  gap: "#ff7a45", dead: "#f87171", frozen: "#6ea8ff", none: "#5a7a6b",
};

const MARK: Record<string, string> = {
  ok: `<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="#00ff9c"/></svg>`,
  over: `<svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 0l6 10H0z" fill="#a3e635"/></svg>`,
  behind: `<svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="4" width="10" height="4" rx="1" fill="#f5c542"/></svg>`,
  gap: `<svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 6h3l2-4 2 8 2-4h1" stroke="#ff7a45" stroke-width="1.6" fill="none"/></svg>`,
  dead: `<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="none" stroke="#f87171" stroke-width="2"/><circle cx="6" cy="6" r="1.6" fill="#f87171"/></svg>`,
  frozen: `<svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1v10M1.5 3.5l9 5M10.5 3.5l-9 5" stroke="#6ea8ff" stroke-width="1.5"/></svg>`,
  none: `<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6h8" stroke="#5a7a6b" stroke-width="2" stroke-dasharray="2 2"/></svg>`,
};

async function main() {
  const out = process.argv[2] ?? "snapshot.html";
  const nowDate = new Date();
  const now = nowDate.getTime();
  const dayMs = 86_400_000;
  const month = nowDate.toISOString().slice(0, 7);
  const monthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);
  const daysInMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0).getDate();
  const monthProgress = Math.round((nowDate.getDate() / daysInMonth) * 100);
  const weekStart = weekStartOf(nowDate);

  const [projects, contracts, moneyMonth, commitment, weekTasks, todayTasks, total, inbox, done, settings, facts, monthFacts] =
    await Promise.all([
      db.project.findMany({ orderBy: [{ status: "asc" }, { potentialUsd: "desc" }] }),
      db.monthContract.findMany({ where: { month } }),
      db.moneyMonth.findFirst({ where: { month } }),
      db.weeklyCommitment.findUnique({ where: { weekStart } }),
      db.task.findMany({ where: { weekStart, status: { not: "frozen" } }, include: { project: true } }),
      db.task.findMany({ where: { status: { in: ["today", "doing"] } }, orderBy: { isTopGoal: "desc" } }),
      db.task.count(),
      db.task.count({ where: { status: "inbox" } }),
      db.task.count({ where: { status: "done" } }),
      db.settings.findUnique({ where: { id: 1 } }),
      db.activity.findMany({ where: { createdAt: { gte: new Date(now - 90 * dayMs) } }, select: { createdAt: true } }),
      db.activity.findMany({ where: { createdAt: { gte: monthStart } }, select: { projectId: true, createdAt: true } }),
    ]);

  const cap = capacityState(todayTasks.reduce((s, t) => s + (t.estimateMin ?? 30), 0), settings?.dayCapacity ?? 180);
  const streak = streakFromDays(facts.map((f) => f.createdAt), nowDate, settings?.freezesPerWeek ?? 2);
  const active = projects.filter((p) => p.status === "work");
  const potential = active.reduce((s, p) => s + (p.potentialUsd ?? 0), 0);

  const goal = moneyMonth?.goalUsd ?? 0;
  const factUsd = moneyMonth?.factUsd ?? 0;
  const gap = goal - factUsd;
  const moneyPct = goal ? Math.min(100, Math.round((factUsd / goal) * 100)) : 0;

  const lastByProject = new Map<string, Date>();
  for (const f of monthFacts) {
    if (f.projectId && !lastByProject.has(f.projectId)) lastByProject.set(f.projectId, f.createdAt);
  }

  const stones = parseList(commitment?.stones);
  const stopList = parseList(commitment?.stopList);
  const stamp = nowDate.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const [mainTask, ...restToday] = todayTasks;

  const rows = active.map((p) => {
    const c = contracts.find((x) => x.projectId === p.id);
    const last = lastByProject.get(p.id);
    const silent = last ? Math.floor((now - last.getTime()) / dayMs) : null;
    const pct = c?.leadTarget ? Math.min(100, Math.round((c.leadFact / c.leadTarget) * 100)) : 0;
    const signal = c?.leadTarget
      ? signalByProgress(c.leadFact, c.leadTarget)
      : silent === null
        ? "none"
        : signalBySilence(silent);
    return { p, c, pct, signal, silent };
  });

  const html = `<title>Мостик — снимок ${stamp}</title>
<style>
:root{--bg:#050807;--card:#0a120e;--line:#16261e;--txt:#eafff4;--muted:#7c9a8b;--dim:#4e6b5c;
--ok:#00ff9c;--over:#a3e635;--behind:#f5c542;--gap:#ff7a45;--dead:#f87171;--none:#5a7a6b;
--mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;--sans:-apple-system,"Helvetica Neue",system-ui,sans-serif}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--txt);font:16px/1.6 var(--sans);-webkit-font-smoothing:antialiased;
background-image:radial-gradient(620px 240px at 86% 0,rgba(0,255,156,.15),transparent 64%),radial-gradient(460px 190px at 10% 6%,rgba(0,255,156,.07),transparent 62%)}
.wrap{max-width:900px;margin:0 auto;padding:34px 18px 70px}
.num{font-family:var(--mono);font-variant-numeric:tabular-nums}
.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);margin:0 0 9px}
h1{font-size:clamp(26px,6vw,34px);letter-spacing:-.035em;line-height:1.06;margin:0 0 22px}
h2{font-size:17px;margin:0}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px 16px;margin-bottom:13px}
.row{display:flex;gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--line);font-size:14px}
.flex{display:flex;gap:24px;flex-wrap:wrap}
.lb{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.vl{font-size:24px;font-weight:750;margin-top:3px}
.track{position:relative;height:10px;border-radius:5px;background:#12211a;margin-top:7px}
.fill{position:absolute;inset:0 auto 0 0;border-radius:5px}
.plan{position:absolute;top:-4px;bottom:-4px;width:2px;background:#d6f5e6;box-shadow:0 0 7px rgba(255,255,255,.55)}
.rail{position:relative;height:18px;border-radius:7px;background:#0d1813;overflow:hidden;margin-top:6px}
.rail i{position:absolute;inset:0 auto 0 0;border-radius:7px}
.ttl{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.big{font-size:20px;font-weight:700;letter-spacing:-.02em}
.chip{font-family:var(--mono);font-size:11.5px;background:#0f2018;border:1px solid #1c3427;color:#7bffc9;padding:2px 8px;border-radius:7px;white-space:nowrap}
.struck{text-decoration:line-through;text-decoration-color:var(--dead);color:var(--dim)}
.empty{color:var(--muted);font-size:13.5px}
.note{border-left:3px solid var(--ok);background:rgba(0,255,156,.06);padding:10px 13px;border-radius:0 11px 11px 0;font-size:13.5px;margin-top:11px}
.note.warn{border-left-color:var(--gap);background:rgba(255,122,69,.07)}
footer{color:var(--dim);font-size:12.5px;margin-top:20px}
@media(max-width:520px){.flex{gap:16px}.vl{font-size:20px}}
</style>
<div class="wrap">
<p class="eyebrow">Мостик · снимок ${stamp} · неделя ${weekLabel(weekStart)}, осталось ${daysLeftInWeek(nowDate, weekStart)} дн</p>
<h1>Где мы сейчас</h1>

<div class="card">
  <h2>Основные задачи недели</h2>
  ${weekTasks.length === 0
      ? `<div class="empty" style="margin-top:8px">На эту неделю ничего не выбрано — вкладка «Неделя» ждёт выбора.</div>`
      : weekTasks.map((t) => {
          const inDay = t.status === "today" || t.status === "doing";
          const isDone = t.status === "done";
          return `<div class="row">
        <div class="ttl" style="white-space:normal">
          <div${isDone ? ` class="struck"` : ""}>${esc(t.title)}</div>
          <div class="num" style="font-size:11.5px;color:var(--muted);margin-top:2px">${[
            t.project ? `${t.project.icon ?? ""} ${esc(t.project.title)}`.trim() : "без проекта",
            t.estimateMin ? `${t.estimateMin} мин` : null,
          ].filter(Boolean).join(" · ")}</div>
        </div>
        <span class="chip"${isDone ? ` style="color:var(--over)"` : ""}>${isDone ? "готово" : inDay ? "сегодня" : "в неделе"}</span>
      </div>`;
        }).join("")}

  ${stones.length ? `<div style="font-size:12.5px;color:var(--muted);margin:13px 0 3px">Три камня недели:</div>
  ${stones.map((s) => `<div class="row" style="border-top:none;padding:4px 0">💎 <span class="ttl" style="white-space:normal">${esc(s)}</span></div>`).join("")}` : ""}
  ${stopList.length ? `<div style="font-size:12.5px;color:var(--muted);margin:11px 0 3px">На этой неделе не делаю:</div>
  ${stopList.map((s) => `<div class="row struck" style="border-top:none;padding:4px 0;font-size:13px">${esc(s)}</div>`).join("")}` : ""}
</div>

<div class="card">
  <h2>Цели месяца</h2>
  ${active.length === 0
      ? `<div class="empty" style="margin-top:8px">Проекты месяца не выбраны.</div>`
      : active.map((p) => `<div class="row" style="border-top:none;padding:5px 0">
      <span style="flex:none">${p.icon ?? "•"}</span>
      <span class="ttl" style="white-space:normal;${p.monthGoal ? "" : "color:var(--dim)"}">${esc(p.monthGoal ?? `${p.title} — цель месяца не задана`)}</span>
    </div>`).join("")}
</div>

<p class="eyebrow" style="margin:20px 0 8px">что делаю сегодня</p>
${mainTask
      ? `<div class="card" style="border-color:rgba(34,211,238,.32)">
  <div class="big">${esc(mainTask.title)}</div>
  <div style="font-size:12.5px;color:var(--muted);margin-top:4px">${[
        mainTask.status === "doing" ? "в работе" : "взята в день",
        mainTask.estimateMin ? `${mainTask.estimateMin} мин` : null,
      ].filter(Boolean).join(" · ")}</div>
  ${mainTask.firstStep ? `<div style="font-size:13.5px;margin-top:7px">▶︎ ${esc(mainTask.firstStep)}</div>` : ""}
  ${restToday.map((t) => `<div class="row"><span class="ttl">${esc(t.title)}</span></div>`).join("")}
</div>`
      : `<div class="card empty">Сегодня ничего не взято.</div>`}

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

<p class="eyebrow" style="margin:20px 0 8px">месяц</p>
<div class="card">
  <div class="flex" style="align-items:baseline">
    <span class="num" style="font-size:13px">факт <b style="font-size:22px">${money(factUsd)}</b></span>
    <span class="num" style="font-size:13px;color:var(--muted)">цель <b style="font-size:18px;color:var(--txt)">${money(goal)}</b></span>
    ${gap > 0 ? `<span class="num" style="font-size:13px;color:var(--gap)">разрыв <b style="font-size:18px">${money(gap)}</b></span>` : ""}
  </div>
  <div class="track" style="height:11px">
    <div class="fill" style="width:${moneyPct}%;background:${moneyPct >= 100 ? "var(--over)" : "var(--ok)"}"></div>
    <div class="plan" style="left:${monthProgress}%"></div>
  </div>
  <div class="num" style="font-size:11.5px;color:var(--muted);margin-top:6px">${moneyPct}% цели · календарь прошёл на ${monthProgress}%${potential ? ` · потенциал активных ${money(potential)} в мес` : ""}</div>
</div>

<div class="card">
  <h2>Дорожки месяца</h2>
  ${rows.length === 0
      ? `<div class="empty" style="margin-top:8px">Активных проектов нет.</div>`
      : rows.map(({ p, c, pct, signal, silent }) => `<div style="padding:9px 0;border-top:1px solid var(--line)">
    <div style="display:flex;gap:10px;align-items:center">
      ${MARK[signal]}
      <span class="ttl" style="font-weight:600">${p.icon ?? ""} ${esc(p.title)}</span>
      <span class="num" style="font-size:11.5px;color:${COLOR[signal]}">${
        c?.leadMetric ? `${c.leadFact} / ${c.leadTarget ?? "—"} ${esc(c.leadMetric)}` : silent === null ? "фактов нет" : `молчит ${silent} дн`
      }</span>
    </div>
    <div class="rail"><i style="width:${Math.max(pct, 4)}%;background:${COLOR[signal]};box-shadow:0 0 12px ${COLOR[signal]}55"></i></div>
    <div style="font-size:12.5px;margin-top:6px;${p.nextStep ? "" : "color:var(--dim)"}">➡️ ${esc(p.nextStep ?? "следующий шаг не задан")}</div>
  </div>`).join("")}
</div>

<div class="card">
  <h2>Мелочёвка</h2>
  <div class="flex" style="margin-top:10px;gap:20px">
    <span class="num">всего <b style="font-size:19px">${total}</b></span>
    <span class="num" style="color:var(--behind)">в инбоксе <b style="font-size:19px">${inbox}</b></span>
    <span class="num" style="color:var(--over)">закрыто <b style="font-size:19px">${done}</b></span>
  </div>
  <div class="note${inbox > 50 ? " warn" : ""}">Мелочёвка живёт на вкладке «День» и открывается после основного — на главный экран она не поднимается.</div>
</div>

<footer>Это снимок на ${stamp}, кнопки в нём не работают. Живая версия с кнопками — на маке, порт 8793.</footer>
</div>`;

  writeFileSync(out, html, "utf8");
  console.log(`Снимок готов: ${out} (${Math.round(html.length / 1024)} КБ)`);
  console.log(`В нём: неделя ${weekTasks.length} задач, месяц ${active.length} проектов, серия ${streak.days}`);
}

main()
  .catch((e) => {
    console.error("Ошибка снимка:", e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
