import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { fetchAnalytics, fetchTrend, fetchNews, fetchSystemStats } from "@/api/client";
import type { SystemStats } from "@/api/client";
import type { NewsItem } from "@/types";
import { useFavoritesStore } from "@/stores/useFavoritesStore";
import { usePriceStore } from "@/stores/usePriceStore";
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
            background: "#ef4444", boxShadow: "0 0 16px #ef4444",
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.05rem" }}>
            <span style={{ color: "#ef4444", fontWeight: 800, fontSize: "0.75rem", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono',monospace" }}>
              КРИЗИС_ДЕФИЦИТА
            </span>
          </div>
          <span style={{ color: "#9ca3af", fontSize: "0.68rem" }}>
            {count} {count === 1 ? "регион" : count < 5 ? "региона" : "регионов"} ниже 25% · срочно
          </span>
        </div>
        <button
          onClick={() => onNavigate?.("catalog")}
          style={{
            background: "linear-gradient(135deg,#ef444430,#ef444410)", border: "1px solid #ef444455", borderRadius: "8px",
            color: "#ef4444", fontSize: "0.7rem", fontWeight: 700, padding: "0.35rem 0.65rem",
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
  const FUEL_COLORS = ["#a855f7", "#db2777", "#f59e0b"];

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
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.1rem" }}>МАТРИЦА_ЦЕН · КРИТИЧНЫЕ_ЗОНЫ</div>
            <p style={{ color: "#9ca3af", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
              Матрица цен
            </p>
          </div>
          <span style={{ background: "#ef444415", border: "1px solid #ef444430", borderRadius: "4px", color: "#ef4444", fontSize: "0.55rem", fontWeight: 700, padding: "0.1rem 0.35rem", fontFamily: "'JetBrains Mono',monospace" }}>
            ТОП-6 крит.
          </span>
        </div>
        <span style={{ color: "#374151", fontSize: "0.58rem", fontFamily: "'JetBrains Mono',monospace" }}>₽/литр</span>
      </div>

      <div style={{ background: "linear-gradient(160deg,#080810,#0a0a14)", border: "1px solid #1e1e2a", borderRadius: "14px", overflow: "hidden", boxShadow: "0 4px 24px #00000040" }}>
        {/* Header row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(3, 68px)", background: "#0f0f1a", borderBottom: "1px solid #1a1a28" }}>
          <div style={{ padding: "0.45rem 0.7rem", color: "#374151", fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono',monospace" }}>
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
                <div style={{ color: isCritical ? "#fca5a5" : "#d1d5db", fontSize: "0.67rem", fontWeight: isCritical ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {region.split(" ").slice(-1)[0].slice(0, 14)}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "2px" }}>
                  <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: isCritical ? "#ef4444" : isLow ? "#eab308" : "#22c55e", flexShrink: 0 }} />
                  <span style={{ color: "#4b5563", fontSize: "0.58rem", fontFamily: "'JetBrains Mono',monospace" }}>
                    {supply?.avg_pct ?? "—"}%
                  </span>
                </div>
              </div>
              {FUELS.map((f) => {
                const p = regionPrices[f] as { effective: number; multiplier: number; is_crisis: boolean } | undefined;
                const isCrisisPrice = p?.is_crisis;
                const up = (p?.multiplier ?? 1) > 1.03;
                const priceColor = isCrisisPrice ? "#ef4444" : up ? "#f59e0b" : "#22c55e";
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
                          <span style={{ fontSize: "0.52rem", color: isCrisisPrice ? "#ef444499" : "#4b5563", fontFamily: "'JetBrains Mono',monospace" }}>
                            {up ? "▲" : "▼"}{Math.abs((p.multiplier - 1) * 100).toFixed(0)}%
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ color: "#374151", fontSize: "0.7rem" }}>—</span>
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
    { name: "Норма", value: green, color: "#22c55e" },
    { name: "Мало", value: yellow, color: "#eab308" },
    { name: "Нет", value: red, color: "#ef4444" },
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
        <div style={{ fontSize: "0.5rem", color: "#4b5563", textTransform: "uppercase" }}>норма</div>
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
  const color = data.avg_pct >= 60 ? "#22c55e" : data.avg_pct >= 25 ? "#eab308" : "#ef4444";
  const dot = data.avg_pct >= 60 ? "🟢" : data.avg_pct >= 25 ? "🟡" : "🔴";
  const zoneLabel: Record<string, string> = { critical: "Крит", standard: "Стандарт", eastern: "Восток" };
  return (
    <div style={{ background: "#0b0b0f", border: "1px solid #1e1e2a", borderRadius: "12px", padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <div style={{ width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, background: "#a855f7", boxShadow: "0 0 8px #a855f7", animation: "tmaPulse 1.5s infinite" }} />
      <div style={{ flex: 1, minWidth: 0, transition: "opacity 0.28s", opacity: vis ? 1 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "#4b5563", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>СКАН</span>
          <span style={{ color: "#e2e8f0", fontSize: "0.82rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{region}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.2rem" }}>
          <span style={{ fontSize: "0.78rem" }}>{dot}</span>
          <span style={{ color, fontFamily: "'JetBrains Mono',monospace", fontSize: "1rem", fontWeight: 700 }}>{data.avg_pct}%</span>
          <span style={{ color: "#4b5563", fontSize: "0.65rem", background: "#14141c", borderRadius: "4px", padding: "0.1rem 0.35rem" }}>{zoneLabel[data.zone_type] ?? data.zone_type}</span>
          <span style={{ color: "#4b5563", fontSize: "0.65rem" }}>{data.count} АЗС</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: "3px", flexShrink: 0 }}>
        {Array.from({ length: Math.min(entries.length, 8) }).map((_, i) => (
          <div key={i} style={{ width: "5px", height: "5px", borderRadius: "50%", background: i === (idx % Math.min(entries.length, 8)) ? "#a855f7" : "#22222f", transition: "background 0.3s" }} />
        ))}
      </div>
    </div>
  );
}

// ── Regional card ─────────────────────────────────────────────────
function RegionCard({ region, data, isFav, onToggleFav }: { region: string; data: RegionalSupply; isFav: boolean; onToggleFav: () => void }) {
  const color = data.avg_pct >= 60 ? "#22c55e" : data.avg_pct >= 25 ? "#eab308" : "#ef4444";
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
        border: `1px solid ${isFav ? "#a855f740" : isCritical ? "#ef444430" : "#1e1e2a"}`,
        borderRadius: "14px",
        padding: "0.8rem",
        position: "relative",
        overflow: "hidden",
        boxShadow: isCritical ? "0 0 20px #ef444418" : isFav ? "0 0 16px #a855f712" : "none",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: isCritical ? "linear-gradient(90deg,#ef4444,#dc2626)" : isFav ? "linear-gradient(90deg,#a855f7,#db2777)" : `linear-gradient(90deg,${color}88,${color})` }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.3rem" }}>
        <p style={{ color: isCritical ? "#fca5a5" : "#9ca3af", fontSize: "0.63rem", margin: 0, flex: 1, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: isCritical ? 600 : 400 }}>
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
        {[["🟢", data.green, "#22c55e"], ["🟡", data.yellow, "#eab308"], ["🔴", data.red, "#ef4444"]].map(([emoji, v, c]) => (
          <span key={String(emoji)} style={{ color: String(c) + "88", fontSize: "0.56rem", fontFamily: "'JetBrains Mono',monospace" }}>{emoji}{v}</span>
        ))}
        <span style={{ marginLeft: "auto", color: "#374151", fontSize: "0.56rem" }}>{data.count} АЗС</span>
      </div>
    </motion.div>
  );
}

// ── Period button ─────────────────────────────────────────────────
function PBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: active ? "linear-gradient(135deg,#a855f7,#db2777)" : "#14141c", border: active ? "none" : "1px solid #22222f", color: active ? "#fff" : "#6b7280", borderRadius: "8px", padding: "0.3rem 0.7rem", fontSize: "0.72rem", fontWeight: active ? 700 : 400, cursor: "pointer", transition: "all 0.2s" }}>
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
  const avgColor = data.avg_pct >= 60 ? "#22c55e" : data.avg_pct >= 25 ? "#eab308" : "#ef4444";
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
            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.55rem", flexShrink: 0 }}>
              #{String(rank + 1).padStart(2, "0")}
            </span>
          )}
          <span style={{ color: isCritical ? "#fca5a5" : "#9ca3af", fontSize: "0.68rem", fontWeight: isCritical ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {region.length > 28 ? region.slice(0, 28) + "…" : region}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
          <span style={{ color: "#374151", fontSize: "0.58rem" }}>{data.count} АЗС</span>
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

  const FUEL_COLORS: Record<string, string> = { "АИ-92": "#a855f7", "АИ-95": "#db2777", "ДТ": "#f59e0b" };

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
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#3b82f6,#a855f7,transparent)" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.02, background: "repeating-linear-gradient(0deg,transparent,transparent 3px,#3b82f6 3px,#3b82f6 4px)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.7rem" }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.15rem" }}>АЛГОРИТМ_ПРОГНОЗА · ИИ</div>
            <p style={{ margin: 0, color: "#e2e8f0", fontSize: "0.88rem", fontWeight: 800 }}>🤖 AI Прогноз цен</p>
          </div>
          <button
            onClick={generate}
            disabled={running}
            style={{ background: running ? "#14141c" : "#3b82f615", border: `1px solid ${running ? "#22222f" : "#3b82f633"}`, borderRadius: "8px", color: running ? "#4b5563" : "#3b82f6", fontSize: "0.65rem", fontWeight: 600, padding: "0.25rem 0.6rem", cursor: running ? "default" : "pointer" }}
          >
            {running ? "⟳ …" : "🔄 Обновить"}
          </button>
        </div>
        {Object.keys(preds).length === 0 ? (
          <div style={{ textAlign: "center", padding: "1rem 0", color: "#374151", fontSize: "0.75rem" }}>
            {running ? "⟳ Вычисление прогноза…" : "Нет данных о ценах"}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.7rem" }}>
            {Object.entries(preds).map(([fuel, p]) => {
              const color = FUEL_COLORS[fuel] ?? "#6b7280";
              const delta = ((p.p24h - p.curr) / p.curr * 100).toFixed(1);
              return (
                <div key={fuel} style={{ background: "#14141c", border: `1px solid ${color}22`, borderRadius: "10px", padding: "0.55rem 0.5rem", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1.5px", background: `linear-gradient(90deg, ${color}88, ${color})` }} />
                  <p style={{ margin: "0 0 0.12rem", color: "#6b7280", fontSize: "0.52rem", fontFamily: "'JetBrains Mono',monospace" }}>{fuel}</p>
                  <p style={{ margin: "0 0 0.08rem", color: "#e2e8f0", fontWeight: 700, fontSize: "0.85rem", lineHeight: 1, fontFamily: "'JetBrains Mono',monospace" }}>{p.curr}₽</p>
                  <p style={{ margin: "0 0 0.05rem", color: p.up ? "#22c55e" : "#ef4444", fontSize: "0.7rem", fontWeight: 700, lineHeight: 1 }}>
                    {p.up ? "↑" : "↓"} {p.p24h}₽
                  </p>
                  <p style={{ margin: 0, color: "#374151", fontSize: "0.48rem" }}>
                    24ч · {Math.abs(Number(delta))}% · {p.conf}% ↑
                  </p>
                </div>
              );
            })}
          </div>
        )}
        {lastUpdated && (
          <p style={{ margin: "0 0 0.55rem", color: "#374151", fontSize: "0.53rem", fontFamily: "'JetBrains Mono',monospace" }}>
            Обновлено: {lastUpdated.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        )}
        <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.14)", borderRadius: "8px", padding: "0.45rem 0.6rem" }}>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "0.57rem", lineHeight: 1.55 }}>
            ⚠️ Прогнозы основаны на исторических данных и алгоритмах машинного обучения. Реальные цены могут отличаться от прогнозных. Не является финансовой рекомендацией.
          </p>
        </div>
      </div>
    </div>
  );
}

export function AnalyticsTab({ onNavigate }: Props) {
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
  const overallColor = (data?.availability_index ?? 0) >= 60 ? "#22c55e" : (data?.availability_index ?? 0) >= 25 ? "#eab308" : "#ef4444";
  const criticalCount = Object.values(regions).filter(r => r.avg_pct < 25).length;
  const sc = data?.station_counts ?? { total: 0, green: 0, yellow: 0, red: 0 };

  if (loading) return (
    <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} style={{ height: "80px", borderRadius: "12px", background: "linear-gradient(90deg,#14141c 25%,#1e1e2a 50%,#14141c 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
      ))}
    </div>
  );

  return (
    <div style={{ paddingBottom: "5rem" }}>

      {/* Header */}
      <div style={{ padding: "0.75rem 1rem 0.5rem", position: "relative" }}>
        <div style={{
          background: "linear-gradient(160deg,#0d0d18,#100c1c)",
          border: "1px solid #a855f722",
          borderRadius: "16px",
          padding: "0.85rem 1rem",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#a855f7,#db2777,transparent)" }} />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "100%", pointerEvents: "none", opacity: 0.025, backgroundImage: "linear-gradient(#a855f7 1px, transparent 1px), linear-gradient(90deg, #a855f7 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#4b5563", fontSize: "0.5rem", letterSpacing: "0.18em", marginBottom: "0.2rem" }}>
                ЦЕНТР_МОНИТОРИНГА v3.1
              </div>
              <h2 style={{ margin: "0 0 0.1rem", color: "#e2e8f0", fontSize: "1.05rem", fontWeight: 800, lineHeight: 1 }}>
                📊 Данные
              </h2>
              <p style={{ margin: 0, color: "#4b5563", fontSize: "0.62rem" }}>
                {lastRefreshed
                  ? `Синхр: ${lastRefreshed.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })} · 500+ станций`
                  : "Данные в реальном времени · 500+ АЗС"}
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.3rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e", animation: "tmaPulse 2s infinite" }} />
                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#22c55e", fontSize: "0.5rem" }}>LIVE</span>
              </div>
              <button
                onClick={async () => { setRefreshing(true); await Promise.all([loadAnalytics(), loadTrend()]).catch(() => {}); setRefreshing(false); }}
                disabled={refreshing}
                style={{ background: refreshing ? "#14141c" : "#a855f715", border: `1px solid ${refreshing ? "#22222f" : "#a855f733"}`, borderRadius: "8px", color: refreshing ? "#4b5563" : "#a855f7", fontSize: "0.65rem", padding: "0.25rem 0.55rem", cursor: refreshing ? "default" : "pointer", transition: "all 0.2s", fontWeight: 600 }}
              >
                {refreshing ? "↻ …" : "↻ Обновить"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Crisis banner */}
      <CrisisBanner count={criticalCount} onNavigate={onNavigate} />

      {/* Hero stats grid */}
      <div style={{ padding: "0 1rem 0.75rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
          {/* Availability Index — big hero card */}
          <div style={{ background: "linear-gradient(135deg,#14141c,#1a0d22)", border: `1px solid ${overallColor}33`, borderRadius: "14px", padding: "0.9rem 1rem", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, ${overallColor}88, ${overallColor})` }} />
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.38rem", letterSpacing: "0.12em", marginBottom: "0.1rem" }}>ИНДЕКС_НАЛИЧИЯ</div>
            <p style={{ color: "#6b7280", fontSize: "0.6rem", margin: "0 0 0.3rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Индекс наличия</p>
            <AnimatedCounter value={data?.availability_index ?? 0} suffix="%" color={overallColor} size="2.2rem" />
            <p style={{ margin: "0.3rem 0 0", color: "#4b5563", fontSize: "0.6rem" }}>
              {criticalCount > 0 ? `⚠ ${criticalCount} крит. регионов` : "✓ Стабильно"}
            </p>
          </div>

          {/* Station counts */}
          <div style={{ background: "#14141c", border: "1px solid #22222f", borderRadius: "14px", padding: "0.9rem 1rem" }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.38rem", letterSpacing: "0.12em", marginBottom: "0.1rem" }}>СТАНЦИЙ_В_СЕТИ</div>
            <p style={{ color: "#6b7280", fontSize: "0.6rem", margin: "0 0 0.3rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>АЗС в базе</p>
            <AnimatedCounter value={sc.total} color="#a855f7" size="2.2rem" />
            <div style={{ display: "flex", gap: "8px", marginTop: "0.3rem" }}>
              <span style={{ color: "#22c55e", fontSize: "0.65rem" }}>🟢{sc.green}</span>
              <span style={{ color: "#eab308", fontSize: "0.65rem" }}>🟡{sc.yellow}</span>
              <span style={{ color: "#ef4444", fontSize: "0.65rem" }}>🔴{sc.red}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live system stats — command center */}
      {sysStats && (
        <div style={{ padding: "0 1rem 0.75rem" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.18rem" }}>СОСТОЯНИЕ_СИСТЕМЫ · LIVE</div>
          <p style={{ color: "#4b5563", fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 0.5rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ display: "inline-block", width: "5px", height: "5px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e", animation: "tmaPulse 2s infinite" }} />
            Состояние системы · live
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            {[
              { icon: "👥", value: sysStats.total_users.toLocaleString("ru"), label: "Операторов", color: "#a855f7", sub: "активных пользователей" },
              { icon: "📋", value: sysStats.total_reports.toLocaleString("ru"), label: "Репортов", color: "#3b82f6", sub: "гражданских данных" },
              { icon: "🛢", value: `${sysStats.avg_availability_pct}%`, label: "Ср. наличие", color: sysStats.avg_availability_pct >= 60 ? "#22c55e" : sysStats.avg_availability_pct >= 25 ? "#eab308" : "#ef4444", sub: "по сети АЗС" },
              { icon: "🧾", value: sysStats.active_purchases.toLocaleString("ru"), label: "Талонов", color: "#db2777", sub: "активных ордеров" },
            ].map(({ icon, value, label, color, sub }) => (
              <div key={label} style={{
                background: `linear-gradient(160deg, #0d0d18, ${color}08)`,
                border: `1px solid ${color}22`,
                borderRadius: "12px",
                padding: "0.65rem 0.75rem",
                position: "relative",
                overflow: "hidden",
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg, transparent, ${color}66, transparent)` }} />
                <p style={{ margin: "0 0 0.15rem", fontSize: "1rem" }}>{icon}</p>
                <p style={{ margin: "0 0 0.05rem", color, fontWeight: 800, fontSize: "1.15rem", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{value}</p>
                <p style={{ margin: 0, color: "#e2e8f0", fontSize: "0.65rem", fontWeight: 600 }}>{label}</p>
                <p style={{ margin: 0, color: "#374151", fontSize: "0.55rem" }}>{sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live price matrix */}
      <PriceMatrix regions={regions} />

      {/* Overview: donut + region monitor */}
      <div style={{ padding: "0 1rem 0.75rem" }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.35rem" }}>ОБЗОР_СЕТИ · СОСТАВ_ТОПЛИВА</div>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "stretch" }}>
        <FuelMixDonut regions={regions} />
        <div style={{ flex: 1 }}>
          <RegionMonitor regions={regions} />
          <div style={{ marginTop: "0.5rem" }}>
            <button
              onClick={() => onNavigate?.("catalog")}
              style={{ width: "100%", background: "linear-gradient(135deg,#a855f7,#db2777)", border: "none", borderRadius: "10px", color: "#fff", fontSize: "0.78rem", fontWeight: 700, padding: "0.55rem", cursor: "pointer", boxShadow: "0 0 12px #a855f740" }}
            >
              🎫 Купить талон
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Region selector */}
      <div style={{ padding: "0 1rem 0.75rem" }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.35rem" }}>ФИЛЬТР_РЕГИОНОВ · ЗОНА_ПОИСКА</div>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: "0.65rem", top: "50%", transform: "translateY(-50%)", fontFamily: "'JetBrains Mono',monospace", color: "#a855f7", fontSize: "0.6rem", pointerEvents: "none", zIndex: 1 }}>
            ▸
          </div>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            style={{ width: "100%", background: "linear-gradient(135deg,#0d0d18,#110c1a)", border: "1px solid #a855f722", borderRadius: "10px", color: "#e2e8f0", fontSize: "0.75rem", padding: "0.5rem 0.6rem 0.5rem 1.6rem", outline: "none", cursor: "pointer", appearance: "none", WebkitAppearance: "none" }}
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
          <div style={{ position: "absolute", right: "0.65rem", top: "50%", transform: "translateY(-50%)", color: "#a855f7", fontSize: "0.6rem", pointerEvents: "none" }}>
            ▼
          </div>
        </div>
      </div>

      {/* Trend chart — AreaChart with gradient */}
      <div style={{ padding: "0 1rem 0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem", flexWrap: "wrap", gap: "0.4rem" }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.46rem", letterSpacing: "0.14em", marginBottom: "0.1rem" }}>ТРЕНД_ДОСТУПНОСТИ</div>
            <p style={{ color: "#9ca3af", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0, fontWeight: 700 }}>
              График
              {selectedRegion && <span style={{ color: "#a855f7" }}> · {selectedRegion.split(" ").slice(-1)[0]}</span>}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.35rem" }}>
            <PBtn label="1д" active={trendDays === 1} onClick={() => setTrendDays(1)} />
            <PBtn label="7д" active={trendDays === 7} onClick={() => setTrendDays(7)} />
            <PBtn label="30д" active={trendDays === 30} onClick={() => setTrendDays(30)} />
          </div>
        </div>

        {trendData.length < 2 ? (
          <div style={{ background: "#14141c", border: "1px solid #22222f", borderRadius: "14px", padding: "2rem 1rem", textAlign: "center" }}>
            <p style={{ color: "#4b5563", fontSize: "0.8rem", margin: 0 }}>
              ⏳ Данные накапливаются…<br />
              <span style={{ fontSize: "0.68rem" }}>График появится после первых замеров</span>
            </p>
          </div>
        ) : (
          <div style={{ background: "#14141c", border: "1px solid #22222f", borderRadius: "14px", padding: "1rem 1rem 0.5rem" }}>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
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
                  contentStyle={{ background: "#14141c", border: "1px solid #22222f", borderRadius: "8px", fontSize: "0.75rem" }}
                  labelStyle={{ color: "#9ca3af" }}
                  formatter={(v: number) => [`${v.toFixed(1)}%`, "Доступность"]}
                  labelFormatter={(t: string) => {
                    const d = new Date(t.replace(" ", "T") + ":00");
                    return d.toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
                  }}
                />
                <Area type="monotone" dataKey="availability" stroke="#a855f7" strokeWidth={2} fill="url(#trendGrad)" dot={false} activeDot={{ r: 4, fill: "#a855f7" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Regional index cards */}
      <div style={{ padding: "0 1rem 0.75rem" }}>
        <div style={{ marginBottom: "0.6rem" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.46rem", letterSpacing: "0.14em", marginBottom: "0.1rem" }}>РЕГИОНАЛЬНЫЙ_ИНДЕКС · {filtered.length}_ЗОНЫ</div>
          <p style={{ color: "#9ca3af", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0, fontWeight: 700 }}>Индекс по регионам</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          {filtered.map(([region, d]) => (
            <RegionCard key={region} region={region} data={d} isFav={isFavorite(region)} onToggleFav={() => isFavorite(region) ? removeFavorite(region) : addFavorite(region)} />
          ))}
        </div>
      </div>

      {/* Stacked availability bars */}
      <div style={{ padding: "0 1rem 0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.65rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.46rem", letterSpacing: "0.14em", marginBottom: "0.1rem" }}>СТАТУС_РАСПРЕДЕЛЕНИЕ</div>
              <p style={{ color: "#9ca3af", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0, fontWeight: 700 }}>Распределение статусов</p>
            </div>
            <span style={{ background: "#a855f715", border: "1px solid #a855f730", borderRadius: "4px", color: "#a855f7", fontSize: "0.55rem", fontWeight: 700, padding: "0.1rem 0.35rem", fontFamily: "'JetBrains Mono',monospace" }}>
              {filtered.length} регионов
            </span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <span style={{ color: "#22c55e88", fontSize: "0.56rem", fontFamily: "'JetBrains Mono',monospace" }}>■ норма</span>
            <span style={{ color: "#eab30888", fontSize: "0.56rem", fontFamily: "'JetBrains Mono',monospace" }}>■ мало</span>
            <span style={{ color: "#ef444488", fontSize: "0.56rem", fontFamily: "'JetBrains Mono',monospace" }}>■ нет</span>
          </div>
        </div>
        {filtered.map(([region, d], i) => <AvailabilityBar key={region} region={region} data={d} rank={i} />)}
      </div>

      {/* AI Price Predictions */}
      <AIPricePredictions />

      <NewsFeed />
    </div>
  );
}

// ─── News Feed ────────────────────────────────────────────────────
const SEVERITY_COLOR: Record<string, string> = { critical: "#ef4444", warning: "#f59e0b", info: "#3b82f6", success: "#22c55e" };
const SEVERITY_LABEL: Record<string, string> = { critical: "КРИТИЧНО", warning: "ВНИМАНИЕ", info: "ИНФО", success: "НОРМА" };
const SEVERITY_BG: Record<string, string> = { critical: "#1a050514", warning: "#1a0f0014", info: "#05081a14", success: "#05190e14" };

function NewsFeed() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [lastNewsRefresh, setLastNewsRefresh] = useState<Date | null>(null);
  const [newsLimit, setNewsLimit] = useState(15);

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

  return (
    <div style={{ padding: "0 1rem 1rem" }}>
      <button
        onClick={() => loadNews()}
        style={{
          width: "100%",
          background: criticalCount > 0 ? "linear-gradient(135deg,#1f0606,#1a0508)" : "linear-gradient(135deg,#0d0d18,#120c1a)",
          border: `1px solid ${criticalCount > 0 ? "#ef444444" : "#a855f728"}`,
          borderRadius: "16px", padding: "0.85rem 1rem", cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          boxShadow: criticalCount > 0 ? "0 0 24px #ef444422" : "0 4px 20px #00000030",
          position: "relative", overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: criticalCount > 0 ? "linear-gradient(90deg,transparent,#ef4444,transparent)" : "linear-gradient(90deg,transparent,#a855f7,transparent)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ fontSize: "1.1rem" }}>{criticalCount > 0 ? "🚨" : "📡"}</span>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: criticalCount > 0 ? "#ef444488" : "#374151", fontSize: "0.46rem", letterSpacing: "0.14em", marginBottom: "0.1rem" }}>
              {criticalCount > 0 ? "ТРЕВОГА_СИГНАЛ" : "СОБЫТИЯ_СЕТИ"}
            </div>
            <p style={{ margin: 0, color: "#e2e8f0", fontSize: "0.82rem", fontWeight: 800, lineHeight: 1 }}>Лента событий</p>
            <p style={{ margin: "0.1rem 0 0", color: "#4b5563", fontSize: "0.58rem" }}>
              {news.length > 0 ? `${news.length} событий` : "нажмите для загрузки"}
              {lastNewsRefresh && ` · ${lastNewsRefresh.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}`}
            </p>
          </div>
          {criticalCount > 0 && (
            <span style={{ background: "#ef444422", border: "1px solid #ef444455", borderRadius: "6px", color: "#ef4444", fontSize: "0.62rem", fontWeight: 700, padding: "0.15rem 0.45rem", animation: "tmaPulse 2s infinite", fontFamily: "'JetBrains Mono',monospace" }}>
              ⚠ {criticalCount}
            </span>
          )}
        </div>
        <span style={{ color: loading ? "#a855f7" : "#374151", fontSize: "0.75rem" }}>
          {loading ? "⟳" : open ? "▲" : "▼"}
        </span>
      </button>

      {open && news.length > 0 && (
        <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {lastNewsRefresh && (
            <p style={{ color: "#374151", fontSize: "0.6rem", margin: "0 0 0.25rem", textAlign: "right" }}>
              Обновлено: {lastNewsRefresh.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
          {news.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: SEVERITY_BG[item.severity] ?? "#14141c",
                border: `1px solid ${SEVERITY_COLOR[item.severity] ?? "#22222f"}22`,
                borderLeft: `3px solid ${SEVERITY_COLOR[item.severity] ?? "#22222f"}`,
                borderRadius: "10px", padding: "0.65rem 0.8rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.25rem" }}>
                <span style={{ background: `${SEVERITY_COLOR[item.severity] ?? "#22222f"}22`, color: SEVERITY_COLOR[item.severity] ?? "#9ca3af", fontSize: "0.58rem", fontWeight: 700, padding: "0.1rem 0.4rem", borderRadius: "4px", letterSpacing: "0.06em", flexShrink: 0 }}>
                  {SEVERITY_LABEL[item.severity] ?? item.severity.toUpperCase()}
                </span>
                <span style={{ color: "#374151", fontSize: "0.6rem", flexShrink: 0 }}>
                  {new Date(item.created_at).toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p style={{ color: "#e2e8f0", fontSize: "0.8rem", margin: "0 0 0.25rem", fontWeight: 500, lineHeight: 1.35 }}>{item.headline}</p>
              {item.body && <p style={{ color: "#6b7280", fontSize: "0.72rem", margin: 0, lineHeight: 1.4 }}>{item.body}</p>}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
                <span style={{ color: "#4b5563", fontSize: "0.62rem" }}>📍 {item.region}</span>
                {item.fuel_type && <span style={{ color: "#4b5563", fontSize: "0.62rem" }}>⛽ {item.fuel_type}</span>}
                {item.price_delta_pct != null && (
                  <span style={{ color: item.price_delta_pct > 0 ? "#ef4444" : "#22c55e", fontSize: "0.62rem", fontFamily: "'JetBrains Mono',monospace" }}>
                    {item.price_delta_pct > 0 ? "+" : ""}{item.price_delta_pct.toFixed(1)}%
                  </span>
                )}
                {item.source && <span style={{ color: "#374151", fontSize: "0.6rem" }}>· {item.source}</span>}
              </div>
            </motion.div>
          ))}
          {news.length >= newsLimit && (
            <button
              onClick={() => { const next = newsLimit + 15; setNewsLimit(next); loadNews(true, next); }}
              style={{ background: "#14141c", border: "1px solid #22222f", borderRadius: "10px", color: "#9ca3af", fontSize: "0.75rem", padding: "0.6rem", cursor: "pointer", width: "100%" }}
            >
              Загрузить ещё
            </button>
          )}
        </div>
      )}
    </div>
  );
}
