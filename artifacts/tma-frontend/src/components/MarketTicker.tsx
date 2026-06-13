import { useEffect, useRef, useState } from "react";
import { usePriceStore } from "@/stores/usePriceStore";
import { fetchNews } from "@/api/client";
import type { NewsItem } from "@/types";

const FUEL_SHORT: Record<string, string> = {
  "АИ-92": "92", "АИ-95": "95", "АИ-95+": "95+", "АИ-100": "100", "ДТ": "ДТ", "ДТ+": "ДТ+", "Газ": "LPG",
};

const SEV_COLOR: Record<string, string> = {
  critical: "#ef4444", warning: "#f59e0b", success: "#22c55e", info: "#3b82f6",
};

export function MarketTicker() {
  const prices = usePriceStore((s) => s.prices);
  const connected = usePriceStore((s) => s.connected);
  const [news, setNews] = useState<NewsItem[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNews(undefined, 20).then(setNews).catch(() => {});
  }, []);

  // Build ticker items from prices (crisis regions first) + news headlines
  const tickerItems: { text: string; color: string }[] = [];

  // Price items — show regions sorted by cheapest (crisis) first
  const regions = Object.entries(prices);
  if (regions.length > 0) {
    const regionsSorted = regions
      .map(([region, fuels]) => {
        const ai92 = fuels["АИ-92"];
        return { region, fuels, stress: ai92?.multiplier ?? 1.0 };
      })
      .sort((a, b) => b.stress - a.stress)
      .slice(0, 8);

    for (const { region, fuels, stress } of regionsSorted) {
      const shortRegion = region.split(" ").slice(-1)[0].slice(0, 10);
      for (const [ft, price] of Object.entries(fuels)) {
        const p = price as { effective: number; multiplier: number; is_crisis: boolean };
        if (!["АИ-92", "АИ-95", "ДТ"].includes(ft)) continue;
        const arrow = p.multiplier > 1.05 ? "▲" : p.multiplier < 0.97 ? "▼" : "—";
        const color = p.is_crisis ? "#ef4444" : p.multiplier > 1.05 ? "#f59e0b" : "#22c55e";
        const deltaPct = ((p.multiplier - 1) * 100).toFixed(1);
        tickerItems.push({
          text: `${FUEL_SHORT[ft] ?? ft} ${shortRegion} ${p.effective.toFixed(0)}₽ ${arrow}${Math.abs(Number(deltaPct))}%`,
          color: stress > 1.1 ? "#ef4444" : color,
        });
      }
    }
  }

  // News items
  for (const item of news.slice(0, 12)) {
    const shortRegion = item.region.split(" ").slice(-1)[0].slice(0, 12);
    tickerItems.push({
      text: `${shortRegion}: ${item.headline.slice(0, 48)}`,
      color: SEV_COLOR[item.severity] ?? "#9ca3af",
    });
  }

  // Fallback
  if (tickerItems.length === 0) {
    for (const label of ["АИ-92 ···", "АИ-95 ···", "ДТ ···"]) {
      tickerItems.push({ text: label, color: "#4b5563" });
    }
  }

  // Duplicate for seamless loop
  const items = [...tickerItems, ...tickerItems];

  return (
    <div style={{
      background: "#0a0a0e",
      borderBottom: "1px solid #1e1e2a",
      height: "28px",
      overflow: "hidden",
      position: "relative",
      display: "flex",
      alignItems: "center",
    }}>
      <style>{`
        @keyframes tickerScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      {/* Live dot */}
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", gap: "4px",
        padding: "0 8px 0 10px",
        borderRight: "1px solid #1e1e2a",
        height: "100%",
        background: "#0a0a0e",
        zIndex: 2,
        position: "relative",
      }}>
        <div style={{
          width: "6px", height: "6px", borderRadius: "50%",
          background: connected ? "#22c55e" : "#4b5563",
          boxShadow: connected ? "0 0 6px #22c55e" : "none",
          animation: connected ? "tmaPulse 1.5s infinite" : "none",
        }} />
        <span style={{ color: "#4b5563", fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          LIVE
        </span>
      </div>

      {/* Scrolling track */}
      <div style={{ flex: 1, overflow: "hidden", height: "100%", display: "flex", alignItems: "center" }}>
        <div
          ref={trackRef}
          style={{
            display: "flex", alignItems: "center", gap: "0",
            whiteSpace: "nowrap",
            animation: `tickerScroll ${Math.max(20, items.length * 3)}s linear infinite`,
            willChange: "transform",
          }}
        >
          {items.map((item, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.65rem",
                color: item.color,
                padding: "0 14px",
                letterSpacing: "0.03em",
              }}>
                {item.text}
              </span>
              <span style={{ color: "#1e1e2a", fontSize: "0.7rem" }}>◆</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
