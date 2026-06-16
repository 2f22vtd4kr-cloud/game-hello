import { useEffect, useState } from "react";
import QRCode from "qrcode";

const HASH = "TLN-7F3A9C2E-AI95-60L-SEV042-20260616";

export function QRTicket() {
  const [dataUrl, setDataUrl] = useState<string>("");
  const now = new Date();

  useEffect(() => {
    QRCode.toDataURL(HASH, {
      width: 300, margin: 2,
      color: { dark: "#0f0f0f", light: "#f0f0f4" },
    }).then(setDataUrl).catch(() => {});
  }, []);

  return (
    <div style={{
      minHeight: "100vh", background: "rgba(3,3,8,0.98)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, sans-serif", padding: "1.25rem",
    }}>
      {/* Scan-line overlay */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(168,85,247,0.018) 3px,rgba(168,85,247,0.018) 4px)" }} />

      <div style={{
        background: "linear-gradient(160deg, #0d0d18, #120820)",
        border: "1px solid rgba(168,85,247,0.35)",
        borderRadius: "24px", padding: "1.5rem",
        maxWidth: "320px", width: "100%",
        position: "relative", overflow: "hidden",
        boxShadow: "0 0 60px rgba(168,85,247,0.18), 0 0 120px rgba(219,39,119,0.08)",
        textAlign: "center",
      }}>
        {/* Top glow line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#a855f7,#db2777,transparent)" }} />

        {/* Active dot */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", marginBottom: "0.85rem" }}>
          <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
          <span style={{ color: "#22c55e", fontSize: "0.52rem", fontFamily: "'Courier New',monospace", letterSpacing: "0.1em" }}>
            АКТИВЕН · ДЕЙСТВИТЕЛЕН 24Ч
          </span>
        </div>

        {/* Header */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontFamily: "'Courier New',monospace", color: "#a855f7", fontSize: "0.46rem", letterSpacing: "0.22em", marginBottom: "0.25rem" }}>
            ⛽️ ТОПЛИВНЫЙ ВАУЧЕР
          </div>
          <p style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "0.92rem", margin: "0 0 0.2rem" }}>
            Предъявите QR контролёру
          </p>
          <p style={{ color: "#4b5563", fontSize: "0.62rem", margin: 0 }}>
            {now.toLocaleDateString("ru", { day: "2-digit", month: "long" })} · {now.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        {/* Fuel + timer chips */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          <div style={{
            flex: 1, background: "#0b0b12", border: "1px solid #1e1e2a",
            borderRadius: "12px", padding: "0.55rem 0.4rem",
            display: "flex", flexDirection: "column", alignItems: "center",
          }}>
            <div style={{ color: "#4b5563", fontSize: "0.44rem", fontFamily: "'Courier New',monospace", letterSpacing: "0.1em", marginBottom: "3px" }}>ТОПЛИВО / ОБЪЁМ</div>
            <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "0.82rem" }}>АИ-95 · 60 л</div>
          </div>
          <div style={{
            flex: 1, background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.28)",
            borderRadius: "12px", padding: "0.55rem 0.4rem",
            display: "flex", flexDirection: "column", alignItems: "center",
          }}>
            <div style={{ color: "#22c55e", fontSize: "0.44rem", fontFamily: "'Courier New',monospace", letterSpacing: "0.1em", marginBottom: "3px", opacity: 0.75 }}>ИСТЕКАЕТ</div>
            <div style={{ color: "#22c55e", fontWeight: 800, fontSize: "0.86rem", fontFamily: "'Courier New',monospace" }}>23:47:31</div>
          </div>
        </div>

        {/* QR code with corner accents */}
        <div style={{ position: "relative", display: "inline-block", margin: "0 auto" }}>
          <div style={{
            width: "220px", height: "220px", margin: "0 auto",
            borderRadius: "16px", overflow: "hidden",
            border: "2px solid rgba(168,85,247,0.35)",
            boxShadow: "0 0 32px rgba(168,85,247,0.22), inset 0 0 20px rgba(168,85,247,0.06)",
          }}>
            {dataUrl ? (
              <img src={dataUrl} alt="QR" style={{ width: "100%", height: "100%", display: "block" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "#0b0b12", display: "flex", alignItems: "center", justifyContent: "center", color: "#a855f7", fontSize: "1.5rem" }}>⟳</div>
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
                : { bottom: 0, right: 0, borderBottomWidth: "2px", borderRightWidth: "2px", borderBottomRightRadius: "4px" })
              }
            />
          ))}
        </div>

        {/* Hash code */}
        <div style={{
          margin: "0.9rem 0 0.2rem", padding: "0.5rem 0.75rem",
          background: "#0b0b12", border: "1px solid #1e1e2a",
          borderRadius: "10px", display: "flex", alignItems: "center", gap: "0.5rem",
          cursor: "pointer",
        }}>
          <span style={{ fontFamily: "'Courier New',monospace", fontSize: "0.58rem", color: "#4b5563", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {HASH}
          </span>
          <span style={{ fontSize: "0.7rem", color: "#6b7280", flexShrink: 0 }}>⎘</span>
        </div>
        <p style={{ color: "#2d3748", fontSize: "0.55rem", margin: "0.25rem 0 0.85rem" }}>
          Нажмите на код для копирования
        </p>

        {/* Action buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "0.85rem" }}>
          {[
            { icon: "📷", label: "PNG" },
            { icon: "📄", label: "PDF" },
            { icon: "📋", label: "Копировать" },
            { icon: "📤", label: "В Telegram" },
          ].map(({ icon, label }) => (
            <button key={label} style={{
              background: "rgba(168,85,247,0.09)", border: "1px solid rgba(168,85,247,0.25)",
              borderRadius: "10px", padding: "0.5rem 0.35rem",
              color: "#c4b5fd", fontSize: "0.64rem", fontWeight: 600,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
            }}>
              <span style={{ fontSize: "0.8rem" }}>{icon}</span>{label}
            </button>
          ))}
        </div>

        {/* Close button */}
        <button style={{
          width: "100%", padding: "0.75rem",
          background: "linear-gradient(135deg, #a855f7, #db2777)",
          border: "none", borderRadius: "14px",
          color: "#fff", fontSize: "0.88rem", fontWeight: 700,
          cursor: "pointer", boxShadow: "0 0 20px rgba(168,85,247,0.4)",
        }}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
