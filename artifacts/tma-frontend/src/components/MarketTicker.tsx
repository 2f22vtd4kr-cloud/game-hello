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
  const [flashIdx, setFlashIdx] = useState(-1);
  const [paused, setPaused] = useState(false);
  const prevConnected = useRef(connected);

  useEffect(() => {
    fetchNews(undefined, 20).then(setNews).catch(() => {});
  }, []);

  // Flash highlight when WS reconnects
  useEffect(() => {
    if (!prevConnected.current && connected) {
      setFlashIdx(Date.now());
      setTimeout(() => setFlashIdx(-1), 800);
    }
    prevConnected.current = connected;
  }, [connected]);

  const criticalNews = news.filter((n) => n.severity === "critical").slice(0, 1)[0];
  const newsCount = news.filter((n) => n.severity === "critical" || n.severity === "warning").length;

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
  const speed = Math.max(28, items.length * 3);

  return (
    <div style={{
      background: "rgba(6,6,10,0.99)",
      borderBottom: "1px solid rgba(168,85,247,0.18)",
      height: "40px",
      overflow: "hidden",
      position: "relative",
      display: "flex",
      alignItems: "center",
      backdropFilter: "blur(20px)",
      boxShadow: "0 2px 16px rgba(0,0,0,0.5)",
      transition: flashIdx > 0 ? "background 0.4s" : undefined,
      ...(flashIdx > 0 ? { background: "rgba(34,197,94,0.08)" } : {}),
    }}>
      <style>{`
        @keyframes tickerScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px #22c55e, 0 0 16px #22c55e44; }
          50%       { opacity: 0.5; box-shadow: 0 0 3px #22c55e; }
        }
        @keyframes offlinePulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 0.2; }
        }
      `}</style>

      {/* Live indicator pill */}
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", gap: "5px",
        padding: "0 10px 0 12px",
        borderRight: "1px solid rgba(255,255,255,0.07)",
        height: "100%",
        background: "rgba(6,6,10,0.99)",
        zIndex: 2,
        position: "relative",
        minWidth: "64px",
      }}>
        <div style={{
          width: "6px", height: "6px", borderRadius: "50%",
          background: connected ? "#22c55e" : "#374151",
          animation: connected ? "livePulse 1.4s ease-in-out infinite" : "offlinePulse 2s ease-in-out infinite",
          flexShrink: 0,
        }} />
        <span style={{
          color: connected ? "#22c55e" : "#374151",
          fontSize: "0.52rem",
          fontWeight: 800,
          letterSpacing: "0.14em",
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          LIVE
        </span>
        {newsCount > 0 && (
          <div style={{
            background: "linear-gradient(135deg,#ef4444,#dc2626)",
            borderRadius: "99px",
            minWidth: "14px", height: "14px",
            fontSize: "0.45rem", fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 3px",
            color: "#fff",
            boxShadow: "0 0 6px rgba(239,68,68,0.6)",
            marginLeft: "2px",
          }}>
            {newsCount > 9 ? "9+" : newsCount}
          </div>
        )}
      </div>

      {/* Left fade */}
      <div style={{
        position: "absolute", left: "64px", top: 0, bottom: 0, width: "20px", zIndex: 1, pointerEvents: "none",
        background: "linear-gradient(90deg, rgba(6,6,10,0.99), transparent)",
      }} />

      {/* Scrolling track */}
      <div
        style={{ flex: 1, overflow: "hidden", height: "100%", display: "flex", alignItems: "center", position: "relative", cursor: paused ? "default" : "pointer" }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setTimeout(() => setPaused(false), 1200)}
      >
        <div
          style={{
            display: "flex", alignItems: "center", gap: "0",
            whiteSpace: "nowrap",
            animationName: "tickerScroll",
            animationDuration: `${speed}s`,
            animationTimingFunction: "linear",
            animationIterationCount: "infinite",
            animationPlayState: paused ? "paused" : "running",
            willChange: "transform",
          }}
        >
          {items.map((item, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.65rem",
                color: item.color,
                padding: "0 12px",
                letterSpacing: "0.04em",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}>
                {item.icon && (
                  <span style={{ fontSize: "0.58rem", opacity: 0.85 }}>{item.icon}</span>
                )}
                {item.text}
              </span>
              <span style={{ color: "rgba(168,85,247,0.25)", fontSize: "0.5rem", flexShrink: 0 }}>◆</span>
            </span>
          ))}
        </div>
      </div>

      {/* Right fade */}
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: "24px", zIndex: 1, pointerEvents: "none",
        background: "linear-gradient(270deg, rgba(6,6,10,0.99), transparent)",
      }} />

      {/* Critical news flash — shown as subtle bottom border when crisis active */}
      {criticalNews && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: "1.5px",
          background: "linear-gradient(90deg, transparent, #ef4444, transparent)",
          animation: "livePulse 1.8s ease-in-out infinite",
        }} />
      )}
    </div>
  );
}
