import { useState, useEffect } from "react";

const FUEL_ROWS = [
  { label: "АИ-92",  price: 47, trend: 2.8, color: "#22c55e" },
  { label: "АИ-95",  price: 52, trend: 3.1, color: "#a855f7" },
  { label: "АИ-95+", price: 56, trend: 3.4, color: "#db2777" },
  { label: "ДТ",     price: 60, trend: 2.5, color: "#f59e0b" },
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function InflationBanner() {
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 50);
    return () => clearInterval(id);
  }, []);

  const fuel = FUEL_ROWS[selected];
  // animated "market" price — slowly creeping up
  const wave = Math.sin(tick * 0.04) * 0.3 + Math.sin(tick * 0.015) * 0.15;
  const marketNow = fuel.price + wave + (tick * 0.003);
  const marketIn3mo = fuel.price * (1 + fuel.trend * 3 / 100);
  const locked = fuel.price;
  const saving3mo = (marketIn3mo - locked).toFixed(1);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#050507",
      display: "flex",
      flexDirection: "column",
      fontFamily: "system-ui, sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* CRT scanlines */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(168,85,247,0.015) 3px,rgba(168,85,247,0.015) 4px)" }} />

      {/* Grid */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "linear-gradient(rgba(168,85,247,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(168,85,247,0.04) 1px,transparent 1px)",
        backgroundSize: "36px 36px" }} />

      {/* Glow orb */}
      <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
        width: "300px", height: "300px", borderRadius: "50%",
        background: "radial-gradient(circle,rgba(168,85,247,0.12) 0%,transparent 70%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, padding: "1.25rem 1rem", flex: 1, display: "flex", flexDirection: "column" }}>

        {/* Status bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "1.5rem" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.44rem", color: "#4b5563", letterSpacing: "0.15em" }}>
            МАТРИЦА_СНАБЖЕНИЯ · ЦЕНА_ЗАМОРОЖЕНА · LIVE
          </span>
        </div>

        {/* Hero headline */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a855f7", fontSize: "0.5rem", letterSpacing: "0.2em", marginBottom: "0.5rem" }}>
            ⛽ ТОПЛИВНЫЕ ТАЛОНЫ
          </div>
          <h1 style={{ color: "#f1f5f9", fontSize: "1.55rem", fontWeight: 900, margin: 0, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            Заплати<br />
            <span style={{ color: "#a855f7" }}>сегодня</span><br />
            — заправляйся<br />
            <span style={{ background: "linear-gradient(90deg,#a855f7,#db2777)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              три месяца
            </span>
          </h1>
          <p style={{ color: "#6b7280", fontSize: "0.78rem", margin: "0.75rem 0 0", lineHeight: 1.6, maxWidth: "280px" }}>
            Цена фиксируется в момент покупки. Никакой индексации, никакой инфляции — только ваши литры по вашей цене.
          </p>
        </div>

        {/* Fuel selector */}
        <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.85rem", flexWrap: "wrap" }}>
          {FUEL_ROWS.map((f, i) => (
            <button key={f.label} onClick={() => setSelected(i)} style={{
              padding: "0.3rem 0.65rem",
              background: selected === i ? `${f.color}22` : "#0d0d18",
              border: `1px solid ${selected === i ? f.color : "#1e1e2a"}`,
              borderRadius: "20px", cursor: "pointer",
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: "0.5rem", color: selected === i ? f.color : "#4b5563",
              fontWeight: selected === i ? 700 : 400,
              transition: "all 0.2s",
            }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Live price comparison card */}
        <div style={{
          background: "linear-gradient(135deg,#0d0d18,#130d20)",
          border: "1px solid #1e1e2a",
          borderRadius: "20px",
          padding: "1rem",
          marginBottom: "0.75rem",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px",
            background: `linear-gradient(90deg,transparent,${fuel.color},transparent)` }} />

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "stretch" }}>
            {/* Locked price */}
            <div style={{ flex: 1, textAlign: "center", padding: "0.75rem 0.5rem",
              background: "#0a0a10", borderRadius: "12px", border: "1px solid #1e1e2a" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.42rem", color: "#22c55e", letterSpacing: "0.12em", marginBottom: "0.4rem" }}>
                🔒 ВАШ ТАЛОН
              </div>
              <div style={{ color: "#22c55e", fontSize: "1.4rem", fontWeight: 900, lineHeight: 1 }}>
                {locked}<span style={{ fontSize: "0.7rem", fontWeight: 400, color: "#16a34a" }}>₽</span>
              </div>
              <div style={{ color: "#4b5563", fontSize: "0.52rem", marginTop: "0.3rem" }}>за литр · ЗАФИКСИРОВАНО</div>
            </div>

            {/* Arrow */}
            <div style={{ display: "flex", alignItems: "center", color: "#374151", fontSize: "1rem" }}>→</div>

            {/* Market price */}
            <div style={{ flex: 1, textAlign: "center", padding: "0.75rem 0.5rem",
              background: "#100808", borderRadius: "12px", border: "1px solid #ef444422" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.42rem", color: "#ef4444", letterSpacing: "0.12em", marginBottom: "0.4rem" }}>
                📈 РЫНОК СЕЙЧАС
              </div>
              <div style={{ color: "#ef4444", fontSize: "1.4rem", fontWeight: 900, lineHeight: 1 }}>
                {marketNow.toFixed(1)}<span style={{ fontSize: "0.7rem", fontWeight: 400, color: "#dc2626" }}>₽</span>
              </div>
              <div style={{ color: "#4b5563", fontSize: "0.52rem", marginTop: "0.3rem" }}>за литр · РАСТЁТ</div>
            </div>
          </div>

          {/* Savings callout */}
          <div style={{
            marginTop: "0.75rem",
            background: `${fuel.color}10`,
            border: `1px solid ${fuel.color}30`,
            borderRadius: "10px",
            padding: "0.6rem 0.75rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <span style={{ color: "#9ca3af", fontSize: "0.62rem" }}>Ваша экономия через 3 месяца</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: fuel.color, fontSize: "0.85rem", fontWeight: 900 }}>
              +{saving3mo}₽/л
            </span>
          </div>
        </div>

        {/* Live market ticker */}
        <div style={{
          background: "#080810",
          border: "1px solid #1e1e2a",
          borderRadius: "12px",
          padding: "0.6rem 0.75rem",
          marginBottom: "0.85rem",
          display: "flex",
          gap: "0.75rem",
          overflowX: "auto",
        }}>
          {FUEL_ROWS.map(f => {
            const w = Math.sin(tick * 0.04 + f.price) * 0.2;
            const live = (f.price + w + tick * 0.002).toFixed(2);
            return (
              <div key={f.label} style={{ flexShrink: 0, textAlign: "center" }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.42rem", color: "#374151", marginBottom: "0.15rem" }}>{f.label}</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.62rem", color: f.color, fontWeight: 700 }}>{live}₽</div>
                <div style={{ fontSize: "0.45rem", color: "#ef4444" }}>▲{f.trend}%/мес</div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <button style={{
          width: "100%",
          padding: "0.9rem",
          background: "linear-gradient(135deg,#a855f7,#db2777)",
          border: "none",
          borderRadius: "16px",
          color: "#fff",
          fontSize: "0.95rem",
          fontWeight: 800,
          cursor: "pointer",
          boxShadow: "0 0 30px #a855f740",
          letterSpacing: "0.01em",
          marginBottom: "0.5rem",
        }}>
          Зафиксировать цену сейчас 🔒
        </button>
        <div style={{ textAlign: "center", color: "#374151", fontSize: "0.55rem", fontFamily: "'JetBrains Mono',monospace" }}>
          ГАРАНТИЯ · 90 ДНЕЙ · БЕЗ ИНДЕКСАЦИИ
        </div>
      </div>
    </div>
  );
}
