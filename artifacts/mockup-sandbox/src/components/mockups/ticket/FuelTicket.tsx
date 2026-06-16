import { useEffect, useState } from "react";
import QRCode from "qrcode";

const HASH = "TLN-7F3A9C2E-AI95-60L-SEV042-20260616";

export default function FuelTicket() {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL(HASH, {
      width: 300, margin: 2,
      color: { dark: "#0f0f0f", light: "#f0f0f4" },
    }).then(setDataUrl).catch(() => {});
  }, []);

  const now = new Date();

  return (
    <div style={{
      minHeight: "100vh",
      background: "#050507",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
      padding: "1rem",
    }}>
      {/* Scan line bg */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(168,85,247,0.02) 3px,rgba(168,85,247,0.02) 4px)",
      }} />

      <div style={{
        background: "linear-gradient(160deg, #0d0d18, #120820)",
        border: "1px solid #a855f755",
        borderRadius: "24px",
        padding: "1.5rem",
        textAlign: "center",
        maxWidth: "300px",
        width: "100%",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 0 60px #a855f722, 0 0 120px #db277711",
      }}>
        {/* Top rainbow line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, #a855f7, #db2777, transparent)" }} />

        {/* Header */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", color: "#a855f7", fontSize: "0.5rem", letterSpacing: "0.2em", marginBottom: "0.25rem" }}>
            ⛽️ ТОПЛИВНЫЙ ВАУЧЕР
          </div>
          <p style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "0.9rem", margin: 0 }}>
            Предъявите QR контролёру
          </p>
          <p style={{ color: "#4b5563", fontSize: "0.62rem", margin: "0.2rem 0 0" }}>
            {now.toLocaleDateString("ru", { day: "2-digit", month: "long", year: "numeric" })} · {now.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        {/* Ticket details strip */}
        <div style={{
          background: "#0b0b0f", border: "1px solid #1e1e2a",
          borderRadius: "12px", padding: "0.6rem 0.9rem",
          marginBottom: "1rem",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ textAlign: "left" }}>
            <div style={{ color: "#4b5563", fontSize: "0.55rem", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.1em", marginBottom: "2px" }}>ТОПЛИВО / ОБЪЁМ</div>
            <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "0.85rem" }}>АИ-95 · 60 л</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#4b5563", fontSize: "0.55rem", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.1em", marginBottom: "2px" }}>СТОИМОСТЬ</div>
            <div style={{ color: "#a855f7", fontWeight: 700, fontSize: "0.85rem", fontFamily: "'JetBrains Mono',monospace" }}>3 120 ₽</div>
          </div>
        </div>

        {/* Station strip */}
        <div style={{
          background: "#0b0b0f", border: "1px solid #1e1e2a",
          borderRadius: "12px", padding: "0.5rem 0.9rem",
          marginBottom: "1rem",
          textAlign: "left",
        }}>
          <div style={{ color: "#4b5563", fontSize: "0.55rem", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.1em", marginBottom: "2px" }}>СТАНЦИЯ</div>
          <div style={{ color: "#9ca3af", fontSize: "0.75rem" }}>⛽ Роснефть АЗС #42 · Севастополь</div>
        </div>

        {/* QR code */}
        <div style={{ position: "relative", display: "inline-block", margin: "0 auto" }}>
          <div style={{
            width: "200px", height: "200px", margin: "0 auto",
            borderRadius: "16px", overflow: "hidden",
            border: "2px solid #a855f744",
            boxShadow: "0 0 30px #a855f730, inset 0 0 20px #a855f710",
            position: "relative",
          }}>
            {dataUrl ? (
              <img src={dataUrl} alt="QR" style={{ width: "100%", height: "100%", display: "block" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "#0b0b0f", display: "flex", alignItems: "center", justifyContent: "center", color: "#a855f7" }}>⟳</div>
            )}
          </div>
          {/* Corner accents */}
          {(["tl","tr","bl","br"] as const).map((k) => (
            <div key={k} style={{
              position: "absolute", width: "16px", height: "16px",
              borderColor: "#a855f7", borderStyle: "solid", borderWidth: 0,
              ...(k === "tl" ? { top: 0, left: 0, borderTopWidth: "2px", borderLeftWidth: "2px", borderTopLeftRadius: "4px" }
                : k === "tr" ? { top: 0, right: 0, borderTopWidth: "2px", borderRightWidth: "2px", borderTopRightRadius: "4px" }
                : k === "bl" ? { bottom: 0, left: 0, borderBottomWidth: "2px", borderLeftWidth: "2px", borderBottomLeftRadius: "4px" }
                : { bottom: 0, right: 0, borderBottomWidth: "2px", borderRightWidth: "2px", borderBottomRightRadius: "4px" }),
            }} />
          ))}
        </div>

        {/* Hash code */}
        <div style={{
          margin: "0.9rem 0 0", padding: "0.5rem 0.75rem",
          background: "#0b0b0f", border: "1px solid #1e1e2a",
          borderRadius: "8px", cursor: "pointer",
          display: "flex", alignItems: "center", gap: "0.5rem",
        }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", color: "#4b5563", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {HASH}
          </span>
          <span style={{ fontSize: "0.7rem", color: "#6b7280", flexShrink: 0 }}>⎘</span>
        </div>
        <p style={{ color: "#374151", fontSize: "0.55rem", margin: "0.3rem 0 0.75rem" }}>
          Нажмите на код для копирования
        </p>

        {/* Action buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "0.75rem" }}>
          {[
            { icon: "📷", label: "Сохранить PNG" },
            { icon: "📄", label: "Скачать PDF" },
            { icon: "📋", label: "Скопировать" },
            { icon: "📤", label: "В Telegram" },
          ].map(({ icon, label }) => (
            <button key={label} style={{
              background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)",
              borderRadius: "10px", padding: "0.5rem 0.35rem",
              color: "#c4b5fd", fontSize: "0.65rem", fontWeight: 600,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
            }}>
              <span style={{ fontSize: "0.8rem" }}>{icon}</span>{label}
            </button>
          ))}
        </div>

        {/* Close button */}
        <button style={{
          width: "100%", padding: "0.7rem",
          background: "linear-gradient(135deg,#a855f7,#db2777)",
          border: "none", borderRadius: "12px",
          color: "#fff", fontSize: "0.85rem", fontWeight: 700,
          cursor: "pointer", boxShadow: "0 0 16px #a855f740",
        }}>
          Закрыть
        </button>

        {/* Status badge */}
        <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
          <span style={{ color: "#22c55e", fontSize: "0.6rem", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.08em" }}>АКТИВЕН</span>
        </div>
      </div>
    </div>
  );
}
