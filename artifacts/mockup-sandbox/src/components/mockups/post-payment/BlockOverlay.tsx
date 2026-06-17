import { useState, useEffect } from "react";

const BLOCK_REASONS = [
  "Транзакция отклонена шлюзом безопасности. Ваш сеанс помечен как подозрительный. Повторите попытку через 15–30 минут или обратитесь к оператору.",
  "Превышен дневной лимит операций для данного региона. Лимит будет сброшен в 00:00 по МСК.",
  "Сессия истекла из-за длительного бездействия. Выберите топливо и станцию повторно.",
  "Платёжный узел временно перегружен. Попробуйте через несколько минут.",
];

export function BlockOverlay() {
  const [countdown, setCountdown] = useState(15);
  const [closed, setClosed] = useState(false);
  const [reasonIdx] = useState(() => Math.floor(Math.random() * BLOCK_REASONS.length));
  const reason = BLOCK_REASONS[reasonIdx];
  const now = new Date();
  const timeStr = now.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(id); setClosed(true); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleClose = () => setClosed(true);

  if (closed) {
    return (
      <div style={{
        minHeight: "100vh", background: "#050507",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "2rem", textAlign: "center",
        fontFamily: "system-ui, sans-serif",
      }}>
        <div style={{
          backgroundImage: "linear-gradient(rgba(168,85,247,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(168,85,247,0.04) 1px,transparent 1px)",
          backgroundSize: "40px 40px", position: "fixed", inset: 0, pointerEvents: "none",
        }} />
        <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔓</div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a855f7", fontSize: "0.55rem", letterSpacing: "0.15em", marginBottom: "0.5rem" }}>
          ШЛЮЗ_ОТКРЫТ
        </div>
        <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "1rem", marginBottom: "0.5rem" }}>
          Вернитесь в каталог
        </div>
        <div style={{ color: "#4b5563", fontSize: "0.75rem" }}>Блокировка снята</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "rgba(5,5,7,0.97)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "1.5rem", textAlign: "center",
      fontFamily: "system-ui, sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      {/* Red scanline overlay */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(239,68,68,0.03) 2px,rgba(239,68,68,0.03) 4px)",
      }} />

      {/* Pulsing red radial glow */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        width: "500px", height: "500px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 70%)",
        pointerEvents: "none", animation: "pulse 2.2s ease-in-out infinite",
      }} />

      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.6;transform:translate(-50%,-50%) scale(1)} 50%{opacity:1;transform:translate(-50%,-50%) scale(1.15)} }
        @keyframes iconPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
        @keyframes drain { from{width:100%} to{width:0%} }
      `}</style>

      {/* Card */}
      <div style={{
        background: "linear-gradient(160deg, #14141c, #1a050a)",
        border: "1px solid #ef444455",
        borderRadius: "24px",
        padding: "2rem 1.5rem",
        maxWidth: "320px", width: "100%",
        position: "relative", overflow: "hidden",
        boxShadow: "0 0 60px #ef444422, inset 0 1px 0 #ef444422",
        zIndex: 1,
      }}>
        {/* Top red line */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "2px",
          background: "linear-gradient(90deg, transparent, #ef4444, transparent)",
        }} />

        {/* Corner accents */}
        {[
          { top: 0, left: 0, borderTop: "1px solid #ef444488", borderLeft: "1px solid #ef444488", borderTopLeftRadius: "24px" },
          { top: 0, right: 0, borderTop: "1px solid #ef444488", borderRight: "1px solid #ef444488", borderTopRightRadius: "24px" },
        ].map((s, i) => (
          <div key={i} style={{ position: "absolute", width: "24px", height: "24px", ...s }} />
        ))}

        {/* Icon */}
        <div style={{
          fontSize: "3rem", marginBottom: "0.75rem",
          filter: "drop-shadow(0 0 16px #ef444488)",
          display: "inline-block",
          animation: "iconPulse 2.2s ease-in-out infinite",
        }}>
          🚫
        </div>

        {/* Timestamp label */}
        <div style={{
          fontFamily: "'JetBrains Mono',monospace",
          color: "#ef4444", fontSize: "0.48rem",
          letterSpacing: "0.15em", marginBottom: "0.5rem", opacity: 0.7,
        }}>
          СИСТЕМА · БЛОКИРОВКА · {timeStr}
        </div>

        {/* Title */}
        <h3 style={{
          color: "#ef4444", fontSize: "1rem",
          margin: "0 0 0.75rem", fontWeight: 800, lineHeight: 1.2,
        }}>
          Шлюз временно недоступен
        </h3>

        {/* Reason */}
        <p style={{
          color: "#9ca3af", fontSize: "0.78rem",
          margin: "0 0 1.25rem", lineHeight: 1.65,
        }}>
          {reason}
        </p>

        {/* Countdown bar */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
            <span style={{ color: "#4b5563", fontSize: "0.62rem" }}>Авто-закрытие через</span>
            <span style={{
              color: countdown > 5 ? "#ef4444" : "#f97316",
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: "0.72rem", fontWeight: 700,
            }}>
              {countdown}с
            </span>
          </div>
          <div style={{ height: "3px", background: "#1e1e2a", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              background: "linear-gradient(90deg, #ef4444, #dc2626)",
              borderRadius: "2px",
              animation: "drain 15s linear forwards",
            }} />
          </div>
        </div>

        {/* Info pills */}
        <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
          {[
            { label: "Деньги не списаны", color: "#22c55e" },
            { label: "Попробуйте снова", color: "#a855f7" },
          ].map(({ label, color }) => (
            <div key={label} style={{
              background: `${color}10`, border: `1px solid ${color}30`,
              borderRadius: "20px", padding: "0.2rem 0.6rem",
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: "0.45rem", color, fontWeight: 700, letterSpacing: "0.04em",
            }}>
              {label}
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={handleClose}
          style={{
            background: "linear-gradient(135deg, #a855f7, #db2777)",
            color: "#fff", border: "none",
            borderRadius: "12px", padding: "0.8rem 2rem",
            cursor: "pointer", fontSize: "0.9rem",
            fontWeight: 700, width: "100%",
            boxShadow: "0 0 20px #a855f740",
            letterSpacing: "0.02em",
          }}
        >
          Принять и закрыть
        </button>

        {/* Subtle error code */}
        <div style={{
          marginTop: "0.75rem",
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: "0.4rem", color: "#1e1e2a", letterSpacing: "0.1em",
        }}>
          ERR_GATEWAY_BLOCKED · SESSION_FLAGGED · {Math.random().toString(36).slice(2,10).toUpperCase()}
        </div>
      </div>
    </div>
  );
}
