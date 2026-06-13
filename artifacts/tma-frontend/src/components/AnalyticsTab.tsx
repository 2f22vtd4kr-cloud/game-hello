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
        background: "linear-gradient(135deg, #1a0505, #1f0a0a)",
        border: "1px solid #ef444444",
        borderRadius: "12px",
        padding: "0.65rem 0.9rem",
        display: "flex", alignItems: "center", gap: "0.75rem",
      }}>
        <div style={{
          width: "10px", height: "10px", borderRadius: "50%", flexShrink: 0,
          background: "#ef4444",
          boxShadow: "0 0 12px #ef4444",
          animation: "crisisPulse 1s infinite",
        }} />
        <div style={{ flex: 1 }}>
          <span style={{ color: "#ef4444", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.04em" }}>
            КРИТИЧЕСКИЙ ДЕФИЦИТ
          </span>
          <span style={{ color: "#9ca3af", fontSize: "0.72rem", marginLeft: "0.5rem" }}>
            {count} {count === 1 ? "регион" : count < 5 ? "региона" : "регионов"} ниже 25%
          </span>
        </div>
        <button
          onClick={() => onNavigate?.("catalog")}
          style={{
            background: "#ef444422", border: "1px solid #ef444444", borderRadius: "8px",
            color: "#ef4444", fontSize: "0.7rem", fontWeight: 700, padding: "0.3rem 0.6rem",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          Купить →
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
    .slice(0, 5)
    .map(([r]) => r);

  if (!crisisRegions.length || !Object.keys(prices).length) return null;

  return (
    <div style={{ padding: "0 1rem 0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
        <p style={{ color: "#9ca3af", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
          Матрица цен
        </p>
        <span style={{ color: "#4b5563", fontSize: "0.62rem" }}>· критич. регионы</span>
      </div>

      <div style={{ background: "#0b0b0f", border: "1px solid #1e1e2a", borderRadius: "12px", overflow: "hidden" }}>
        {/* Header row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(3, 72px)", background: "#14141c", borderBottom: "1px solid #1e1e2a" }}>
          <div style={{ padding: "0.4rem 0.6rem", color: "#4b5563", fontSize: "0.6rem", textTransform: "uppercase" }}>Регион</div>
          {FUELS.map((f, i) => (
            <div key={f} style={{ padding: "0.4rem 0.4rem", color: FUEL_COLORS[i], fontSize: "0.62rem", fontWeight: 700, textAlign: "center" }}>{f}</div>
          ))}
        </div>

        {crisisRegions.map((region, ri) => {
          const regionPrices = prices[region] ?? {};
          const supply = regions[region];
          const isCritical = supply?.avg_pct < 25;
          return (
            <div
              key={region}
              style={{
                display: "grid", gridTemplateColumns: "1fr repeat(3, 72px)",
                borderBottom: ri < crisisRegions.length - 1 ? "1px solid #1a1a22" : "none",
                background: isCritical ? "#1a050516" : "transparent",
              }}
            >
              <div style={{ padding: "0.45rem 0.6rem", overflow: "hidden" }}>
                <div style={{ color: isCritical ? "#ef4444" : "#e2e8f0", fontSize: "0.68rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {region.split(" ").slice(-1)[0].slice(0, 14)}
                </div>
                <div style={{ color: "#4b5563", fontSize: "0.6rem", marginTop: "1px" }}>
                  {supply?.avg_pct ?? "—"}% · {supply?.count ?? "—"} АЗС
                </div>
              </div>
              {FUELS.map((f) => {
                const p = regionPrices[f] as { effective: number; multiplier: number; is_crisis: boolean } | undefined;
                const isCrisisPrice = p?.is_crisis;
                const up = (p?.multiplier ?? 1) > 1.03;
                return (
                  <div key={f} style={{ padding: "0.45rem 0.4rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    {p ? (
                      <>
                        <span style={{
                          fontFamily: "'JetBrains Mono',monospace",
                          fontSize: "0.78rem", fontWeight: 700,
                          color: isCrisisPrice ? "#ef4444" : up ? "#f59e0b" : "#22c55e",
                        }}>
                          {p.effective.toFixed(0)}₽
                        </span>
                        {p.multiplier !== 1 && (
                          <span style={{ fontSize: "0.55rem", color: isCrisisPrice ? "#ef444488" : "#4b5563" }}>
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
  const trendColor = data.avg_pct >= 60 ? "#22c55e" : data.avg_pct >= 25 ? "#eab308" : "#ef4444";
  return (
    <motion.div whileTap={{ scale: 0.97 }} style={{ background: "#14141c", border: `1px solid ${isFav ? "#a855f730" : data.avg_pct < 25 ? "#ef444422" : "#22222f"}`, borderRadius: "14px", padding: "0.85rem", position: "relative", overflow: "hidden" }}>
      {data.avg_pct < 25 && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(90deg, #ef4444, #dc2626)" }} />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <p style={{ color: "#9ca3af", fontSize: "0.64rem", margin: "0 0 0.3rem", textTransform: "uppercase", letterSpacing: "0.04em", flex: 1, lineHeight: 1.3 }}>
          {region.length > 22 ? region.slice(0, 22) + "…" : region}
        </p>
        <button onClick={onToggleFav} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem", padding: "0", marginLeft: "0.25rem", opacity: isFav ? 1 : 0.35, transition: "opacity 0.2s", lineHeight: 1, flexShrink: 0 }}>
          {isFav ? "⭐" : "☆"}
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.3rem" }}>
        <AnimatedCounter value={data.avg_pct} suffix="%" color={color} size="1.8rem" />
        <span style={{ fontSize: "1rem", color: trendColor, fontWeight: 700 }}>{trend}</span>
      </div>
      <div style={{ height: "4px", borderRadius: "2px", overflow: "hidden", background: "#0b0b0f", display: "flex", marginTop: "0.4rem" }}>
        <div style={{ width: `${gP}%`, background: "#22c55e", transition: "width 0.8s" }} />
        <div style={{ width: `${yP}%`, background: "#eab308", transition: "width 0.8s" }} />
        <div style={{ width: `${rP}%`, background: "#ef4444", transition: "width 0.8s" }} />
      </div>
      <div style={{ display: "flex", gap: "6px", marginTop: "0.4rem" }}>
        {[["🟢", data.green], ["🟡", data.yellow], ["🔴", data.red]].map(([emoji, v]) => (
          <span key={String(emoji)} style={{ color: "#4b5563", fontSize: "0.58rem" }}>{emoji} {v}</span>
        ))}
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
function AvailabilityBar({ region, data }: { region: string; data: RegionalSupply }) {
  const total = data.green + data.yellow + data.red;
  if (!total) return null;
  const gP = (data.green / total) * 100;
  const yP = (data.yellow / total) * 100;
  const rP = (data.red / total) * 100;
  return (
    <div style={{ marginBottom: "0.65rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
        <span style={{ color: "#9ca3af", fontSize: "0.72rem" }}>{region.length > 28 ? region.slice(0, 28) + "…" : region}</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.72rem", color: data.avg_pct >= 60 ? "#22c55e" : data.avg_pct >= 25 ? "#eab308" : "#ef4444" }}>{data.avg_pct}%</span>
          <span style={{ color: "#4b5563", fontSize: "0.62rem" }}>{data.count} АЗС</span>
        </div>
      </div>
      <div style={{ height: "7px", borderRadius: "3.5px", overflow: "hidden", background: "#0b0b0f", display: "flex" }}>
        <div style={{ width: `${gP}%`, background: "linear-gradient(90deg,#16a34a,#22c55e)", transition: "width 0.8s" }} />
        <div style={{ width: `${yP}%`, background: "linear-gradient(90deg,#ca8a04,#eab308)", transition: "width 0.8s" }} />
        <div style={{ width: `${rP}%`, background: "linear-gradient(90deg,#dc2626,#ef4444)", transition: "width 0.8s" }} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
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
      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes tmaPulse{0%,100%{opacity:1}50%{opacity:0.35}}
        @keyframes crisisPulse{0%,100%{opacity:1;box-shadow:0 0 12px #ef4444}50%{opacity:0.6;box-shadow:0 0 4px #ef4444}}
      `}</style>

      {/* Header */}
      <div style={{ padding: "1rem 1rem 0.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ margin: "0 0 0.1rem", color: "#e2e8f0", fontSize: "1.1rem", fontWeight: 700 }}>
            📊 Центр мониторинга
          </h2>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "0.72rem" }}>
            {lastRefreshed
              ? `Обновлено: ${lastRefreshed.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}`
              : "Матрица снабжения · в реальном времени"}
          </p>
        </div>
        <button
          onClick={async () => { setRefreshing(true); await Promise.all([loadAnalytics(), loadTrend()]).catch(() => {}); setRefreshing(false); }}
          disabled={refreshing}
          style={{ background: refreshing ? "#14141c" : "rgba(168,85,247,0.15)", border: "1px solid #a855f733", borderRadius: "8px", color: refreshing ? "#4b5563" : "#a855f7", fontSize: "0.72rem", padding: "0.3rem 0.6rem", cursor: refreshing ? "default" : "pointer", transition: "all 0.2s", flexShrink: 0, marginLeft: "0.5rem" }}
        >
          {refreshing ? "↻ …" : "↻ Обновить"}
        </button>
      </div>

      {/* Crisis banner */}
      <CrisisBanner count={criticalCount} onNavigate={onNavigate} />

      {/* Hero stats grid */}
      <div style={{ padding: "0 1rem 0.75rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
          {/* Availability Index — big hero card */}
          <div style={{ background: "linear-gradient(135deg,#14141c,#1a0d22)", border: `1px solid ${overallColor}33`, borderRadius: "14px", padding: "0.9rem 1rem", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, ${overallColor}88, ${overallColor})` }} />
            <p style={{ color: "#6b7280", fontSize: "0.6rem", margin: "0 0 0.3rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Индекс наличия</p>
            <AnimatedCounter value={data?.availability_index ?? 0} suffix="%" color={overallColor} size="2.2rem" />
            <p style={{ margin: "0.3rem 0 0", color: "#4b5563", fontSize: "0.6rem" }}>
              {criticalCount > 0 ? `⚠ ${criticalCount} крит. регионов` : "✓ Стабильно"}
            </p>
          </div>

          {/* Station counts */}
          <div style={{ background: "#14141c", border: "1px solid #22222f", borderRadius: "14px", padding: "0.9rem 1rem" }}>
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

      {/* Live system stats */}
      {sysStats && (
        <div style={{ padding: "0 1rem 0.75rem" }}>
          <div style={{ background: "#0b0b0f", border: "1px solid #1a1a24", borderRadius: "12px", padding: "0.6rem 0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {[
              { icon: "👥", value: sysStats.total_users, label: "Юзеров" },
              { icon: "📋", value: sysStats.total_reports, label: "Репортов" },
              { icon: "📡", value: sysStats.total_news, label: "Новостей" },
              { icon: "⛽", value: `${sysStats.avg_availability_pct}%`, label: "Ср. наличие" },
            ].map(({ icon, value, label }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <p style={{ margin: 0, color: "#a855f7", fontSize: "0.85rem", fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{icon} {value}</p>
                <p style={{ margin: 0, color: "#374151", fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live price matrix */}
      <PriceMatrix regions={regions} />

      {/* Overview: donut + region monitor */}
      <div style={{ padding: "0 1rem 0.75rem", display: "flex", gap: "0.75rem", alignItems: "stretch" }}>
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

      {/* Region selector */}
      <div style={{ padding: "0 1rem 0.75rem" }}>
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          style={{ width: "100%", background: "#14141c", border: "1px solid #22222f", borderRadius: "10px", color: "#e2e8f0", fontSize: "0.75rem", padding: "0.45rem 0.6rem", outline: "none", cursor: "pointer" }}
        >
          <option value="">Все регионы</option>
          {Object.keys(regions).sort().map((r) => (
            <option key={r} value={r}>{r.length > 32 ? r.slice(0, 32) + "…" : r}</option>
          ))}
        </select>
      </div>

      {/* Trend chart — AreaChart with gradient */}
      <div style={{ padding: "0 1rem 0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem", flexWrap: "wrap", gap: "0.4rem" }}>
          <p style={{ color: "#9ca3af", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
            Тренд доступности
            {selectedRegion && <span style={{ color: "#a855f7" }}> · {selectedRegion.split(" ").slice(-1)[0]}</span>}
          </p>
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
        <p style={{ color: "#9ca3af", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.6rem" }}>Индекс по регионам</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          {filtered.map(([region, d]) => (
            <RegionCard key={region} region={region} data={d} isFav={isFavorite(region)} onToggleFav={() => isFavorite(region) ? removeFavorite(region) : addFavorite(region)} />
          ))}
        </div>
      </div>

      {/* Stacked availability bars */}
      <div style={{ padding: "0 1rem 0.5rem" }}>
        <p style={{ color: "#9ca3af", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.75rem" }}>Распределение статусов</p>
        {filtered.map(([region, d]) => <AvailabilityBar key={region} region={region} data={d} />)}
      </div>

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
        style={{ width: "100%", background: "transparent", border: "1px solid #22222f", borderRadius: "12px", padding: "0.75rem 1rem", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "#9ca3af", fontSize: "0.78rem", fontWeight: 600 }}>📡 Лента событий</span>
          {criticalCount > 0 && (
            <span style={{ background: "#ef444422", border: "1px solid #ef444433", borderRadius: "6px", color: "#ef4444", fontSize: "0.62rem", fontWeight: 700, padding: "0.1rem 0.4rem" }}>
              {criticalCount} крит
            </span>
          )}
        </div>
        <span style={{ color: loading ? "#a855f7" : "#6b7280", fontSize: "0.75rem" }}>
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
