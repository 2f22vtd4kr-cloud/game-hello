import { useState, useEffect } from "react";

const NETWORK = "Лукойл";
const FUEL_TYPE = "АИ-95";
const VOLUME = 40;
const PRICE = 2968;
const HASH = "TKN-7F3A-2024-K9M";
const EXPIRES = "27 сентября 2026";

function MiniQR() {
  const size = 64;
  const cells = 11;
  const cell = size / cells;
  const pattern: number[][] = [];
  for (let r = 0; r < cells; r++) {
    pattern[r] = [];
    for (let c = 0; c < cells; c++) {
      const isFinder = (r < 4 && c < 4) || (r < 4 && c >= cells - 4) || (r >= cells - 4 && c < 4);
      if (isFinder) {
        const isOuter = r === 0 || r === 3 || c === 0 || c === 3 ||
          (r >= cells - 4 && (r === cells - 4 || r === cells - 1 || c === 0 || c === 3)) ||
          (c >= cells - 4 && (c === cells - 4 || c === cells - 1 || r === 0 || r === 3));
        const isInner = (r === 1 || r === 2) && (c === 1 || c === 2) ||
          (r === 1 || r === 2) && (c >= cells - 3 && c <= cells - 2) ||
          (r >= cells - 3 && r <= cells - 2) && (c === 1 || c === 2);
        pattern[r][c] = (isOuter || isInner) ? 1 : 0;
      } else {
        pattern[r][c] = Math.abs(Math.sin(r * 5 + c * 9)) > 0.5 ? 1 : 0;
      }
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ borderRadius: 6, display: "block" }}>
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

export function SuccessScreen() {
  const [show, setShow] = useState(false);
  const [cardShow, setCardShow] = useState(false);
  const [badgeShow, setBadgeShow] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShow(true), 200);
    const t2 = setTimeout(() => setCardShow(true), 550);
    const t3 = setTimeout(() => setBadgeShow(true), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #1E22DC 0%, #181CC6 40%, #1318B0 75%, #1015A5 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "1.5rem",
      fontFamily: "'Inter', system-ui, sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Stars */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} xmlns="http://www.w3.org/2000/svg">
        {Array.from({ length: 60 }, (_, i) => ({
          x: (i * 137.5 + 17) % 100,
          y: (i * 97.3 + 11) % 100,
          r: i % 5 === 0 ? 1.4 : i % 3 === 0 ? 1.1 : 0.7,
          op: 0.2 + (i % 7) * 0.08,
        })).map((s, i) => (
          <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="white" opacity={s.op} />
        ))}
      </svg>

      <div style={{
        width: "100%",
        maxWidth: "360px",
        position: "relative",
        zIndex: 1,
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(28px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}>
        {/* ── Green checkmark ── */}
        <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
          <div style={{
            width: "72px", height: "72px", borderRadius: "50%",
            background: "rgba(34,197,94,0.18)",
            border: "2px solid rgba(34,197,94,0.65)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1rem",
            boxShadow: "0 0 40px rgba(34,197,94,0.35), 0 0 80px rgba(34,197,94,0.12)",
          }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="#22c55e" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div style={{ color: "#ffffff", fontWeight: 800, fontSize: "1.35rem", marginBottom: "0.3rem" }}>
            Талон активирован!
          </div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.78rem" }}>
            QR-код в разделе «Хранилище»
          </div>

          {/* Price-lock badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            background: "rgba(232,98,42,0.18)",
            border: "1px solid rgba(232,98,42,0.5)",
            borderRadius: "20px",
            padding: "0.35rem 0.9rem",
            marginTop: "0.75rem",
            opacity: badgeShow ? 1 : 0,
            transform: badgeShow ? "scale(1)" : "scale(0.85)",
            transition: "opacity 0.4s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1)",
          }}>
            <span style={{ fontSize: "0.85rem" }}>🔒</span>
            <span style={{ color: "#E8622A", fontSize: "0.75rem", fontWeight: 700 }}>
              Цена зафиксирована на 90 дней
            </span>
          </div>
        </div>

        {/* ── Voucher card ── */}
        <div style={{
          background: "linear-gradient(135deg, rgba(180,40,30,0.92) 0%, rgba(140,20,15,0.95) 100%)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "16px",
          padding: "1rem 1.1rem",
          marginBottom: "0.75rem",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
          opacity: cardShow ? 1 : 0,
          transform: cardShow ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.45s ease, transform 0.45s ease",
        }}>
          {/* Card top sheen */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
          }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            {/* Left: text info */}
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.45rem",
                letterSpacing: "0.15em",
                color: "rgba(255,255,255,0.55)",
                marginBottom: "0.3rem",
              }}>
                ⛽ ЦИФРОВОЙ ТОПЛИВНЫЙ ТАЛОН
              </div>
              <div style={{ color: "#ffffff", fontWeight: 800, fontSize: "1.15rem", marginBottom: "0.4rem" }}>
                {NETWORK}
              </div>
              <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                {[
                  { label: FUEL_TYPE, color: "#fbbf24", bg: "rgba(251,191,36,0.2)" },
                  { label: `${VOLUME} л`, color: "#ffffff", bg: "rgba(255,255,255,0.15)" },
                  { label: `${PRICE.toLocaleString("ru")} ₽`, color: "#ffffff", bg: "rgba(255,255,255,0.12)" },
                ].map(({ label, color, bg }) => (
                  <span key={label} style={{
                    background: bg, color, fontSize: "0.7rem", fontWeight: 700,
                    borderRadius: "6px", padding: "0.15rem 0.45rem",
                  }}>
                    {label}
                  </span>
                ))}
              </div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.58rem",
                color: "rgba(255,255,255,0.5)",
                marginBottom: "0.2rem",
              }}>
                {HASH}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <span style={{ fontSize: "0.65rem" }}>🕐</span>
                <span style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.6)" }}>
                  Действует до {EXPIRES}
                </span>
              </div>
            </div>

            {/* Right: mini QR */}
            <div style={{ marginLeft: "0.75rem", flexShrink: 0, textAlign: "center" }}>
              <div style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "8px",
                padding: "4px",
              }}>
                <MiniQR />
              </div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.38rem",
                color: "rgba(255,255,255,0.5)",
                marginTop: "4px",
                letterSpacing: "0.06em",
              }}>
                ПРЕДЪЯВИ НА КАССЕ
              </div>
            </div>
          </div>
        </div>

        {/* ── Vault nav row ── */}
        <div style={{
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: "14px",
          padding: "0.85rem 1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "0.75rem",
          cursor: "pointer",
          opacity: cardShow ? 1 : 0,
          transition: "opacity 0.5s ease 0.15s",
        }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: "rgba(232,98,42,0.2)",
            border: "1px solid rgba(232,98,42,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1rem", flexShrink: 0,
          }}>
            🗃
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#ffffff", fontWeight: 700, fontSize: "0.88rem" }}>
              Хранилище →
            </div>
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.68rem", marginTop: "1px" }}>
              Все активные талоны, история покупок и начисленный XP — в одном месте. Доступно в любое время.
            </div>
          </div>
        </div>

        {/* ── Buy more CTA ── */}
        <button style={{
          width: "100%",
          padding: "0.85rem",
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.22)",
          borderRadius: "14px",
          color: "#ffffff",
          fontSize: "0.9rem",
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          opacity: cardShow ? 1 : 0,
          transition: "opacity 0.5s ease 0.25s",
        }}>
          <span>💳</span> Купить ещё
        </button>
      </div>
    </div>
  );
}
