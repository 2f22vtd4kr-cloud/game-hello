import { useState, useEffect } from "react";

const NET_COLOR = "#f59e0b";
const HASH = "TLN-2026-A4F8-9C2E-B371";

function QRPattern() {
  const size = 220;
  const cells = 21;
  const cell = size / cells;

  const pattern: number[][] = [];
  for (let r = 0; r < cells; r++) {
    pattern[r] = [];
    for (let c = 0; c < cells; c++) {
      const isFinderTL = (r < 7 && c < 7);
      const isFinderTR = (r < 7 && c >= cells - 7);
      const isFinderBL = (r >= cells - 7 && c < 7);
      if (isFinderTL || isFinderTR || isFinderBL) {
        const isOuter = r === 0 || r === 6 || c === 0 || c === 6 ||
          (r >= cells - 7 && (r === cells - 7 || r === cells - 1 || c === 0 || c === 6)) ||
          (c >= cells - 7 && (c === cells - 7 || c === cells - 1 || r === 0 || r === 6));
        const isInner = (r >= 2 && r <= 4 && c >= 2 && c <= 4) ||
          (r >= 2 && r <= 4 && c >= cells - 5 && c <= cells - 3) ||
          (r >= cells - 5 && r <= cells - 3 && c >= 2 && c <= 4);
        pattern[r][c] = (isOuter || isInner) ? 1 : 0;
      } else {
        pattern[r][c] = Math.abs(Math.sin(r * 7 + c * 13 + r * c)) > 0.5 ? 1 : 0;
      }
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill="#f0f0f4" rx="4" />
      {pattern.map((row, r) =>
        row.map((val, c) =>
          val === 1 ? (
            <rect
              key={`${r}-${c}`}
              x={c * cell} y={r * cell}
              width={cell} height={cell}
              fill="#0f0f0f"
            />
          ) : null
        )
      )}
    </svg>
  );
}

export function QRVoucher() {
  const [scanY, setScanY] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let raf: number;
    let start: number | null = null;
    const duration = 2400;

    function tick(ts: number) {
      if (!start) start = ts;
      const elapsed = (ts - start) % (duration * 2);
      const progress = elapsed < duration ? elapsed / duration : 2 - elapsed / duration;
      setScanY(progress * 220);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const daysLeft = 28;

  return (
    <div style={{
      minHeight: "100vh",
      background: "rgba(3,3,8,0.97)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1.5rem",
      fontFamily: "'Inter', sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Scan line bg */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(168,85,247,0.02) 3px,rgba(168,85,247,0.02) 4px)",
      }} />

      <div style={{
        background: `linear-gradient(160deg, #0d0d18, ${NET_COLOR}06)`,
        border: `1px solid ${NET_COLOR}55`,
        borderRadius: "24px",
        padding: "1.5rem",
        textAlign: "center",
        maxWidth: "300px",
        width: "100%",
        position: "relative",
        overflow: "hidden",
        boxShadow: `0 0 60px ${NET_COLOR}22, 0 0 120px #db277711`,
      }}>
        {/* Top gradient line */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "1px",
          background: `linear-gradient(90deg, transparent, ${NET_COLOR}, #db2777, transparent)`,
        }} />

        {/* Header */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            color: "#a855f7", fontSize: "0.5rem", letterSpacing: "0.2em", marginBottom: "0.25rem",
          }}>
            ⛽️ ТОПЛИВНЫЙ ВАУЧЕР
          </div>
          <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: "1.05rem", letterSpacing: "0.02em" }}>
            Лукойл
          </div>
          <div style={{ fontSize: "0.62rem", fontFamily: "'JetBrains Mono', monospace", marginTop: "3px" }}>
            <span style={{ color: "#f59e0b", fontWeight: 700 }}>АИ-95</span>
            <span style={{ color: "#6b7280" }}> · 60л</span>
            <span style={{ color: "#4b5563" }}> · ₽3 240</span>
          </div>
          <div style={{
            marginTop: "0.4rem",
            background: "rgba(245,158,11,0.08)",
            border: `1px solid ${NET_COLOR}30`,
            borderRadius: "8px",
            padding: "0.28rem 0.55rem",
            display: "inline-block",
          }}>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              color: "#fde68a", fontSize: "0.48rem",
              fontWeight: 700, letterSpacing: "0.06em",
            }}>
              ✓ ДЕЙСТВУЕТ НА ВСЕХ АЗС СЕТИ ЛУКОЙЛ
            </span>
          </div>
          <div style={{ color: "#4b5563", fontSize: "0.58rem", marginTop: "0.35rem" }}>
            17 июня 2026 · 22:47
          </div>
        </div>

        {/* QR container */}
        <div style={{ position: "relative", display: "inline-block", margin: "0 auto" }}>
          <div style={{
            width: "236px", height: "236px",
            borderRadius: "16px", overflow: "hidden",
            border: `2px solid ${NET_COLOR}44`,
            boxShadow: `0 0 30px ${NET_COLOR}30, inset 0 0 20px ${NET_COLOR}10`,
            position: "relative",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <QRPattern />
            {/* Scanner beam */}
            <div style={{
              position: "absolute", left: 0, right: 0, top: `${scanY}px`,
              height: "3px",
              background: `linear-gradient(90deg, transparent, ${NET_COLOR}cc, transparent)`,
              boxShadow: `0 0 8px ${NET_COLOR}88`,
              pointerEvents: "none",
              transform: "translateY(-50%)",
            }} />
          </div>
          {/* Corner accents */}
          {[
            { top: 0, left: 0, borderTop: `2px solid ${NET_COLOR}`, borderLeft: `2px solid ${NET_COLOR}`, borderTopLeftRadius: "4px" },
            { top: 0, right: 0, borderTop: `2px solid ${NET_COLOR}`, borderRight: `2px solid ${NET_COLOR}`, borderTopRightRadius: "4px" },
            { bottom: 0, left: 0, borderBottom: `2px solid ${NET_COLOR}`, borderLeft: `2px solid ${NET_COLOR}`, borderBottomLeftRadius: "4px" },
            { bottom: 0, right: 0, borderBottom: `2px solid ${NET_COLOR}`, borderRight: `2px solid ${NET_COLOR}`, borderBottomRightRadius: "4px" },
          ].map((s, i) => (
            <div key={i} style={{ position: "absolute", width: "16px", height: "16px", ...s }} />
          ))}
        </div>

        {/* Hash */}
        <div
          onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          style={{
            margin: "0.9rem 0 0", padding: "0.5rem 0.75rem",
            background: "#0b0b0f", border: "1px solid #1e1e2a",
            borderRadius: "8px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "0.5rem",
          }}
        >
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.6rem", color: "#4b5563",
            flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {HASH}
          </span>
          <span style={{ fontSize: "0.7rem", color: copied ? "#22c55e" : "#6b7280" }}>
            {copied ? "✓" : "⎘"}
          </span>
        </div>

        {/* Expiry bar */}
        <div style={{ marginTop: "0.75rem", textAlign: "left" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "0.58rem", color: "#4b5563", fontFamily: "'JetBrains Mono', monospace" }}>Срок действия</span>
            <span style={{ fontSize: "0.58rem", color: "#22c55e", fontWeight: 700 }}>{daysLeft} дн. осталось</span>
          </div>
          <div style={{ height: "4px", background: "#1e1e2a", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${(daysLeft / 30) * 100}%`,
              background: "#22c55e",
              boxShadow: "0 0 8px #22c55e88",
              borderRadius: "2px",
              transition: "width 0.5s ease",
            }} />
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          {["💾 PNG", "📄 PDF", "📤 TG"].map((label) => (
            <button key={label} style={{
              flex: 1, padding: "0.5rem 0.25rem",
              background: "#0b0b0f", border: "1px solid #1e1e2a",
              borderRadius: "8px", color: "#6b7280",
              fontSize: "0.65rem", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
