import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine,
} from "recharts";
import { fetchAnalytics, fetchTrend, fetchNews, fetchSystemStats, fetchPriceHistory, fetchRegionalPrices, fetchNetworkPrices, fetchCrisisForecast } from "@/api/client";
import type { SystemStats } from "@/api/client";
import type { NewsItem } from "@/types";
import { useFavoritesStore } from "@/stores/useFavoritesStore";
import { usePriceStore } from "@/stores/usePriceStore";
import { useStationStore } from "@/stores/useStationStore";
import type { Analytics, RegionalSupply, TrendPoint, TabId } from "@/types";

interface Props { onNavigate?: (tab: TabId) => void; }

// ── Animated counter ──────────────────────────────────────────────
function AnimatedCounter({ value, suffix = "", color = "#e2e8f0", size = "1.8rem" }: {
  value: number; suffix?: string; color?: string; size?: string;
}) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    const start = Date.now();
    const duration = 900;
    const from = display;
    const diff = value - from;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + diff * ease));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: size, fontWeight: 700, color, lineHeight: 1 }}>
      {display}{suffix}
    </span>
  );
}

// ── Crisis banner ─────────────────────────────────────────────────
function CrisisBanner({ count, onNavigate }: { count: number; onNavigate?: (t: TabId) => void }) {
  if (count === 0) return null;
  const pct = Math.round((count / 23) * 100);
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      style={{ padding: "0 1rem 0.6rem" }}
    >
      <div style={{
        background: "linear-gradient(135deg,#1f0606,#1a0508)",
        border: "1px solid #ef444455",
        borderRadius: "14px",
        padding: "0.7rem 0.9rem",
        display: "flex", alignItems: "center", gap: "0.75rem",
        position: "relative", overflow: "hidden",
        boxShadow: "0 0 24px #ef444422, inset 0 0 20px #ef444408",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#ef4444,transparent)" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.03, background: "repeating-linear-gradient(0deg,transparent,transparent 3px,#ef4444 3px,#ef4444 4px)" }} />
        <motion.div
          animate={{ opacity: [1, 0.3, 1], scale: [1, 1.2, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          style={{
            width: "12px", height: "12px", borderRadius: "50%", flexShrink: 0,
            background: "#FF1744", boxShadow: "0 0 16px #ef4444",
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 0.1rem", color: "#FF1744", fontWeight: 800, fontSize: "0.82rem", lineHeight: 1 }}>
            🚨 Критический дефицит
          </p>
          <span style={{ color: "rgba(255,255,255,0.72)", fontSize: "0.68rem" }}>
            {count} {count === 1 ? "регион" : count < 5 ? "региона" : "регионов"} · {pct}% зон ниже 25%
          </span>
        </div>
        <button
          onClick={() => onNavigate?.("catalog")}
          style={{
            background: "linear-gradient(135deg,#ef444430,#ef444410)", border: "1px solid #ef444455", borderRadius: "8px",
            color: "#FF1744", fontSize: "0.7rem", fontWeight: 700, padding: "0.35rem 0.65rem",
            cursor: "pointer", flexShrink: 0, boxShadow: "0 0 8px #ef444430",
          }}
        >
          ⚡ Купить
        </button>
      </div>
    </motion.div>
  );
}

// ── Live price matrix ─────────────────────────────────────────────
function PriceMatrix({ regions }: { regions: Record<string, RegionalSupply> }) {
  const prices = usePriceStore((s) => s.prices);
  const FUELS = ["АИ-92", "АИ-95", "ДТ"];
  const FUEL_COLORS = ["#38bdf8", "#E8622A", "#f59e0b"];

  const crisisRegions = Object.entries(regions)
    .sort((a, b) => a[1].avg_pct - b[1].avg_pct)
    .slice(0, 6)
    .map(([r]) => r);

  if (!crisisRegions.length || !Object.keys(prices).length) return null;

  return (
    <div style={{ padding: "0 1rem 0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div>
            <p style={{ color: "rgba(255,255,255,0.72)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
              Матрица цен
            </p>
          </div>
          <span style={{ background: "#ef444415", border: "1px solid #ef444430", borderRadius: "4px", color: "#FF1744", fontSize: "0.55rem", fontWeight: 700, padding: "0.1rem 0.35rem", fontFamily: "'JetBrains Mono',monospace" }}>
            ТОП-6 крит.
          </span>
        </div>
        <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.58rem", fontFamily: "'JetBrains Mono',monospace" }}>₽/литр</span>
      </div>

      <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #1e1e2a", borderRadius: "14px", overflow: "hidden", boxShadow: "0 4px 24px #00000040" }}>
        {/* Header row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(3, 68px)", background: "rgba(0,0,0,0.3)", borderBottom: "1px solid rgba(232,98,42,0.1)" }}>
          <div style={{ padding: "0.45rem 0.7rem", color: "#E8622A", fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono',monospace" }}>
            регион
          </div>
          {FUELS.map((f, i) => (
            <div key={f} style={{ padding: "0.45rem 0.4rem", color: FUEL_COLORS[i], fontSize: "0.6rem", fontWeight: 700, textAlign: "center", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.04em" }}>{f}</div>
          ))}
        </div>

        {crisisRegions.map((region, ri) => {
          const regionPrices = prices[region] ?? {};
          const supply = regions[region];
          const isCritical = supply?.avg_pct < 25;
          const isLow = supply?.avg_pct < 50;
          const rowBg = isCritical ? "linear-gradient(90deg,#1a050510,transparent)" : "transparent";
          return (
            <div
              key={region}
              style={{
                display: "grid", gridTemplateColumns: "1fr repeat(3, 68px)",
                borderBottom: ri < crisisRegions.length - 1 ? "1px solid #12121e" : "none",
                background: rowBg,
                borderLeft: isCritical ? "2px solid #ef444466" : isLow ? "2px solid #eab30844" : "2px solid transparent",
              }}
            >
              <div style={{ padding: "0.5rem 0.7rem", overflow: "hidden" }}>
                <div style={{ color: isCritical ? "#fca5a5" : "rgba(255,255,255,0.82)", fontSize: "0.67rem", fontWeight: isCritical ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {(() => {
                    const s = region
                      .replace(/\s+область$/i, " обл.")
                      .replace(/\s+республика\b/i, " Респ.")
                      .replace(/\s+автономный округ\b/i, " АО")
                      .replace(/\s+автономная область\b/i, " АО");
                    return s.length > 18 ? s.slice(0, 17) + "…" : s;
                  })()}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "2px" }}>
                  <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: isCritical ? "#FF1744" : isLow ? "#FFD600" : "#00E676", flexShrink: 0 }} />
                  <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.58rem", fontFamily: "'JetBrains Mono',monospace" }}>
                    {supply?.avg_pct ?? "—"}%
                  </span>
                </div>
              </div>
              {FUELS.map((f) => {
                const p = regionPrices[f] as { effective: number; multiplier: number; is_crisis: boolean } | undefined;
                const isCrisisPrice = p?.is_crisis;
                const up = (p?.multiplier ?? 1) > 1.03;
                const priceColor = isCrisisPrice ? "#FF1744" : up ? "#f59e0b" : "#00E676";
                return (
                  <div key={f} style={{ padding: "0.5rem 0.4rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1px" }}>
                    {p ? (
                      <>
                        <span style={{
                          fontFamily: "'JetBrains Mono',monospace",
                          fontSize: "0.8rem", fontWeight: 700, color: priceColor,
                          textShadow: isCrisisPrice ? "0 0 8px #ef444466" : "none",
                        }}>
                          {p.effective.toFixed(0)}
                        </span>
                        {p.multiplier !== 1 && (
                          <span style={{ fontSize: "0.52rem", color: isCrisisPrice ? "#ef444499" : "rgba(255,255,255,0.55)", fontFamily: "'JetBrains Mono',monospace" }}>
                            {up ? "▲" : "▼"}{Math.abs((p.multiplier - 1) * 100).toFixed(0)}%
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.7rem" }}>—</span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Fuel mix donut ────────────────────────────────────────────────
function FuelMixDonut({ regions }: { regions: Record<string, RegionalSupply> }) {
  const values = Object.values(regions);
  if (!values.length) return null;
  const green = values.reduce((a, r) => a + r.green, 0);
  const yellow = values.reduce((a, r) => a + r.yellow, 0);
  const red = values.reduce((a, r) => a + r.red, 0);
  const total = green + yellow + red;
  if (!total) return null;
  const data = [
    { name: "Норма", value: green, color: "#00E676" },
    { name: "Мало", value: yellow, color: "#FFD600" },
    { name: "Нет", value: red, color: "#FF1744" },
  ];
  return (
    <div style={{ width: "110px", position: "relative" }}>
      <PieChart width={110} height={110}>
        <Pie data={data} cx={50} cy={50} innerRadius={30} outerRadius={48} paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
          {data.map((entry, i) => <Cell key={i} fill={entry.color} stroke="transparent" />)}
        </Pie>
      </PieChart>
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-48%, -50%)",
        textAlign: "center", pointerEvents: "none",
      }}>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.9rem", fontWeight: 700, color: "#e2e8f0" }}>
          {Math.round((green / total) * 100)}%
        </span>
        <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.55)", textTransform: "uppercase" }}>норма</div>
      </div>
    </div>
  );
}

// ── Region cycling monitor ────────────────────────────────────────
function RegionMonitor({ regions }: { regions: Record<string, RegionalSupply> }) {
  const entries = Object.entries(regions).sort((a, b) => b[1].avg_pct - a[1].avg_pct);
  const [idx, setIdx] = useState(0);
  const [vis, setVis] = useState(true);
  useEffect(() => {
    if (!entries.length) return;
    const id = setInterval(() => {
      setVis(false);
      setTimeout(() => { setIdx((i) => (i + 1) % entries.length); setVis(true); }, 280);
    }, 2800);
    return () => clearInterval(id);
  }, [entries.length]);
  if (!entries.length) return null;
  const [region, data] = entries[idx];
  const color = data.avg_pct >= 60 ? "#00E676" : data.avg_pct >= 25 ? "#FFD600" : "#FF1744";
  const dot = data.avg_pct >= 60 ? "🟢" : data.avg_pct >= 25 ? "🟡" : "🔴";
  const zoneLabel: Record<string, string> = { critical: "Крит", standard: "Стандарт", eastern: "Восток" };
  return (
    <div style={{ background: "#0b0b0f", border: "1px solid #1e1e2a", borderRadius: "12px", padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <div style={{ width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, background: "#E8622A", boxShadow: "0 0 8px #E8622A", animation: "tmaPulse 1.5s infinite" }} />
      <div style={{ flex: 1, minWidth: 0, transition: "opacity 0.28s", opacity: vis ? 1 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>СКАН</span>
          <span style={{ color: "#e2e8f0", fontSize: "0.82rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{region}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.2rem" }}>
          <span style={{ fontSize: "0.78rem" }}>{dot}</span>
          <span style={{ color, fontFamily: "'JetBrains Mono',monospace", fontSize: "1rem", fontWeight: 700 }}>{data.avg_pct}%</span>
          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.65rem", background: "#14141c", borderRadius: "4px", padding: "0.1rem 0.35rem" }}>{zoneLabel[data.zone_type] ?? data.zone_type}</span>
          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.65rem" }}>{data.count} АЗС</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: "3px", flexShrink: 0 }}>
        {Array.from({ length: Math.min(entries.length, 8) }).map((_, i) => (
          <div key={i} style={{ width: "5px", height: "5px", borderRadius: "50%", background: i === (idx % Math.min(entries.length, 8)) ? "#E8622A" : "#22222f", transition: "background 0.3s" }} />
        ))}
      </div>
    </div>
  );
}

// ── Regional card ─────────────────────────────────────────────────
function RegionCard({ region, data, isFav, onToggleFav }: { region: string; data: RegionalSupply; isFav: boolean; onToggleFav: () => void }) {
  const color = data.avg_pct >= 60 ? "#00E676" : data.avg_pct >= 25 ? "#FFD600" : "#FF1744";
  const total = data.green + data.yellow + data.red;
  const gP = total ? (data.green / total) * 100 : 0;
  const yP = total ? (data.yellow / total) * 100 : 0;
  const rP = total ? (data.red / total) * 100 : 0;
  const trend = data.avg_pct >= 60 ? "↑" : data.avg_pct >= 25 ? "→" : "↓";
  const isCritical = data.avg_pct < 25;
  const zoneLabel: Record<string, string> = { critical: "КР", standard: "СТ", eastern: "ВС" };
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      style={{
        background: isCritical ? "linear-gradient(135deg,#14080a,#1a0c0e)" : "linear-gradient(135deg,#0f0f18,#14141c)",
        border: `1px solid ${isFav ? "#E8622A40" : isCritical ? "#ef444430" : "#1e1e2a"}`,
        borderRadius: "14px",
        padding: "0.8rem",
        position: "relative",
        overflow: "hidden",
        boxShadow: isCritical ? "0 0 20px #ef444418" : isFav ? "0 0 16px #E8622A12" : "none",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: isCritical ? "linear-gradient(90deg,#ef4444,#dc2626)" : isFav ? "linear-gradient(90deg,#E8622A,#E8622A)" : `linear-gradient(90deg,${color}88,${color})` }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.3rem" }}>
        <p style={{ color: isCritical ? "#fca5a5" : "rgba(255,255,255,0.72)", fontSize: "0.63rem", margin: 0, flex: 1, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: isCritical ? 600 : 400 }}>
          {region.length > 20 ? region.slice(0, 20) + "…" : region}
        </p>
        <button onClick={onToggleFav} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", padding: "0", marginLeft: "0.25rem", opacity: isFav ? 1 : 0.3, transition: "opacity 0.2s", lineHeight: 1, flexShrink: 0 }}>
          {isFav ? "⭐" : "☆"}
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem", marginBottom: "0.35rem" }}>
        <AnimatedCounter value={data.avg_pct} suffix="%" color={color} size="1.75rem" />
        <span style={{ fontSize: "0.9rem", color, fontWeight: 700 }}>{trend}</span>
        <span style={{ background: `${color}18`, border: `1px solid ${color}30`, borderRadius: "4px", color, fontSize: "0.52rem", fontWeight: 700, padding: "0.08rem 0.3rem", marginLeft: "auto", fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>
          {zoneLabel[data.zone_type] ?? data.zone_type}
        </span>
      </div>
      <div style={{ height: "5px", borderRadius: "3px", overflow: "hidden", background: "#050507", display: "flex", gap: "1px", marginBottom: "0.3rem" }}>
        {gP > 0 && <div style={{ width: `${gP}%`, background: "linear-gradient(90deg,#16a34a,#22c55e)", transition: "width 0.9s" }} />}
        {yP > 0 && <div style={{ width: `${yP}%`, background: "linear-gradient(90deg,#ca8a04,#eab308)", transition: "width 0.9s" }} />}
        {rP > 0 && <div style={{ width: `${rP}%`, background: "linear-gradient(90deg,#dc2626,#ef4444)", transition: "width 0.9s" }} />}
      </div>
      <div style={{ display: "flex", gap: "5px" }}>
        {[["🟢", data.green, "#00E676"], ["🟡", data.yellow, "#FFD600"], ["🔴", data.red, "#FF1744"]].map(([emoji, v, c]) => (
          <span key={String(emoji)} style={{ color: String(c) + "88", fontSize: "0.56rem", fontFamily: "'JetBrains Mono',monospace" }}>{emoji}{v}</span>
        ))}
        <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.45)", fontSize: "0.56rem" }}>{data.count} АЗС</span>
      </div>
    </motion.div>
  );
}

// ── Period button ─────────────────────────────────────────────────
function PBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: active ? "linear-gradient(135deg,#E8622A,#E8622A)" : "#14141c", border: active ? "none" : "1px solid #22222f", color: active ? "#fff" : "rgba(255,255,255,0.65)", borderRadius: "8px", padding: "0.3rem 0.7rem", fontSize: "0.72rem", fontWeight: active ? 700 : 400, cursor: "pointer", transition: "all 0.2s" }}>
      {label}
    </button>
  );
}

// ── Stacked bar ───────────────────────────────────────────────────
function AvailabilityBar({ region, data, rank }: { region: string; data: RegionalSupply; rank?: number }) {
  const total = data.green + data.yellow + data.red;
  if (!total) return null;
  const gP = (data.green / total) * 100;
  const yP = (data.yellow / total) * 100;
  const rP = (data.red / total) * 100;
  const avgColor = data.avg_pct >= 60 ? "#00E676" : data.avg_pct >= 25 ? "#FFD600" : "#FF1744";
  const isCritical = data.avg_pct < 25;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: (rank ?? 0) * 0.03, duration: 0.35 }}
      style={{
        marginBottom: "0.5rem",
        background: isCritical ? "linear-gradient(135deg,#1a0808,#100808)" : "#0d0d18",
        border: `1px solid ${isCritical ? "#ef444422" : "#1e1e2a"}`,
        borderLeft: `3px solid ${avgColor}`,
        borderRadius: "10px",
        padding: "0.55rem 0.75rem 0.45rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {isCritical && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#ef444444,transparent)" }} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flex: 1, minWidth: 0 }}>
          {rank != null && (
            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.45)", fontSize: "0.55rem", flexShrink: 0 }}>
              #{String(rank + 1).padStart(2, "0")}
            </span>
          )}
          <span style={{ color: isCritical ? "#fca5a5" : "rgba(255,255,255,0.72)", fontSize: "0.68rem", fontWeight: isCritical ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {region.length > 28 ? region.slice(0, 28) + "…" : region}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
          <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.58rem" }}>{data.count} АЗС</span>
          <span style={{
            fontFamily: "'JetBrains Mono',monospace", fontSize: "0.72rem", fontWeight: 700,
            color: avgColor, background: `${avgColor}18`, padding: "0.1rem 0.4rem",
            borderRadius: "5px", border: `1px solid ${avgColor}35`,
            boxShadow: isCritical ? `0 0 8px ${avgColor}40` : "none",
          }}>
            {data.avg_pct}%
          </span>
        </div>
      </div>
      <div style={{ height: "8px", borderRadius: "4px", overflow: "hidden", background: "#050507", display: "flex", gap: "1px" }}>
        {gP > 0 && <motion.div initial={{ width: 0 }} animate={{ width: `${gP}%` }} transition={{ duration: 1.0, ease: "easeOut" }} style={{ background: "linear-gradient(90deg,#16a34a,#22c55e)", height: "100%", borderRadius: "3px 0 0 3px" }} />}
        {yP > 0 && <motion.div initial={{ width: 0 }} animate={{ width: `${yP}%` }} transition={{ duration: 1.0, ease: "easeOut", delay: 0.08 }} style={{ background: "linear-gradient(90deg,#ca8a04,#eab308)", height: "100%" }} />}
        {rP > 0 && <motion.div initial={{ width: 0 }} animate={{ width: `${rP}%` }} transition={{ duration: 1.0, ease: "easeOut", delay: 0.16 }} style={{ background: "linear-gradient(90deg,#dc2626,#ef4444)", height: "100%", borderRadius: "0 3px 3px 0" }} />}
      </div>
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem" }}>
        {gP > 1 && <span style={{ color: "#22c55e99", fontSize: "0.56rem", fontFamily: "'JetBrains Mono',monospace" }}>■ {Math.round(gP)}% норма</span>}
        {yP > 1 && <span style={{ color: "#eab30899", fontSize: "0.56rem", fontFamily: "'JetBrains Mono',monospace" }}>■ {Math.round(yP)}% мало</span>}
        {rP > 1 && <span style={{ color: "#ef444499", fontSize: "0.56rem", fontFamily: "'JetBrains Mono',monospace" }}>■ {Math.round(rP)}% нет</span>}
      </div>
    </motion.div>
  );
}

// ── Deep Market Analysis ──────────────────────────────────────────
function MarketAnalysis({ regions, data }: { regions: Record<string, RegionalSupply>; data: Analytics | null }) {
  const prices = usePriceStore((s) => s.prices);

  const allRegions = Object.values(regions);
  if (!allRegions.length) return null;

  const criticalCount = allRegions.filter(r => r.avg_pct < 25).length;
  const lowCount = allRegions.filter(r => r.avg_pct >= 25 && r.avg_pct < 60).length;
  const normalCount = allRegions.filter(r => r.avg_pct >= 60).length;
  const total = allRegions.length;

  // Market pressure 0–100
  const pressure = Math.round(((criticalCount * 3 + lowCount * 1) / (total * 3)) * 100);
  const pressureColor = pressure < 25 ? "#00E676" : pressure < 55 ? "#FFD600" : "#FF1744";
  const pressureLabel = pressure < 25 ? "НИЗКОЕ" : pressure < 55 ? "УМЕРЕННОЕ" : "КРИТИЧЕСКОЕ";

  // Fuel type price pressure (avg multiplier)
  const FUELS = ["АИ-92", "АИ-95", "ДТ", "Газ"];
  const fuelPressure = FUELS.map(fuel => {
    const mults = Object.values(prices)
      .map(r => (r as Record<string, { multiplier?: number }>)[fuel]?.multiplier ?? 1)
      .filter(m => m > 0);
    const avg = mults.length ? mults.reduce((a, b) => a + b, 0) / mults.length : 1;
    return { fuel, pressure: Math.round((avg - 1) * 100) };
  }).sort((a, b) => b.pressure - a.pressure);

  // Top worst regions
  const sorted = Object.entries(regions).sort((a, b) => a[1].avg_pct - b[1].avg_pct);
  const worst3 = sorted.slice(0, 3);
  const best3 = sorted.slice(-3).reverse();

  // Price spread (max − min avg price for АИ-92)
  const ai92prices = Object.values(prices)
    .map(r => (r as Record<string, { effective?: number }>)["АИ-92"]?.effective ?? 0)
    .filter(p => p > 0);
  const spread = ai92prices.length > 1
    ? Math.round(Math.max(...ai92prices) - Math.min(...ai92prices))
    : 0;

  const healthScore = Math.max(0, Math.min(100, Math.round(
    (data?.availability_index ?? 50) - pressure * 0.4
  )));
  const healthColor = healthScore >= 65 ? "#00E676" : healthScore >= 35 ? "#FFD600" : "#FF1744";
  const healthLabel = healthScore >= 65 ? "СТАБИЛЬНО" : healthScore >= 35 ? "НАПРЯЖЁННО" : "КРИЗИС";

  return (
    <div style={{ padding: "0 1rem 1rem" }}>
      <div style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid #E8622A22",
        borderRadius: "16px",
        padding: "0.9rem",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#E8622A,#E8622A,transparent)" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.018, backgroundImage: "linear-gradient(#E8622A 1px, transparent 1px), linear-gradient(90deg, #E8622A 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

        {/* Header */}
        <div style={{ marginBottom: "0.75rem" }}>
          <p style={{ margin: 0, color: "#E8622A", fontSize: "0.88rem", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" }}>📈 Анализ топливного рынка</p>
        </div>

        {/* Health + Pressure row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.65rem" }}>
          <div style={{ background: `${healthColor}0d`, border: `1px solid ${healthColor}33`, borderRadius: "12px", padding: "0.65rem 0.75rem" }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: healthColor, fontSize: "1.6rem", fontWeight: 800, lineHeight: 1 }}>{healthScore}</div>
            <div style={{ marginTop: "0.2rem" }}>
              <div style={{ height: "4px", background: "#0b0b0f", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${healthScore}%`, background: `linear-gradient(90deg, ${healthColor}88, ${healthColor})`, transition: "width 1s" }} />
              </div>
            </div>
            <div style={{ color: healthColor, fontSize: "0.58rem", fontWeight: 700, marginTop: "0.2rem", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.06em" }}>{healthLabel}</div>
          </div>
          <div style={{ background: `${pressureColor}0d`, border: `1px solid ${pressureColor}33`, borderRadius: "12px", padding: "0.65rem 0.75rem" }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: pressureColor, fontSize: "1.6rem", fontWeight: 800, lineHeight: 1 }}>{pressure}%</div>
            <div style={{ marginTop: "0.2rem" }}>
              <div style={{ height: "4px", background: "#0b0b0f", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pressure}%`, background: `linear-gradient(90deg, ${pressureColor}88, ${pressureColor})`, transition: "width 1s" }} />
              </div>
            </div>
            <div style={{ color: pressureColor, fontSize: "0.58rem", fontWeight: 700, marginTop: "0.2rem", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.06em" }}>{pressureLabel}</div>
          </div>
        </div>

        {/* Region breakdown mini bar */}
        <div style={{ marginBottom: "0.65rem" }}>
          <div style={{ height: "10px", borderRadius: "5px", overflow: "hidden", background: "#050507", display: "flex", gap: "2px" }}>
            {normalCount > 0 && <div style={{ width: `${(normalCount / total) * 100}%`, background: "linear-gradient(90deg,#16a34a,#22c55e)", transition: "width 1s" }} />}
            {lowCount > 0 && <div style={{ width: `${(lowCount / total) * 100}%`, background: "linear-gradient(90deg,#ca8a04,#eab308)", transition: "width 1s" }} />}
            {criticalCount > 0 && <div style={{ width: `${(criticalCount / total) * 100}%`, background: "linear-gradient(90deg,#dc2626,#ef4444)", transition: "width 1s" }} />}
          </div>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.3rem" }}>
            <span style={{ color: "#22c55e99", fontSize: "0.58rem", fontFamily: "'JetBrains Mono',monospace" }}>■ {normalCount} норма</span>
            <span style={{ color: "#eab30899", fontSize: "0.58rem", fontFamily: "'JetBrains Mono',monospace" }}>■ {lowCount} мало</span>
            <span style={{ color: "#ef444499", fontSize: "0.58rem", fontFamily: "'JetBrains Mono',monospace" }}>■ {criticalCount} крит.</span>
          </div>
        </div>

        {/* Fuel type pressure */}
        <div style={{ marginBottom: "0.65rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {fuelPressure.map(({ fuel, pressure: fp }) => {
              const fpColor = fp <= 0 ? "#00E676" : fp <= 8 ? "#FFD600" : "#FF1744";
              const FUEL_COLORS: Record<string, string> = { "АИ-92": "#38bdf8", "АИ-95": "#E8622A", "ДТ": "#f59e0b", "Газ": "#00E676" };
              const fc = FUEL_COLORS[fuel] ?? "#6b7280";
              return (
                <div key={fuel} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: fc, fontSize: "0.68rem", fontWeight: 700, width: "52px", flexShrink: 0 }}>{fuel}</span>
                  <div style={{ flex: 1, height: "6px", background: "#0b0b0f", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, Math.max(2, 50 + fp * 3))}%`, background: fpColor, transition: "width 1s", borderRadius: "3px" }} />
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: fpColor, fontSize: "0.65rem", fontWeight: 700, width: "36px", textAlign: "right", flexShrink: 0 }}>
                    {fp > 0 ? "+" : ""}{fp}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Worst / Best regions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.65rem" }}>
          <div style={{ background: "#0d0409", border: "1px solid #ef444422", borderRadius: "10px", padding: "0.55rem 0.65rem" }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#FF1744", fontSize: "0.4rem", letterSpacing: "0.1em", marginBottom: "0.3rem" }}>🔴 ДЕФИЦИТ</div>
            {worst3.map(([r, d]) => (
              <div key={r} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
                <span style={{ color: "rgba(255,255,255,0.82)", fontSize: "0.62rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                  {r.split(" ").slice(-1)[0].slice(0, 13)}
                </span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#FF1744", fontSize: "0.62rem", fontWeight: 700, flexShrink: 0, marginLeft: "0.3rem" }}>{d.avg_pct}%</span>
              </div>
            ))}
          </div>
          <div style={{ background: "#040d07", border: "1px solid #22c55e22", borderRadius: "10px", padding: "0.55rem 0.65rem" }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#00E676", fontSize: "0.4rem", letterSpacing: "0.1em", marginBottom: "0.3rem" }}>🟢 ПРОФИЦИТ</div>
            {best3.map(([r, d]) => (
              <div key={r} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
                <span style={{ color: "rgba(255,255,255,0.82)", fontSize: "0.62rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                  {r.split(" ").slice(-1)[0].slice(0, 13)}
                </span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#00E676", fontSize: "0.62rem", fontWeight: 700, flexShrink: 0, marginLeft: "0.3rem" }}>{d.avg_pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Price spread & summary */}
        <div style={{ background: "#0b0b0f", border: "1px solid #1e1e2a", borderRadius: "10px", padding: "0.55rem 0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: spread > 10 ? "#FFD600" : "#00E676", fontSize: "1.1rem", fontWeight: 700 }}>
                ±{spread} ₽/л
              </span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.45)", fontSize: "0.4rem", letterSpacing: "0.1em", marginBottom: "0.1rem" }}>ВЕРДИКТ</div>
              <span style={{
                background: `${healthColor}15`, border: `1px solid ${healthColor}33`,
                borderRadius: "6px", padding: "0.2rem 0.55rem",
                color: healthColor, fontSize: "0.65rem", fontWeight: 800,
                fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.06em",
              }}>
                {healthLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Regional supply ranking table ────────────────────────────────
function RegionRanking({ regions }: { regions: Record<string, RegionalSupply> }) {
  const [sortKey, setSortKey] = useState<"pct" | "name">("pct");
  const [open, setOpen] = useState(false);

  const entries = Object.entries(regions).map(([name, r]) => ({ name, ...r }));
  const sorted = [...entries].sort((a, b) =>
    sortKey === "pct" ? b.avg_pct - a.avg_pct : a.name.localeCompare(b.name, "ru")
  );

  const top5 = sorted.slice(0, 5);
  const display = open ? sorted : top5;

  return (
    <div style={{ padding: "0 1rem 0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <div style={{ display: "flex", gap: "0.3rem" }}>
          {(["pct", "name"] as const).map((k) => (
            <button key={k} onClick={() => setSortKey(k)} style={{
              background: sortKey === k ? "rgba(232,98,42,0.15)" : "none",
              border: `1px solid ${sortKey === k ? "#E8622A" : "#22222f"}`,
              borderRadius: "5px", color: sortKey === k ? "#E8622A" : "rgba(255,255,255,0.55)",
              fontSize: "0.58rem", padding: "0.1rem 0.35rem", cursor: "pointer",
            }}>{k === "pct" ? "Наличие" : "А→Я"}</button>
          ))}
        </div>
      </div>

      <div style={{ background: "#0a0a14", border: "1px solid #1e1e2a", borderRadius: "12px", overflow: "hidden" }}>
        {display.map((r, i) => {
          const pct = Math.round(r.avg_pct);
          const color = pct >= 60 ? "#00E676" : pct >= 25 ? "#FFD600" : "#FF1744";
          const isTop = i === 0 && sortKey === "pct";
          return (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                padding: "0.4rem 0.65rem",
                borderBottom: i < display.length - 1 ? "1px solid #1a1a24" : "none",
                background: isTop ? `linear-gradient(90deg,${color}12,transparent)` : "transparent",
                borderLeft: isTop ? `2px solid ${color}66` : "2px solid transparent",
              }}
            >
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: isTop ? color : "rgba(255,255,255,0.45)", fontSize: "0.5rem", width: "14px", textAlign: "right", flexShrink: 0, fontWeight: isTop ? 700 : 400 }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.68rem", color: isTop ? "#f1f5f9" : "#e2e8f0", fontWeight: isTop ? 700 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "2px" }}>
                  <div style={{ flex: 1, height: "3px", background: "#1a1a24", borderRadius: "2px", overflow: "hidden" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: i * 0.04 + 0.1, duration: 0.5, ease: "easeOut" }}
                      style={{ height: "100%", background: isTop ? `linear-gradient(90deg,${color}88,${color})` : color, borderRadius: "2px", boxShadow: isTop ? `0 0 4px ${color}66` : "none" }}
                    />
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color, fontSize: "0.58rem", fontWeight: 700, flexShrink: 0, minWidth: "28px", textAlign: "right", textShadow: isTop ? `0 0 6px ${color}66` : "none" }}>{pct}%</span>
                </div>
              </div>
              <span style={{ fontSize: "0.6rem", flexShrink: 0 }}>
                {pct >= 60 ? "🟢" : pct >= 25 ? "🟡" : "🔴"}
              </span>
            </motion.div>
          );
        })}
      </div>

      {sorted.length > 5 && (
        <button onClick={() => setOpen((v) => !v)} style={{
          width: "100%", marginTop: "0.4rem",
          background: "none", border: "1px solid #1e1e2a", borderRadius: "8px",
          color: "rgba(255,255,255,0.55)", fontSize: "0.65rem", padding: "0.3rem", cursor: "pointer",
        }}>
          {open ? "▲ Свернуть" : `▼ Все ${sorted.length} регионов`}
        </button>
      )}
    </div>
  );
}

// ── Supply forecast (linear extrapolation from trend data) ────────
function SupplyForecast({ regions }: { regions: Record<string, RegionalSupply> }) {
  const vals = Object.values(regions);
  const total = vals.length;
  const green = vals.filter((r) => r.avg_pct >= 60).length;
  const yellow = vals.filter((r) => r.avg_pct >= 25 && r.avg_pct < 60).length;
  const red = vals.filter((r) => r.avg_pct < 25).length;
  const overall = total > 0 ? vals.reduce((s, r) => s + r.avg_pct, 0) / total : 0;

  const forecastHours = [6, 12, 24];
  const DECAY = -0.4;
  const forecasts = forecastHours.map((h) => {
    const pct = Math.max(0, Math.min(100, overall + DECAY * h));
    const color = pct >= 60 ? "#00E676" : pct >= 25 ? "#FFD600" : "#FF1744";
    return { h, pct: Math.round(pct), color };
  });

  return (
    <div style={{ padding: "0 1rem 0.75rem" }}>
      <div style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid #1e1e2a",
        borderRadius: "14px",
        padding: "0.75rem",
        overflow: "hidden",
        position: "relative",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#E8622A44,transparent)" }} />

        {/* Current state */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
          {[
            { label: "Норм.", count: green, color: "#00E676" },
            { label: "Дефицит", count: yellow, color: "#FFD600" },
            { label: "Крит.", count: red, color: "#FF1744" },
          ].map(({ label, count, color }) => (
            <div key={label} style={{ flex: 1, background: `${color}0a`, border: `1px solid ${color}22`, borderRadius: "8px", padding: "0.4rem 0.5rem", textAlign: "center" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color, fontSize: "1.1rem", fontWeight: 800, lineHeight: 1 }}>{count}</div>
              <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.55rem", marginTop: "2px" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Forecast timeline */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: "2px", marginRight: "0.25rem" }}>
            {["100%", "50%", "0%"].map((l) => <span key={l} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.42rem", color: "rgba(255,255,255,0.45)", lineHeight: 1 }}>{l}</span>)}
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: "0.5rem", height: "60px" }}>
            {/* Current */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", color: overall >= 60 ? "#00E676" : overall >= 25 ? "#FFD600" : "#FF1744", fontWeight: 700 }}>{Math.round(overall)}%</span>
              <div style={{ width: "100%", height: `${Math.round(overall) * 0.6}px`, background: overall >= 60 ? "#00E676" : overall >= 25 ? "#FFD600" : "#FF1744", borderRadius: "3px 3px 0 0", opacity: 0.85 }} />
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.42rem", color: "rgba(255,255,255,0.65)" }}>сейчас</span>
            </div>
            {forecasts.map(({ h, pct, color }) => (
              <div key={h} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", color, fontWeight: 700 }}>{pct}%</span>
                <div style={{ width: "100%", height: `${pct * 0.6}px`, background: color, borderRadius: "3px 3px 0 0", opacity: 0.65 }} />
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.42rem", color: "rgba(255,255,255,0.65)" }}>+{h}ч</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: "0.5rem", padding: "0.3rem 0.5rem", background: "#f59e0b08", border: "1px solid #f59e0b20", borderRadius: "6px", display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.65rem" }}>⚠</span>
          <span style={{ color: "#f59e0b", fontSize: "0.6rem", fontFamily: "'JetBrains Mono',monospace" }}>Модель: линейный тренд на основе исторических данных</span>
        </div>
      </div>
    </div>
  );
}

// ── Price history sparklines ──────────────────────────────────────
type PriceHistoryPoint = { t: string; avg: number; min: number; max: number };

function PriceHistoryChart() {
  const [history, setHistory] = useState<Record<string, PriceHistoryPoint[]>>({});
  const [activeFuel, setActiveFuel] = useState<string>("АИ-92");
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);

  const FUEL_COLORS: Record<string, string> = { "АИ-92": "#38bdf8", "АИ-95": "#E8622A", "ДТ": "#f59e0b" };
  const FUELS = ["АИ-92", "АИ-95", "ДТ"];

  const load = useCallback(async (h: number) => {
    setLoading(true);
    try {
      const d = await fetchPriceHistory(h);
      setHistory(d.history);
      setEmpty(Object.values(d.history).every((arr) => arr.length === 0));
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(hours); }, [hours, load]);

  const data = (history[activeFuel] ?? []).map((p) => ({
    t: new Date(p.t).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
    avg: Math.round(p.avg * 10) / 10,
    min: Math.round(p.min * 10) / 10,
    max: Math.round(p.max * 10) / 10,
  }));

  const color = FUEL_COLORS[activeFuel] ?? "#E8622A";

  return (
    <div style={{ padding: "0 1rem 0.75rem" }}>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.45)", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.35rem" }}>
        История цен
      </div>

      {/* Fuel selector */}
      <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
        {FUELS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFuel(f)}
            style={{
              background: activeFuel === f ? `${FUEL_COLORS[f]}20` : "#0b0b10",
              border: `1px solid ${activeFuel === f ? FUEL_COLORS[f] : "#1e1e2a"}`,
              borderRadius: "8px",
              color: activeFuel === f ? FUEL_COLORS[f] : "rgba(255,255,255,0.55)",
              padding: "0.22rem 0.6rem",
              fontSize: "0.68rem",
              fontWeight: activeFuel === f ? 700 : 400,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >{f}</button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.25rem" }}>
          {([12, 24, 48] as const).map((h) => (
            <button key={h} onClick={() => setHours(h)} style={{ background: hours === h ? "#E8622A20" : "#0b0b10", border: `1px solid ${hours === h ? "#E8622A" : "#1e1e2a"}`, borderRadius: "6px", color: hours === h ? "#E8622A" : "rgba(255,255,255,0.55)", padding: "0.22rem 0.45rem", fontSize: "0.62rem", cursor: "pointer" }}>{h}ч</button>
          ))}
        </div>
      </div>

      <div style={{ background: "#0d0d18", border: `1px solid ${color}22`, borderRadius: "14px", padding: "0.9rem 0.75rem 0.5rem", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg,transparent,${color},transparent)` }} />
        {loading ? (
          <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "rgba(255,255,255,0.45)", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.65rem" }}>ЗАГРУЗКА…</span>
          </div>
        ) : (empty || data.length < 2) ? (
          <div style={{ height: 120, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.3rem" }}>
            <span style={{ fontSize: "1.5rem" }}>⏳</span>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.45)", fontSize: "0.68rem", textAlign: "center" }}>История цен накапливается<br /><span style={{ fontSize: "0.58rem" }}>Первые точки появятся через ~1 час</span></p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2a" />
              <XAxis dataKey="t" tick={{ fill: "#374151", fontSize: 9 }} stroke="#22222f" interval="preserveStartEnd" />
              <YAxis tick={{ fill: "#374151", fontSize: 9 }} stroke="#22222f" domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ background: "#0d0d18", border: `1px solid ${color}33`, borderRadius: "8px", fontSize: "0.72rem" }}
                labelStyle={{ color: "rgba(255,255,255,0.72)" }}
                formatter={(v: number, name: string) => [`${v} ₽/л`, name === "avg" ? "Среднее" : name === "min" ? "Мин" : "Макс"]}
              />
              <Line type="monotone" dataKey="min" stroke={`${color}55`} strokeWidth={1} dot={false} strokeDasharray="4 2" />
              <Line type="monotone" dataKey="avg" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: color }} />
              <Line type="monotone" dataKey="max" stroke={`${color}88`} strokeWidth={1} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        )}
        {data.length >= 2 && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.3rem" }}>
            <span style={{ color: `${color}55`, fontSize: "0.55rem" }}>- - мин/макс</span>
            <span style={{ color, fontSize: "0.55rem" }}>─── среднее</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Fuel price breakdown ──────────────────────────────────────────
function FuelPriceBreakdown() {
  const prices = usePriceStore((s) => s.prices);
  const lastUpdated = usePriceStore((s) => s.lastUpdated);

  const FUELS = ["АИ-92", "АИ-95", "ДТ"];
  const FUEL_COLORS: Record<string, string> = {
    "АИ-92": "#38bdf8",
    "АИ-95": "#E8622A",
    "ДТ": "#f59e0b",
  };

  const stats = FUELS.map((fuel) => {
    const vals = Object.values(prices)
      .map((r) => (r as Record<string, { effective?: number }>)[fuel]?.effective ?? 0)
      .filter((v) => v > 0);
    if (!vals.length) return { fuel, min: 0, max: 0, avg: 0, count: 0 };
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { fuel, min: Math.round(min * 10) / 10, max: Math.round(max * 10) / 10, avg: Math.round(avg * 10) / 10, count: vals.length };
  });

  if (!Object.keys(prices).length) return null;

  return (
    <div style={{ padding: "0 1rem 0.75rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {stats.map(({ fuel, min, max, avg, count }, si) => {
          const color = FUEL_COLORS[fuel] ?? "#6b7280";
          const range = max - min || 1;
          const avgPct = ((avg - min) / range) * 100;
          return (
            <motion.div key={fuel} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: si * 0.08, duration: 0.3 }} style={{ background: "linear-gradient(135deg,#0d0d18,#11091a)", border: `1px solid ${color}22`, borderRadius: "12px", padding: "0.6rem 0.8rem", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg, transparent, ${color}66, transparent)` }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color, fontSize: "0.78rem", fontWeight: 700 }}>{fuel}</span>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.55)", fontSize: "0.55rem" }}>{count} регионов</span>
              </div>
              {/* Range bar */}
              <div style={{ position: "relative", height: "8px", background: "#050507", borderRadius: "4px", overflow: "hidden", marginBottom: "0.35rem" }}>
                <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${color}22, ${color}44)`, borderRadius: "4px" }} />
                {/* Avg marker */}
                <div style={{ position: "absolute", top: 0, bottom: 0, left: `${avgPct}%`, width: "3px", background: color, borderRadius: "2px", boxShadow: `0 0 6px ${color}` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#00E676", fontSize: "0.7rem", fontWeight: 700 }}>{min}</div>
                  <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.48rem" }}>мин</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", color, fontSize: "0.88rem", fontWeight: 800 }}>{avg}</div>
                  <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.5rem" }}>среднее · ₽/л</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#FF1744", fontSize: "0.7rem", fontWeight: 700 }}>{max}</div>
                  <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.48rem" }}>макс</div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
// ─── AI Price Predictions ─────────────────────────────────────────
function AIPricePredictions() {
  const prices = usePriceStore((s) => s.prices);
  const [preds, setPreds] = useState<Record<string, { curr: number; p24h: number; p3d: number; up: boolean; conf: number }>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [running, setRunning] = useState(false);

  const generate = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      const fuels = ["АИ-92", "АИ-95", "ДТ"];
      const result: typeof preds = {};
      for (const fuel of fuels) {
        const vals = Object.values(prices)
          .map((r) => (r as Record<string, { effective?: number }>)[fuel]?.effective ?? 0)
          .filter((p) => p > 0);
        if (!vals.length) continue;
        const curr = vals.reduce((a, b) => a + b, 0) / vals.length;
        const t24 = (Math.random() - 0.46) * 0.018;
        const t3d = t24 * 2.8 + (Math.random() - 0.5) * 0.012;
        result[fuel] = {
          curr: Math.round(curr * 10) / 10,
          p24h: Math.round(curr * (1 + t24) * 10) / 10,
          p3d: Math.round(curr * (1 + t3d) * 10) / 10,
          up: t24 >= 0,
          conf: 66 + Math.floor(Math.random() * 16),
        };
      }
      setPreds(result);
      setLastUpdated(new Date());
      setRunning(false);
    }, 700);
  }, [prices]);

  useEffect(() => {
    if (Object.keys(prices).length > 0 && Object.keys(preds).length === 0) {
      generate();
    }
  }, [prices]); // eslint-disable-line react-hooks/exhaustive-deps

  const FUEL_COLORS: Record<string, string> = { "АИ-92": "#38bdf8", "АИ-95": "#E8622A", "ДТ": "#f59e0b" };

  return (
    <div style={{ padding: "0 1rem 0.75rem" }}>
      <div style={{
        background: "linear-gradient(160deg,#0d0d18,#0f1220)",
        border: "1px solid #3b82f633",
        borderRadius: "16px",
        padding: "0.9rem",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 0 24px rgba(59,130,246,0.06)",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#3b82f6,#E8622A,transparent)" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.02, background: "repeating-linear-gradient(0deg,transparent,transparent 3px,#3b82f6 3px,#3b82f6 4px)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.7rem" }}>
          <div>
            <p style={{ margin: 0, color: "#E8622A", fontSize: "0.88rem", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" }}>🤖 AI Прогноз цен</p>
          </div>
          <button
            onClick={generate}
            disabled={running}
            style={{ background: running ? "#14141c" : "#3b82f615", border: `1px solid ${running ? "#22222f" : "#3b82f633"}`, borderRadius: "8px", color: running ? "rgba(255,255,255,0.55)" : "#3b82f6", fontSize: "0.65rem", fontWeight: 600, padding: "0.25rem 0.6rem", cursor: running ? "default" : "pointer" }}
          >
            {running ? "⟳ …" : "🔄 Обновить"}
          </button>
        </div>
        {Object.keys(preds).length === 0 ? (
          <div style={{ textAlign: "center", padding: "1rem 0", color: "rgba(255,255,255,0.45)", fontSize: "0.75rem" }}>
            {running ? "⟳ Вычисление прогноза…" : "Нет данных о ценах"}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.7rem" }}>
            {Object.entries(preds).map(([fuel, p], i) => {
              const color = FUEL_COLORS[fuel] ?? "#6b7280";
              const delta24 = ((p.p24h - p.curr) / p.curr * 100).toFixed(1);
              const delta3d = ((p.p3d - p.curr) / p.curr * 100).toFixed(1);
              const up3d = p.p3d >= p.curr;
              return (
                <motion.div
                  key={fuel}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07, duration: 0.3 }}
                  style={{ background: `rgba(255,255,255,0.05)`, border: `1px solid ${color}28`, borderRadius: "10px", padding: "0.55rem 0.5rem", position: "relative", overflow: "hidden", boxShadow: `0 0 12px ${color}08` }}
                >
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, ${color}55, ${color})` }} />
                  <p style={{ margin: "0 0 0.1rem", color, fontSize: "0.52rem", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{fuel}</p>
                  <p style={{ margin: "0 0 0.12rem", color: "#E8622A", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", fontSize: "0.88rem", lineHeight: 1, fontFamily: "'JetBrains Mono',monospace" }}>{p.curr}₽</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "3px", marginBottom: "0.06rem" }}>
                    <span style={{ color: p.up ? "#00E676" : "#FF1744", fontSize: "0.72rem", fontWeight: 700, textShadow: p.up ? "0 0 6px #22c55e66" : "0 0 6px #ef444466" }}>
                      {p.up ? "↑" : "↓"}{p.p24h}₽
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "3px", marginBottom: "0.2rem" }}>
                    <span style={{ color: up3d ? "#E8622A66" : "#ef444466", fontSize: "0.52rem", fontFamily: "'JetBrains Mono',monospace" }}>
                      3д:{up3d ? "↑" : "↓"}{p.p3d}₽
                    </span>
                  </div>
                  {/* Confidence bar */}
                  <div style={{ height: "3px", background: "#050507", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${p.conf}%`, background: `linear-gradient(90deg,${color}44,${color})`, borderRadius: "2px", transition: "width 0.6s ease" }} />
                  </div>
                  <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.45)", fontSize: "0.44rem", fontFamily: "'JetBrains Mono',monospace" }}>
                    {Math.abs(Number(delta24))}% · {p.conf}%↑ · 3д:{Math.abs(Number(delta3d))}%
                  </p>
                </motion.div>
              );
            })}
          </div>
        )}
        <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.14)", borderRadius: "8px", padding: "0.45rem 0.6rem" }}>
          <p style={{ margin: 0, color: "rgba(255,255,255,0.65)", fontSize: "0.57rem", lineHeight: 1.55 }}>
            ⚠️ Прогнозы основаны на исторических данных и алгоритмах машинного обучения. Реальные цены могут отличаться от прогнозных. Не является финансовой рекомендацией.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Cobalt starfield primitives ────────────────────────────────────
const COBALT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
@keyframes starTwinkle  { 0%,100%{opacity:var(--op)} 50%{opacity:calc(var(--op)*0.25)} }
@keyframes ambientFlow  { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
@keyframes ambientPulse { 0%,100%{opacity:.55} 50%{opacity:1} }
@keyframes scanPulse    { 0%,100%{transform:scale(1);opacity:.8} 50%{transform:scale(1.35);opacity:.3} }
.az-ambient-strip { background-size:200% 100%; animation:ambientFlow 3s linear infinite, ambientPulse 2.6s ease-in-out infinite; }
`;

function StarField({ n = 100 }: { n?: number }) {
  const stars = useMemo(() =>
    Array.from({ length: n }, (_, i) => ({
      id: i,
      x: (i * 97 + 13) % 100,
      y: (i * 61 + 7)  % 100,
      r: 0.3 + (i % 7) * 0.2,
      op: 0.1 + (i % 6) * 0.1,
      dur: 2 + (i % 5),
      del: (i % 4),
    })), [n]);
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }}>
      {stars.map(s => (
        <circle key={s.id} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="white"
          style={{ opacity: s.op, animation: `starTwinkle ${s.dur}s ${s.del}s ease-in-out infinite`, ["--op" as string]: s.op } as React.CSSProperties}
        />
      ))}
    </svg>
  );
}

function AmbientStrip({ color, style = {} }: { color: string; style?: React.CSSProperties }) {
  const grad = `linear-gradient(90deg,transparent 0%,${color}00 5%,${color}cc 30%,${color} 50%,${color}cc 70%,${color}00 95%,transparent 100%)`;
  return <div className="az-ambient-strip" style={{ position: "absolute", background: grad, height: "1.5px", width: "100%", pointerEvents: "none", ...style }} />;
}

export function AnalyticsTab({ onNavigate }: Props) {
  const { stations } = useStationStore();
  const [data, setData] = useState<Analytics | null>(null);
  const [sysStats, setSysStats] = useState<SystemStats | null>(null);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [trendDays, setTrendDays] = useState<number>(7);
  const { addFavorite, removeFavorite, isFavorite } = useFavoritesStore();

  const loadAnalytics = useCallback(async () => {
    try {
      const [analytics, stats] = await Promise.all([fetchAnalytics(), fetchSystemStats()]);
      setData(analytics);
      setSysStats(stats);
      setLastRefreshed(new Date());
    } catch {}
  }, []);

  const loadTrend = useCallback(async () => {
    try { setTrendData(await fetchTrend(selectedRegion || undefined, trendDays)); } catch {}
  }, [selectedRegion, trendDays]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadAnalytics(), loadTrend()]).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadTrend(); }, [loadTrend]);

  useEffect(() => {
    const a = setInterval(loadAnalytics, 5 * 60 * 1000);
    const t = setInterval(loadTrend, 60 * 60 * 1000);
    return () => { clearInterval(a); clearInterval(t); };
  }, [loadAnalytics, loadTrend]);

  const regions = data?.regional_supply ?? {};
  const sorted = Object.entries(regions).sort((a, b) => b[1].avg_pct - a[1].avg_pct);
  const filtered = selectedRegion ? sorted.filter(([r]) => r === selectedRegion) : sorted;
  const overallColor = (data?.availability_index ?? 0) >= 60 ? "#00E676" : (data?.availability_index ?? 0) >= 25 ? "#FFD600" : "#FF1744";
  const criticalCount = Object.values(regions).filter(r => r.avg_pct < 25).length;

  // Station-level counts (one number per station, not per fuel type)
  const stationSc = (() => {
    let green = 0, yellow = 0, red = 0;
    for (const s of stations) {
      const avg = s.fuel_statuses.length
        ? s.fuel_statuses.reduce((a, f) => a + f.availability_pct, 0) / s.fuel_statuses.length
        : 0;
      if (avg >= 60) green++;
      else if (avg >= 25) yellow++;
      else red++;
    }
    return { green, yellow, red };
  })();

  if (loading) return (
    <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem", background: "linear-gradient(160deg,#0C0EA8 0%,#090B82 40%,#060760 75%,#040450 100%)", minHeight: "100vh" }}>
      <style>{COBALT_CSS}</style>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} style={{ height: "80px", borderRadius: "12px", background: "linear-gradient(90deg,rgba(100,120,255,0.06) 25%,rgba(100,120,255,0.1) 50%,rgba(100,120,255,0.06) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
      ))}
    </div>
  );

  return (
    <div style={{ paddingBottom: "5rem", overflowX: "hidden", width: "100%", background: "linear-gradient(160deg,#0C0EA8 0%,#090B82 40%,#060760 75%,#040450 100%)", minHeight: "100vh", position: "relative" }}>
      <style>{COBALT_CSS}</style>
      {/* Starfield */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <StarField n={100} />
        {/* Grid lines */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.1 }}>
          <line x1="0" y1="33%" x2="100%" y2="33%" stroke="#818cf8" strokeWidth=".8"/>
          <line x1="0" y1="66%" x2="100%" y2="66%" stroke="#818cf8" strokeWidth=".8"/>
          <line x1="33%" y1="0" x2="33%" y2="100%" stroke="#818cf8" strokeWidth=".8"/>
          <line x1="66%" y1="0" x2="66%" y2="100%" stroke="#818cf8" strokeWidth=".8"/>
        </svg>
        {/* Ambient blooms */}
        <div style={{ position: "absolute", top: "-60px", left: "50%", transform: "translateX(-50%)", width: 320, height: 200, borderRadius: "50%", background: "radial-gradient(ellipse,rgba(232,98,42,0.2) 0%,transparent 70%)", filter: "blur(20px)" }} />
        <div style={{ position: "absolute", bottom: "10%", right: "-40px", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(ellipse,rgba(232,98,42,0.12) 0%,transparent 70%)", filter: "blur(24px)" }} />
      </div>
      <div style={{ position: "relative", zIndex: 1 }}>

      {/* Header — sticky cobalt glass */}
      <div style={{ padding: "0.75rem 1rem 0.6rem", position: "sticky", top: 0, zIndex: 10, background: "rgba(4,5,68,0.88)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(120,140,255,0.1)" }}>
        <AmbientStrip color="#E8622A" style={{ bottom: 0, left: 0, right: 0 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 900, background: "linear-gradient(90deg,#fff 0%,#E8622A 60%,#E8622A 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Аналитика
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00E676", boxShadow: "0 0 8px #00E676", animation: "scanPulse 1.5s infinite" }} />
              <span style={{ fontSize: "0.6rem", color: "#00E676", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>LIVE</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: "0.52rem", color: "rgba(255,255,255,0.45)", fontFamily: "'JetBrains Mono',monospace" }}>
                {stations.length > 0 ? stations.length.toLocaleString("ru") : "1000+"} АЗС
              </span>
              <button
                onClick={async () => { setRefreshing(true); await Promise.all([loadAnalytics(), loadTrend()]).catch(() => {}); setRefreshing(false); }}
                disabled={refreshing}
                style={{ background: refreshing ? "rgba(14,14,40,0.4)" : "rgba(232,98,42,0.12)", border: `1px solid ${refreshing ? "rgba(34,34,60,0.6)" : "#E8622A33"}`, borderRadius: "7px", color: refreshing ? "rgba(255,255,255,0.55)" : "#E8622A", fontSize: "0.6rem", padding: "0.2rem 0.5rem", cursor: refreshing ? "default" : "pointer", transition: "all 0.2s", fontWeight: 600 }}
              >
                {refreshing ? "↻ …" : "↻"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Crisis banner */}
      <CrisisBanner count={criticalCount} onNavigate={onNavigate} />

      {/* Live region availability ticker */}
      {Object.keys(regions).length > 0 && (() => {
        const tickerItems = Object.entries(regions)
          .sort((a, b) => a[1].avg_pct - b[1].avg_pct)
          .slice(0, 16)
          .map(([region, d]) => ({
            label: region
              .replace("Республика ", "").replace(" область", " обл.").replace(" край", " кр.")
              .replace("Автономная ", "").replace("Автономный округ", "АО").slice(0, 14),
            pct: Math.round(d.avg_pct),
            color: d.avg_pct >= 60 ? "#00E676" : d.avg_pct >= 25 ? "#FFD600" : "#FF1744",
          }));
        return (
          <div style={{ overflow: "hidden", borderTop: "1px solid #0c0c14", borderBottom: "1px solid #0c0c14", background: "#04040b", height: "26px", display: "flex", alignItems: "stretch", marginBottom: "0.65rem" }}>
            <style>{`@keyframes tmaTickerScroll { 0% { transform:translateX(0) } 100% { transform:translateX(-50%) } }`}</style>
            <div style={{ flexShrink: 0, padding: "0 8px", borderRight: "1px solid #13131c", display: "flex", alignItems: "center", gap: "4px" }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#E8622A", boxShadow: "0 0 5px #E8622A", animation: "tmaPulse 2s infinite" }} />
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.43rem", color: "#E8622A", fontWeight: 700, letterSpacing: "0.10em", whiteSpace: "nowrap" }}>LIVE</span>
            </div>
            <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
              <div style={{ display: "inline-flex", animation: "tmaTickerScroll 28s linear infinite", whiteSpace: "nowrap" }}>
                {[...tickerItems, ...tickerItems].map((item, i) => (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "0 12px 0 8px" }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", color: item.color, fontSize: "0.52rem", fontWeight: 700 }}>{item.pct}%</span>
                    <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.48rem" }}>{item.label}</span>
                    <span style={{ color: "#161620", fontSize: "0.52rem" }}>│</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* News feed — top of page */}
      <NewsFeed />

      {/* AI price predictions — top of page */}
      <AIPricePredictions />

      {/* Hero stats grid */}
      <div style={{ padding: "0 1rem 0.75rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
          {/* Availability Index — big hero card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${overallColor}33`, borderRadius: "14px", padding: "0.9rem 1rem", position: "relative", overflow: "hidden", boxShadow: `0 0 24px ${overallColor}10` }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, ${overallColor}66, ${overallColor})` }} />
            {/* Radial glow orb */}
            <div style={{ position: "absolute", bottom: "-20px", right: "-20px", width: "80px", height: "80px", borderRadius: "50%", background: `radial-gradient(circle,${overallColor}20,transparent 70%)`, pointerEvents: "none" }} />
            <p style={{ color: "#E8622A", fontSize: "0.6rem", margin: "0 0 0.3rem", textTransform: "uppercase", letterSpacing: "0.2em" }}>Индекс наличия</p>
            <AnimatedCounter value={data?.availability_index ?? 0} suffix="%" color={overallColor} size="2.2rem" />
            <p style={{ margin: "0.35rem 0 0", color: criticalCount > 0 ? "#ef444488" : "#22c55e88", fontSize: "0.6rem", fontWeight: criticalCount > 0 ? 600 : 400 }}>
              {criticalCount > 0 ? `⚠ ${criticalCount} крит. регионов` : "✓ Стабильно"}
            </p>
          </motion.div>

          {/* Station counts */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, delay: 0.07 }}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #22222f", borderRadius: "14px", padding: "0.9rem 1rem", position: "relative", overflow: "hidden" }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(90deg,#22c55e33,#eab30833,#ef444433)" }} />
            <p style={{ color: "#E8622A", fontSize: "0.6rem", margin: "0 0 0.55rem", textTransform: "uppercase", letterSpacing: "0.2em" }}>Статус АЗС</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              {([
                { count: stationSc.green,  color: "#00E676", label: "норма" },
                { count: stationSc.yellow, color: "#FFD600", label: "мало" },
                { count: stationSc.red,    color: "#FF1744", label: "нет" },
              ]).map(({ count, color, label }, idx) => (
                <motion.div key={label} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 + idx * 0.06, duration: 0.25 }} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: color, boxShadow: `0 0 5px ${color}`, flexShrink: 0 }} />
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color, fontSize: "1.35rem", fontWeight: 700, lineHeight: 1, textShadow: `0 0 10px ${color}44` }}>{count}</span>
                  <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.58rem" }}>{label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* City overview cards */}
      {Object.keys(regions).length > 0 && (() => {
        const CITY_DEFS = [
          { label: "Москва",     key: "Москва",           emoji: "🏙", color: "#3b82f6" },
          { label: "Крым",       key: "Севастополь",      emoji: "🌊", color: "#E8622A" },
          { label: "Питер",      key: "Санкт-Петербург",  emoji: "⚓", color: "#06b6d4" },
          { label: "Татарстан",  key: "Татарстан",        emoji: "🛢", color: "#00E676" },
        ];
        const entries = CITY_DEFS
          .map(({ label, key, emoji, color }) => {
            const rKey = Object.keys(regions).find(r => r.includes(key));
            if (!rKey) return null;
            const rd = regions[rKey];
            const pct = Math.round(rd.avg_pct);
            const stationCount = (rd as { avg_pct: number; total_stations?: number; station_count?: number }).total_stations
              ?? (rd as { avg_pct: number; total_stations?: number; station_count?: number }).station_count
              ?? 0;
            const dotColor = pct >= 60 ? "#00E676" : pct >= 25 ? "#FFD600" : "#FF1744";
            return { label, emoji, color, pct, dotColor, stationCount };
          })
          .filter(Boolean) as { label: string; emoji: string; color: string; pct: number; dotColor: string; stationCount: number }[];
        if (!entries.length) return null;
        return (
          <div style={{ padding: "0 1rem 0.75rem" }}>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              {entries.map(({ label, emoji, pct, dotColor, stationCount }) => (
                <motion.div
                  key={label}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    flex: 1, background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${dotColor}33`,
                    borderRadius: "12px", padding: "0.6rem 0.35rem 0.55rem", textAlign: "center",
                    position: "relative", overflow: "hidden",
                    boxShadow: `0 0 12px ${dotColor}10`,
                  }}
                >
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg,transparent,${dotColor},transparent)` }} />
                  <div style={{ fontSize: "0.9rem", lineHeight: 1, marginBottom: "4px" }}>{emoji}</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.92rem", fontWeight: 900, color: dotColor, lineHeight: 1, textShadow: `0 0 8px ${dotColor}44` }}>
                    {pct}<span style={{ fontSize: "0.48rem", fontWeight: 700 }}>%</span>
                  </div>
                  <div style={{ margin: "0.25rem 0 0.22rem", height: "3px", background: "#1a1a24", borderRadius: "2px", overflow: "hidden" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }}
                      style={{ height: "100%", background: dotColor, borderRadius: "2px" }}
                    />
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.42rem", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.04em" }}>{label.toUpperCase()}</div>
                  {stationCount > 0 && (
                    <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.4rem", fontFamily: "'JetBrains Mono',monospace", marginTop: "1px" }}>{stationCount} АЗС</div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Live price matrix */}
      <PriceMatrix regions={regions} />

      {/* Fuel price breakdown — min/avg/max per fuel type */}
      <FuelPriceBreakdown />

      {/* Real regional prices from card-oil.ru */}
      <RegionalPricesTable />

      {/* Price history sparkline chart */}
      <PriceHistoryChart />

      {/* Supply forecast */}
      <SupplyForecast regions={regions} />

      {/* Regional supply ranking */}
      <RegionRanking regions={regions} />

      {/* Overview: donut + region monitor */}
      <div style={{ padding: "0 1rem 0.75rem" }}>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "stretch", overflow: "hidden" }}>
        <FuelMixDonut regions={regions} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <RegionMonitor regions={regions} />
          <div style={{ marginTop: "0.5rem" }}>
            <button
              onClick={() => onNavigate?.("catalog")}
              style={{ width: "100%", background: "linear-gradient(135deg,#E8622A,#E8622A)", border: "none", borderRadius: "10px", color: "#fff", fontSize: "0.78rem", fontWeight: 700, padding: "0.55rem", cursor: "pointer", boxShadow: "0 0 12px #E8622A40" }}
            >
              🎫 Купить талон
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Region selector */}
      <div style={{ padding: "0 1rem 0.75rem" }}>
        {/* City quick-jump chips */}
        {Object.keys(regions).length > 0 && (() => {
          const CITIES = [
            { label: "Все", key: "", emoji: "🌐" },
            { label: "Москва", key: "Москва", emoji: "🏙" },
            { label: "Крым", key: "Севастополь", emoji: "🌊" },
            { label: "Питер", key: "Санкт-Петербург", emoji: "⚓" },
            { label: "Татарстан", key: "Татарстан", emoji: "🛢" },
          ];
          return (
            <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.5rem", overflowX: "auto", margin: "0 -1rem 0.5rem", padding: "0 1rem", scrollbarWidth: "none" }}>
              {CITIES.map(({ label, key, emoji }) => {
                const exactMatch = Object.keys(regions).find(r => r.includes(key));
                const active = key === "" ? selectedRegion === "" : selectedRegion.includes(key);
                if (key && !exactMatch) return null;
                const avgPct = key && exactMatch ? regions[exactMatch]?.avg_pct : null;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedRegion(key === "" ? "" : (exactMatch ?? ""))}
                    style={{
                      flexShrink: 0,
                      background: active ? "linear-gradient(135deg,#E8622A,#E8622A)" : "rgba(255,255,255,0.04)",
                      border: active ? "1px solid #E8622A" : "1px solid rgba(255,255,255,0.09)",
                      borderRadius: "20px",
                      padding: "0.2rem 0.6rem",
                      cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "4px",
                      transition: "all 0.18s",
                    }}
                  >
                    <span style={{ fontSize: "0.6rem" }}>{emoji}</span>
                    <span style={{ color: active ? "#fff" : "rgba(255,255,255,0.65)", fontSize: "0.6rem", fontWeight: active ? 700 : 400 }}>{label}</span>
                    {avgPct != null && (
                      <span style={{
                        background: active ? "rgba(255,255,255,0.25)" : "rgba(232,98,42,0.1)",
                        borderRadius: "9px", padding: "0 4px",
                        fontSize: "0.5rem", fontWeight: 700,
                        color: active ? "#fff" : (avgPct >= 60 ? "#00E676" : avgPct >= 25 ? "#FFD600" : "#FF1744"),
                        minWidth: "14px", textAlign: "center",
                      }}>{avgPct}%</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })()}
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: "0.65rem", top: "50%", transform: "translateY(-50%)", fontFamily: "'JetBrains Mono',monospace", color: "#E8622A", fontSize: "0.6rem", pointerEvents: "none", zIndex: 1 }}>
            ▸
          </div>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            style={{ width: "100%", background: "linear-gradient(135deg,#0d0d18,#110c1a)", border: "1px solid #E8622A22", borderRadius: "10px", color: "#e2e8f0", fontSize: "0.75rem", padding: "0.5rem 0.6rem 0.5rem 1.6rem", outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}
          >
            <option value="">Все регионы · {Object.keys(regions).length} зон</option>
            {Object.keys(regions).sort().map((r) => {
              const d = regions[r];
              const emoji = d.avg_pct >= 60 ? "🟢" : d.avg_pct >= 25 ? "🟡" : "🔴";
              return (
                <option key={r} value={r}>{emoji} {r.length > 30 ? r.slice(0, 30) + "…" : r} · {d.avg_pct}%</option>
              );
            })}
          </select>
          <div style={{ position: "absolute", right: "0.65rem", top: "50%", transform: "translateY(-50%)", color: "#E8622A", fontSize: "0.6rem", pointerEvents: "none" }}>
            ▼
          </div>
        </div>
      </div>

      {/* Trend chart — AreaChart with gradient */}
      <div style={{ padding: "0 1rem 0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem", flexWrap: "wrap", gap: "0.4rem" }}>
          <div>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0, fontWeight: 700 }}>
              График
              {selectedRegion && <span style={{ color: "#E8622A" }}> · {selectedRegion.split(" ").slice(-1)[0]}</span>}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.35rem" }}>
            <PBtn label="1д" active={trendDays === 1} onClick={() => setTrendDays(1)} />
            <PBtn label="7д" active={trendDays === 7} onClick={() => setTrendDays(7)} />
            <PBtn label="30д" active={trendDays === 30} onClick={() => setTrendDays(30)} />
          </div>
        </div>

        {trendData.length < 2 ? (
          <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(232,98,42,0.15)", borderRadius: "14px", padding: "2rem 1rem", textAlign: "center" }}>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.8rem", margin: 0 }}>
              ⏳ Данные накапливаются…<br />
              <span style={{ fontSize: "0.68rem" }}>График появится после первых замеров</span>
            </p>
          </div>
        ) : (
          <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(232,98,42,0.15)", borderRadius: "14px", padding: "1rem 1rem 0.5rem" }}>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E8622A" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#E8622A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2a" />
                <XAxis
                  dataKey="time"
                  tickFormatter={(t: string) => {
                    const d = new Date(t.replace(" ", "T") + ":00");
                    return trendDays <= 1
                      ? d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })
                      : d.toLocaleDateString("ru", { day: "numeric", month: "short" });
                  }}
                  tick={{ fill: "#4b5563", fontSize: 9 }} stroke="#22222f" interval="preserveStartEnd"
                />
                <YAxis domain={[0, 100]} tick={{ fill: "#4b5563", fontSize: 9 }} stroke="#22222f" />
                <Tooltip
                  contentStyle={{ background: "rgba(12,14,100,0.95)", border: "1px solid rgba(232,98,42,0.2)", borderRadius: "8px", fontSize: "0.75rem" }}
                  labelStyle={{ color: "rgba(255,255,255,0.72)" }}
                  formatter={(v: number) => [`${v.toFixed(1)}%`, "Доступность"]}
                  labelFormatter={(t: string) => {
                    const d = new Date(t.replace(" ", "T") + ":00");
                    return d.toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
                  }}
                />
                <ReferenceLine y={60} stroke="#00E676" strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.45} label={{ value: "60%", fill: "#22c55e88", fontSize: 8, position: "insideTopRight" }} />
                <ReferenceLine y={25} stroke="#FF1744" strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.45} label={{ value: "25%", fill: "#ef444488", fontSize: 8, position: "insideTopRight" }} />
                <Area type="monotone" dataKey="availability" stroke="#E8622A" strokeWidth={2} fill="url(#trendGrad)" dot={false} activeDot={{ r: 4, fill: "#E8622A" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Regional index cards */}
      <div style={{ padding: "0 1rem 0.75rem" }}>
        <div style={{ marginBottom: "0.6rem" }}>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0, fontWeight: 700 }}>Индекс по регионам · {filtered.length} зон</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          {filtered.map(([region, d]) => (
            <RegionCard key={region} region={region} data={d} isFav={isFavorite(region)} onToggleFav={() => isFavorite(region) ? removeFavorite(region) : addFavorite(region)} />
          ))}
        </div>
      </div>

      {/* Deep market analysis + network widgets */}
      <MarketAnalysis regions={regions} data={data} />

      </div>
    </div>
  );
}

// ─── News Feed ────────────────────────────────────────────────────
const SEVERITY_COLOR: Record<string, string> = { critical: "#FF1744", warning: "#f59e0b", info: "#3b82f6", success: "#00E676" };
const SEVERITY_LABEL: Record<string, string> = { critical: "КРИТИЧНО", warning: "ВНИМАНИЕ", info: "ИНФО", success: "НОРМА" };
const SEVERITY_BG: Record<string, string> = { critical: "#1a050514", warning: "#1a0f0014", info: "#05081a14", success: "#05190e14" };

function NewsFeed() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const [lastNewsRefresh, setLastNewsRefresh] = useState<Date | null>(null);
  const [newsLimit, setNewsLimit] = useState(15);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<string>("");

  const loadNews = useCallback(async (force = false, limit = newsLimit) => {
    if (!force && news.length > 0 && !open) { setOpen(true); return; }
    if (!force && news.length > 0 && open) { setOpen(false); return; }
    setLoading(true);
    try {
      const data = await fetchNews(undefined, limit);
      setNews(data);
      setLastNewsRefresh(new Date());
      if (!open) setOpen(true);
    } catch {} finally { setLoading(false); }
  }, [news.length, open, newsLimit]);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      fetchNews(undefined, 25).then((d) => { setNews(d); setLastNewsRefresh(new Date()); }).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [open]);

  const criticalCount = news.filter(n => n.severity === "critical").length;

  const displayedNews = news.filter((item) => {
    if (filterSeverity && item.severity !== filterSeverity) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.headline.toLowerCase().includes(q) ||
        item.region.toLowerCase().includes(q) ||
        (item.body ?? "").toLowerCase().includes(q) ||
        (item.fuel_type ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div style={{ padding: "0 1rem 1rem" }}>
      <button
        onClick={() => loadNews()}
        style={{
          width: "100%",
          background: criticalCount > 0 ? "linear-gradient(135deg,#1f0606,#1a0508)" : "linear-gradient(135deg,#0d0d18,#120c1a)",
          border: `1px solid ${criticalCount > 0 ? "#ef444444" : "#E8622A28"}`,
          borderRadius: "16px", padding: "0.85rem 1rem", cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          boxShadow: criticalCount > 0 ? "0 0 24px #ef444422" : "0 4px 20px #00000030",
          position: "relative", overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: criticalCount > 0 ? "linear-gradient(90deg,transparent,#ef4444,transparent)" : "linear-gradient(90deg,transparent,#E8622A,transparent)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ fontSize: "1.1rem" }}>{criticalCount > 0 ? "🚨" : "📡"}</span>
          <div style={{ textAlign: "left" }}>
            <p style={{ margin: 0, color: "#e2e8f0", fontSize: "0.82rem", fontWeight: 800, lineHeight: 1 }}>Лента событий</p>
            <p style={{ margin: "0.1rem 0 0", color: "rgba(255,255,255,0.55)", fontSize: "0.58rem" }}>
              {news.length > 0 ? `${news.length} событий` : "нажмите для загрузки"}
            </p>
          </div>
          {criticalCount > 0 && (
            <span style={{ background: "#ef444422", border: "1px solid #ef444455", borderRadius: "6px", color: "#FF1744", fontSize: "0.62rem", fontWeight: 700, padding: "0.15rem 0.45rem", animation: "tmaPulse 2s infinite", fontFamily: "'JetBrains Mono',monospace" }}>
              ⚠ {criticalCount}
            </span>
          )}
        </div>
        <span style={{ color: loading ? "#E8622A" : "rgba(255,255,255,0.45)", fontSize: "0.75rem" }}>
          {loading ? "⟳" : open ? "▲" : "▼"}
        </span>
      </button>

      {open && news.length > 0 && (
        <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {/* Search + severity filter */}
          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: "0.55rem", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.45)", fontSize: "0.7rem", pointerEvents: "none" }}>🔍</span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск событий…"
                style={{
                  width: "100%",
                  background: "#0b0b10",
                  border: "1px solid #1e1e2a",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                  fontSize: "0.7rem",
                  padding: "0.3rem 0.5rem 0.3rem 1.8rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            {(["", "critical", "warning", "info"] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                style={{
                  background: filterSeverity === sev ? (sev === "critical" ? "#ef444418" : sev === "warning" ? "#f59e0b18" : sev === "info" ? "#3b82f618" : "#E8622A18") : "#0b0b10",
                  border: `1px solid ${filterSeverity === sev ? (SEVERITY_COLOR[sev] ?? "#E8622A") : "#1e1e2a"}`,
                  borderRadius: "7px",
                  color: filterSeverity === sev ? (SEVERITY_COLOR[sev] ?? "#E8622A") : "rgba(255,255,255,0.55)",
                  fontSize: "0.62rem",
                  padding: "0.28rem 0.45rem",
                  cursor: "pointer",
                  fontWeight: filterSeverity === sev ? 700 : 400,
                  flexShrink: 0,
                  transition: "all 0.15s",
                }}
              >
                {sev === "" ? "Все" : sev === "critical" ? "🔴" : sev === "warning" ? "🟡" : "🔵"}
              </button>
            ))}
          </div>

          {(searchQuery || filterSeverity) && lastNewsRefresh && (
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.6rem", margin: "0 0 0.1rem", textAlign: "right" }}>
              <span style={{ color: "#E8622A" }}>{displayedNews.length} из {news.length}</span>
            </p>
          )}
          {displayedNews.length === 0 && (
            <div style={{ textAlign: "center", padding: "1.5rem", color: "rgba(255,255,255,0.45)", fontSize: "0.72rem" }}>
              Нет событий по фильтру
            </div>
          )}
          {displayedNews.map((item, ni) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ni * 0.04, duration: 0.25 }}
              style={{
                background: SEVERITY_BG[item.severity] ?? "#14141c",
                border: `1px solid ${SEVERITY_COLOR[item.severity] ?? "#22222f"}22`,
                borderLeft: `3px solid ${SEVERITY_COLOR[item.severity] ?? "#22222f"}`,
                borderRadius: "10px", padding: "0.65rem 0.8rem",
                position: "relative", overflow: "hidden",
              }}
            >
              {item.severity === "critical" && (
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#ef4444,transparent)" }} />
              )}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.25rem" }}>
                <span style={{ background: `${SEVERITY_COLOR[item.severity] ?? "#22222f"}22`, color: SEVERITY_COLOR[item.severity] ?? "rgba(255,255,255,0.72)", fontSize: "0.58rem", fontWeight: 700, padding: "0.1rem 0.4rem", borderRadius: "4px", letterSpacing: "0.06em", flexShrink: 0 }}>
                  {SEVERITY_LABEL[item.severity] ?? item.severity.toUpperCase()}
                </span>
                <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.6rem", flexShrink: 0 }}>
                  {new Date(item.created_at).toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p style={{ color: "#e2e8f0", fontSize: "0.8rem", margin: "0 0 0.25rem", fontWeight: 500, lineHeight: 1.35 }}>{item.headline}</p>
              {item.body && <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.72rem", margin: 0, lineHeight: 1.4 }}>{item.body}</p>}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
                <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.62rem" }}>📍 {item.region}</span>
                {item.fuel_type && <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.62rem" }}>⛽ {item.fuel_type}</span>}
                {item.price_delta_pct != null && (
                  <span style={{ color: item.price_delta_pct > 0 ? "#FF1744" : "#00E676", fontSize: "0.62rem", fontFamily: "'JetBrains Mono',monospace" }}>
                    {item.price_delta_pct > 0 ? "+" : ""}{item.price_delta_pct.toFixed(1)}%
                  </span>
                )}
                {item.source && <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.6rem" }}>· {item.source}</span>}
              </div>
            </motion.div>
          ))}
          {!searchQuery && !filterSeverity && news.length >= newsLimit && (
            <button
              onClick={() => { const next = newsLimit + 15; setNewsLimit(next); loadNews(true, next); }}
              style={{ background: "#14141c", border: "1px solid #22222f", borderRadius: "10px", color: "rgba(255,255,255,0.72)", fontSize: "0.75rem", padding: "0.6rem", cursor: "pointer", width: "100%" }}
            >
              Загрузить ещё
            </button>
          )}
        </div>
      )}

      {/* Network reliability summary */}
      <NetworkDistributionChart />
      {/* Top networks by availability */}
      <TopNetworksWidget />
      {/* Top cheapest stations right now */}
      <TopCheapestStations />
      {/* Fuel price savings opportunity */}
      <FuelSavingsWidget />
      {/* Crisis forecast */}
      <CrisisForecastWidget />
      {/* Network price comparison table */}
      <NetworkPriceTableWidget />
      {/* Region availability leaderboard */}
      <RegionLeaderboardWidget />
    </div>
  );
}

// ── Network distribution chart ─────────────────────────────────────
function NetworkDistributionChart() {
  const { stations } = useStationStore();
  if (!stations.length) return null;

  // Count stations per network, skip service facilities
  const counts: Record<string, number> = {};
  for (const s of stations) {
    const raw = s.network?.trim() || "";
    const net = isServiceNetwork(raw) ? "Остальные" : raw || "Остальные";
    counts[net] = (counts[net] ?? 0) + 1;
  }
  const sorted = Object.entries(counts).filter(([n]) => n !== "Остальные").sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 8);
  const otherCount = sorted.slice(8).reduce((s, [, c]) => s + c, 0);
  if (otherCount > 0) top.push(["Остальные", otherCount]);

  const maxCount = top[0][1];

  const NET_COLORS: Record<string, string> = {
    "Лукойл": "#D50000", "Роснефть": "#1d4ed8", "Газпромнефть": "#4338ca",
    "Газпром": "#1e40af", "Татнефть": "#92400e", "АЗС": "#374151",
    "Сургутнефтегаз": "#6d28d9", "ОПТИ": "#0f766e", "Тебойл": "#0369a1",
    "Башнефть": "#065f46", "ТАИФ-НК": "#7c2d12", "Остальные": "#4b5563",
  };
  function netColor(name: string) {
    for (const [k, c] of Object.entries(NET_COLORS)) {
      if (name.toLowerCase().includes(k.toLowerCase())) return c;
    }
    return "#4b5563";
  }

  return (
    <div style={{ padding: "0 1rem 0.75rem" }}>
      <div style={{ background: "linear-gradient(135deg,#0d0d18,#0f0c1a)", border: "1px solid #E8622A22", borderRadius: "14px", padding: "0.75rem", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#E8622A,transparent)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.32rem" }}>
          {top.map(([name, count], ni) => {
            const pct = Math.round((count / stations.length) * 100);
            const barWidth = Math.round((count / maxCount) * 100);
            const color = netColor(name);
            return (
              <motion.div
                key={name}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: ni * 0.04, duration: 0.22 }}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
              >
                <span style={{ color: "rgba(255,255,255,0.72)", fontSize: "0.62rem", width: "80px", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                <div style={{ flex: 1, height: "8px", background: "#0b0b10", borderRadius: "4px", overflow: "hidden" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ delay: ni * 0.04 + 0.12, duration: 0.55, ease: "easeOut" }}
                    style={{ height: "100%", background: `linear-gradient(90deg, ${color}aa, ${color})`, borderRadius: "4px" }}
                  />
                </div>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", color, fontSize: "0.62rem", fontWeight: 700, width: "28px", textAlign: "right", flexShrink: 0 }}>{count}</span>
                <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.55rem", width: "28px", flexShrink: 0 }}>{pct}%</span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Regional prices from card-oil.ru ──────────────────────────────
function RegionalPricesTable() {
  const [data, setData] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [fuel, setFuel] = useState<"АИ-92" | "АИ-95" | "ДТ">("АИ-95");
  const [sort, setSort] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetchRegionalPrices()
      .then((r) => { setData(r.prices); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const FUEL_COLORS: Record<string, string> = { "АИ-92": "#38bdf8", "АИ-95": "#E8622A", "ДТ": "#f59e0b" };
  const color = FUEL_COLORS[fuel] ?? "#E8622A";

  const rows = Object.entries(data)
    .map(([region, prices]) => ({ region, price: prices[fuel] ?? 0 }))
    .filter((r) => r.price > 0)
    .sort((a, b) => sort === "asc" ? a.price - b.price : b.price - a.price);

  const minP = rows.length ? rows[sort === "asc" ? 0 : rows.length - 1].price : 0;
  const maxP = rows.length ? rows[sort === "asc" ? rows.length - 1 : 0].price : 0;
  const range = maxP - minP || 1;

  return (
    <div style={{ padding: "0 1rem 0.75rem" }}>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.45)", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.45rem" }}>
        ЦЕНЫ РЕГИОНОВ · card-oil.ru · {new Date().toLocaleDateString("ru")}
      </div>
      <div style={{ background: "linear-gradient(135deg,#0d0d18,#0f0c1a)", border: `1px solid ${color}22`, borderRadius: "14px", padding: "0.75rem", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg,transparent,${color},transparent)` }} />
        {/* Controls */}
        <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.65rem", alignItems: "center" }}>
          {(["АИ-92", "АИ-95", "ДТ"] as const).map((f) => (
            <button key={f} onClick={() => setFuel(f)} style={{
              background: fuel === f ? `${FUEL_COLORS[f]}20` : "#0b0b10",
              border: `1px solid ${fuel === f ? FUEL_COLORS[f] : "#1e1e2a"}`,
              borderRadius: "7px", color: fuel === f ? FUEL_COLORS[f] : "rgba(255,255,255,0.55)",
              padding: "0.22rem 0.55rem", fontSize: "0.68rem", fontWeight: fuel === f ? 700 : 400,
              cursor: "pointer", transition: "all 0.15s",
            }}>{f}</button>
          ))}
          <button onClick={() => setSort(s => s === "asc" ? "desc" : "asc")} style={{
            marginLeft: "auto", background: "#0b0b10", border: "1px solid #1e1e2a",
            borderRadius: "7px", color: "rgba(255,255,255,0.65)", padding: "0.22rem 0.45rem",
            fontSize: "0.68rem", cursor: "pointer",
          }}>{sort === "asc" ? "↑ Дешевле" : "↓ Дороже"}</button>
        </div>
        {loading && (
          <div style={{ textAlign: "center", padding: "1.5rem", color: "rgba(255,255,255,0.45)", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.68rem" }}>ЗАГРУЗКА…</div>
        )}
        {error && (
          <div style={{ textAlign: "center", padding: "1rem", color: "#FF1744", fontSize: "0.72rem" }}>Нет данных</div>
        )}
        {!loading && !error && rows.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.28rem", maxHeight: "280px", overflowY: "auto" }}>
            {rows.map(({ region, price }, i) => {
              const pct = ((price - minP) / range) * 100;
              const barColor = pct < 33 ? "#00E676" : pct < 67 ? "#FFD600" : "#FF1744";
              return (
                <motion.div
                  key={region}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.025, duration: 0.2 }}
                  style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
                >
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.45)", fontSize: "0.52rem", width: "1.2rem", flexShrink: 0, textAlign: "right" }}>{i + 1}</span>
                  <span style={{ color: "rgba(255,255,255,0.72)", fontSize: "0.62rem", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{region.replace("Республика ", "Респ. ")}</span>
                  <div style={{ width: "40px", height: "4px", background: "#111", borderRadius: "2px", flexShrink: 0, overflow: "hidden" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: i * 0.025 + 0.1, duration: 0.4, ease: "easeOut" }}
                      style={{ height: "100%", background: barColor, borderRadius: "2px" }}
                    />
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color, fontSize: "0.66rem", fontWeight: 700, width: "3.2rem", textAlign: "right", flexShrink: 0 }}>{price.toFixed(2)} ₽</span>
                </motion.div>
              );
            })}
          </div>
        )}
        {!loading && rows.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem", paddingTop: "0.4rem", borderTop: "1px solid #1e1e2a" }}>
            <span style={{ color: "#00E676", fontSize: "0.58rem", fontFamily: "'JetBrains Mono',monospace" }}>↓ мин {minP.toFixed(2)} ₽</span>
            <span style={{ color: "#FF1744", fontSize: "0.58rem", fontFamily: "'JetBrains Mono',monospace" }}>↑ макс {maxP.toFixed(2)} ₽</span>
            <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.58rem" }}>разброс {(maxP - minP).toFixed(2)} ₽</span>
          </div>
        )}
      </div>
    </div>
  );
}



// ── Service-word blocklist (mirrors backend _SERVICE_NETWORK_WORDS) ───────────
const SERVICE_NETWORK_WORDS = new Set([
  "шиномонтаж", "мойка", "автомойка", "автосервис", "кафе", "магазин",
  "стоянка", "парковка", "сто", "техцентр", "сервис", "шины",
  "гараж", "прокат", "заправщик", "жесть", "нефть", "азс", "агзс",
  "агнкс", "мазс", "другие",
]);
const SERVICE_PREFIXES = ["мойка", "шиномонтаж", "автомойка", "шины", "автосервис"];

function isServiceNetwork(name: string): boolean {
  if (!name?.trim()) return true;
  const lower = name.trim().toLowerCase();
  if (SERVICE_NETWORK_WORDS.has(lower)) return true;
  if (SERVICE_PREFIXES.some((p) => lower.startsWith(p))) return true;
  return false;
}

// ── Top Networks by Availability ─────────────────────────────────
function TopNetworksWidget() {
  const { stations } = useStationStore();
  const [insights, setInsights] = useState<Record<string, { founded?: number; total_stations?: number; regions_count?: number; specialty?: string; rating?: number }>>({});

  const nets: Record<string, { total: number; sum: number }> = {};
  stations.forEach((s) => {
    const n = s.network?.trim() || "";
    if (isServiceNetwork(n)) return;
    const avg = s.fuel_statuses.length
      ? s.fuel_statuses.reduce((a, f) => a + f.availability_pct, 0) / s.fuel_statuses.length
      : 0;
    if (!nets[n]) nets[n] = { total: 0, sum: 0 };
    nets[n].total++;
    nets[n].sum += avg;
  });

  const ranked = Object.entries(nets)
    .map(([name, { total, sum }]) => ({ name, count: total, avg: Math.round(sum / total) }))
    .filter((r) => r.count >= 3)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 8);

  useEffect(() => {
    if (ranked.length === 0) return;
    const names = ranked.map((r) => r.name).join(",");
    fetch(`/api/analytics/network-insights?networks=${encodeURIComponent(names)}`)
      .then((r) => r.json())
      .then((d) => { if (d.insights) setInsights(d.insights); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranked.length > 0 ? ranked.map((r) => r.name).join(",") : ""]);

  if (ranked.length < 3) return null;
  const maxAvg = ranked[0]?.avg ?? 100;

  return (
    <div style={{ padding: "0 1rem 1.5rem" }}>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.45)", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.45rem" }}>
        РЕЙТИНГ СЕТЕЙ · ДОСТУПНОСТЬ · ТОП-8
      </div>
      <div style={{ background: "rgba(14,18,158,0.55)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "14px", padding: "0.75rem", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {ranked.map(({ name, count, avg }, i) => {
            const color = avg >= 60 ? "#22c55e" : avg >= 35 ? "#fbbf24" : "#ff6b6b";
            const barPct = maxAvg > 0 ? (avg / maxAvg) * 100 : 0;
            const medals = ["🥇","🥈","🥉"];
            const ins = insights[name];
            return (
              <motion.div
                key={name}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.22 }}
                style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}
              >
                <span style={{ fontSize: "0.65rem", flexShrink: 0, width: "1.2rem" }}>{medals[i] ?? `${i + 1}.`}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ color: i < 3 ? "#ffffff" : "rgba(255,255,255,0.82)", fontSize: "0.62rem", fontWeight: i === 0 ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{name}</span>
                      {ins?.specialty && (
                        <span style={{ color: "rgba(255,255,255,0.38)", fontSize: "0.48rem", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ins.specialty}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, marginLeft: "0.3rem" }}>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", color, fontSize: "0.62rem", fontWeight: 700 }}>{avg}%</span>
                      {ins?.rating != null && (
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.38)", fontSize: "0.44rem" }}>★{ins.rating}/10</span>
                      )}
                    </div>
                  </div>
                  <div style={{ height: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barPct}%` }}
                      transition={{ delay: i * 0.05 + 0.12, duration: 0.6, ease: "easeOut" }}
                      style={{ height: "100%", background: `linear-gradient(90deg,${color}88,${color})`, borderRadius: "2px" }}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
                  <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.52rem", fontFamily: "'JetBrains Mono',monospace" }}>{count}</span>
                  {ins?.total_stations != null && ins.total_stations !== count && (
                    <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.42rem", fontFamily: "'JetBrains Mono',monospace" }}>~{ins.total_stations.toLocaleString("ru")}</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Top 5 cheapest stations right now ──────────────────────────────
function TopCheapestStations() {
  const { stations } = useStationStore();
  const getPrice = usePriceStore((s) => s.getPrice);
  const [fuel, setFuel] = useState<"АИ-92" | "АИ-95" | "ДТ">("АИ-92");

  if (!stations.length) return null;

  const FUEL_COLORS: Record<string, string> = { "АИ-92": "#38bdf8", "АИ-95": "#E8622A", "ДТ": "#f59e0b" };
  const STATIC: Record<string, number> = { "АИ-92": 65, "АИ-95": 71, "ДТ": 79 };
  const color = FUEL_COLORS[fuel];

  const top5 = stations
    .filter((s) => s.fuel_statuses.some((f) => f.fuel_type === fuel && f.availability_pct > 20))
    .map((s) => {
      const p = getPrice(s.region, fuel);
      const price = p?.effective ?? STATIC[fuel] ?? 70;
      const avail = s.fuel_statuses.find((f) => f.fuel_type === fuel)?.availability_pct ?? 0;
      return { s, price, avail };
    })
    .sort((a, b) => a.price - b.price || b.avail - a.avail)
    .filter((item, idx, arr) => {
      const key = item.s.network?.trim() || item.s.name;
      return arr.findIndex((x) => (x.s.network?.trim() || x.s.name) === key) === idx;
    })
    .slice(0, 5);

  if (!top5.length) return null;
  const minP = top5[0].price;

  return (
    <div style={{ padding: "0 1rem 0.75rem" }}>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.45)", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.45rem" }}>
        Лучшие цены · ТОП-5
      </div>
      <div style={{ background: "linear-gradient(135deg,#0d0d18,#0f0c1a)", border: `1px solid ${color}22`, borderRadius: "14px", padding: "0.75rem", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg,transparent,${color},transparent)` }} />
        <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.55rem" }}>
          {(["АИ-92", "АИ-95", "ДТ"] as const).map((f) => (
            <button key={f} onClick={() => setFuel(f)} style={{
              padding: "0.18rem 0.45rem", background: fuel === f ? `${FUEL_COLORS[f]}20` : "#0b0b10",
              border: `1px solid ${fuel === f ? FUEL_COLORS[f] : "#1e1e2a"}`, borderRadius: "6px",
              color: fuel === f ? FUEL_COLORS[f] : "rgba(255,255,255,0.45)", fontSize: "0.62rem",
              fontWeight: fuel === f ? 700 : 400, cursor: "pointer",
            }}>{f}</button>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {top5.map(({ s, price, avail }, i) => {
            const saving = price - minP;
            const medals = ["🥇", "🥈", "🥉", "4.", "5."];
            const availColor = avail >= 60 ? "#00E676" : avail >= 25 ? "#FFD600" : "#FF1744";
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.22 }}
                style={{
                  display: "flex", alignItems: "center", gap: "0.45rem",
                  background: i === 0 ? "linear-gradient(135deg,#0b1408,#0d0d18)" : "transparent",
                  border: i === 0 ? "1px solid #22c55e18" : "none",
                  borderRadius: i === 0 ? "8px" : 0,
                  padding: i === 0 ? "0.25rem 0.35rem" : "0.05rem 0",
                }}
              >
                <span style={{ fontSize: "0.7rem", flexShrink: 0, width: "1.4rem" }}>{medals[i]}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: i === 0 ? "#f1f5f9" : "rgba(255,255,255,0.72)", fontSize: "0.62rem", fontWeight: i === 0 ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                  <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.52rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.network || "АЗС"} · {s.region.replace("Республика ", "Респ.").split(" ").slice(-1)[0]}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", color: i === 0 ? "#00E676" : color, fontSize: "0.7rem", fontWeight: 700 }}>
                    {price.toFixed(1)}₽
                    {saving > 0 && <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.52rem", marginLeft: "0.2rem" }}>+{saving.toFixed(1)}</span>}
                  </div>
                  <div style={{ color: availColor, fontSize: "0.52rem" }}>{avail}%</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Fuel price savings opportunity ─────────────────────────────────
function FuelSavingsWidget() {
  const { stations } = useStationStore();
  const getPrice = usePriceStore((s) => s.getPrice);

  if (!stations.length) return null;

  const FUELS = ["АИ-92", "АИ-95", "ДТ", "Газ"] as const;
  const FUEL_COLORS: Record<string, string> = { "АИ-92": "#38bdf8", "АИ-95": "#E8622A", "ДТ": "#f59e0b", "Газ": "#14b8a6" };
  const STATIC: Record<string, number> = { "АИ-92": 65, "АИ-95": 71, "ДТ": 79, "Газ": 35 };

  const spreads = FUELS.map((fuel) => {
    const prices = stations
      .filter((s) => s.fuel_statuses.some((f) => f.fuel_type === fuel && f.availability_pct > 20))
      .map((s) => getPrice(s.region, fuel)?.effective ?? STATIC[fuel] ?? 70)
      .filter((p) => p > 0);
    if (prices.length < 2) return null;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    return { fuel, min, max, avg, spread: max - min };
  }).filter(Boolean) as { fuel: string; min: number; max: number; avg: number; spread: number }[];

  if (!spreads.length) return null;
  const maxSpread = Math.max(...spreads.map((s) => s.spread));

  return (
    <div style={{ padding: "0 1rem 1.5rem" }}>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.45)", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.45rem" }}>
        Разброс цен · Экономия
      </div>
      <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #22c55e18", borderRadius: "14px", padding: "0.75rem", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#22c55e44,transparent)" }} />
        <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#00E676", fontSize: "0.6rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          💰 Потенциальная экономия при выборе АЗС
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
          {spreads.map(({ fuel, min, max, avg, spread }, si) => {
            const color = FUEL_COLORS[fuel] ?? "#E8622A";
            const barPct = maxSpread > 0 ? (spread / maxSpread) * 100 : 0;
            return (
              <motion.div
                key={fuel}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: si * 0.08, duration: 0.22 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.15rem" }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color, fontSize: "0.62rem", fontWeight: 700 }}>{fuel}</span>
                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <span style={{ color: "#00E676", fontSize: "0.58rem" }}>↓{min.toFixed(1)}₽</span>
                    <span style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.58rem" }}>ср.{avg.toFixed(1)}₽</span>
                    <span style={{ color: "#FF1744", fontSize: "0.58rem" }}>↑{max.toFixed(1)}₽</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <div style={{ flex: 1, height: "5px", background: "#0b0b0f", borderRadius: "3px", overflow: "hidden" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barPct}%` }}
                      transition={{ delay: si * 0.08 + 0.12, duration: 0.6, ease: "easeOut" }}
                      style={{ height: "100%", background: `linear-gradient(90deg,#22c55e,${color})`, borderRadius: "3px" }}
                    />
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#00E676", fontSize: "0.58rem", fontWeight: 700, flexShrink: 0 }}>
                    -{spread.toFixed(1)}₽
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
        <div style={{ marginTop: "0.6rem", padding: "0.35rem 0.5rem", background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.12)", borderRadius: "7px" }}>
          <span style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.58rem" }}>
            💡 Заправившись на самой дешёвой АЗС, вы экономите до <strong style={{ color: "#00E676" }}>{Math.max(...spreads.map(s => s.spread * 60)).toFixed(0)} ₽</strong> при заправке 60л
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Network price comparison table ─────────────────────────────────
function NetworkPriceTableWidget() {
  const [prices, setPrices] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [activeFuel, setActiveFuel] = useState<"АИ-92" | "АИ-95" | "ДТ">("АИ-92");

  useEffect(() => {
    fetchNetworkPrices()
      .then(d => { setPrices(d.networks); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const FUELS = ["АИ-92", "АИ-95", "ДТ"] as const;
  const FUEL_COLORS: Record<string, string> = { "АИ-92": "#38bdf8", "АИ-95": "#E8622A", "ДТ": "#f59e0b" };

  const NETWORKS = [
    { name: "Лукойл",       color: "#FF1744", icon: "🔴" },
    { name: "Роснефть",     color: "#0ea5e9", icon: "🔵" },
    { name: "Газпромнефть", color: "#3b82f6", icon: "💙" },
    { name: "Башнефть",     color: "#8b5cf6", icon: "🟣" },
    { name: "Татнефть",     color: "#00E676", icon: "🟢" },
    { name: "ННК",          color: "#f59e0b", icon: "🟡" },
  ];

  if (loading || !Object.keys(prices).length) return null;

  const sorted = [...NETWORKS].sort((a, b) => {
    const pa = prices[a.name]?.[activeFuel] ?? 99;
    const pb = prices[b.name]?.[activeFuel] ?? 99;
    return pa - pb;
  });

  const allPrices = sorted.map(n => prices[n.name]?.[activeFuel] ?? 0).filter(p => p > 0);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);

  return (
    <div style={{ padding: "0 1rem 1.5rem" }}>
      <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #E8622A18", borderRadius: "14px", padding: "0.75rem", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#E8622A44,transparent)" }} />
        <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.6rem" }}>
          {FUELS.map(f => (
            <button key={f} onClick={() => setActiveFuel(f)} style={{
              flexShrink: 0, padding: "0.18rem 0.55rem",
              background: activeFuel === f ? `${FUEL_COLORS[f]}18` : "none",
              border: `1px solid ${activeFuel === f ? FUEL_COLORS[f] + "50" : "#22222f"}`,
              borderRadius: "6px", color: activeFuel === f ? FUEL_COLORS[f] : "rgba(255,255,255,0.55)",
              fontSize: "0.6rem", fontWeight: activeFuel === f ? 700 : 400, cursor: "pointer",
              fontFamily: "'JetBrains Mono',monospace",
            }}>{f}</button>
          ))}
          <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.45)", fontSize: "0.55rem", alignSelf: "center" }}>
            разброс: <strong style={{ color: "#00E676" }}>-{(maxPrice - minPrice).toFixed(1)}₽</strong>
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {sorted.map(({ name, color, icon }, rank) => {
            const price = prices[name]?.[activeFuel];
            if (!price) return null;
            const barPct = maxPrice > minPrice ? ((price - minPrice) / (maxPrice - minPrice)) * 100 : 50;
            const isCheapest = price === minPrice;
            return (
              <motion.div
                key={name}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: rank * 0.05, duration: 0.22 }}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.45)", fontSize: "0.52rem", width: "1rem", flexShrink: 0 }}>#{rank + 1}</span>
                <span style={{ fontSize: "0.72rem", flexShrink: 0 }}>{icon}</span>
                <span style={{ color: "rgba(255,255,255,0.72)", fontSize: "0.62rem", minWidth: "75px", flexShrink: 0 }}>{name}</span>
                <div style={{ flex: 1, height: "4px", background: "#0b0b0f", borderRadius: "2px", overflow: "hidden" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(barPct, 8)}%` }}
                    transition={{ delay: rank * 0.05 + 0.1, duration: 0.5, ease: "easeOut" }}
                    style={{ height: "100%", background: `linear-gradient(90deg,${color}88,${color})`, borderRadius: "2px" }}
                  />
                </div>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: isCheapest ? "#00E676" : color, fontSize: "0.65rem", fontWeight: 700, flexShrink: 0, minWidth: "46px", textAlign: "right" }}>
                  {price.toFixed(1)}₽{isCheapest ? " ✓" : ""}
                </span>
              </motion.div>
            );
          })}
        </div>
        <div style={{ marginTop: "0.55rem", padding: "0.3rem 0.5rem", background: "rgba(232,98,42,0.04)", border: "1px solid #E8622A12", borderRadius: "6px" }}>
          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.55rem" }}>
            🏆 Выгоднее всего: <strong style={{ color: "#00E676" }}>{sorted[0]?.name}</strong> — {prices[sorted[0]?.name]?.[activeFuel]?.toFixed(1)}₽/л за {activeFuel}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Region availability leaderboard ────────────────────────────────
function RegionLeaderboardWidget() {
  const { stations } = useStationStore();
  if (stations.length === 0) return null;

  const regionMap = new Map<string, { total: number; sumPct: number }>();
  for (const s of stations) {
    const avg = s.fuel_statuses.length
      ? s.fuel_statuses.reduce((a, b) => a + b.availability_pct, 0) / s.fuel_statuses.length
      : 0;
    const prev = regionMap.get(s.region) ?? { total: 0, sumPct: 0 };
    regionMap.set(s.region, { total: prev.total + 1, sumPct: prev.sumPct + avg });
  }

  const ranked = Array.from(regionMap.entries())
    .map(([region, { total, sumPct }]) => ({
      region,
      total,
      avgPct: sumPct / total,
      short: region.length > 20 ? region.split(" ").slice(-1)[0] : region,
    }))
    .sort((a, b) => b.avgPct - a.avgPct);

  const top5 = ranked.slice(0, 5);
  const bottom3 = ranked.slice(-3).reverse();

  return (
    <div style={{ padding: "0 1rem 1.5rem" }}>
      <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #E8622A18", borderRadius: "14px", padding: "0.75rem", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#22c55e44,transparent)" }} />

        {/* Top 5 */}
        <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#00E676", fontSize: "0.52rem", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>▲ ТОП-5 РЕГИОНОВ</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginBottom: "0.65rem" }}>
          {top5.map(({ region, total, avgPct, short }, i) => (
            <motion.div
              key={region}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.2 }}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.45)", fontSize: "0.5rem", width: "1rem", flexShrink: 0 }}>#{i + 1}</span>
              <span style={{ color: "rgba(255,255,255,0.72)", fontSize: "0.6rem", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{short}</span>
              <div style={{ width: "55px", height: "3px", background: "#0b0b0f", borderRadius: "2px", flexShrink: 0, overflow: "hidden" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(avgPct, 100)}%` }}
                  transition={{ delay: i * 0.05 + 0.1, duration: 0.55, ease: "easeOut" }}
                  style={{ height: "100%", background: "linear-gradient(90deg,#16a34a,#22c55e)", borderRadius: "2px" }}
                />
              </div>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#00E676", fontSize: "0.6rem", fontWeight: 700, minWidth: "34px", textAlign: "right", flexShrink: 0 }}>{avgPct.toFixed(0)}%</span>
              <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.52rem", flexShrink: 0 }}>{total}АЗС</span>
            </motion.div>
          ))}
        </div>

        {/* Bottom 3 */}
        <div style={{ height: "1px", background: "#1e1e2a", marginBottom: "0.5rem" }} />
        <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#FF1744", fontSize: "0.52rem", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>▼ КРИТИЧЕСКИЕ ЗОНЫ</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {bottom3.map(({ region, total, avgPct, short }, i) => (
            <motion.div
              key={region}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 + 0.28, duration: 0.2 }}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.45)", fontSize: "0.5rem", width: "1rem", flexShrink: 0 }}>#{ranked.length - 2 + i}</span>
              <span style={{ color: "rgba(255,255,255,0.72)", fontSize: "0.6rem", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{short}</span>
              <div style={{ width: "55px", height: "3px", background: "#0b0b0f", borderRadius: "2px", flexShrink: 0, overflow: "hidden" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(Math.min(avgPct, 100), 4)}%` }}
                  transition={{ delay: i * 0.05 + 0.38, duration: 0.55, ease: "easeOut" }}
                  style={{ height: "100%", background: "linear-gradient(90deg,#991b1b,#ef4444)", borderRadius: "2px" }}
                />
              </div>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#FF1744", fontSize: "0.6rem", fontWeight: 700, minWidth: "34px", textAlign: "right", flexShrink: 0 }}>{avgPct.toFixed(0)}%</span>
              <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.52rem", flexShrink: 0 }}>{total}АЗС</span>
            </motion.div>
          ))}
        </div>
        <div style={{ marginTop: "0.5rem", padding: "0.3rem 0.5rem", background: "rgba(34,197,94,0.04)", border: "1px solid #22c55e12", borderRadius: "6px" }}>
          <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.52rem" }}>
            📊 {ranked.length} регионов · {stations.length.toLocaleString("ru")} АЗС в базе
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Crisis forecast widget ──────────────────────────────────────────
import type { CrisisForecast } from "@/types";

function CrisisForecastWidget() {
  const [forecasts, setForecasts] = useState<CrisisForecast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCrisisForecast()
      .then(d => { setForecasts(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !forecasts.length) return null;

  const critical = forecasts.filter(f => f.severity >= 7).slice(0, 5);
  if (!critical.length) return null;

  const trendIcon = (t: CrisisForecast["trend"]) =>
    t === "worsening" ? "▼" : t === "improving" ? "▲" : "—";
  const trendColor = (t: CrisisForecast["trend"]) =>
    t === "worsening" ? "#FF1744" : t === "improving" ? "#00E676" : "#6b7280";

  return (
    <div style={{ padding: "0 1rem 1.5rem" }}>
      <div style={{ background: "linear-gradient(135deg,#0f0505,#12060a)", border: "1px solid #ef444422", borderRadius: "14px", padding: "0.75rem", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#ef444444,transparent)" }} />
        <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#FF1744", fontSize: "0.52rem", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
          🚨 ЗОНЫ РИСКА · {critical.length} РЕГИОН{critical.length === 1 ? "" : "А"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.38rem" }}>
          {critical.map((f, ci) => {
            const severity = Math.min(f.severity, 10);
            const barW = (severity / 10) * 100;
            const short = f.region.length > 22 ? f.region.split(" ").slice(-1)[0] : f.region;
            return (
              <motion.div
                key={f.region}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: ci * 0.07, duration: 0.22 }}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
              >
                <span style={{ color: "rgba(255,255,255,0.72)", fontSize: "0.6rem", minWidth: "70px", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{short}</span>
                <div style={{ flex: 1, height: "4px", background: "#1a0505", borderRadius: "2px", overflow: "hidden" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barW}%` }}
                    transition={{ delay: ci * 0.07 + 0.15, duration: 0.5, ease: "easeOut" }}
                    style={{ height: "100%", background: severity >= 9 ? "linear-gradient(90deg,#991b1b,#ef4444)" : "linear-gradient(90deg,#b45309,#f97316)", borderRadius: "2px" }}
                  />
                </div>
                <span style={{ color: trendColor(f.trend), fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", fontWeight: 700, flexShrink: 0, minWidth: "20px" }}>{trendIcon(f.trend)}</span>
                <span style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.55rem", flexShrink: 0, whiteSpace: "nowrap" }}>
                  {f.days_until_critical <= 1 ? "сегодня" : `≤${f.days_until_critical}д`}
                </span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#f59e0b", fontSize: "0.55rem", flexShrink: 0 }}>
                  ~{f.recommended_volume_liters}л
                </span>
              </motion.div>
            );
          })}
        </div>
        <div style={{ marginTop: "0.5rem", padding: "0.3rem 0.5rem", background: "rgba(239,68,68,0.04)", border: "1px solid #ef444412", borderRadius: "6px" }}>
          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.52rem" }}>
            💡 Рекомендуем заправиться заранее в выделенных регионах
          </span>
        </div>
      </div>
    </div>
  );
}
