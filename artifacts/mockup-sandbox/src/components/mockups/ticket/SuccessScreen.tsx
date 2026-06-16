export function SuccessScreen() {
  return (
    <div style={{
      minHeight: "100vh", background: "#050507",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, sans-serif", padding: "1.25rem",
    }}>
      {/* Scan-line overlay */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(34,197,94,0.012) 3px,rgba(34,197,94,0.012) 4px)" }} />

      <div style={{
        background: "linear-gradient(160deg, #080f09, #0a1a0a)",
        border: "1px solid rgba(34,197,94,0.3)",
        borderRadius: "24px", padding: "1.75rem 1.5rem",
        maxWidth: "320px", width: "100%",
        position: "relative", overflow: "hidden",
        boxShadow: "0 0 80px rgba(34,197,94,0.12), 0 0 160px rgba(34,197,94,0.06)",
      }}>
        {/* Top gradient line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#22c55e,#a855f7,transparent)" }} />

        {/* Success icon */}
        <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
          <div style={{
            width: "72px", height: "72px", borderRadius: "50%",
            background: "rgba(34,197,94,0.1)",
            border: "2px solid rgba(34,197,94,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 0.85rem",
            boxShadow: "0 0 32px rgba(34,197,94,0.3)",
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ fontFamily: "'Courier New',monospace", color: "#22c55e", fontSize: "0.44rem", letterSpacing: "0.22em", marginBottom: "0.3rem", opacity: 0.85 }}>
            ОПЛАТА_ПОДТВЕРЖДЕНА
          </div>
          <h2 style={{ color: "#f0f4f0", fontWeight: 800, fontSize: "1.1rem", margin: "0 0 0.2rem" }}>
            Талон выдан!
          </h2>
          <p style={{ color: "#6b7280", fontSize: "0.72rem", margin: 0 }}>
            Ваучер активен 24 часа
          </p>
        </div>

        {/* Order summary card */}
        <div style={{
          background: "#060a06", border: "1px solid #1a261a",
          borderRadius: "16px", padding: "1rem", marginBottom: "1rem",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.55rem" }}>
            <span style={{ color: "#4b5563", fontSize: "0.68rem" }}>Топливо / Объём</span>
            <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "0.82rem" }}>АИ-95 · 60 л</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.55rem" }}>
            <span style={{ color: "#4b5563", fontSize: "0.68rem" }}>АЗС</span>
            <span style={{ color: "#9ca3af", fontSize: "0.7rem" }}>Роснефть #42, Севастополь</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.55rem" }}>
            <span style={{ color: "#4b5563", fontSize: "0.68rem" }}>Сумма (руб.)</span>
            <span style={{ color: "#9ca3af", fontSize: "0.7rem" }}>3 480 ₽</span>
          </div>
          <div style={{ height: "1px", background: "#1a261a", margin: "0.55rem 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#4b5563", fontSize: "0.68rem" }}>Дата</span>
            <span style={{ color: "#374151", fontFamily: "'Courier New',monospace", fontSize: "0.6rem" }}>
              16 июн · 20:47
            </span>
          </div>
        </div>

        {/* Stars badge */}
        <div style={{
          background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.22)",
          borderRadius: "12px", padding: "0.65rem 0.85rem",
          marginBottom: "1.1rem", display: "flex", alignItems: "center", gap: "0.6rem",
        }}>
          <span style={{ fontSize: "1.1rem" }}>⭐</span>
          <div>
            <div style={{ color: "#f59e0b", fontSize: "0.72rem", fontWeight: 700 }}>
              1 696 Telegram Stars списано
            </div>
            <div style={{ color: "#4b5563", fontSize: "0.6rem" }}>
              Оплата подтверждена Telegram
            </div>
          </div>
        </div>

        {/* XP badge */}
        <div style={{
          background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.2)",
          borderRadius: "12px", padding: "0.5rem 0.85rem",
          marginBottom: "1.1rem", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.85rem" }}>⚡</span>
            <span style={{ color: "#c4b5fd", fontSize: "0.68rem", fontWeight: 600 }}>Начислено XP</span>
          </div>
          <span style={{ color: "#a855f7", fontWeight: 800, fontSize: "0.82rem", fontFamily: "'Courier New',monospace" }}>+30</span>
        </div>

        {/* CTA buttons */}
        <button style={{
          width: "100%", padding: "0.8rem",
          background: "linear-gradient(135deg, #22c55e, #16a34a)",
          border: "none", borderRadius: "14px",
          color: "#fff", fontSize: "0.88rem", fontWeight: 800,
          cursor: "pointer", boxShadow: "0 0 20px rgba(34,197,94,0.35)",
          marginBottom: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
        }}>
          <span>📱</span> Открыть QR-талон
        </button>
        <button style={{
          width: "100%", padding: "0.65rem",
          background: "transparent", border: "1px solid #1a261a",
          borderRadius: "14px", color: "#4b5563", fontSize: "0.8rem",
          cursor: "pointer",
        }}>
          Вернуться в каталог
        </button>
      </div>
    </div>
  );
}
