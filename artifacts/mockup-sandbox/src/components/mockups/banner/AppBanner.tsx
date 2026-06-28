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
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
            `,
            backgroundSize: "18px 18px",
          }}
        />
        {[
          { x: 20, y: 30, c: "#22c55e" },
          { x: 45, y: 20, c: "#22c55e" },
          { x: 60, y: 45, c: "#fbbf24" },
          { x: 30, y: 55, c: "#22c55e" },
          { x: 72, y: 30, c: "#ff6b6b" },
          { x: 15, y: 68, c: "#22c55e" },
          { x: 55, y: 70, c: "#fbbf24" },
          { x: 80, y: 60, c: "#22c55e" },
          { x: 38, y: 78, c: "#ff6b6b" },
          { x: 65, y: 82, c: "#22c55e" },
        ].map((m, i) => (
          <div
            key={i}
            className="absolute flex flex-col items-center"
            style={{ left: `${m.x}%`, top: `${m.y}%` }}
          >
            <div
              className="w-2.5 h-2.5 rounded-full shadow-lg border border-white/20"
              style={{ background: m.c }}
            />
            <div
              className="w-0.5 h-1"
              style={{ background: m.c, opacity: 0.6 }}
            />
          </div>
        ))}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-[#1E22DC]/80 backdrop-blur-sm border border-white/20 rounded-lg px-2 py-1">
          <p className="text-[7px] text-white/80 text-center">1 295 станций</p>
        </div>
      </div>

      <div className="flex justify-around items-center px-2 py-1.5 bg-[#0d0f1a] border-t border-white/10">
        {[
          { icon: "🗺️", label: "Карта", active: true },
          { icon: "📊", label: "Аналит." },
          { icon: "⛽", label: "Каталог" },
          { icon: "🔐", label: "Хранилище" },
          { icon: "⭐", label: "Игры" },
        ].map((t) => (
          <div key={t.label} className="flex flex-col items-center gap-0.5">
            <span className="text-[9px]">{t.icon}</span>
            <span className={`text-[5px] ${t.active ? "text-[#E8622A] font-bold" : "text-white/40"}`}>
              {t.label}
            </span>
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
        {[
          { icon: "🗺️", label: "Карта" },
          { icon: "📊", label: "Аналит." },
          { icon: "⛽", label: "Каталог", active: true },
          { icon: "🔐", label: "Хранилище" },
          { icon: "⭐", label: "Игры" },
        ].map((t) => (
          <div key={t.label} className="flex flex-col items-center gap-0.5">
            <span className="text-[9px]">{t.icon}</span>
            <span className={`text-[5px] ${t.active ? "text-[#E8622A] font-bold" : "text-white/40"}`}>
              {t.label}
            </span>
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
                  <div key={k} className={`rounded-[1px] ${[0,2,4,6,8].includes(k) ? "bg-black" : "bg-white"}`} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-around items-center px-2 py-1.5 bg-[#0d0f1a] border-t border-white/10">
        {[
          { icon: "🗺️", label: "Карта" },
          { icon: "📊", label: "Аналит." },
          { icon: "⛽", label: "Каталог" },
          { icon: "🔐", label: "Хранилище", active: true },
          { icon: "⭐", label: "Игры" },
        ].map((t) => (
          <div key={t.label} className="flex flex-col items-center gap-0.5">
            <span className="text-[9px]">{t.icon}</span>
            <span className={`text-[5px] ${t.active ? "text-[#E8622A] font-bold" : "text-white/40"}`}>
              {t.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhoneMockup({ children, rotate = 0, scale = 1, zIndex = 1 }: {
  children: React.ReactNode;
  rotate?: number;
  scale?: number;
  zIndex?: number;
}) {
  return (
    <div
      className="relative"
      style={{
        transform: `rotate(${rotate}deg) scale(${scale})`,
        zIndex,
        transformOrigin: "bottom center",
      }}
    >
      <div
        className="relative rounded-[28px] overflow-hidden shadow-2xl border-4 border-[#c8a97a]"
        style={{
          width: 165,
          height: 340,
          background: "#1a1a1a",
          boxShadow: "0 30px 80px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.1)",
        }}
      >
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
        <div className="absolute inset-0 rounded-[28px] pointer-events-none"
          style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }}
        />
      </div>
    </div>
  );
}

export function AppBanner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    const grad = ctx.createLinearGradient(0, 0, W * 0.6, H);
    grad.addColorStop(0, "#1E22DC");
    grad.addColorStop(0.4, "#181CC6");
    grad.addColorStop(0.75, "#1318B0");
    grad.addColorStop(1, "#1015A5");
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
    <div className="relative w-full h-screen flex items-center justify-center overflow-hidden" style={{ background: "linear-gradient(160deg, #1E22DC 0%, #181CC6 40%, #1318B0 75%, #1015A5 100%)" }}>
      <canvas
        ref={canvasRef}
        width={1200}
        height={800}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 1 }}
      />

      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.35 }}>
        <defs>
          <style>{`
            @keyframes twinkle {
              0%, 100% { opacity: 0.15; }
              50% { opacity: 0.9; }
            }
          `}</style>
        </defs>
        {stars.map((s) => (
          <circle
            key={s.id}
            cx={`${s.x}%`}
            cy={`${s.y}%`}
            r={s.r + 0.3}
            fill="white"
            style={{
              animation: `twinkle ${2.5 + s.delay}s ease-in-out infinite`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}
      </svg>

      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 60% 70% at 75% 50%, rgba(232,98,42,0.12) 0%, transparent 70%)"
      }} />

      <div className="relative z-10 flex flex-col items-center gap-10 w-full px-8">

        <div className="flex flex-col items-start gap-3 absolute left-12 top-1/2 -translate-y-1/2">
          <div className="text-[11px] font-mono tracking-[0.2em] text-white/50 uppercase">Топливный Узел</div>
          <div className="text-5xl font-black text-white leading-[1.05]" style={{ textShadow: "0 0 40px rgba(30,34,220,0.5)" }}>
            Матрица<br />Снабжения
          </div>
          <div className="text-sm text-white/60 max-w-[200px] leading-relaxed">
            1 295 АЗС · Крым и юг России · Реальное время
          </div>
          <div className="mt-2 px-4 py-2 rounded-full text-sm font-bold text-white"
            style={{ background: "#E8622A", boxShadow: "0 0 20px rgba(232,98,42,0.4)" }}>
            Открыть в Telegram
          </div>
        </div>

        <div className="relative flex items-end justify-center ml-48" style={{ height: 400 }}>
          <div className="absolute" style={{ left: -80, bottom: 0, zIndex: 1 }}>
            <PhoneMockup rotate={-18} scale={0.88} zIndex={1}>
              <MapScreen />
            </PhoneMockup>
          </div>

          <div className="absolute" style={{ left: 50, bottom: 20, zIndex: 3 }}>
            <PhoneMockup rotate={0} scale={1} zIndex={3}>
              <CatalogScreen />
            </PhoneMockup>
          </div>

          <div className="absolute" style={{ left: 185, bottom: 0, zIndex: 2 }}>
            <PhoneMockup rotate={16} scale={0.88} zIndex={2}>
              <VaultScreen />
            </PhoneMockup>
          </div>

          <div className="absolute inset-0 pointer-events-none" style={{
            background: "radial-gradient(ellipse 70% 40% at 50% 100%, rgba(30,34,220,0.6) 0%, transparent 70%)"
          }} />
        </div>
      </div>

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 items-center opacity-40">
        {["АИ-92", "АИ-95", "ДТ", "ГАЗ"].map((f) => (
          <span key={f} className="text-[10px] text-white border border-white/20 px-2 py-0.5 rounded-full">{f}</span>
        ))}
      </div>
    </div>
  );
}
