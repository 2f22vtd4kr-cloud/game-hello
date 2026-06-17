import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";

const NETWORK = "Лукойл";
const NET_COLOR = "#f59e0b";
const FUEL = "ЭКТО Plus";
const VOLUME = 40;
const HASH = "TLN-LK-9F3A2C7E-EKTO95-40L-SEV2026";
const DAYS_LEFT = 27;
const EXPIRES_ISO = new Date(Date.now() + DAYS_LEFT * 24 * 3600 * 1000).toISOString();

function expiryInfo(expiresAt: string) {
  const now = Date.now();
  const exp = new Date(expiresAt).getTime();
  const totalMs = 30 * 24 * 3600 * 1000;
  const leftMs = exp - now;
  const daysLeft = Math.max(0, Math.ceil(leftMs / (24 * 3600 * 1000)));
  const pct = Math.max(0, Math.min(100, (leftMs / totalMs) * 100));
  if (leftMs <= 0) return { color: "#ef4444", label: "Истёк", pct: 0, daysLeft: 0 };
  if (daysLeft <= 7) return { color: "#ef4444", label: `${daysLeft} дн. осталось`, pct, daysLeft };
  if (daysLeft <= 15) return { color: "#eab308", label: `${daysLeft} дн. осталось`, pct, daysLeft };
  return { color: "#22c55e", label: `${daysLeft} дн. осталось`, pct, daysLeft };
}

type Corner = "tl" | "tr" | "bl" | "br";
function cornerStyle(k: Corner): React.CSSProperties {
  if (k === "tl") return { top: 0, left: 0, borderTopWidth: "2px", borderLeftWidth: "2px", borderTopLeftRadius: "4px" };
  if (k === "tr") return { top: 0, right: 0, borderTopWidth: "2px", borderRightWidth: "2px", borderTopRightRadius: "4px" };
  if (k === "bl") return { bottom: 0, left: 0, borderBottomWidth: "2px", borderLeftWidth: "2px", borderBottomLeftRadius: "4px" };
  return { bottom: 0, right: 0, borderBottomWidth: "2px", borderRightWidth: "2px", borderBottomRightRadius: "4px" };
}

export function NetworkVoucherPost() {
  const [dataUrl, setDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const scanRef = useRef(0);
  const [scanY, setScanY] = useState(0);
  const expiry = expiryInfo(EXPIRES_ISO);
  const now = new Date();

  useEffect(() => {
    QRCode.toDataURL(HASH, {
      width: 300, margin: 2,
      color: { dark: "#0f0f0f", light: "#f0f0f4" },
    }).then(setDataUrl).catch(() => {});
  }, []);

  useEffect(() => {
    let raf: number;
    let start: number | null = null;
    const dur = 2400;
    function tick(ts: number) {
      if (!start) start = ts;
      const elapsed = (ts - start) % (dur * 2);
      const progress = elapsed < dur ? elapsed / dur : 2 - elapsed / dur;
      setScanY(progress * 220);
      scanRef.current = raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "rgba(3,3,8,0.97)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1.25rem",
      fontFamily: "system-ui, sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      {/* CRT scanlines */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(168,85,247,0.018) 3px,rgba(168,85,247,0.018) 4px)", zIndex: 0 }} />

      <div style={{
        background: `linear-gradient(160deg, #0d0d18, ${NET_COLOR}04)`,
        border: `1px solid ${NET_COLOR}55`,
        borderRadius: "24px",
        padding: "1.5rem",
        maxWidth: "320px", width: "100%",
        position: "relative", overflow: "hidden",
        boxShadow: `0 0 60px ${NET_COLOR}22, 0 0 120px #db277711`,
        textAlign: "center", zIndex: 1,
      }}>
        {/* Top glow line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg,transparent,${NET_COLOR},#db2777,transparent)` }} />
        <div style={{ position: "absolute", top: "-20%", right: "-10%", width: "55%", height: "55%", background: `radial-gradient(circle,${NET_COLOR}09,transparent 70%)`, pointerEvents: "none" }} />

        {/* Status dot */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", marginBottom: "0.85rem" }}>
          <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: expiry.color, boxShadow: `0 0 8px ${expiry.color}` }} />
          <span style={{ color: expiry.color, fontSize: "0.5rem", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.1em", fontWeight: 700 }}>
            АКТИВЕН · {expiry.label.toUpperCase()}
          </span>
        </div>

        {/* Header */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a855f7", fontSize: "0.46rem", letterSpacing: "0.22em", marginBottom: "0.3rem" }}>
            ⛽️ СЕТЕВОЙ ТОПЛИВНЫЙ ВАУЧЕР
          </div>
          <div style={{ color: "#e2e8f0", fontWeight: 900, fontSize: "1.3rem", letterSpacing: "0.01em", lineHeight: 1.1, marginBottom: "0.2rem" }}>
            {NETWORK}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: NET_COLOR, fontSize: "0.65rem", fontWeight: 700, marginBottom: "0.45rem" }}>
            {FUEL} · {VOLUME}л
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "0.3rem",
            background: `${NET_COLOR}12`, border: `1px solid ${NET_COLOR}44`,
            borderRadius: "20px", padding: "0.22rem 0.7rem",
          }}>
            <span style={{ fontSize: "0.6rem" }}>✓</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: NET_COLOR, fontSize: "0.48rem", fontWeight: 700, letterSpacing: "0.06em" }}>
              ДЕЙСТВУЕТ НА ВСЕХ АЗС СЕТИ {NETWORK.toUpperCase()}
            </span>
          </div>
          <div style={{ color: "#4b5563", fontSize: "0.58rem", marginTop: "0.4rem" }}>
            {now.toLocaleDateString("ru", { day: "2-digit", month: "long", year: "numeric" })} · {now.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>

        {/* QR with scanner beam */}
        <div style={{ position: "relative", display: "inline-block", margin: "0 auto" }}>
          <div style={{
            width: "220px", height: "220px", margin: "0 auto",
            borderRadius: "16px", overflow: "hidden",
            border: `2px solid ${NET_COLOR}44`,
            boxShadow: `0 0 32px ${NET_COLOR}22, inset 0 0 20px ${NET_COLOR}08`,
            position: "relative",
          }}>
            {dataUrl ? (
              <img src={dataUrl} alt="QR" style={{ width: "100%", height: "100%", display: "block" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "#0b0b12", display: "flex", alignItems: "center", justifyContent: "center", color: "#a855f7", fontSize: "1.5rem" }}>⟳</div>
            )}
            {/* Animated scanner beam */}
            {dataUrl && (
              <div style={{
                position: "absolute", left: 0, right: 0, top: `${scanY}px`,
                height: "3px",
                background: `linear-gradient(90deg,transparent,${NET_COLOR}cc,transparent)`,
                boxShadow: `0 0 8px ${NET_COLOR}88`,
                pointerEvents: "none",
                transform: "translateY(-50%)",
              }} />
            )}
          </div>
          {(["tl", "tr", "bl", "br"] as Corner[]).map((k) => (
            <div key={k} style={{
              position: "absolute", width: "16px", height: "16px",
              borderColor: NET_COLOR, borderStyle: "solid", borderWidth: 0,
              ...cornerStyle(k),
            }} />
          ))}
        </div>

        {/* Hash */}
        <div
          onClick={() => { navigator.clipboard.writeText(HASH).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          style={{
            margin: "0.9rem 0 0", padding: "0.5rem 0.75rem",
            background: "#0b0b12", border: "1px solid #1e1e2a",
            borderRadius: "10px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "0.5rem",
          }}
        >
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.58rem", color: "#4b5563", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {HASH}
          </span>
          <span style={{ fontSize: "0.7rem", color: copied ? "#22c55e" : "#6b7280" }}>{copied ? "✓" : "⎘"}</span>
        </div>
        <p style={{ color: "#2a2a36", fontSize: "0.5rem", margin: "0.2rem 0 0.75rem", fontFamily: "'JetBrains Mono',monospace" }}>
          Нажмите на код для копирования
        </p>

        {/* Expiry bar */}
        <div style={{
          background: "#0b0b12", border: `1px solid ${expiry.color}28`,
          borderRadius: "10px", padding: "0.5rem 0.75rem", marginBottom: "0.65rem",
          textAlign: "left",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.44rem", color: "#374151", letterSpacing: "0.1em" }}>СРОК ДЕЙСТВИЯ</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.52rem", color: expiry.color, fontWeight: 700 }}>{expiry.label}</span>
          </div>
          <div style={{ height: "5px", background: "#111118", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{ width: `${expiry.pct}%`, height: "100%", background: expiry.color, borderRadius: "3px", boxShadow: `0 0 6px ${expiry.color}` }} />
          </div>
        </div>

        {/* Action buttons — NO payment buttons here, already paid */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.65rem" }}>
          {[
            { icon: "💾", label: "PNG", onClick: () => { setSaving(true); setTimeout(() => setSaving(false), 800); } },
            { icon: "📄", label: "PDF", onClick: () => {} },
            { icon: "📤", label: "В TG", onClick: () => {} },
            { icon: "📋", label: "Копировать", onClick: () => {} },
          ].map(({ icon, label, onClick }) => (
            <button key={label} onClick={onClick} style={{
              flex: 1, padding: "0.45rem 0.15rem",
              background: "#0b0b12", border: "1px solid #1e1e2a",
              borderRadius: "8px", color: "#6b7280",
              fontSize: "0.55rem", cursor: "pointer",
              fontFamily: "'JetBrains Mono',monospace",
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: "2px",
            }}>
              <span style={{ fontSize: "0.8rem" }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        <button style={{
          width: "100%", padding: "0.7rem",
          background: `linear-gradient(135deg, ${NET_COLOR}, #db2777)`,
          border: "none", borderRadius: "14px",
          color: "#fff", fontSize: "0.85rem", fontWeight: 700,
          cursor: "pointer", boxShadow: `0 0 20px ${NET_COLOR}44`,
          letterSpacing: "0.02em",
        }}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
