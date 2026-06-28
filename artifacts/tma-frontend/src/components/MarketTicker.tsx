import { useEffect, useRef, useState } from "react";
import { usePriceStore } from "@/stores/usePriceStore";
import { fetchNews } from "@/api/client";
import type { NewsItem } from "@/types";

const FUEL_SHORT: Record<string, string> = {
  "АИ-92": "92", "АИ-95": "95", "АИ-95+": "95+", "АИ-100": "100", "ДТ": "ДТ", "ДТ+": "ДТ+", "Газ": "LPG",
};

const SEV_ICON: Record<string, string> = {
  critical: "⚠", warning: "◈", success: "◉", info: "◆",
};

export function MarketTicker({ stationCount }: { stationCount?: number }) {
  const prices = usePriceStore((s) => s.prices);
  const connected = usePriceStore((s) => s.connected);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [paused, setPaused] = useState(false);
  const prevConnected = useRef(connected);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    fetchNews(undefined, 20).then(setNews).catch(() => {});
  }, []);

  useEffect(() => {
    if (!prevConnected.current && connected) {
      setFlash(true);
      setTimeout(() => setFlash(false), 600);
    }
    prevConnected.current = connected;
  }, [connected]);

  const criticalCount = news.filter((n) => n.severity === "critical" || n.severity === "warning").length;
  const hasCrisis = news.some((n) => n.severity === "critical");

  const tickerItems: { text: string; color: string; icon?: string }[] = [];

  const regions = Object.entries(prices);
  if (regions.length > 0) {
    const sorted = regions
      .map(([region, fuels]) => {
        const ai92 = fuels["АИ-92"] as { multiplier?: number } | undefined;
        return { region, fuels, stress: ai92?.multiplier ?? 1.0 };
      })
      .sort((a, b) => b.stress - a.stress)
      .slice(0, 8);

    for (const { region, fuels, stress } of sorted) {
      const shortRegion = region.split(" ").slice(-1)[0].slice(0, 10);
      for (const [ft, price] of Object.entries(fuels)) {
        const p = price as { effective: number; multiplier: number; is_crisis: boolean };
        if (!["АИ-92", "АИ-95", "ДТ"].includes(ft)) continue;
        const arrow = p.multiplier > 1.05 ? "▲" : p.multiplier < 0.97 ? "▼" : "—";
        const color = p.is_crisis
          ? "#ff6b6b"
          : stress > 1.1
          ? "#fbbf24"
          : p.multiplier < 0.97
          ? "#6ee7b7"
          : "rgba(255,255,255,0.55)";
        const deltaPct = ((p.multiplier - 1) * 100).toFixed(1);
        tickerItems.push({
          text: `${FUEL_SHORT[ft] ?? ft} ${shortRegion} ${p.effective.toFixed(0)}₽ ${arrow}${Math.abs(Number(deltaPct))}%`,
          color,
          icon: p.is_crisis ? "⚠" : undefined,
        });
      }
    }
  }

  for (const item of news.slice(0, 10)) {
    const shortRegion = item.region.split(" ").slice(-1)[0].slice(0, 10);
    const color =
      item.severity === "critical" ? "#ff6b6b" :
      item.severity === "warning"  ? "#fbbf24" :
      "rgba(255,255,255,0.55)";
    tickerItems.push({
      text: `${shortRegion}: ${item.headline.slice(0, 48)}`,
      color,
      icon: SEV_ICON[item.severity],
    });
  }

  if (tickerItems.length === 0) {
    for (const label of ["АИ-92 ···", "АИ-95 ···", "ДТ ···"]) {
      tickerItems.push({ text: label, color: "rgba(255,255,255,0.22)" });
    }
  }

  const items = [...tickerItems, ...tickerItems];
  const speed = Math.max(28, items.length * 3);

  return (
    <div style={{
      background: hasCrisis
        ? "linear-gradient(90deg,rgba(28,8,8,0.99) 0%,rgba(18,22,185,0.99) 100%)"
        : flash
        ? "rgba(30,34,220,0.99)"
        : "linear-gradient(90deg,rgba(14,18,175,0.99) 0%,rgba(22,27,210,0.99) 100%)",
      borderBottom: hasCrisis
        ? "1px solid rgba(255,107,107,0.3)"
        : "1px solid rgba(255,255,255,0.10)",
      height: "40px",
      overflow: "hidden",
      position: "relative",
      display: "flex",
      alignItems: "center",
      backdropFilter: "blur(20px)",
      boxShadow: hasCrisis
        ? "0 2px 20px rgba(255,107,107,0.15)"
        : "0 2px 24px rgba(0,0,0,0.50)",
      transition: "background 0.4s, border-color 0.4s",
    }}>
      <style>{`
        @keyframes tickerScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes liveDot {
          0%,100% { opacity:1; box-shadow:0 0 6px #6ee7b7,0 0 14px #6ee7b733; }
          50%      { opacity:0.45; box-shadow:0 0 2px #6ee7b7; }
        }
        @keyframes offlineDot {
          0%,100% { opacity:0.4; }
          50%      { opacity:0.15; }
        }
        @keyframes crisisBar {
          0%,100% { opacity:1; }
          50%      { opacity:0.35; }
        }
      `}</style>

      {/* LIVE pill */}
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", gap: "5px",
        padding: "0 10px 0 12px",
        borderRight: "1px solid rgba(255,255,255,0.09)",
        height: "100%",
        background: "rgba(0,0,0,0.16)",
        zIndex: 2,
        position: "relative",
        minWidth: "60px",
      }}>
        <div style={{
          width: "6px", height: "6px", borderRadius: "50%",
          background: connected ? "#6ee7b7" : "rgba(255,255,255,0.2)",
          animation: connected ? "liveDot 1.4s ease-in-out infinite" : "offlineDot 2s ease-in-out infinite",
          flexShrink: 0,
        }} />
        <span style={{
          color: "#ffffff",
          fontSize: "0.52rem",
          fontWeight: 800,
          letterSpacing: "0.14em",
          fontFamily: "'JetBrains Mono', monospace",
          opacity: connected ? 1 : 0.4,
        }}>
          LIVE
        </span>
        {stationCount != null && stationCount > 0 && (
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.44rem",
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.02em",
          }}>
            {stationCount.toLocaleString("ru")}
          </span>
        )}
        {criticalCount > 0 && (
          <div style={{
            background: "#ff6b6b",
            borderRadius: "99px",
            minWidth: "14px", height: "14px",
            fontSize: "0.44rem", fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 3px",
            color: "#fff",
            boxShadow: "0 0 6px rgba(255,107,107,0.55)",
          }}>
            {criticalCount > 9 ? "9+" : criticalCount}
          </div>
        )}
      </div>

      {/* Left fade */}
      <div style={{
        position: "absolute", left: "60px", top: 0, bottom: 0, width: "18px",
        zIndex: 1, pointerEvents: "none",
        background: "linear-gradient(90deg,rgba(14,18,175,0.99),transparent)",
      }} />

      {/* Scrolling track */}
      <div
        style={{ flex: 1, overflow: "hidden", height: "100%", display: "flex", alignItems: "center", position: "relative" }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setTimeout(() => setPaused(false), 1200)}
      >
        <div style={{
          display: "flex", alignItems: "center",
          whiteSpace: "nowrap",
          animationName: "tickerScroll",
          animationDuration: `${speed}s`,
          animationTimingFunction: "linear",
          animationIterationCount: "infinite",
          animationPlayState: paused ? "paused" : "running",
          willChange: "transform",
        }}>
          {items.map((item, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.65rem",
                color: item.color,
                padding: "0 12px",
                letterSpacing: "0.04em",
                display: "flex", alignItems: "center", gap: "4px",
              }}>
                {item.icon && <span style={{ fontSize: "0.55rem", opacity: 0.8 }}>{item.icon}</span>}
                {item.text}
              </span>
              <span style={{ color: "rgba(255,255,255,0.14)", fontSize: "0.4rem", flexShrink: 0 }}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/* Right fade */}
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: "24px",
        zIndex: 1, pointerEvents: "none",
        background: "linear-gradient(270deg,rgba(22,27,210,0.99),transparent)",
      }} />

      {hasCrisis && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: "1.5px",
          background: "linear-gradient(90deg,transparent,#ff6b6b 30%,#ff6b6b 70%,transparent)",
          animation: "crisisBar 1.6s ease-in-out infinite",
        }} />
      )}
    </div>
  );
}
