import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";
import { fetchAnalytics } from "@/api/client";
import type { Analytics } from "@/types";

function Skeleton() {
  return (
    <div style={{
      background: "linear-gradient(90deg,#14141c 25%,#1e1e2a 50%,#14141c 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
      borderRadius: "12px",
      height: "120px",
    }} />
  );
}

function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      style={{
        background: "#14141c",
        border: "1px solid #22222f",
        borderRadius: "14px",
        padding: "0.85rem",
        flex: 1,
        minWidth: "0",
      }}
    >
      <p style={{ color: "#6b7280", fontSize: "0.68rem", margin: "0 0 0.3rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </p>
      <p style={{
        margin: 0, fontSize: "1.5rem", fontWeight: 700,
        color: color ?? "#e2e8f0",
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {value}
      </p>
      {sub && <p style={{ color: "#4b5563", fontSize: "0.7rem", margin: "0.2rem 0 0" }}>{sub}</p>}
    </motion.div>
  );
}

function AvailabilityBar({ region, data }: { region: string; data: { green: number; yellow: number; red: number; avg_pct: number; count: number } }) {
  const total = data.green + data.yellow + data.red;
  if (!total) return null;
  const gPct = (data.green / total) * 100;
  const yPct = (data.yellow / total) * 100;
  const rPct = (data.red / total) * 100;

  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
        <span style={{ color: "#9ca3af", fontSize: "0.72rem" }}>
          {region.length > 28 ? region.slice(0, 28) + "…" : region}
        </span>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.72rem",
          color: data.avg_pct >= 60 ? "#22c55e" : data.avg_pct >= 25 ? "#eab308" : "#ef4444",
        }}>
          {data.avg_pct}%
        </span>
      </div>
      <div style={{ height: "6px", borderRadius: "3px", overflow: "hidden", background: "#0b0b0f", display: "flex" }}>
        <div style={{ width: `${gPct}%`, background: "#22c55e", transition: "width 0.8s" }} />
        <div style={{ width: `${yPct}%`, background: "#eab308", transition: "width 0.8s" }} />
        <div style={{ width: `${rPct}%`, background: "#ef4444", transition: "width 0.8s" }} />
      </div>
    </div>
  );
}

const REGION_CHART_COLORS = [
  "#a855f7", "#db2777", "#22c55e", "#eab308", "#3b82f6",
  "#06b6d4", "#f97316", "#ec4899", "#8b5cf6", "#14b8a6",
];

export function AnalyticsTab() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics()
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, []);

  if (loading) return (
    <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      {[1, 2, 3, 4].map((i) => <Skeleton key={i} />)}
    </div>
  );

  if (error || !data) return (
    <div style={{ padding: "2rem", textAlign: "center", color: "#ef4444" }}>
      Ошибка загрузки аналитики
    </div>
  );

  const regionBarData = Object.entries(data.regional_supply)
    .sort((a, b) => b[1].avg_pct - a[1].avg_pct)
    .slice(0, 10)
    .map(([region, d]) => ({
      name: region.length > 18 ? region.slice(0, 18) + "…" : region,
      value: d.avg_pct,
    }));

  const trendByTime: Record<string, { time: string; avg: number; count: number }> = {};
  data.trend_data.forEach((t) => {
    const key = t.time.slice(0, 16);
    if (!trendByTime[key]) trendByTime[key] = { time: key, avg: 0, count: 0 };
    trendByTime[key].avg += t.avg_availability;
    trendByTime[key].count += 1;
  });
  const trendChart = Object.values(trendByTime)
    .slice(-12)
    .map((t) => ({
      time: t.time.slice(11, 16),
      availability: Math.round(t.avg / t.count),
    }));

  return (
    <div style={{ height: "100%", overflowY: "auto", paddingBottom: "5rem" }}>
      {/* Header */}
      <div style={{ padding: "1rem 1rem 0.5rem" }}>
        <h2 style={{ margin: 0, color: "#e2e8f0", fontSize: "1.1rem", fontWeight: 700 }}>
          📊 Центр мониторинга
        </h2>
        <p style={{ margin: "0.2rem 0 0", color: "#6b7280", fontSize: "0.75rem" }}>
          Актуальные данные по всем региональным узлам
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ padding: "0.75rem 1rem", display: "flex", gap: "0.5rem" }}>
        <StatCard
          label="Индекс наличия"
          value={`${data.availability_index}%`}
          color={data.availability_index >= 60 ? "#22c55e" : data.availability_index >= 30 ? "#eab308" : "#ef4444"}
          sub="По всем регионам"
        />
        <StatCard
          label="Ценовой индекс"
          value={data.price_index.toFixed(1)}
          color="#a855f7"
          sub="Относительный"
        />
      </div>

      {/* Station counts */}
      <div style={{ padding: "0 1rem", display: "flex", gap: "0.5rem" }}>
        <StatCard label="Всего АЗС" value={data.station_counts.total} />
        <StatCard label="В наличии" value={data.station_counts.green} color="#22c55e" />
        <StatCard label="Дефицит" value={data.station_counts.red} color="#ef4444" />
      </div>

      {/* Availability trend */}
      {trendChart.length > 0 && (
        <div style={{ padding: "1rem 1rem 0" }}>
          <h3 style={{ margin: "0 0 0.75rem", color: "#9ca3af", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Тренд доступности (24ч)
          </h3>
          <div style={{
            background: "#14141c", border: "1px solid #22222f",
            borderRadius: "14px", padding: "1rem",
          }}>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={trendChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#22222f" />
                <XAxis dataKey="time" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{ background: "#0b0b0f", border: "1px solid #22222f", borderRadius: "8px", color: "#e2e8f0", fontSize: "0.78rem" }}
                  formatter={(v: number) => [`${v}%`, "Наличие"]}
                />
                <Line type="monotone" dataKey="availability" stroke="#a855f7" strokeWidth={2}
                  dot={false} activeDot={{ r: 4, fill: "#a855f7" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Regional bar chart */}
      <div style={{ padding: "1rem 1rem 0" }}>
        <h3 style={{ margin: "0 0 0.75rem", color: "#9ca3af", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Регионы — топ‑10 по наличию
        </h3>
        <div style={{
          background: "#14141c", border: "1px solid #22222f",
          borderRadius: "14px", padding: "1rem",
        }}>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={regionBarData} layout="vertical" margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#22222f" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fill: "#9ca3af", fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#0b0b0f", border: "1px solid #22222f", borderRadius: "8px", color: "#e2e8f0", fontSize: "0.78rem" }}
                formatter={(v: number) => [`${v}%`, "Наличие"]}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {regionBarData.map((_, i) => (
                  <Cell key={i} fill={REGION_CHART_COLORS[i % REGION_CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-region availability stacked bars */}
      <div style={{ padding: "1rem" }}>
        <h3 style={{ margin: "0 0 0.75rem", color: "#9ca3af", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Резервные показатели — все зоны снабжения
        </h3>
        <div style={{
          background: "#14141c", border: "1px solid #22222f",
          borderRadius: "14px", padding: "1rem",
        }}>
          {Object.entries(data.regional_supply).map(([region, d]) => (
            <AvailabilityBar key={region} region={region} data={d} />
          ))}
        </div>
      </div>

      {/* Community link */}
      <div style={{ padding: "0 1rem 1rem", textAlign: "center" }}>
        <p style={{ color: "#4b5563", fontSize: "0.7rem", margin: 0 }}>
          Система синхронизирована с внешними индексами. Официальный бот очередей:{" "}
          <a href="https://t.me/sev_fuel_ochered_bot" target="_blank"
             style={{ color: "#a855f7", textDecoration: "none" }}>
            @sev_fuel_ochered_bot
          </a>
        </p>
      </div>
    </div>
  );
}
