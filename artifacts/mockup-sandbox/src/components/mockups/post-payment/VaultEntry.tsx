import { useState } from "react";

const XP = 380;
const XP_NEXT = 500;
const TIER = "Разведчик";
const TIER_NEXT = "Агент";
const XP_PCT = Math.round((XP / XP_NEXT) * 100);

const PURCHASES = [
  {
    id: 1, fuel: "АИ-95", volume: 60, station: "Лукойл, ул. Нахимова 5",
    region: "Севастополь", price: 3240, stars: 1696,
    network: "Лукойл", netColor: "#f59e0b",
    status: "active", daysLeft: 28, hash: "TLN-2026-A4F8-9C2E-B371",
    isNew: true,
  },
  {
    id: 2, fuel: "АИ-92", volume: 40, station: "Роснефть, пр. Победы 14",
    region: "Симферополь", price: 1960, stars: 1020,
    network: "Роснефть", netColor: "#ef4444",
    status: "active", daysLeft: 12, hash: "TLN-2026-C1D3-7B5A-F290",
    isNew: false,
  },
  {
    id: 3, fuel: "Дизель", volume: 40, station: "Газпром АЗС, Ялтинская",
    region: "Ялта", price: 2140, stars: 1114,
    network: "Газпром", netColor: "#3b82f6",
    status: "used", daysLeft: 0, hash: "TLN-2026-E8F2-3A6C-D184",
    isNew: false,
  },
];

export function VaultEntry() {
  const [activeQR, setActiveQR] = useState<number | null>(null);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#050507",
      fontFamily: "'Inter', sans-serif",
      paddingBottom: "5rem",
    }}>
      {/* Background grid */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(168,85,247,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(168,85,247,0.03) 1px,transparent 1px)",
        backgroundSize: "40px 40px",
        zIndex: 0,
      }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{
          padding: "1.25rem 1rem 0.5rem",
          borderBottom: "1px solid #0f0f1a",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.48rem", letterSpacing: "0.2em",
                color: "#4b5563", marginBottom: "0.2rem",
              }}>
                ПРОФИЛЬ_ОПЕРАТОРА
              </div>
              <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "1.1rem" }}>
                Хранилище
              </div>
            </div>
            {/* Tier badge */}
            <div style={{
              background: "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(219,39,119,0.1))",
              border: "1px solid rgba(168,85,247,0.35)",
              borderRadius: "10px", padding: "0.35rem 0.65rem",
            }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.5rem", color: "#a855f7", letterSpacing: "0.1em" }}>
                ★ {TIER.toUpperCase()}
              </div>
              <div style={{ fontSize: "0.6rem", color: "#c4b5fd", fontWeight: 700, textAlign: "center" }}>
                {XP} XP
              </div>
            </div>
          </div>

          {/* XP Bar */}
          <div style={{ marginTop: "0.85rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
              <span style={{ fontSize: "0.6rem", color: "#6b7280", fontFamily: "'JetBrains Mono', monospace" }}>
                До «{TIER_NEXT}»
              </span>
              <span style={{ fontSize: "0.6rem", color: "#a855f7", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                {XP} / {XP_NEXT} XP
              </span>
            </div>
            <div style={{ height: "6px", background: "#1a1a2e", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${XP_PCT}%`,
                background: "linear-gradient(90deg, #a855f7, #db2777)",
                boxShadow: "0 0 12px rgba(168,85,247,0.6)",
                borderRadius: "3px",
              }} />
            </div>
            <div style={{ fontSize: "0.55rem", color: "#374151", marginTop: "0.2rem", textAlign: "right" }}>
              +{XP_NEXT - XP} XP до следующего уровня
            </div>
          </div>
        </div>

        {/* New voucher highlight strip */}
        <div style={{
          margin: "0.75rem 1rem 0",
          background: "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(168,85,247,0.05))",
          border: "1px solid rgba(34,197,94,0.25)",
          borderRadius: "10px",
          padding: "0.5rem 0.75rem",
          display: "flex", alignItems: "center", gap: "0.5rem",
        }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e", flexShrink: 0 }} />
          <span style={{ fontSize: "0.68rem", color: "#86efac", fontWeight: 600 }}>
            Новый ваучер добавлен · Лукойл АИ-95
          </span>
          <span style={{ marginLeft: "auto", fontSize: "0.58rem", color: "#4b5563" }}>только что</span>
        </div>

        {/* Voucher list */}
        <div style={{ padding: "0.75rem 1rem 0" }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.48rem", letterSpacing: "0.15em",
            color: "#374151", marginBottom: "0.6rem",
          }}>
            АКТИВНЫЕ ВАУЧЕРЫ ({PURCHASES.filter(p => p.status === "active").length})
          </div>

          {PURCHASES.map((p) => {
            const isActive = p.status === "active";
            return (
              <div key={p.id} style={{
                background: p.isNew
                  ? "linear-gradient(160deg, #0d0d18, rgba(168,85,247,0.06))"
                  : "linear-gradient(160deg, #0a0a12, #09090f)",
                border: p.isNew
                  ? "1px solid rgba(168,85,247,0.35)"
                  : `1px solid ${isActive ? "#1e1e2a" : "#111118"}`,
                borderRadius: "14px",
                padding: "0.85rem",
                marginBottom: "0.65rem",
                position: "relative",
                overflow: "hidden",
                opacity: isActive ? 1 : 0.55,
              }}>
                {/* Top line */}
                {p.isNew && (
                  <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, height: "1px",
                    background: "linear-gradient(90deg, transparent, #a855f7, #db2777, transparent)",
                  }} />
                )}

                {/* NEW pulse dot */}
                {p.isNew && (
                  <div style={{
                    position: "absolute", top: "0.75rem", right: "0.75rem",
                    display: "flex", alignItems: "center", gap: "0.3rem",
                  }}>
                    <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
                    <span style={{ fontSize: "0.5rem", color: "#22c55e", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>NEW</span>
                  </div>
                )}

                <div style={{ display: "flex", gap: "0.65rem", alignItems: "flex-start" }}>
                  {/* Color bar */}
                  <div style={{
                    width: "4px", borderRadius: "2px", alignSelf: "stretch", flexShrink: 0,
                    background: p.netColor,
                    boxShadow: isActive ? `0 0 8px ${p.netColor}66` : "none",
                  }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
                      <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "0.85rem" }}>
                        {p.fuel}
                      </span>
                      <span style={{ color: "#6b7280", fontSize: "0.72rem" }}>· {p.volume}л</span>
                      {isActive && (
                        <span style={{
                          fontSize: "0.5rem", fontFamily: "'JetBrains Mono', monospace",
                          color: "#22c55e", background: "rgba(34,197,94,0.1)",
                          border: "1px solid rgba(34,197,94,0.2)",
                          borderRadius: "4px", padding: "1px 5px", marginLeft: "auto",
                        }}>АКТИВЕН</span>
                      )}
                      {!isActive && (
                        <span style={{
                          fontSize: "0.5rem", fontFamily: "'JetBrains Mono', monospace",
                          color: "#6b7280", background: "rgba(107,114,128,0.1)",
                          border: "1px solid rgba(107,114,128,0.2)",
                          borderRadius: "4px", padding: "1px 5px", marginLeft: "auto",
                        }}>ИСПОЛЬЗОВАН</span>
                      )}
                    </div>

                    <div style={{ color: "#4b5563", fontSize: "0.65rem", marginBottom: "0.15rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.station}
                    </div>
                    <div style={{ color: "#374151", fontSize: "0.6rem" }}>{p.region}</div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
                      <div>
                        <span style={{ color: "#a855f7", fontWeight: 700, fontSize: "0.82rem" }}>₽{p.price.toLocaleString("ru")}</span>
                        <span style={{ color: "#374151", fontSize: "0.6rem" }}> · ⭐{p.stars.toLocaleString("ru")}</span>
                      </div>

                      {isActive && (
                        <button
                          onClick={() => setActiveQR(activeQR === p.id ? null : p.id)}
                          style={{
                            background: "linear-gradient(135deg, #a855f7, #db2777)",
                            border: "none", borderRadius: "7px",
                            padding: "0.3rem 0.65rem",
                            color: "#fff", fontSize: "0.65rem", fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          📱 QR
                        </button>
                      )}
                    </div>

                    {/* Expiry bar */}
                    {isActive && p.daysLeft > 0 && (
                      <div style={{ marginTop: "0.5rem" }}>
                        <div style={{ height: "3px", background: "#1a1a2e", borderRadius: "2px", overflow: "hidden" }}>
                          <div style={{
                            height: "100%",
                            width: `${(p.daysLeft / 30) * 100}%`,
                            background: p.daysLeft > 15 ? "#22c55e" : p.daysLeft > 7 ? "#eab308" : "#ef4444",
                            boxShadow: p.daysLeft > 15 ? "0 0 6px #22c55e66" : "none",
                            borderRadius: "2px",
                          }} />
                        </div>
                        <div style={{ fontSize: "0.52rem", color: "#4b5563", marginTop: "0.2rem", fontFamily: "'JetBrains Mono', monospace" }}>
                          {p.daysLeft} дн. осталось
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
