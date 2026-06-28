import { useEffect, useRef } from "react";

const STAR_COUNT = 90;

function generateStars() {
  return Array.from({ length: STAR_COUNT }, (_, i) => ({
    id: i,
    x: ((i * 137.508 + 11) % 100),
    y: ((i * 91.337 + 7) % 100),
    r: 0.5 + (i % 5) * 0.25,
    opacity: 0.3 + (i % 7) * 0.1,
    delay: (i % 8) * 0.4,
  }));
}

const stars = generateStars();

/* ─── Phone screens ─────────────────────────────────────────────── */

function MapScreen() {
  return (
    <div className="w-full h-full flex flex-col bg-[#0d1117] text-white overflow-hidden">
      <div className="flex items-center justify-between px-3 pt-2 pb-1.5 bg-[#0d1117]">
        <span className="text-[9px] font-bold text-white/90">Карта АЗС</span>
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
        </div>
      </div>
      <div className="relative flex-1 bg-[#1a2234] overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }} />
        {[
          { x: 20, y: 30, c: "#22c55e" }, { x: 45, y: 20, c: "#22c55e" },
          { x: 60, y: 45, c: "#fbbf24" }, { x: 30, y: 55, c: "#22c55e" },
          { x: 72, y: 30, c: "#ff6b6b" }, { x: 15, y: 68, c: "#22c55e" },
          { x: 55, y: 70, c: "#fbbf24" }, { x: 80, y: 60, c: "#22c55e" },
          { x: 38, y: 78, c: "#ff6b6b" }, { x: 65, y: 82, c: "#22c55e" },
        ].map((m, i) => (
          <div key={i} className="absolute flex flex-col items-center" style={{ left: `${m.x}%`, top: `${m.y}%` }}>
            <div className="w-2.5 h-2.5 rounded-full shadow-lg border border-white/20" style={{ background: m.c }} />
            <div className="w-0.5 h-1" style={{ background: m.c, opacity: 0.6 }} />
          </div>
        ))}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-[#1E22DC]/80 backdrop-blur-sm border border-white/20 rounded-lg px-2 py-1">
          <p className="text-[7px] text-white/80 text-center">1 295 станций</p>
        </div>
      </div>
      <div className="flex justify-around items-center px-2 py-1.5 bg-[#0d0f1a] border-t border-white/10">
        {[{ icon: "🗺️", label: "Карта", active: true }, { icon: "📊", label: "Аналит." }, { icon: "⛽", label: "Каталог" }, { icon: "🔐", label: "Хранилище" }, { icon: "⭐", label: "Игры" }].map((t) => (
          <div key={t.label} className="flex flex-col items-center gap-0.5">
            <span className="text-[9px]">{t.icon}</span>
            <span className={`text-[5px] ${t.active ? "text-[#E8622A] font-bold" : "text-white/40"}`}>{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CatalogScreen() {
  return (
    <div className="w-full h-full flex flex-col bg-[#0d0f1a] text-white overflow-hidden">
      <div className="px-3 pt-2 pb-1.5 bg-[#0d0f1a]">
        <span className="text-[9px] font-bold text-white/90">Каталог топлива</span>
      </div>
      <div className="mx-2 mb-2 bg-white/10 rounded-md px-2 py-1 flex items-center gap-1">
        <span className="text-[8px] text-white/40">🔍 Поиск АЗС...</span>
      </div>
      <div className="flex-1 overflow-hidden px-2 flex flex-col gap-1.5">
        {[
          { name: "Роснефть #12", fuel: "АИ-92", price: "58.4 ₽", avail: 90, color: "#22c55e" },
          { name: "Лукойл #7", fuel: "АИ-95", price: "63.1 ₽", avail: 60, color: "#fbbf24" },
          { name: "Газпром #3", fuel: "ДТ", price: "71.8 ₽", avail: 20, color: "#ff6b6b" },
        ].map((s) => (
          <div key={s.name} className="bg-white/5 rounded-lg px-2 py-1.5 border border-white/10">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[7px] font-semibold text-white">{s.name}</p>
                <p className="text-[6px] text-white/50">{s.fuel} · {s.price}</p>
              </div>
              <div className="text-right">
                <div className="text-[7px] font-bold" style={{ color: s.color }}>{s.avail}%</div>
                <div className="w-10 h-1 bg-white/10 rounded-full mt-0.5">
                  <div className="h-full rounded-full" style={{ width: `${s.avail}%`, background: s.color }} />
                </div>
              </div>
            </div>
          </div>
        ))}
        <button className="mt-1 w-full bg-[#E8622A] rounded-lg py-1.5 text-[8px] font-bold text-white">
          Получить талон →
        </button>
      </div>
      <div className="flex justify-around items-center px-2 py-1.5 bg-[#0d0f1a] border-t border-white/10">
        {[{ icon: "🗺️", label: "Карта" }, { icon: "📊", label: "Аналит." }, { icon: "⛽", label: "Каталог", active: true }, { icon: "🔐", label: "Хранилище" }, { icon: "⭐", label: "Игры" }].map((t) => (
          <div key={t.label} className="flex flex-col items-center gap-0.5">
            <span className="text-[9px]">{t.icon}</span>
            <span className={`text-[5px] ${t.active ? "text-[#E8622A] font-bold" : "text-white/40"}`}>{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VaultScreen() {
  return (
    <div className="w-full h-full flex flex-col bg-[#0d0f1a] text-white overflow-hidden">
      <div className="px-3 pt-2 pb-1.5">
        <span className="text-[9px] font-bold text-white/90">Хранилище</span>
      </div>
      <div className="mx-2 mb-2 bg-[#1E22DC]/30 rounded-xl p-2 border border-[#E8622A]/30">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[6px] text-white/50">Уровень</p>
            <p className="text-[8px] font-bold text-[#E8622A]">Командир</p>
          </div>
          <div className="text-right">
            <p className="text-[6px] text-white/50">XP</p>
            <p className="text-[9px] font-bold text-white">1 240</p>
          </div>
        </div>
        <div className="mt-1.5 w-full h-1 bg-white/10 rounded-full">
          <div className="h-full w-4/5 bg-gradient-to-r from-[#1E22DC] to-[#E8622A] rounded-full" />
        </div>
      </div>
      <div className="px-2 flex flex-col gap-1.5 flex-1 overflow-hidden">
        {[
          { fuel: "АИ-92", vol: "40 л", station: "Роснефть #12", date: "28 июн", qr: true },
          { fuel: "АИ-95", vol: "60 л", station: "Лукойл #7", date: "25 июн", qr: false },
        ].map((v, i) => (
          <div key={i} className="bg-white/5 rounded-lg px-2 py-1.5 border border-white/10 flex justify-between items-center">
            <div>
              <p className="text-[7px] font-semibold text-white">{v.fuel} · {v.vol}</p>
              <p className="text-[6px] text-white/40">{v.station} · {v.date}</p>
            </div>
            {v.qr && (
              <div className="w-5 h-5 bg-white rounded p-0.5 grid grid-cols-3 gap-px">
                {Array.from({ length: 9 }).map((_, k) => (
                  <div key={k} className={`rounded-[1px] ${[0, 2, 4, 6, 8].includes(k) ? "bg-black" : "bg-white"}`} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-around items-center px-2 py-1.5 bg-[#0d0f1a] border-t border-white/10">
        {[{ icon: "🗺️", label: "Карта" }, { icon: "📊", label: "Аналит." }, { icon: "⛽", label: "Каталог" }, { icon: "🔐", label: "Хранилище", active: true }, { icon: "⭐", label: "Игры" }].map((t) => (
          <div key={t.label} className="flex flex-col items-center gap-0.5">
            <span className="text-[9px]">{t.icon}</span>
            <span className={`text-[5px] ${t.active ? "text-[#E8622A] font-bold" : "text-white/40"}`}>{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhoneMockup({ children, rotate = 0, scale = 1, zIndex = 1 }: {
  children: React.ReactNode; rotate?: number; scale?: number; zIndex?: number;
}) {
  return (
    <div className="relative" style={{ transform: `rotate(${rotate}deg) scale(${scale})`, zIndex, transformOrigin: "bottom center" }}>
      <div className="relative rounded-[28px] overflow-hidden shadow-2xl border-4 border-[#c8a97a]" style={{
        width: 165, height: 340, background: "#1a1a1a",
        boxShadow: "0 30px 80px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.1)",
      }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-[#1a1a1a] rounded-b-2xl z-10 flex items-center justify-center gap-1">
          <div className="w-1 h-1 rounded-full bg-[#333]" />
          <div className="w-4 h-1 rounded-full bg-[#2a2a2a]" />
        </div>
        <div className="absolute top-0 left-0 right-0 h-6 bg-[#0d0f1a] z-[5] flex items-center justify-between px-4 pt-1">
          <span className="text-[7px] text-white/70 font-mono">9:41</span>
          <div className="flex gap-0.5 items-center">
            <div className="w-3 h-1.5 border border-white/40 rounded-[2px] relative">
              <div className="absolute inset-[1px] right-0 bg-white/60 rounded-[1px] w-2/3" />
            </div>
          </div>
        </div>
        <div className="absolute inset-0 pt-6">{children}</div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-white/30 rounded-full" />
        <div className="absolute inset-0 rounded-[28px] pointer-events-none" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }} />
      </div>
    </div>
  );
}

/* ─── Fading orange shadow text — replicates the reference "extrusion" effect ── */
function ShadowText({ text, className = "" }: { text: string; className?: string }) {
  const LAYERS = 28;
  return (
    <div className={`relative select-none ${className}`} style={{ lineHeight: 1 }}>
      {/* shadow layers: offset diagonally, fading from orange → transparent */}
      {Array.from({ length: LAYERS }).map((_, i) => {
        const progress = i / (LAYERS - 1); // 0 = top (behind text) → 1 = deepest
        const ox = i * 3.2;
        const oy = i * 3.6;
        // opacity: high near text, drops to 0 at the far end
        const opacity = (1 - progress) * 0.55;
        // color blends from coral-orange toward the cobalt blue
        const r = Math.round(232 - progress * 80);
        const g = Math.round(98 - progress * 60);
        const b = Math.round(42 + progress * 130);
        return (
          <span
            key={i}
            aria-hidden
            className="absolute inset-0 font-black"
            style={{
              transform: `translate(${ox}px, ${oy}px)`,
              color: `rgba(${r},${g},${b},${opacity})`,
              WebkitTextStroke: "0px",
              zIndex: LAYERS - i,
            }}
          >
            {text}
          </span>
        );
      })}
      {/* actual bright text on top */}
      <span className="relative font-black" style={{ color: "#E8622A", zIndex: LAYERS + 1 }}>
        {text}
      </span>
    </div>
  );
}

/* ─── Main banner ───────────────────────────────────────────────── */
export function AppBanner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const grad = ctx.createLinearGradient(0, 0, W * 0.6, H);
    grad.addColorStop(0, "#2526D9");
    grad.addColorStop(0.35, "#1E20CC");
    grad.addColorStop(0.7, "#191BBF");
    grad.addColorStop(1, "#1417B2");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    stars.forEach((s) => {
      ctx.beginPath();
      ctx.arc(s.x / 100 * W, s.y / 100 * H, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.opacity})`;
      ctx.fill();
    });
  }, []);

  return (
    <div
      className="relative w-full h-screen flex items-center overflow-hidden"
      style={{ background: "linear-gradient(155deg, #2526D9 0%, #1E20CC 35%, #191BBF 70%, #1417B2 100%)" }}
    >
      {/* star canvas */}
      <canvas ref={canvasRef} width={1200} height={800} className="absolute inset-0 w-full h-full" />

      {/* animated SVG stars */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.4 }}>
        <defs>
          <style>{`@keyframes tw{0%,100%{opacity:.12}50%{opacity:.95}}`}</style>
        </defs>
        {stars.map((s) => (
          <circle key={s.id} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r + 0.2} fill="white"
            style={{ animation: `tw ${2.8 + s.delay}s ease-in-out infinite`, animationDelay: `${s.delay}s` }} />
        ))}
      </svg>

      {/* warm glow behind phones */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 55% 65% at 78% 55%, rgba(232,98,42,0.14) 0%, transparent 68%)"
      }} />

      {/* ── Left: text block ── */}
      <div className="relative z-10 flex flex-col gap-5 pl-12" style={{ width: 460, flexShrink: 0 }}>
        {/* app name */}
        <div className="text-white font-bold tracking-wide" style={{ fontSize: 18, opacity: 0.92 }}>
          Топливо ⛽️
        </div>

        {/* hero slogan with fading orange shadow — 3 lines matching reference scale */}
        <div className="flex flex-col gap-0" style={{ overflow: "visible" }}>
          <ShadowText text="Пох*й" className="text-[72px] leading-none" />
          <ShadowText text="инфляция —" className="text-[52px] leading-none mt-1" />
          <ShadowText text="бери талоны" className="text-[44px] leading-none mt-1" />
          <ShadowText text="и замораживай" className="text-[38px] leading-none mt-1" />
          <ShadowText text="цены." className="text-[72px] leading-none mt-1" />
        </div>
      </div>

      {/* ── Right: phones ── */}
      <div className="relative z-10 flex-1 flex items-end justify-center" style={{ height: 440, marginBottom: -40 }}>
        <div className="absolute" style={{ left: "5%", bottom: 0, zIndex: 1 }}>
          <PhoneMockup rotate={-18} scale={0.88} zIndex={1}><MapScreen /></PhoneMockup>
        </div>
        <div className="absolute" style={{ left: "32%", bottom: 20, zIndex: 3 }}>
          <PhoneMockup rotate={0} scale={1} zIndex={3}><CatalogScreen /></PhoneMockup>
        </div>
        <div className="absolute" style={{ left: "59%", bottom: 0, zIndex: 2 }}>
          <PhoneMockup rotate={16} scale={0.88} zIndex={2}><VaultScreen /></PhoneMockup>
        </div>
        {/* bottom vignette */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 80% 35% at 50% 100%, rgba(25,27,191,0.7) 0%, transparent 70%)"
        }} />
      </div>
    </div>
  );
}
