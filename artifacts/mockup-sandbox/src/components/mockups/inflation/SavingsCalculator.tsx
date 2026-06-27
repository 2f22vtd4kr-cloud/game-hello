import { useState, useEffect } from "react";

const FUEL_TYPES = [
  { label: "АИ-92",  price: 47, monthlyPct: 2.8 },
  { label: "АИ-95",  price: 52, monthlyPct: 3.1 },
  { label: "АИ-95+", price: 56, monthlyPct: 3.4 },
  { label: "ДТ",     price: 60, monthlyPct: 2.5 },
  { label: "Газ",    price: 28, monthlyPct: 1.8 },
];

const VOLUMES = [20, 40, 60, 100, 200];

function fmt(n: number) { return n.toLocaleString("ru", { maximumFractionDigits: 0 }); }

export function SavingsCalculator() {
  const [fuelIdx, setFuelIdx] = useState(0);
  const [volume, setVolume] = useState(40);
  const [months, setMonths] = useState(3);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 80);
    return () => clearInterval(id);
  }, []);

  const fuel = FUEL_TYPES[fuelIdx];
  const lockedTotal = fuel.price * volume;
  // projected market price after N months
  const marketPrice = fuel.price * Math.pow(1 + fuel.monthlyPct / 100, months);
  const marketTotal = marketPrice * volume;
  const savings = marketTotal - lockedTotal;
  const savingsPct = ((savings / lockedTotal) * 100).toFixed(1);
  // animated live market price
  const liveDelta = Math.sin(tick * 0.04) * 0.4;
  const livePrice = (fuel.price + liveDelta + tick * 0.004).toFixed(2);

  // Bar chart data — monthly projected prices
  const chartData = Array.from({ length: months }, (_, i) => ({
    month: i + 1,
    market: fuel.price * Math.pow(1 + fuel.monthlyPct / 100, i + 1),
    locked: fuel.price,
  }));
  const maxBar = chartData[chartData.length - 1]?.market || fuel.price;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#050507",
      fontFamily: "system-ui, sans-serif",
      padding: "1.25rem 1rem",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none",
        background: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(168,85,247,0.015) 3px,rgba(168,85,247,0.015) 4px)" }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a855f7", fontSize: "0.44rem", letterSpacing: "0.18em", marginBottom: "0.4rem" }}>
            💰 КАЛЬКУЛЯТОР ЭКОНОМИИ
          </div>
          <h2 style={{ color: "#f1f5f9", fontSize: "1.2rem", fontWeight: 900, margin: 0, lineHeight: 1.15 }}>
            Сколько вы<br />
            <span style={{ background: "linear-gradient(90deg,#a855f7,#db2777)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              сохраните?
            </span>
          </h2>
        </div>

        {/* Live price pill */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem",
          background: "#0d0d18", border: "1px solid #1e1e2a", borderRadius: "10px", padding: "0.5rem 0.75rem" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 6px #ef4444", flexShrink: 0 }} />
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.48rem", color: "#6b7280" }}>
            РЫНОЧНАЯ ЦЕНА {fuel.label} СЕЙЧАС:
          </span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.62rem", color: "#ef4444", fontWeight: 700, marginLeft: "auto" }}>
            {livePrice} ₽/л
          </span>
        </div>

        {/* Fuel selector */}
        <div style={{ marginBottom: "0.85rem" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.42rem", color: "#374151", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>
            ТОПЛИВО
          </div>
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            {FUEL_TYPES.map((f, i) => (
              <button key={f.label} onClick={() => setFuelIdx(i)} style={{
                padding: "0.35rem 0.7rem",
                background: fuelIdx === i ? "#a855f722" : "#0d0d18",
                border: `1px solid ${fuelIdx === i ? "#a855f7" : "#1e1e2a"}`,
                borderRadius: "20px", cursor: "pointer",
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: "0.5rem",
                color: fuelIdx === i ? "#a855f7" : "#4b5563",
                fontWeight: fuelIdx === i ? 700 : 400,
              }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Volume selector */}
        <div style={{ marginBottom: "0.85rem" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.42rem", color: "#374151", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>
            ОБЪЁМ
          </div>
          <div style={{ display: "flex", gap: "0.35rem" }}>
            {VOLUMES.map(v => (
              <button key={v} onClick={() => setVolume(v)} style={{
                flex: 1,
                padding: "0.45rem 0",
                background: volume === v ? "#db277722" : "#0d0d18",
                border: `1px solid ${volume === v ? "#db2777" : "#1e1e2a"}`,
                borderRadius: "10px", cursor: "pointer",
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: "0.52rem",
                color: volume === v ? "#db2777" : "#4b5563",
                fontWeight: volume === v ? 700 : 400,
              }}>
                {v}л
              </button>
            ))}
          </div>
        </div>

        {/* Months selector */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.42rem", color: "#374151", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>
            СРОК ТАЛОНА — {months} МЕС.
          </div>
          <input type="range" min={1} max={3} value={months} onChange={e => setMonths(Number(e.target.value))}
            style={{ width: "100%", accentColor: "#a855f7" }} />
        </div>

        {/* Big savings result */}
        <div style={{
          background: "linear-gradient(135deg,#0a1a0a,#0d0d18)",
          border: "1px solid #22c55e44",
          borderRadius: "20px",
          padding: "1.25rem",
          marginBottom: "0.85rem",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px",
            background: "linear-gradient(90deg,transparent,#22c55e,transparent)" }} />
          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#22c55e", fontSize: "0.45rem", letterSpacing: "0.15em", marginBottom: "0.5rem" }}>
            ВЫ СЭКОНОМИТЕ
          </div>
          <div style={{ color: "#22c55e", fontSize: "2.2rem", fontWeight: 900, lineHeight: 1, marginBottom: "0.25rem" }}>
            {fmt(savings)} <span style={{ fontSize: "1.2rem" }}>₽</span>
          </div>
          <div style={{ color: "#16a34a", fontSize: "0.7rem", marginBottom: "0.75rem" }}>
            за {volume}л {fuel.label} через {months} мес.
          </div>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
            <div style={{ background: "#0a0a10", borderRadius: "8px", padding: "0.35rem 0.6rem", textAlign: "center" }}>
              <div style={{ color: "#22c55e", fontSize: "0.62rem", fontWeight: 700 }}>{fmt(lockedTotal)}₽</div>
              <div style={{ color: "#374151", fontSize: "0.42rem" }}>Вы платите</div>
            </div>
            <div style={{ background: "#0a0a10", borderRadius: "8px", padding: "0.35rem 0.6rem", textAlign: "center" }}>
              <div style={{ color: "#ef4444", fontSize: "0.62rem", fontWeight: 700 }}>{fmt(marketTotal)}₽</div>
              <div style={{ color: "#374151", fontSize: "0.42rem" }}>Рынок через {months}мес</div>
            </div>
            <div style={{ background: "#0a0a10", borderRadius: "8px", padding: "0.35rem 0.6rem", textAlign: "center" }}>
              <div style={{ color: "#a855f7", fontSize: "0.62rem", fontWeight: 700 }}>+{savingsPct}%</div>
              <div style={{ color: "#374151", fontSize: "0.42rem" }}>Дороже без талона</div>
            </div>
          </div>
        </div>

        {/* Mini bar chart */}
        <div style={{
          background: "#0d0d18", border: "1px solid #1e1e2a", borderRadius: "14px", padding: "0.75rem", marginBottom: "0.85rem"
        }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.42rem", color: "#374151", letterSpacing: "0.1em", marginBottom: "0.6rem" }}>
            ПРОГНОЗ ЦЕНЫ (₽/л)
          </div>
          <div style={{ display: "flex", gap: "0.35rem", alignItems: "flex-end", height: "60px" }}>
            {/* Locked bar */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.38rem", color: "#22c55e" }}>{locked}</div>
              <div style={{
                width: "100%",
                height: `${(fuel.price / maxBar) * 48}px`,
                background: "linear-gradient(to top,#22c55e,#16a34a44)",
                borderRadius: "4px 4px 0 0",
                borderTop: "1px solid #22c55e",
              }} />
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.38rem", color: "#374151" }}>Сейчас</div>
            </div>
            {chartData.map((d, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.38rem", color: "#ef4444" }}>{d.market.toFixed(0)}</div>
                <div style={{ width: "100%", position: "relative", height: `${(d.market / maxBar) * 48}px` }}>
                  <div style={{ position: "absolute", bottom: 0, width: "100%",
                    height: `${(d.locked / maxBar) * 48 / (d.market / maxBar) * 100}%`,
                    background: "#22c55e22", borderRadius: "0" }} />
                  <div style={{ position: "absolute", bottom: 0, width: "100%", height: "100%",
                    background: "linear-gradient(to top,#ef444444,#ef444422)",
                    borderRadius: "4px 4px 0 0", borderTop: "1px solid #ef444466" }} />
                </div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.38rem", color: "#374151" }}>+{i+1}м</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            {[["#22c55e","Ваш талон"],["#ef4444","Рынок"]].map(([c,l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: c }} />
                <span style={{ color: "#4b5563", fontSize: "0.42rem" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        <button style={{
          width: "100%", padding: "0.85rem",
          background: "linear-gradient(135deg,#a855f7,#db2777)",
          border: "none", borderRadius: "14px",
          color: "#fff", fontSize: "0.9rem", fontWeight: 800,
          cursor: "pointer", boxShadow: "0 0 24px #a855f740",
        }}>
          Купить {volume}л {fuel.label} · {fmt(lockedTotal)}₽
        </button>
      </div>
    </div>
  );
}
