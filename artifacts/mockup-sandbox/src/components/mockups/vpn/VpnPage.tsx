import { useState } from "react";

const STAR_COUNT = 70;
const stars = Array.from({ length: STAR_COUNT }, (_, i) => ({
  id: i,
  x: (i * 137.508 + 11) % 100,
  y: (i * 91.337 + 7) % 100,
  r: 0.4 + (i % 5) * 0.22,
  opacity: 0.25 + (i % 7) * 0.09,
  delay: (i % 8) * 0.45,
}));

const PLANS = [
  { id: "sprint",   emoji: "⚡️", name: "Спринт",         dur: "5 мин",  rub: 15, stars: 9,  sub: "Быстрая проверка почты или авторизация" },
  { id: "vzlet",    emoji: "✈️", name: "Взлёт",           dur: "15 мин", rub: 30, stars: 17, sub: "Заблокированные медиа и чаты", popular: true },
  { id: "session",  emoji: "🎬", name: "Сессия",          dur: "30 мин", rub: 50, stars: 28, sub: "Видео, загрузки, документы" },
  { id: "bezlimit", emoji: "🪐", name: "Безлимит на час", dur: "60 мин", rub: 80, stars: 44, sub: "Полная рабочая сессия" },
];

type Pay = "stars" | "crypto";

export function VpnPage() {
  const [pay, setPay] = useState<Pay>("stars");
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div
      className="relative min-h-screen w-full overflow-y-auto flex flex-col"
      style={{ background: "linear-gradient(160deg,#1E22DC 0%,#181CC6 40%,#1318B0 75%,#1015A5 100%)" }}
    >
      {/* Starfield */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.45 }}>
        <defs>
          <style>{`@keyframes tw{0%,100%{opacity:.1}50%{opacity:.95}}`}</style>
        </defs>
        {stars.map((s) => (
          <circle key={s.id} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="white"
            style={{ animation: `tw ${2.6 + s.delay}s ease-in-out infinite`, animationDelay: `${s.delay}s` }} />
        ))}
      </svg>

      {/* warm right glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 50% 60% at 85% 30%, rgba(232,98,42,0.13) 0%, transparent 65%)"
      }} />

      {/* drag handle */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.18)" }} />
      </div>

      {/* content */}
      <div className="relative z-10 flex flex-col gap-4 px-4 pt-2 pb-8">

        {/* header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-mono tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
              VPN · ЗАЩИТА СЕТИ
            </p>
            <h2 className="text-2xl font-black text-white leading-tight">
              🔒 VPN-доступ
            </h2>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>
              Защищённый канал · WireGuard · Instant
            </p>
          </div>
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }}
          >
            ✕
          </button>
        </div>

        {/* description */}
        <div
          className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
        >
          Активируйте защищённый VPN-канал для обхода блокировок. Соединение поднимается <span className="text-white font-semibold">автоматически</span> сразу после оплаты.
        </div>

        {/* payment toggle */}
        <div className="flex gap-2">
          {(["stars", "crypto"] as Pay[]).map((m) => (
            <button
              key={m}
              onClick={() => setPay(m)}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: pay === m ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${pay === m ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.1)"}`,
                color: pay === m ? "#ffffff" : "rgba(255,255,255,0.4)",
              }}
            >
              {m === "stars" ? "⭐ Telegram Stars" : "💎 CryptoBot"}
            </button>
          ))}
        </div>

        {/* plan cards */}
        <div className="flex flex-col gap-3">
          {PLANS.map((plan) => {
            const isPopular = plan.popular;
            const isSelected = selected === plan.id;
            return (
              <button
                key={plan.id}
                onClick={() => setSelected(plan.id)}
                className="w-full text-left rounded-2xl px-4 py-3.5 flex items-center gap-3 transition-all"
                style={{
                  background: isSelected
                    ? "rgba(232,98,42,0.15)"
                    : isPopular
                      ? "rgba(255,255,255,0.09)"
                      : "rgba(255,255,255,0.05)",
                  border: `1px solid ${
                    isSelected ? "#E8622A"
                    : isPopular ? "rgba(255,255,255,0.22)"
                    : "rgba(255,255,255,0.1)"
                  }`,
                  boxShadow: isSelected ? "0 0 20px rgba(232,98,42,0.2)" : "none",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* top shimmer for popular */}
                {isPopular && (
                  <div className="absolute top-0 left-0 right-0 h-px" style={{
                    background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)"
                  }} />
                )}

                {/* plan emoji */}
                <span className="text-2xl min-w-[2rem] text-center">{plan.emoji}</span>

                {/* plan info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-base">{plan.name}</span>
                    {isPopular && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: "#E8622A", color: "#fff" }}>
                        ХИТ
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {plan.dur} · WIREGUARD
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {plan.sub}
                  </div>
                </div>

                {/* price button */}
                <div
                  className="shrink-0 px-3.5 py-2 rounded-xl text-sm font-black text-white"
                  style={{
                    background: isSelected ? "#E8622A" : "rgba(232,98,42,0.8)",
                    boxShadow: isSelected ? "0 0 16px rgba(232,98,42,0.45)" : "none",
                    minWidth: 64,
                    textAlign: "center",
                  }}
                >
                  {pay === "stars" ? `⭐ ${plan.stars}` : `${plan.rub} ₽`}
                </div>
              </button>
            );
          })}
        </div>

        {/* confirm CTA */}
        <button
          className="w-full py-4 rounded-2xl text-base font-black text-white mt-1"
          style={{
            background: selected ? "#E8622A" : "rgba(255,255,255,0.08)",
            border: `1px solid ${selected ? "#E8622A" : "rgba(255,255,255,0.12)"}`,
            boxShadow: selected ? "0 0 28px rgba(232,98,42,0.35)" : "none",
            color: selected ? "#fff" : "rgba(255,255,255,0.3)",
            transition: "all 0.2s",
          }}
        >
          {selected
            ? `Активировать VPN — ${pay === "stars" ? `⭐ ${PLANS.find(p => p.id === selected)?.stars}` : `${PLANS.find(p => p.id === selected)?.rub} ₽`}`
            : "Выберите план"}
        </button>

        {/* fine print */}
        <p className="text-center text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.28)" }}>
          После оплаты выдаётся персональный WireGuard-ключ.<br />
          Соединение отключается автоматически по истечении времени.
        </p>
      </div>
    </div>
  );
}
