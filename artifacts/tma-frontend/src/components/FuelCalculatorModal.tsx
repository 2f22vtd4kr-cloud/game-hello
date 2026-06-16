import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { impact } from "@/lib/haptic";

const FUEL_PRICES: Record<string, number> = {
  "АИ-92": 47, "АИ-95": 52, "АИ-95+": 56,
  "АИ-100": 68, "ДТ": 60, "ДТ+": 65, "Газ": 28,
};

const FUEL_CONSUMPTION: Record<string, number> = {
  "Легковой": 8,
  "Внедорожник": 12,
  "Микроавтобус": 14,
  "Грузовик": 25,
  "Мотоцикл": 5,
};

interface Props { onClose: () => void; }

export function FuelCalculatorModal({ onClose }: Props) {
  const [distance, setDistance] = useState<string>("100");
  const [consumption, setConsumption] = useState<string>("9");
  const [fuelType, setFuelType] = useState<string>("АИ-92");
  const [margin, setMargin] = useState<string>("10");

  const result = useMemo(() => {
    const d = parseFloat(distance) || 0;
    const c = parseFloat(consumption) || 0;
    const m = parseFloat(margin) || 0;
    const price = FUEL_PRICES[fuelType] ?? 47;
    const volumeNeeded = (d * c) / 100;
    const volumeWithMargin = volumeNeeded * (1 + m / 100);
    const totalCost = volumeWithMargin * price;
    const costPer100 = (c * price);
    return { volumeNeeded, volumeWithMargin, totalCost, costPer100, price };
  }, [distance, consumption, fuelType, margin]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 900,
        background: "rgba(2,2,8,0.9)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        backdropFilter: "blur(4px)",
      }}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "480px",
          background: "linear-gradient(160deg,#0d0d18,#0a0a14)",
          border: "1px solid #a855f733",
          borderBottom: "none",
          borderRadius: "22px 22px 0 0",
          padding: "1rem 1.25rem 2rem",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#a855f7,#db2777,transparent)" }} />

        {/* Handle */}
        <div style={{ width: "36px", height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.1)", margin: "0 auto 1rem" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.46rem", color: "#4b5563", letterSpacing: "0.16em", marginBottom: "0.15rem" }}>ТОПЛИВО_КАЛЬКУЛЯТОР · РЕЙС</div>
            <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: "1rem", fontWeight: 700 }}>🧮 Калькулятор расхода</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#6b7280", fontSize: "0.8rem", padding: "0.3rem 0.5rem", cursor: "pointer" }}
          >✕</button>
        </div>

        {/* Quick-fill vehicle presets */}
        <div style={{ display: "flex", gap: "0.35rem", overflowX: "auto", marginBottom: "0.85rem", scrollbarWidth: "none" }}>
          {Object.entries(FUEL_CONSUMPTION).map(([label, val]) => (
            <button
              key={label}
              onClick={() => { impact("light"); setConsumption(String(val)); }}
              style={{
                flexShrink: 0,
                background: parseFloat(consumption) === val ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${parseFloat(consumption) === val ? "#a855f7" : "#1e1e2a"}`,
                borderRadius: "8px", color: parseFloat(consumption) === val ? "#a855f7" : "#6b7280",
                fontSize: "0.65rem", padding: "0.3rem 0.65rem", cursor: "pointer", whiteSpace: "nowrap",
              }}
            >{label}</button>
          ))}
        </div>

        {/* Inputs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem", marginBottom: "0.65rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.52rem", color: "#6b7280", letterSpacing: "0.1em" }}>РАССТОЯНИЕ (КМ)</span>
            <input
              type="number" min="0" value={distance}
              onChange={(e) => setDistance(e.target.value)}
              style={{ background: "#0b0b12", border: "1px solid #1e1e2a", borderRadius: "10px", color: "#e2e8f0", padding: "0.55rem 0.7rem", fontSize: "1rem", fontWeight: 700, outline: "none", width: "100%", boxSizing: "border-box" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.52rem", color: "#6b7280", letterSpacing: "0.1em" }}>РАСХОД (Л/100КМ)</span>
            <input
              type="number" min="0" step="0.5" value={consumption}
              onChange={(e) => setConsumption(e.target.value)}
              style={{ background: "#0b0b12", border: "1px solid #1e1e2a", borderRadius: "10px", color: "#e2e8f0", padding: "0.55rem 0.7rem", fontSize: "1rem", fontWeight: 700, outline: "none", width: "100%", boxSizing: "border-box" }}
            />
          </label>
        </div>

        {/* Fuel type selector */}
        <div style={{ marginBottom: "0.65rem" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.52rem", color: "#6b7280", letterSpacing: "0.1em", marginBottom: "0.35rem" }}>ТИП ТОПЛИВА</div>
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            {Object.entries(FUEL_PRICES).map(([ft, price]) => (
              <button
                key={ft}
                onClick={() => { impact("light"); setFuelType(ft); }}
                style={{
                  background: fuelType === ft ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${fuelType === ft ? "#a855f7" : "#1e1e2a"}`,
                  borderRadius: "8px", color: fuelType === ft ? "#a855f7" : "#6b7280",
                  fontSize: "0.68rem", padding: "0.3rem 0.6rem", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "1px",
                }}
              >
                <span style={{ fontWeight: 700 }}>{ft}</span>
                <span style={{ fontSize: "0.52rem", opacity: 0.7 }}>{price} ₽</span>
              </button>
            ))}
          </div>
        </div>

        {/* Reserve margin */}
        <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.52rem", color: "#6b7280", letterSpacing: "0.1em" }}>ЗАПАС (%)</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.52rem", color: "#a855f7" }}>{margin}%</span>
          </div>
          <input
            type="range" min="0" max="50" step="5" value={margin}
            onChange={(e) => setMargin(e.target.value)}
            style={{ accentColor: "#a855f7", width: "100%" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {[0, 10, 20, 30, 40, 50].map(v => (
              <span key={v} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.46rem", color: parseFloat(margin) === v ? "#a855f7" : "#374151" }}>{v}%</span>
            ))}
          </div>
        </label>

        {/* Result card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${distance}-${consumption}-${fuelType}-${margin}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              background: "linear-gradient(135deg,#0f0a1a,#0a0f1a)",
              border: "1px solid #a855f733",
              borderRadius: "16px",
              padding: "1rem 1.1rem",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#a855f7,transparent)" }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.46rem", color: "#4b5563", letterSpacing: "0.12em", marginBottom: "0.2rem" }}>ОБЪЁМ ТОПЛИВА</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "1.4rem", fontWeight: 800, color: "#3b82f6", lineHeight: 1 }}>
                  {result.volumeWithMargin.toFixed(1)}<span style={{ fontSize: "0.7rem", fontWeight: 400, color: "#4b5563" }}> л</span>
                </div>
                {parseFloat(margin) > 0 && (
                  <div style={{ fontSize: "0.58rem", color: "#4b5563", marginTop: "0.15rem" }}>
                    базово: {result.volumeNeeded.toFixed(1)} л + запас
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.46rem", color: "#4b5563", letterSpacing: "0.12em", marginBottom: "0.2rem" }}>СТОИМОСТЬ</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "1.4rem", fontWeight: 800, color: "#22c55e", lineHeight: 1 }}>
                  {result.totalCost.toFixed(0)}<span style={{ fontSize: "0.7rem", fontWeight: 400, color: "#4b5563" }}> ₽</span>
                </div>
                <div style={{ fontSize: "0.58rem", color: "#4b5563", marginTop: "0.15rem" }}>
                  {result.price} ₽/л · {fuelType}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "8px", padding: "0.5rem 0.6rem", textAlign: "center" }}>
                <div style={{ fontSize: "0.55rem", color: "#4b5563", marginBottom: "0.15rem" }}>100 км</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.85rem", color: "#f59e0b", fontWeight: 700 }}>{result.costPer100.toFixed(0)} ₽</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "8px", padding: "0.5rem 0.6rem", textAlign: "center" }}>
                <div style={{ fontSize: "0.55rem", color: "#4b5563", marginBottom: "0.15rem" }}>1 км</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.85rem", color: "#f59e0b", fontWeight: 700 }}>{(result.costPer100 / 100).toFixed(2)} ₽</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "8px", padding: "0.5rem 0.6rem", textAlign: "center" }}>
                <div style={{ fontSize: "0.55rem", color: "#4b5563", marginBottom: "0.15rem" }}>1 литр</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.85rem", color: "#a855f7", fontWeight: 700 }}>{result.price} ₽</div>
              </div>
            </div>

            {/* Progress bar: how many 20L cans */}
            {result.volumeWithMargin > 0 && (
              <div style={{ marginTop: "0.7rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.46rem", color: "#4b5563", letterSpacing: "0.1em" }}>КАНИСТРЫ (20 Л)</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", color: "#6b7280" }}>{Math.ceil(result.volumeWithMargin / 20)} шт</span>
                </div>
                <div style={{ display: "flex", gap: "3px" }}>
                  {Array.from({ length: Math.min(Math.ceil(result.volumeWithMargin / 20), 8) }).map((_, i) => {
                    const filled = result.volumeWithMargin - i * 20;
                    const pct = Math.min(1, filled / 20);
                    return (
                      <div key={i} style={{ flex: 1, height: "6px", background: "#1e1e2a", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ width: `${pct * 100}%`, height: "100%", background: "linear-gradient(90deg,#3b82f6,#a855f7)", borderRadius: "3px" }} />
                      </div>
                    );
                  })}
                  {Math.ceil(result.volumeWithMargin / 20) > 8 && (
                    <span style={{ fontSize: "0.55rem", color: "#4b5563", alignSelf: "center", marginLeft: "2px" }}>+{Math.ceil(result.volumeWithMargin / 20) - 8}</span>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
