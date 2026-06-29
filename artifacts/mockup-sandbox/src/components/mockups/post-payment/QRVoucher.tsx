import { useState, useEffect } from "react";

const NET_COLOR = "#f59e0b";
const HASH = "TLN-2026-A4F8-9C2E-B371-0D88";

function QRPattern() {
  const size = 220;
  const cells = 21;
  const cell = size / cells;

  const pattern: number[][] = [];
  for (let r = 0; r < cells; r++) {
    pattern[r] = [];
    for (let c = 0; c < cells; c++) {
      const isFinderTL = r < 7 && c < 7;
      const isFinderTR = r < 7 && c >= cells - 7;
      const isFinderBL = r >= cells - 7 && c < 7;
      if (isFinderTL || isFinderTR || isFinderBL) {
        const isOuter =
          r === 0 || r === 6 || c === 0 || c === 6 ||
          (r >= cells - 7 && (r === cells - 7 || r === cells - 1 || c === 0 || c === 6)) ||
          (c >= cells - 7 && (c === cells - 7 || c === cells - 1 || r === 0 || r === 6));
        const isInner =
          (r >= 2 && r <= 4 && c >= 2 && c <= 4) ||
          (r >= 2 && r <= 4 && c >= cells - 5 && c <= cells - 3) ||
          (r >= cells - 5 && r <= cells - 3 && c >= 2 && c <= 4);
        pattern[r][c] = isOuter || isInner ? 1 : 0;
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
            <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill="#0f0f0f" />
          ) : null
        )
      )}
    </svg>
  );
}

export function QRVoucher() {
  const [scanY, setScanY] = useState(0);
  const [copied, setCopied] = useState(false);
  const [pulse, setPulse] = useState(false);

  const daysLeft = 76;
  const expiryPct = (daysLeft / 90) * 100;
  const expiryColor = daysLeft <= 30 ? "#ef4444" : daysLeft <= 60 ? "#eab308" : "#22c55e";
  const now = new Date("2026-06-29T14:27:00");

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

  useEffect(() => {
    const id = setInterval(() => setPulse((p) => !p), 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "rgba(3,3,8,0.97)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        fontFamily: "'Inter', system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* CRT scanline overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(232,98,42,0.02) 3px,rgba(232,98,42,0.02) 4px)",
        }}
      />

      {/* Card */}
      <div
        style={{
          background: `linear-gradient(160deg, #0d0d18, ${NET_COLOR}04)`,
          border: `1px solid ${NET_COLOR}55`,
          borderRadius: "24px",
          padding: "1.5rem",
          textAlign: "center",
          maxWidth: "320px",
          width: "100%",
          position: "relative",
          overflow: "hidden",
          boxShadow: `0 0 60px ${NET_COLOR}22, 0 0 120px #E8622A11`,
          transition: "box-shadow 0.7s ease",
        }}
      >
        {/* Top glow line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "1px",
            background: `linear-gradient(90deg, transparent, ${NET_COLOR}, #E8622A, transparent)`,
          }}
        />

        {/* ── Header ── */}
        <div style={{ marginBottom: "1rem" }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              color: "#E8622A",
              fontSize: "0.5rem",
              letterSpacing: "0.2em",
              marginBottom: "0.25rem",
            }}
          >
            ⛽️ ТОПЛИВНЫЙ ВАУЧЕР
          </div>

          <div
            style={{
              color: "#e2e8f0",
              fontWeight: 800,
              fontSize: "1.05rem",
              letterSpacing: "0.02em",
              marginBottom: "2px",
            }}
          >
            Лукойл
          </div>

          <div
            style={{
              fontSize: "0.62rem",
              fontFamily: "'JetBrains Mono', monospace",
              marginTop: "3px",
            }}
          >
            <span style={{ color: "#E8622A", fontWeight: 700 }}>АИ-95</span>
            <span style={{ color: "rgba(255,255,255,0.65)" }}> · 60 л</span>
            <span style={{ color: "rgba(255,255,255,0.45)" }}> · ₽3 240</span>
          </div>

          {/* "valid at all stations" badge */}
          <div
            style={{
              marginTop: "0.45rem",
              background: "rgba(232,98,42,0.08)",
              border: "1px solid rgba(232,98,42,0.30)",
              borderRadius: "8px",
              padding: "0.28rem 0.55rem",
              display: "inline-block",
            }}
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                color: "#c4b5fd",
                fontSize: "0.48rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              ✓ ДЕЙСТВУЕТ НА ВСЕХ АЗС СЕТИ ЛУКОЙЛ
            </span>
          </div>

          <p
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: "0.6rem",
              margin: "0.35rem 0 0",
            }}
          >
            {now.toLocaleDateString("ru", { day: "2-digit", month: "long", year: "numeric" })}
            {" · "}
            {now.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        {/* ── QR block ── */}
        <div style={{ position: "relative", display: "inline-block", margin: "0 auto" }}>
          <div
            style={{
              width: "236px",
              height: "236px",
              borderRadius: "16px",
              overflow: "hidden",
              border: `2px solid ${NET_COLOR}44`,
              boxShadow: `0 0 30px ${NET_COLOR}30, inset 0 0 20px ${NET_COLOR}10`,
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <QRPattern />

            {/* Animated scanner beam */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${scanY}px`,
                height: "3px",
                background: `linear-gradient(90deg, transparent, ${NET_COLOR}cc, transparent)`,
                boxShadow: `0 0 8px ${NET_COLOR}88`,
                pointerEvents: "none",
                transform: "translateY(-50%)",
              }}
            />
          </div>

          {/* Corner brackets */}
          {[
            { top: 0, left: 0, borderTop: `2px solid ${NET_COLOR}`, borderLeft: `2px solid ${NET_COLOR}`, borderTopLeftRadius: "4px" },
            { top: 0, right: 0, borderTop: `2px solid ${NET_COLOR}`, borderRight: `2px solid ${NET_COLOR}`, borderTopRightRadius: "4px" },
            { bottom: 0, left: 0, borderBottom: `2px solid ${NET_COLOR}`, borderLeft: `2px solid ${NET_COLOR}`, borderBottomLeftRadius: "4px" },
            { bottom: 0, right: 0, borderBottom: `2px solid ${NET_COLOR}`, borderRight: `2px solid ${NET_COLOR}`, borderBottomRightRadius: "4px" },
          ].map((s, i) => (
            <div key={i} style={{ position: "absolute", width: "16px", height: "16px", ...s }} />
          ))}
        </div>

        {/* ── Hash / copy row ── */}
        <div
          onClick={() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          style={{
            margin: "0.9rem 0 0",
            padding: "0.5rem 0.75rem",
            background: "#0b0b0f",
            border: "1px solid #1e1e2a",
            borderRadius: "8px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.6rem",
              color: "rgba(255,255,255,0.45)",
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {HASH}
          </span>
          <span style={{ fontSize: "0.7rem", color: copied ? "#22c55e" : "rgba(255,255,255,0.55)" }}>
            {copied ? "✓" : "⎘"}
          </span>
        </div>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.52rem", margin: "0.25rem 0 0.5rem" }}>
          {copied ? "✓ Скопировано!" : "Нажмите на код для копирования"}
        </p>

        {/* ── Expiry progress bar ── */}
        <div
          style={{
            marginBottom: "0.75rem",
            background: "#0b0b0f",
            border: `1px solid ${expiryColor}30`,
            borderRadius: "10px",
            padding: "0.5rem 0.75rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.3rem",
            }}
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.48rem",
                color: "rgba(255,255,255,0.4)",
                letterSpacing: "0.1em",
              }}
            >
              СРОК ДЕЙСТВИЯ
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.54rem",
                color: expiryColor,
                fontWeight: 700,
              }}
            >
              {daysLeft} дн. осталось
            </span>
          </div>
          <div style={{ height: "5px", background: "#111118", borderRadius: "3px", overflow: "hidden" }}>
            <div
              style={{
                width: `${expiryPct}%`,
                height: "100%",
                background: expiryColor,
                borderRadius: "3px",
                boxShadow: `0 0 6px ${expiryColor}`,
                transition: "width 0.5s",
              }}
            />
          </div>
          <p
            style={{
              margin: "0.3rem 0 0",
              color: "rgba(255,255,255,0.3)",
              fontSize: "0.43rem",
              fontFamily: "'JetBrains Mono', monospace",
              lineHeight: 1.4,
            }}
          >
            ⚠ Точный срок действия может измениться с момента получения талона
          </p>
        </div>

        {/* ── Action buttons 2×2 ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px",
            marginBottom: "0.75rem",
          }}
        >
          {[
            { icon: "📷", label: "Сохранить PNG" },
            { icon: "📄", label: "Скачать PDF" },
            { icon: "📋", label: "Скопировать" },
            { icon: "📤", label: "В Telegram" },
          ].map(({ icon, label }) => (
            <button
              key={label}
              style={{
                background: "rgba(232,98,42,0.10)",
                border: "1px solid rgba(232,98,42,0.25)",
                borderRadius: "10px",
                padding: "0.5rem 0.35rem",
                color: "#c4b5fd",
                fontSize: "0.65rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
              }}
            >
              <span style={{ fontSize: "0.8rem" }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* ── Close / confirm CTA ── */}
        <button
          style={{
            width: "100%",
            padding: "0.7rem",
            background: "linear-gradient(135deg, #E8622A, #d9520e)",
            border: "none",
            borderRadius: "12px",
            color: "#fff",
            fontSize: "0.85rem",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: pulse ? "0 0 24px #E8622A70" : "0 0 10px #E8622A30",
            transition: "box-shadow 0.7s ease",
          }}
        >
          Закрыть
        </button>
      </div>
    </div>
  );
}
