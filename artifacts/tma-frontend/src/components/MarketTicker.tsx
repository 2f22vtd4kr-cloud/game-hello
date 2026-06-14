import { useEffect, useRef, useState } from "react";
import { usePriceStore } from "@/stores/usePriceStore";
import { fetchNews } from "@/api/client";
import type { NewsItem } from "@/types";

const FUEL_SHORT: Record<string, string> = {
  "АИ-92": "92", "АИ-95": "95", "АИ-95+": "95+", "АИ-100": "100", "ДТ": "ДТ", "ДТ+": "ДТ+", "Газ": "LPG",
};

const SEV_COLOR: Record<string, string> = {
  critical: "#ef4444", warning: "#f59e0b", success: "#22c55e", info: "#06b6d4",
};

const SEV_ICON: Record<string, string> = {
  critical: "⚠", warning: "◈", success: "◉", info: "◆",
};

export function MarketTicker() {
  const prices = usePriceStore((s) => s.prices);
  const connected = usePriceStore((s) => s.connected);
  const [news, setNews] = useState<NewsItem[]>([]);

  useEffect(() => {
    fetchNews(undefined, 20).then(setNews).catch(() => {});
  }, []);

  // Build ticker items
  const tickerItems: { text: string; color: string; icon?: string }[] = [];

  const regions = Object.entries(prices);
  if (regions.length > 0) {
    const regionsSorted = regions
      .map(([region, fuels]) => {
        const ai92 = fuels["АИ-92"] as { multiplier?: number } | undefined;
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
        const color = p.is_crisis ? "#ef4444" : stress > 1.1 ? "#f59e0b" : p.multiplier < 0.97 ? "#22c55e" : "#6b7280";
        const deltaPct = ((p.multiplier - 1) * 100).toFixed(1);
        tickerItems.push({
          text: `${FUEL_SHORT[ft] ?? ft} ${shortRegion} ${p.effective.toFixed(0)}₽ ${arrow}${Math.abs(Number(deltaPct))}%`,
          color,
          icon: p.is_crisis ? "⚠" : undefined,
        });
      }
    }
  }

  for (const item of news.slice(0, 12)) {
    const shortRegion = item.region.split(" ").slice(-1)[0].slice(0, 10);
    tickerItems.push({
      text: `${shortRegion}: ${item.headline.slice(0, 50)}`,
      color: SEV_COLOR[item.severity] ?? "#6b7280",
      icon: SEV_ICON[item.severity],
    });
  }

  if (tickerItems.length === 0) {
    for (const label of ["АИ-92 ···", "АИ-95 ···", "ДТ ···"]) {
      tickerItems.push({ text: label, color: "#2d2d3a" });
    }
  }

  const items = [...tickerItems, ...tickerItems];
  const speed = Math.max(24, items.length * 2.8);

  return (
    <div style={{
      background: "rgba(6,6,10,0.98)",
      borderBottom: "1px solid rgba(168,85,247,0.1)",
      height: "28px",
      overflow: "hidden",
      position: "relative",
      display: "flex",
      alignItems: "center",
      backdropFilter: "blur(20px)",
    }}>
      <style>{`
        @keyframes tickerScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #22c55e; }
          50%       { opacity: 0.5; box-shadow: 0 0 2px #22c55e; }
        }
        @keyframes criticalPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #ef4444; }
          50%       { opacity: 0.5; box-shadow: 0 0 2px #ef4444; }
        }
      `}</style>

      {/* Live indicator pill */}
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", gap: "5px",
        padding: "0 10px 0 12px",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        height: "100%",
        background: "rgba(6,6,10,0.98)",
        zIndex: 2,
        position: "relative",
      }}>
        <div style={{
          width: "5px", height: "5px", borderRadius: "50%",
          background: connected ? "#22c55e" : "#374151",
          animation: connected ? "livePulse 1.4s ease-in-out infinite" : "none",
          flexShrink: 0,
        }} />
        <span style={{
          color: connected ? "#22c55e" : "#374151",
          fontSize: "0.48rem",
          fontWeight: 700,
          letterSpacing: "0.12em",
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          LIVE
        </span>
      </div>

      {/* Left fade mask */}
      <div style={{
        position: "absolute", left: "58px", top: 0, bottom: 0, width: "24px", zIndex: 1, pointerEvents: "none",
        background: "linear-gradient(90deg, rgba(6,6,10,0.98), transparent)",
      }} />

      {/* Scrolling track */}
      <div style={{ flex: 1, overflow: "hidden", height: "100%", display: "flex", alignItems: "center", position: "relative" }}>
        <div
          style={{
            display: "flex", alignItems: "center", gap: "0",
            whiteSpace: "nowrap",
            animation: `tickerScroll ${speed}s linear infinite`,
            willChange: "transform",
          }}
        >
          {items.map((item, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.62rem",
                color: item.color,
                padding: "0 12px",
                letterSpacing: "0.04em",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}>
                {item.icon && (
                  <span style={{ fontSize: "0.55rem", opacity: 0.8 }}>{item.icon}</span>
                )}
                {item.text}
              </span>
              <span style={{ color: "rgba(168,85,247,0.2)", fontSize: "0.5rem", flexShrink: 0 }}>◆</span>
            </span>
          ))}
        </div>
      </div>

      {/* Right fade mask */}
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: "24px", zIndex: 1, pointerEvents: "none",
        background: "linear-gradient(270deg, rgba(6,6,10,0.98), transparent)",
      }} />
    </div>
  );
}
