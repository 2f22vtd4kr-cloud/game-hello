import { useState, useEffect } from "react";

export function SuccessScreen() {
  const [show, setShow] = useState(false);
  const [xpPop, setXpPop] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShow(true), 300);
    const t2 = setTimeout(() => setXpPop(true), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#050507",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "1.5rem",
      fontFamily: "'Inter', sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background grid */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(168,85,247,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(168,85,247,0.04) 1px,transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      {/* Radial glow */}
      <div style={{
        position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)",
        width: "360px", height: "360px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(34,197,94,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{
        width: "100%", maxWidth: "360px", position: "relative", zIndex: 1,
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(24px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}>
        {/* Success icon */}
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{
            width: "80px", height: "80px", borderRadius: "50%",
            background: "radial-gradient(circle, rgba(34,197,94,0.2) 0%, rgba(34,197,94,0.05) 70%)",
            border: "2px solid rgba(34,197,94,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1rem",
            boxShadow: "0 0 40px rgba(34,197,94,0.3), 0 0 80px rgba(34,197,94,0.1)",
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.55rem", letterSpacing: "0.2em",
            color: "#22c55e", marginBottom: "0.4rem",
          }}>
            ОПЛАТА_ПОДТВЕРЖДЕНА
          </div>
          <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "1.3rem", letterSpacing: "-0.01em" }}>
            Ваучер выдан!
          </div>
        </div>

        {/* Order card */}
        <div style={{
          background: "linear-gradient(160deg, #0d0d18, #0a0a14)",
          border: "1px solid #1e1e30",
          borderRadius: "16px",
          padding: "1.25rem",
          marginBottom: "1rem",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Top accent line */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "1px",
            background: "linear-gradient(90deg, transparent, #a855f7, #db2777, transparent)",
          }} />

          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.48rem", letterSpacing: "0.15em",
            color: "#4b5563", marginBottom: "0.75rem",
          }}>
            ДЕТАЛИ ЗАКАЗА
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.9rem" }}>
            <div>
              <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "1rem" }}>АИ-95 · 60 л</div>
              <div style={{ color: "#6b7280", fontSize: "0.7rem", marginTop: "2px" }}>Лукойл АЗС, ул. Нахимова 5</div>
              <div style={{ color: "#4b5563", fontSize: "0.62rem", marginTop: "2px" }}>Севастополь — Центральный</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "#a855f7", fontWeight: 800, fontSize: "1.1rem" }}>₽3 240</div>
              <div style={{ color: "#4b5563", fontSize: "0.62rem" }}>₽54/л</div>
            </div>
          </div>

          {/* Payment method badge */}
          <div style={{
            background: "rgba(251,191,36,0.08)",
            border: "1px solid rgba(251,191,36,0.25)",
            borderRadius: "8px",
            padding: "0.5rem 0.75rem",
            display: "flex", alignItems: "center", gap: "0.5rem",
            marginBottom: "0.75rem",
          }}>
            <span style={{ fontSize: "0.9rem" }}>⭐</span>
            <div>
              <div style={{ color: "#fbbf24", fontSize: "0.72rem", fontWeight: 600 }}>Telegram Stars</div>
              <div style={{ color: "#6b7280", fontSize: "0.6rem", fontFamily: "'JetBrains Mono', monospace" }}>1 696 Stars списано</div>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
            </div>
          </div>

          {/* XP badge */}
          <div style={{
            opacity: xpPop ? 1 : 0,
            transform: xpPop ? "scale(1)" : "scale(0.7)",
            transition: "opacity 0.4s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1)",
            background: "rgba(168,85,247,0.12)",
            border: "1px solid rgba(168,85,247,0.35)",
            borderRadius: "8px",
            padding: "0.45rem 0.75rem",
            display: "flex", alignItems: "center", gap: "0.5rem",
          }}>
            <span style={{ fontSize: "0.85rem" }}>⚡</span>
            <div>
              <div style={{ color: "#c4b5fd", fontSize: "0.7rem", fontWeight: 700 }}>+30 XP получено</div>
              <div style={{ color: "#6b7280", fontSize: "0.58rem" }}>Уровень: Разведчик · 380/500 XP</div>
            </div>
            <div style={{ marginLeft: "auto", fontFamily: "'JetBrains Mono', monospace", color: "#a855f7", fontSize: "0.6rem", fontWeight: 700 }}>
              ↑ 8%
            </div>
          </div>
        </div>

        {/* CTA buttons */}
        <button style={{
          width: "100%", padding: "0.9rem",
          background: "linear-gradient(135deg, #a855f7, #db2777)",
          border: "none", borderRadius: "12px",
          color: "#fff", fontWeight: 700, fontSize: "0.9rem",
          cursor: "pointer", marginBottom: "0.6rem",
          boxShadow: "0 4px 24px rgba(168,85,247,0.35)",
          letterSpacing: "0.02em",
        }}>
          📱 Открыть QR-талон
        </button>
        <button style={{
          width: "100%", padding: "0.75rem",
          background: "transparent",
          border: "1px solid #1e1e30",
          borderRadius: "12px",
          color: "#6b7280", fontSize: "0.85rem",
          cursor: "pointer",
        }}>
          Вернуться в каталог
        </button>
      </div>
    </div>
  );
}
