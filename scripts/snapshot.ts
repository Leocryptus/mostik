/**
 * Снимок мостика в одну самодостаточную HTML-страницу.
 *
 *   npm run snapshot -- путь.html
 *
 * Зачем: открыть состояние с любого устройства без Tailscale и без сервера.
 * Стили инлайновые, данные — из базы на момент запуска. Кнопки не работают:
 * это фотография, а не приложение.
 *
 * Порядок блоков повторяет экраны простой версии: сегодня → задачи месяца →
 * что не разобрано. Снимок должен читаться так же, как сам мостик.
 */
import { writeFileSync } from "node:fs";
import { db } from "../lib/db";
import { loadGoals } from "../lib/goals";
import { STATE_LABEL } from "../lib/simple";

const money = (n: number) => "$" + n.toLocaleString("ru-RU").replace(/,/g, " ");
const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);

const COLOR = { moving: "#00ff9c", behind: "#f5c542", silent: "#f87171" } as const;

async function main() {
  const out = process.argv[2] ?? "snapshot.html";
  const now = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();

  const [goals, today, inboxCount, doneToday] = await Promise.all([
    loadGoals(),
    db.task.findMany({
      where: { status: { in: ["today", "doing"] } },
      include: { project: { select: { title: true, icon: true } }, stream: { select: { title: true } } },
      orderBy: [{ isTopGoal: "desc" }, { createdAt: "asc" }],
    }),
    db.task.count({ where: { status: "inbox", adequacyAt: null } }),
    db.task.count({ where: { status: "done", doneAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
  ]);

  const active = goals.filter((g) => g.status === "work");
  const [main, ...rest] = today;
  const stamp = now.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

  const html = `<title>Мостик — снимок ${stamp}</title>
<style>
:root{--bg:#050807;--card:#0a120e;--line:#16261e;--txt:#eafff4;--muted:#7c9a8b;--dim:#4e6b5c;
--ok:#00ff9c;--warn:#f5c542;--bad:#f87171;
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
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:12px}
.flex{display:flex;gap:22px;flex-wrap:wrap}
.track{position:relative;height:9px;border-radius:5px;background:#12211a;margin-top:7px}
.fill{position:absolute;inset:0 auto 0 0;border-radius:5px}
.ttl{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.big{font-size:21px;font-weight:700;letter-spacing:-.02em}
.chip{font-family:var(--mono);font-size:11.5px;background:#0f2018;border:1px solid #1c3427;color:#7bffc9;padding:2px 8px;border-radius:7px;white-space:nowrap}
.empty{color:var(--muted);font-size:13.5px}
.note{border-left:3px solid var(--ok);background:rgba(0,255,156,.06);padding:10px 13px;border-radius:0 11px 11px 0;font-size:13.5px;margin-top:11px}
footer{color:var(--dim);font-size:12.5px;margin-top:20px}
</style>
<div class="wrap">
<p class="eyebrow">Мостик · снимок ${stamp} · до конца месяца ${daysLeft} дн</p>
<h1>Где мы сейчас</h1>

<p class="eyebrow" style="margin:0 0 8px">что делаю сегодня</p>
${main
      ? `<div class="card" style="border-color:rgba(0,255,156,.3)">
  <div class="big">${esc(main.title)}</div>
  <div class="num" style="font-size:12px;color:var(--muted);margin-top:4px">${[
        main.project ? `${main.project.icon ?? ""} ${esc(main.project.title)}`.trim() : null,
        main.stream ? esc(main.stream.title) : null,
        main.estimateMin ? `${main.estimateMin} мин` : null,
        main.status === "doing" ? "в работе" : null,
      ].filter(Boolean).join(" · ")}</div>
  ${main.becomesTrue ? `<div style="font-size:13px;margin-top:8px;color:var(--muted)">станет правдой: ${esc(main.becomesTrue)}</div>` : ""}
  ${main.firstStep ? `<div style="font-size:14px;margin-top:6px">▶︎ ${esc(main.firstStep)}</div>` : ""}
  ${rest.map((t) => `<div class="row"><span class="ttl">${esc(t.title)}</span><span class="chip">в дне</span></div>`).join("")}
</div>`
      : `<div class="card empty">Сегодня ничего не взято.</div>`}

<div class="card">
  <div class="flex">
    <span class="num" style="font-size:13.5px;color:var(--ok)">закрыто сегодня <b style="font-size:19px">${doneToday}</b></span>
    <span class="num" style="font-size:13.5px;color:var(--warn)">не разобрано <b style="font-size:19px">${inboxCount}</b></span>
    <span class="num" style="font-size:13.5px;color:var(--muted)">задач месяца <b style="font-size:19px;color:var(--txt)">${active.length}</b> из 5</span>
  </div>
</div>

<p class="eyebrow" style="margin:20px 0 8px">ради чего этот месяц</p>
${active.length === 0
      ? `<div class="card empty">Задач месяца нет.</div>`
      : `<div class="grid">${active.map((g) => {
          const c = COLOR[g.state];
          const metricPct = g.metricTarget ? Math.min(100, Math.round((g.metricFact / g.metricTarget) * 100)) : 0;
          const openSteps = g.subprojects.reduce((s, x) => s + x.openCount, 0) + g.looseSteps.length;
          return `<div class="card" style="margin:0;border-color:rgba(0,255,156,.28)">
    <div style="display:flex;gap:12px;align-items:flex-start">
      ${ring(g.progress, c)}
      <div style="flex:1;min-width:0">
        <div style="font-size:16px;font-weight:650">${g.icon ?? ""} ${esc(g.title)}</div>
        <div class="num" style="font-size:11.5px;color:${c};margin-top:3px">${STATE_LABEL[g.state]}${
            g.silentDays !== null && g.silentDays > 14 ? ` · ${g.silentDays} дн без фактов` : ""
          }</div>
        <div class="num" style="font-size:11.5px;color:var(--muted);margin-top:2px">${
          [g.potentialUsd ? `${money(g.potentialUsd)} / мес` : null, g.owner].filter(Boolean).join(" · ") || "цифры нет"
        }</div>
      </div>
    </div>
    <div style="font-size:13.5px;margin-top:10px;${g.becomesTrue ? "" : "color:var(--dim)"}">🎯 ${esc(g.becomesTrue ?? "что станет правдой — не задано")}</div>
    ${g.metricName ? `<div class="track"><div class="fill" style="width:${metricPct}%;background:${c}"></div></div>
    <div class="num" style="font-size:11.5px;color:var(--muted);margin-top:5px">${esc(g.metricName)}: ${g.metricFact}${g.metricTarget ? ` из ${g.metricTarget}` : ""}</div>` : ""}
    ${g.krs.map((k) => `<div class="num" style="font-size:12px;color:var(--muted);padding:2px 0">· ${esc(k.name)} — <b style="color:var(--txt)">${k.current}</b> из ${k.target} ${esc(k.unit ?? "")}</div>`).join("")}
    <div class="num" style="font-size:11.5px;color:var(--dim);margin-top:9px">подпроектов ${g.subprojects.length} · открытых шагов ${openSteps}</div>
  </div>`;
        }).join("")}</div>`}

${inboxCount > 0 ? `<div class="note">Не разобрано ${inboxCount} записей. Разбор — на вкладке «Инбокс»: четыре вопроса, и запись ложится в задачу месяца.</div>` : ""}

<footer>Это снимок на ${stamp}, кнопки в нём не работают. Живая версия — на маке, порт 8793.</footer>
</div>`;

  writeFileSync(out, html, "utf8");
  console.log(`Снимок готов: ${out} (${Math.round(html.length / 1024)} КБ)`);
  console.log(`В нём: сегодня ${today.length}, задач месяца ${active.length}, не разобрано ${inboxCount}`);
}

/** Кольцо прогресса по OKR — тот же примитив, что на экране «Месяц». */
function ring(percent: number, color: string): string {
  const r = 25;
  const c = 2 * Math.PI * r;
  return `<svg width="62" height="62" viewBox="0 0 62 62" style="flex:none">
    <circle cx="31" cy="31" r="${r}" fill="none" stroke="#16261e" stroke-width="6"/>
    <circle cx="31" cy="31" r="${r}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"
      stroke-dasharray="${(c * percent) / 100} ${c}" transform="rotate(-90 31 31)"/>
    <text x="31" y="36" text-anchor="middle" font-size="14" font-weight="700" fill="#eafff4"
      font-family="ui-monospace,Menlo,monospace">${percent}</text>
  </svg>`;
}

main()
  .catch((e) => {
    console.error("Ошибка снимка:", e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
