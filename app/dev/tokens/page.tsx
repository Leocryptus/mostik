import { SIGNALS, signalBySilence, signalByProgress, shortfallLabel, type SignalKey } from "@/lib/signals";
import { SignalMark } from "@/app/components/signal-mark";

export const metadata = { title: "Мостик · дизайн-ядро" };

const ORDER: SignalKey[] = ["ok", "over", "behind", "gap", "dead", "frozen", "none"];

/** Полоса план-факт: заполнено цветом, остаток тёмный, план — засечка. */
function Track({ fact, plan, signal }: { fact: number; plan: number; signal: SignalKey }) {
  const pct = Math.min(100, Math.round((fact / plan) * 100));
  return (
    <div className="track" role="img" aria-label={`факт ${fact} из ${plan}`}>
      <div
        className="track-fill"
        style={{ width: `${pct}%`, background: SIGNALS[signal].color, boxShadow: `0 0 12px ${SIGNALS[signal].color}55` }}
      />
      {pct < 100 && <div className="track-rest" style={{ left: `${pct}%` }} />}
      <div className="track-plan" style={{ left: "100%" }} />
    </div>
  );
}

function Row({ name, fact, plan, unit }: { name: string; fact: number; plan: number; unit?: string }) {
  const sig = signalByProgress(fact, plan);
  const short = shortfallLabel(fact, plan, unit);
  return (
    <div style={{ padding: "11px 0", borderTop: "1px solid var(--line)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7, fontSize: 14 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SignalMark signal={sig} /> {name}
        </span>
        <span className="num" style={{ fontSize: 13, color: SIGNALS[sig].color }}>
          {fact} / {plan} {short ? `· ${short}` : `· ${SIGNALS[sig].label.toLowerCase()}`}
        </span>
      </div>
      <Track fact={fact} plan={plan} signal={sig} />
    </div>
  );
}

export default function TokensPage() {
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "44px 20px 80px" }}>
      <p className="num" style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--dim)", margin: "0 0 10px" }}>
        Мостик · дизайн-ядро · утверждено 27.07
      </p>
      <h1 style={{ fontSize: 38, letterSpacing: "-.035em", lineHeight: 1.05, margin: "0 0 12px" }}>Токио, ночь</h1>
      <p style={{ color: "var(--muted)", maxWidth: "64ch", margin: "0 0 30px" }}>
        Витрина стиля: семь сигналов, примитивы и приёмы вёрстки текста. Всё, что строится дальше, берёт значения отсюда — цвета в компонентах не пишутся руками.
      </p>

      {/* СИГНАЛЫ */}
      <h2 style={{ fontSize: 20, margin: "0 0 12px" }}>Семь сигналов</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(224px,1fr))", gap: 11 }}>
        {ORDER.map((k) => {
          const s = SIGNALS[k];
          return (
            <div key={k} className="card" style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", background: "rgba(255,255,255,.05)", flex: "none" }}>
                <SignalMark signal={k} />
              </span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 650 }}>{s.label}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{s.when}</div>
                <div className="num" style={{ fontSize: 10.5, color: "var(--dim)", marginTop: 4 }}>{s.shape}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ПОЛОСЫ */}
      <h2 style={{ fontSize: 20, margin: "34px 0 4px" }}>Показатели недели</h2>
      <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "0 0 12px", maxWidth: "66ch" }}>
        Незакрытая часть остаётся тёмной — она и есть отставание. Белая засечка показывает план. Штриховки нет.
      </p>
      <div className="card">
        <Row name="Cryptus · офферы биржам" fact={6} plan={5} />
        <Row name="Обменка · новые каналы" fact={2} plan={4} />
        <Row name="MAST · кошельки партнёров" fact={1} plan={3} />
      </div>

      {/* СВЕТОФОР ПО ТИШИНЕ */}
      <h2 style={{ fontSize: 20, margin: "34px 0 4px" }}>Светофор по тишине</h2>
      <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "0 0 12px" }}>
        Считается от возраста последнего факта движения: до 7 дней, 8–14, дальше — тишина.
      </p>
      <div className="card" style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
        {[3, 10, 21].map((d) => {
          const k = signalBySilence(d);
          return (
            <span key={d} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <SignalMark signal={k} />
              <span className="num">{d} дней</span>
              <span style={{ color: SIGNALS[k].color }}>{SIGNALS[k].label}</span>
            </span>
          );
        })}
      </div>

      {/* ПРИМИТИВЫ */}
      <h2 style={{ fontSize: 20, margin: "34px 0 12px" }}>Примитивы</h2>
      <div className="card" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn btn-primary">Взять в фокус</button>
        <button className="btn">Другая</button>
        <button className="btn">Готово</button>
        <span className="chip">$62 / час</span>
        <span className="chip">90 мин</span>
        <span className="chip">4 дня</span>
      </div>

      {/* ТЕКСТ */}
      <h2 style={{ fontSize: 20, margin: "34px 0 4px" }}>Приёмы вёрстки текста</h2>
      <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "0 0 12px", maxWidth: "66ch" }}>
        Утверждены шесть. Правило: не больше двух видов выделения на экран — иначе не подсвечено ничего.
      </p>
      <div className="card">
        <p className="t-lead" style={{ margin: "0 0 10px" }}>До цели месяца не хватает $13&nbsp;600.</p>
        <p style={{ margin: "0 0 8px" }}>
          🎯 Главная ставка месяца — <span className="t-underline" style={{ color: "var(--s-ok)" }}>Cryptus</span>, остальное поддерживает.
        </p>
        <p style={{ margin: "0 0 8px" }}>
          Каналы обменки: <span className="t-accent" style={{ color: "var(--s-behind)" }}>отстаём на два</span> при двух днях до конца недели.
        </p>
        <p style={{ margin: "0 0 4px" }}>
          Ставка часа <span className="chip">$62</span>, задача на <span className="chip">90 мин</span> — считается по деньгам.
        </p>
        <div className="t-note" style={{ borderLeftColor: "var(--s-gap)", background: "rgba(255,46,136,.06)" }}>
          Union молчит пятнадцать дней. Нужно решение: шаг, делегат или заморозка.
        </div>
        <p style={{ margin: 0, fontSize: 14 }}>
          Задача <span className="t-struck">«Поресёрчить рынок»</span> заменена на «Собрать пять офферов до пятницы».
        </p>
      </div>
    </main>
  );
}
