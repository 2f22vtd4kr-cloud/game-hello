import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { fetchAnalytics, fetchTrend } from "@/api/client";
import { useFavoritesStore } from "@/stores/useFavoritesStore";
import type { Analytics, RegionalSupply, TrendPoint, TabId } from "@/types";

interface Props {
  onNavigate?: (tab: TabId) => void;
}

// ── Region cycling monitor ─────────────────────────────────────────────────
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
    <div style={{
      background: "#0b0b0f", border: "1px solid #1e1e2a", borderRadius: "12px",
      padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem",
    }}>
      <div style={{
        width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
        background: "#a855f7", boxShadow: "0 0 8px #a855f7",
        animation: "tmaPulse 1.5s infinite",
      }} />
      <div style={{ flex: 1, minWidth: 0, transition: "opacity 0.28s", opacity: vis ? 1 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "#4b5563", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
            СКАН
          </span>
          <span style={{ color: "#e2e8f0", fontSize: "0.82rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {region}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.2rem" }}>
          <span style={{ fontSize: "0.78rem" }}>{dot}</span>
          <span style={{ color, fontFamily: "'JetBrains Mono',monospace", fontSize: "1rem", fontWeight: 700 }}>
            {data.avg_pct}%
          </span>
          <span style={{ color: "#4b5563", fontSize: "0.65rem", background: "#14141c", borderRadius: "4px", padding: "0.1rem 0.35rem" }}>
            {zoneLabel[data.zone_type] ?? data.zone_type}
          </span>
          <span style={{ color: "#4b5563", fontSize: "0.65rem" }}>{data.count} АЗС</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: "3px", flexShrink: 0 }}>
        {Array.from({ length: Math.min(entries.length, 8) }).map((_, i) => (
          <div key={i} style={{
            width: "5px", height: "5px", borderRadius: "50%",
            background: i === (idx % Math.min(entries.length, 8)) ? "#a855f7" : "#22222f",
            transition: "background 0.3s",
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Regional availability card ─────────────────────────────────────────────
function RegionCard({ region, data, isFav, onToggleFav }: {
  region: string; data: RegionalSupply; isFav: boolean; onToggleFav: () => void;
}) {
  const color = data.avg_pct >= 60 ? "#22c55e" : data.avg_pct >= 25 ? "#eab308" : "#ef4444";
  const total = data.green + data.yellow + data.red;
  const gP = total ? (data.green / total) * 100 : 0;
  const yP = total ? (data.yellow / total) * 100 : 0;
  const rP = total ? (data.red / total) * 100 : 0;

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      style={{
        background: "#14141c",
        border: `1px solid ${isFav ? "#a855f730" : "#22222f"}`,
        borderRadius: "14px", padding: "0.85rem", position: "relative", overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <p style={{ color: "#9ca3af", fontSize: "0.64rem", margin: "0 0 0.3rem", textTransform: "uppercase", letterSpacing: "0.04em", flex: 1, lineHeight: 1.3 }}>
          {region.length > 22 ? region.slice(0, 22) + "…" : region}
        </p>
        <button
          onClick={onToggleFav}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem", padding: "0", marginLeft: "0.25rem", opacity: isFav ? 1 : 0.35, transition: "opacity 0.2s", lineHeight: 1, flexShrink: 0 }}
        >
          {isFav ? "⭐" : "☆"}
        </button>
      </div>
      <p style={{ margin: "0 0 0.4rem", fontSize: "1.8rem", fontWeight: 700, color, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>
        {data.avg_pct}<span style={{ fontSize: "1rem" }}>%</span>
      </p>
      <div style={{ height: "4px", borderRadius: "2px", overflow: "hidden", background: "#0b0b0f", display: "flex" }}>
        <div style={{ width: `${gP}%`, background: "#22c55e" }} />
        <div style={{ width: `${yP}%`, background: "#eab308" }} />
        <div style={{ width: `${rP}%`, background: "#ef4444" }} />
      </div>
    </motion.div>
  );
}

// ── Period button ──────────────────────────────────────────────────────────
function PBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "linear-gradient(135deg,#a855f7,#db2777)" : "#14141c",
        border: active ? "none" : "1px solid #22222f",
        color: active ? "#fff" : "#6b7280",
        borderRadius: "8px", padding: "0.3rem 0.7rem",
        fontSize: "0.72rem", fontWeight: active ? 700 : 400,
        cursor: "pointer", transition: "all 0.2s",
      }}
    >
      {label}
    </button>
  );
}

// ── Per-region stacked bar ─────────────────────────────────────────────────
function AvailabilityBar({ region, data }: { region: string; data: RegionalSupply }) {
  const total = data.green + data.yellow + data.red;
  if (!total) return null;
  const gP = (data.green / total) * 100;
  const yP = (data.yellow / total) * 100;
  const rP = (data.red / total) * 100;
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
        <span style={{ color: "#9ca3af", fontSize: "0.72rem" }}>
          {region.length > 28 ? region.slice(0, 28) + "…" : region}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.72rem", color: data.avg_pct >= 60 ? "#22c55e" : data.avg_pct >= 25 ? "#eab308" : "#ef4444" }}>
          {data.avg_pct}%
        </span>
      </div>
      <div style={{ height: "6px", borderRadius: "3px", overflow: "hidden", background: "#0b0b0f", display: "flex" }}>
        <div style={{ width: `${gP}%`, background: "#22c55e", transition: "width 0.8s" }} />
        <div style={{ width: `${yP}%`, background: "#eab308", transition: "width 0.8s" }} />
        <div style={{ width: `${rP}%`, background: "#ef4444", transition: "width 0.8s" }} />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function AnalyticsTab({ onNavigate }: Props) {
  const [data, setData] = useState<Analytics | null>(null);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [trendDays, setTrendDays] = useState<number>(7);
  const { addFavorite, removeFavorite, isFavorite } = useFavoritesStore();

  const loadAnalytics = useCallback(async () => {
    try { setData(await fetchAnalytics()); } catch {}
  }, []);

  const loadTrend = useCallback(async () => {
    try { setTrendData(await fetchTrend(selectedRegion || undefined, trendDays)); } catch {}
  }, [selectedRegion, trendDays]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([loadAnalytics(), loadTrend()]).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload trend when region or period changes
  useEffect(() => { loadTrend(); }, [loadTrend]);

  // Poll analytics every 5 min, trend every 60 min
  useEffect(() => {
    const a = setInterval(loadAnalytics, 5 * 60 * 1000);
    const t = setInterval(loadTrend, 60 * 60 * 1000);
    return () => { clearInterval(a); clearInterval(t); };
  }, [loadAnalytics, loadTrend]);

  const regions = data?.regional_supply ?? {};
  const sorted = Object.entries(regions).sort((a, b) => b[1].avg_pct - a[1].avg_pct);
  const filtered = selectedRegion ? sorted.filter(([r]) => r === selectedRegion) : sorted;
  const overallColor = (data?.availability_index ?? 0) >= 60 ? "#22c55e" : (data?.availability_index ?? 0) >= 25 ? "#eab308" : "#ef4444";

  if (loading) return (
    <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ height: "80px", borderRadius: "12px", background: "linear-gradient(90deg,#14141c 25%,#1e1e2a 50%,#14141c 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
      ))}
    </div>
  );

  return (
    <div style={{ paddingBottom: "5rem" }}>
      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes tmaPulse{0%,100%{opacity:1}50%{opacity:0.35}}
      `}</style>

      {/* Header */}
      <div style={{ padding: "1rem 1rem 0.5rem" }}>
        <h2 style={{ margin: "0 0 0.1rem", color: "#e2e8f0", fontSize: "1.1rem", fontWeight: 700 }}>
          📊 Центр мониторинга
        </h2>
        <p style={{ margin: 0, color: "#6b7280", fontSize: "0.72rem" }}>
          Матрица снабжения · в реальном времени
        </p>
      </div>

      {/* Region cycling monitor */}
      {Object.keys(regions).length > 0 && (
        <div style={{ padding: "0 1rem 0.75rem" }}>
          <RegionMonitor regions={regions} />
        </div>
      )}

      {/* Индекс наличия + Region selector */}
      <div style={{ padding: "0 1rem 0.75rem", display: "flex", gap: "0.75rem", alignItems: "stretch" }}>
        <div style={{
          background: "#14141c", border: "1px solid #22222f", borderRadius: "14px",
          padding: "0.85rem", flexShrink: 0,
          display: "flex", flexDirection: "column", justifyContent: "center",
        }}>
          <p style={{ color: "#6b7280", fontSize: "0.64rem", margin: "0 0 0.3rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Индекс наличия
          </p>
          <p style={{ margin: 0, fontSize: "2rem", fontWeight: 700, color: overallColor, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>
            {data?.availability_index ?? "—"}<span style={{ fontSize: "1rem" }}>%</span>
          </p>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            style={{
              background: "#14141c", border: "1px solid #22222f", borderRadius: "10px",
              color: "#e2e8f0", fontSize: "0.75rem", padding: "0.45rem 0.6rem",
              width: "100%", outline: "none", cursor: "pointer", flex: 1,
            }}
          >
            <option value="">Все регионы</option>
            {Object.keys(regions).sort().map((r) => (
              <option key={r} value={r}>{r.length > 32 ? r.slice(0, 32) + "…" : r}</option>
            ))}
          </select>

          <button
            onClick={() => onNavigate?.("catalog")}
            style={{
              background: "linear-gradient(135deg,#a855f7,#db2777)",
              border: "none", borderRadius: "10px", color: "#fff",
              fontSize: "0.78rem", fontWeight: 700, padding: "0.55rem",
              cursor: "pointer", boxShadow: "0 0 12px #a855f740",
            }}
          >
            🎫 Купить талон
          </button>
        </div>
      </div>

      {/* Regional index cards */}
      <div style={{ padding: "0 1rem 0.75rem" }}>
        <p style={{ color: "#9ca3af", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.6rem" }}>
          Индекс по регионам
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          {filtered.map(([region, d]) => (
            <RegionCard
              key={region}
              region={region}
              data={d}
              isFav={isFavorite(region)}
              onToggleFav={() => isFavorite(region) ? removeFavorite(region) : addFavorite(region)}
            />
          ))}
        </div>
      </div>

      {/* Trend graph */}
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
              <span style={{ fontSize: "0.68rem" }}>График появится после первых замеров (каждый час)</span>
            </p>
          </div>
        ) : (
          <div style={{ background: "#14141c", border: "1px solid #22222f", borderRadius: "14px", padding: "1rem 1rem 0.5rem" }}>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={trendData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2a" />
                <XAxis
                  dataKey="time"
                  tickFormatter={(t: string) => {
                    const d = new Date(t.replace(" ", "T") + ":00");
                    return trendDays <= 1
                      ? d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })
                      : d.toLocaleDateString("ru", { day: "numeric", month: "short" });
                  }}
                  tick={{ fill: "#4b5563", fontSize: 9 }}
                  stroke="#22222f"
                  interval="preserveStartEnd"
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
                <Line type="monotone" dataKey="availability" stroke="#a855f7" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#a855f7" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Per-region stacked bars */}
      <div style={{ padding: "0 1rem 0.5rem" }}>
        <p style={{ color: "#9ca3af", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.75rem" }}>
          Распределение статусов
        </p>
        {filtered.map(([region, d]) => (
          <AvailabilityBar key={region} region={region} data={d} />
        ))}
      </div>
    </div>
  );
}
