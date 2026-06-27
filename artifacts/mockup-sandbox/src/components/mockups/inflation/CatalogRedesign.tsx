import { useState, useEffect } from "react";

const FUELS = [
  { label: "АИ-92",  icon: "🟢", price: 47, monthlyPct: 2.8 },
  { label: "АИ-95",  icon: "🔵", price: 52, monthlyPct: 3.1 },
  { label: "АИ-95+", icon: "🟣", price: 56, monthlyPct: 3.4 },
  { label: "ДТ",     icon: "⚫", price: 60, monthlyPct: 2.5 },
];

const VOLUMES = [20, 40, 60];

function expiryColor(daysLeft: number) {
  if (daysLeft > 60) return "#22c55e";
  if (daysLeft > 30) return "#eab308";
  return "#ef4444";
}

function expiryLabel(daysLeft: number) {
  if (daysLeft > 60) return `${daysLeft} дн.`;
  if (daysLeft > 30) return `${daysLeft} дн.`;
  return `⚠️ ${daysLeft} дн.`;
}

const SAMPLE_VOUCHERS = [
  { fuel: "АИ-92", volume: 40, lockedPrice: 47, boughtDate: "3 апр", daysLeft: 82 },
  { fuel: "АИ-95", volume: 20, lockedPrice: 52, boughtDate: "28 мар", daysLeft: 56 },
  { fuel: "ДТ",    volume: 60, lockedPrice: 60, boughtDate: "14 мар", daysLeft: 24 },
];

export function CatalogRedesign() {
  const [tab, setTab] = useState<"buy"|"vault">("buy");
  const [fuelIdx, setFuelIdx] = useState(0);
  const [volume, setVolume] = useState(40);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60);
    return () => clearInterval(id);
  }, []);

  const fuel = FUELS[fuelIdx];
  const lockedPrice = fuel.price;
  const totalRub = lockedPrice * volume;
  const totalStars = Math.ceil(totalRub / 1.84);
  const saving3mo = (fuel.price * fuel.monthlyPct * 3 / 100 * volume).toFixed(0);

  // animated live market price
  const livePrice = (fuel.price + Math.sin(tick * 0.04) * 0.35 + tick * 0.003).toFixed(2);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#050507",
      fontFamily: "system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none",
        background: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(168,85,247,0.015) 3px,rgba(168,85,247,0.015) 4px)", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ padding: "1rem 1rem 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a855f7", fontSize: "0.44rem", letterSpacing: "0.15em" }}>
                ТОПЛИВНЫЕ ТАЛОНЫ
              </div>
              <div style={{ color: "#f1f5f9", fontSize: "1.05rem", fontWeight: 800, lineHeight: 1.2 }}>
                Каталог
              </div>
            </div>
            {/* Live price ticker pill */}
            <div style={{
              background: "#100808", border: "1px solid #ef444433",
              borderRadius: "20px", padding: "0.25rem 0.6rem",
              display: "flex", alignItems: "center", gap: "0.35rem",
            }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 4px #ef4444" }} />
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.42rem", color: "#ef4444" }}>
                {fuel.label} {livePrice}₽
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", background: "#0d0d18", borderRadius: "12px", padding: "3px", marginBottom: "1rem" }}>
            {(["buy","vault"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: "0.5rem",
                background: tab === t ? "linear-gradient(135deg,#a855f7,#db2777)" : "transparent",
                border: "none", borderRadius: "10px",
                color: tab === t ? "#fff" : "#4b5563",
                fontSize: "0.7rem", fontWeight: tab === t ? 700 : 400,
                cursor: "pointer",
              }}>
                {t === "buy" ? "🛒 Купить" : "🗄 Хранилище"}
              </button>
            ))}
          </div>
        </div>

        {tab === "buy" ? (
          <div style={{ padding: "0 1rem 1rem", flex: 1, display: "flex", flexDirection: "column", gap: "0.75rem" }}>

            {/* Anti-inflation banner */}
            <div style={{
              background: "linear-gradient(135deg,#0d0d20,#130820)",
              border: "1px solid #a855f744",
              borderRadius: "16px",
              padding: "0.85rem",
              position: "relative",
              overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px",
                background: "linear-gradient(90deg,transparent,#a855f7,transparent)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <div style={{ fontSize: "1.5rem" }}>🔒</div>
                <div>
                  <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: "0.75rem", marginBottom: "0.15rem" }}>
                    Цена заморожена на 90 дней
                  </div>
                  <div style={{ color: "#6b7280", fontSize: "0.6rem", lineHeight: 1.5 }}>
                    Купи сегодня — заправляйся по сегодняшней цене. Рынок растёт — ваши литры нет.
                  </div>
                </div>
              </div>
              <div style={{
                marginTop: "0.6rem",
                display: "flex",
                gap: "0.4rem",
              }}>
                {[
                  { icon: "📈", label: "+2–4%/мес", sub: "инфляция топлива" },
                  { icon: "💰", label: `+${saving3mo}₽`, sub: "экономия за 3 мес" },
                  { icon: "🛡️", label: "90 дней", sub: "срок талона" },
                ].map(({ icon, label, sub }) => (
                  <div key={sub} style={{ flex: 1, background: "#0a0a14", borderRadius: "10px",
                    padding: "0.4rem 0.3rem", textAlign: "center", border: "1px solid #1e1e2a" }}>
                    <div style={{ fontSize: "0.75rem" }}>{icon}</div>
                    <div style={{ color: "#a855f7", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", fontWeight: 700 }}>{label}</div>
                    <div style={{ color: "#374151", fontSize: "0.38rem" }}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fuel type */}
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.42rem", color: "#374151", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>
                ВИД ТОПЛИВА
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                {FUELS.map((f, i) => {
                  const saving = (f.price * f.monthlyPct * 3 / 100).toFixed(1);
                  return (
                    <button key={f.label} onClick={() => setFuelIdx(i)} style={{
                      background: fuelIdx === i ? "#a855f714" : "#0d0d18",
                      border: `1px solid ${fuelIdx === i ? "#a855f7" : "#1e1e2a"}`,
                      borderRadius: "12px", cursor: "pointer", padding: "0.6rem 0.75rem",
                      textAlign: "left",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "0.7rem" }}>{f.label}</span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#22c55e", fontSize: "0.42rem" }}>+{saving}₽/л</span>
                      </div>
                      <div style={{ color: "#a855f7", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.65rem", fontWeight: 700, marginTop: "0.15rem" }}>
                        {f.price}₽<span style={{ color: "#374151", fontSize: "0.42rem", fontWeight: 400 }}>/л</span>
                      </div>
                      <div style={{ color: "#374151", fontSize: "0.4rem", marginTop: "0.1rem" }}>
                        экономия·3мес
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Volume */}
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.42rem", color: "#374151", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>
                ОБЪЁМ
              </div>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                {VOLUMES.map(v => (
                  <button key={v} onClick={() => setVolume(v)} style={{
                    flex: 1, padding: "0.55rem",
                    background: volume === v ? "#db277722" : "#0d0d18",
                    border: `1px solid ${volume === v ? "#db2777" : "#1e1e2a"}`,
                    borderRadius: "12px", cursor: "pointer",
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: "0.6rem",
                    color: volume === v ? "#db2777" : "#4b5563",
                    fontWeight: volume === v ? 700 : 400,
                  }}>
                    {v}л
                  </button>
                ))}
              </div>
            </div>

            {/* Price summary */}
            <div style={{
              background: "#0d0d18", border: "1px solid #1e1e2a",
              borderRadius: "14px", padding: "0.75rem",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                <span style={{ color: "#6b7280", fontSize: "0.65rem" }}>{volume}л × {lockedPrice}₽</span>
                <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "0.65rem" }}>{totalRub}₽</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                <span style={{ color: "#6b7280", fontSize: "0.65rem" }}>Экономия через 3 мес.</span>
                <span style={{ color: "#22c55e", fontWeight: 700, fontSize: "0.65rem" }}>+{saving3mo}₽</span>
              </div>
              <div style={{ height: "1px", background: "#1e1e2a", margin: "0.4rem 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#9ca3af", fontSize: "0.62rem" }}>Stars</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a855f7", fontWeight: 700, fontSize: "0.72rem" }}>⭐ {totalStars}</span>
              </div>
            </div>

            <button style={{
              width: "100%", padding: "0.85rem",
              background: "linear-gradient(135deg,#a855f7,#db2777)",
              border: "none", borderRadius: "14px",
              color: "#fff", fontSize: "0.88rem", fontWeight: 800,
              cursor: "pointer", boxShadow: "0 0 24px #a855f740",
            }}>
              Зафиксировать {volume}л {fuel.label} · ⭐{totalStars}
            </button>
          </div>
        ) : (
          /* Vault */
          <div style={{ padding: "0 1rem 1rem", flex: 1, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.42rem", color: "#374151", letterSpacing: "0.1em", marginBottom: "0.25rem" }}>
              АКТИВНЫЕ ТАЛОНЫ · {SAMPLE_VOUCHERS.length}
            </div>
            {SAMPLE_VOUCHERS.map((v, i) => {
              const c = expiryColor(v.daysLeft);
              const marketNow = (FUELS.find(f => f.label === v.fuel)?.price ?? v.lockedPrice) * (1 + 0.028 * (90 - v.daysLeft) / 30);
              const savedSoFar = ((marketNow - v.lockedPrice) * v.volume).toFixed(0);
              return (
                <div key={i} style={{
                  background: "#0d0d18", border: `1px solid ${c}33`,
                  borderRadius: "14px", padding: "0.85rem",
                  position: "relative", overflow: "hidden",
                }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px",
                    background: `linear-gradient(90deg,transparent,${c},transparent)` }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                    <div>
                      <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "0.75rem" }}>{v.fuel} · {v.volume}л</div>
                      <div style={{ color: "#4b5563", fontSize: "0.52rem" }}>{v.lockedPrice}₽/л · куплен {v.boughtDate}</div>
                    </div>
                    <div style={{
                      display: "flex", alignItems: "center", gap: "0.25rem",
                      background: `${c}12`, border: `1px solid ${c}33`,
                      borderRadius: "20px", padding: "0.2rem 0.5rem",
                    }}>
                      <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: c, boxShadow: `0 0 4px ${c}` }} />
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", color: c, fontSize: "0.45rem", fontWeight: 700 }}>
                        {expiryLabel(v.daysLeft)}
                      </span>
                    </div>
                  </div>
                  {/* Savings counter */}
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <div style={{ flex: 1, background: "#0a0a10", borderRadius: "8px", padding: "0.35rem 0.5rem", textAlign: "center" }}>
                      <div style={{ color: "#22c55e", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.58rem", fontWeight: 700 }}>+{savedSoFar}₽</div>
                      <div style={{ color: "#374151", fontSize: "0.38rem" }}>сэкономлено</div>
                    </div>
                    <div style={{ flex: 1, background: "#0a0a10", borderRadius: "8px", padding: "0.35rem 0.5rem", textAlign: "center" }}>
                      <div style={{ color: c, fontFamily: "'JetBrains Mono',monospace", fontSize: "0.58rem", fontWeight: 700 }}>{v.daysLeft}д</div>
                      <div style={{ color: "#374151", fontSize: "0.38rem" }}>осталось</div>
                    </div>
                    <button style={{
                      flex: 2, background: "linear-gradient(135deg,#a855f7,#db2777)",
                      border: "none", borderRadius: "8px",
                      color: "#fff", fontSize: "0.6rem", fontWeight: 700, cursor: "pointer",
                    }}>
                      QR-код →
                    </button>
                  </div>
                  {/* Expiry bar */}
                  <div style={{ marginTop: "0.5rem", height: "3px", background: "#1e1e2a", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{ width: `${(v.daysLeft / 90) * 100}%`, height: "100%", background: c, borderRadius: "2px" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
