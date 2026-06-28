import { useState } from "react";
import "./catalog.css";

const NETWORKS = [
  { name: "Лукойл",       color: "#DC143C", glow: "#DC143C",  emoji: "🔴", badge: "ЭКТО",      fuels: ["АИ-92","АИ-95","АИ-95+","АИ-100","ДТ","ДТ+","Газ"], prices: { "АИ-92":65.9,"АИ-95":74.2,"АИ-95+":79.5,"АИ-100":92.0,"ДТ":80.5,"ДТ+":85.3,"Газ":31.2 } },
  { name: "Роснефть",     color: "#1E90FF", glow: "#1E90FF",  emoji: "🔵", badge: "PULSAR",     fuels: ["АИ-92","АИ-95","АИ-95+","АИ-100","ДТ","ДТ+","Газ"], prices: { "АИ-92":65.1,"АИ-95":72.9,"АИ-95+":78.0,"АИ-100":90.5,"ДТ":79.4,"ДТ+":84.2,"Газ":30.5 } },
  { name: "Газпромнефть", color: "#2979FF", glow: "#4488FF",  emoji: "🟦", badge: "G-DRIVE",    fuels: ["АИ-92","АИ-95","АИ-95+","АИ-100","ДТ","ДТ+","Газ"], prices: { "АИ-92":65.4,"АИ-95":73.4,"АИ-95+":78.5,"АИ-100":91.2,"ДТ":79.9,"ДТ+":84.7,"Газ":30.9 } },
  { name: "Башнефть",     color: "#7C3AED", glow: "#9333EA",  emoji: "🟣", badge: "ATUM",       fuels: ["АИ-92","АИ-95","АИ-95+","ДТ","Газ"], prices: { "АИ-92":61.9,"АИ-95":66.1,"АИ-95+":70.7,"ДТ":75.8,"Газ":26.5 } },
  { name: "Татнефть",     color: "#059669", glow: "#10B981",  emoji: "🟢", badge: "ТАНЕКО",     fuels: ["АИ-92","АИ-95","АИ-95+","ДТ","ДТ+","Газ"], prices: { "АИ-92":62.4,"АИ-95":66.8,"АИ-95+":71.5,"ДТ":76.4,"ДТ+":81.0,"Газ":26.9 } },
  { name: "ННК",          color: "#D97706", glow: "#F59E0B",  emoji: "🟡", badge: "NEO",        fuels: ["АИ-92","АИ-95","ДТ","Газ"], prices: { "АИ-92":70.5,"АИ-95":74.8,"ДТ":87.9,"Газ":35.0 } },
];

const FUEL_LABELS: Record<string, string> = {
  "АИ-92":"АИ-92","АИ-95":"АИ-95","АИ-95+":"АИ-95 Plus","АИ-100":"АИ-100","ДТ":"Дизель","ДТ+":"Дизель Plus","Газ":"Газ (СУГ)"
};

const VOLUMES = [20, 40, 60];

type Step = "networks" | "fuel" | "volume" | "confirm";

interface Selection {
  network: typeof NETWORKS[0] | null;
  fuel: string | null;
  volume: number;
}

function FreezeHero() {
  return (
    <div className="freeze-hero">
      <div className="freeze-glow-ring" />
      <div className="freeze-content">
        <span className="freeze-icon">🔒</span>
        <div className="freeze-text-block">
          <span className="freeze-headline">Цена заморожена</span>
          <span className="freeze-sub">на 90 дней · защита от роста рынка</span>
        </div>
      </div>
    </div>
  );
}

function NetworkCard({ net, onSelect, isSelected }: {
  net: typeof NETWORKS[0];
  onSelect: () => void;
  isSelected: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className="network-card"
      style={{
        "--net-color": net.color,
        "--net-glow": net.glow,
        borderColor: isSelected ? net.color : "rgba(255,255,255,0.07)",
        background: isSelected
          ? `linear-gradient(135deg, ${net.color}18 0%, ${net.color}06 100%)`
          : "rgba(255,255,255,0.03)",
        boxShadow: isSelected
          ? `0 0 0 1px ${net.color}55, 0 8px 32px ${net.glow}25`
          : "none",
      } as React.CSSProperties}
    >
      <div className="nc-left">
        <span className="nc-emoji">{net.emoji}</span>
        <div className="nc-names">
          <span className="nc-name">{net.name}</span>
          <span className="nc-badge" style={{ color: net.color }}>{net.badge}</span>
        </div>
      </div>
      <div className="nc-right">
        <span className="nc-price" style={{ color: isSelected ? net.color : "#9ca3af" }}>
          от {Math.min(...Object.values(net.prices)).toFixed(0)}₽
        </span>
        <span className="nc-stations">{Math.floor(Math.random() * 80 + 40)} АЗС</span>
      </div>
      {isSelected && (
        <div className="nc-check" style={{ background: net.color }}>✓</div>
      )}
    </button>
  );
}

function FuelSelector({ network, selected, onSelect }: {
  network: typeof NETWORKS[0];
  selected: string | null;
  onSelect: (f: string) => void;
}) {
  return (
    <div className="fuel-selector">
      {network.fuels.map(fuel => {
        const price = network.prices[fuel as keyof typeof network.prices];
        const isActive = selected === fuel;
        return (
          <button
            key={fuel}
            onClick={() => onSelect(fuel)}
            className="fuel-chip"
            style={{
              borderColor: isActive ? network.color : "rgba(255,255,255,0.08)",
              background: isActive ? `${network.color}18` : "rgba(255,255,255,0.03)",
              color: isActive ? network.color : "#9ca3af",
              boxShadow: isActive ? `0 0 16px ${network.glow}30` : "none",
            }}
          >
            <span className="fuel-chip-name">{FUEL_LABELS[fuel] ?? fuel}</span>
            <span className="fuel-chip-price" style={{ color: isActive ? network.color : "#6b7280" }}>
              {price}₽
            </span>
          </button>
        );
      })}
    </div>
  );
}

function VolumeSelector({ volumes, selected, price, onSelect, color }: {
  volumes: number[];
  selected: number;
  price: number;
  onSelect: (v: number) => void;
  color: string;
}) {
  return (
    <div className="volume-row">
      {volumes.map(v => {
        const isActive = selected === v;
        const total = (price * v).toFixed(0);
        return (
          <button
            key={v}
            onClick={() => onSelect(v)}
            className="volume-chip"
            style={{
              borderColor: isActive ? color : "rgba(255,255,255,0.08)",
              background: isActive ? `${color}18` : "rgba(255,255,255,0.03)",
              boxShadow: isActive ? `0 0 20px ${color}35` : "none",
            }}
          >
            <span className="vol-liters" style={{ color: isActive ? color : "#e2e8f0" }}>{v} л</span>
            <span className="vol-price" style={{ color: isActive ? color + "bb" : "#6b7280" }}>{total} ₽</span>
          </button>
        );
      })}
    </div>
  );
}

function ConfirmSheet({ sel, onConfirm, onBack }: {
  sel: { network: typeof NETWORKS[0]; fuel: string; volume: number };
  onConfirm: () => void;
  onBack: () => void;
}) {
  const price = sel.network.prices[sel.fuel as keyof typeof sel.network.prices];
  const total = (price * sel.volume).toFixed(0);
  const stars = Math.ceil((price * sel.volume) / 1.84);
  const savings3mo = ((price * 1.083 - price) * sel.volume).toFixed(0);

  return (
    <div className="confirm-sheet">
      <div className="confirm-bar" style={{ background: sel.network.color }} />

      <div className="confirm-header">
        <button onClick={onBack} className="back-btn">← Назад</button>
        <span className="confirm-title">Подтверждение</span>
      </div>

      <div className="confirm-freeze-badge">
        <span>🔒</span>
        <span>Цена заморожена на <strong>90 дней</strong></span>
      </div>

      <div className="confirm-summary">
        <div className="cs-row">
          <span className="cs-label">Сеть</span>
          <span className="cs-value" style={{ color: sel.network.color }}>{sel.network.name}</span>
        </div>
        <div className="cs-row">
          <span className="cs-label">Топливо</span>
          <span className="cs-value">{FUEL_LABELS[sel.fuel] ?? sel.fuel}</span>
        </div>
        <div className="cs-row">
          <span className="cs-label">Объём</span>
          <span className="cs-value">{sel.volume} л</span>
        </div>
        <div className="cs-divider" />
        <div className="cs-row">
          <span className="cs-label">Цена за литр</span>
          <span className="cs-value">{price} ₽</span>
        </div>
        <div className="cs-row cs-total">
          <span className="cs-label">Итого</span>
          <span className="cs-value-big" style={{ color: sel.network.color }}>{total} ₽</span>
        </div>
      </div>

      <div className="savings-hint">
        <span className="sh-icon">📈</span>
        <span className="sh-text">Экономия за 3 месяца при росте рынка +8%:</span>
        <span className="sh-amount">+{savings3mo} ₽</span>
      </div>

      <div className="pay-methods">
        <button className="pay-btn pay-stars" onClick={onConfirm}>
          <span>⭐</span> {stars} Stars
        </button>
        <button className="pay-btn pay-crypto" onClick={onConfirm}>
          <span>💎</span> {(Number(total) / 92).toFixed(2)} USDT
        </button>
      </div>
    </div>
  );
}

export function CatalogNew() {
  const [step, setStep] = useState<Step>("networks");
  const [sel, setSel] = useState<Selection>({ network: null, fuel: null, volume: 40 });
  const [done, setDone] = useState(false);

  const handleNetworkSelect = (net: typeof NETWORKS[0]) => {
    setSel(s => ({ ...s, network: net, fuel: null }));
    setTimeout(() => setStep("fuel"), 200);
  };

  const handleFuelSelect = (fuel: string) => {
    setSel(s => ({ ...s, fuel }));
    setTimeout(() => setStep("volume"), 200);
  };

  if (done) {
    return (
      <div className="catalog-root">
        <div className="success-screen">
          <div className="success-icon" style={{ boxShadow: `0 0 60px ${sel.network?.color}55` }}>✅</div>
          <h2 className="success-title">Талон активирован!</h2>
          <p className="success-sub">QR-код в разделе «Хранилище»</p>
          <div className="success-freeze">🔒 Цена зафиксирована на 90 дней</div>
          <button className="success-back" onClick={() => { setDone(false); setStep("networks"); setSel({ network: null, fuel: null, volume: 40 }); }}>
            Купить ещё
          </button>
        </div>
      </div>
    );
  }

  if (step === "confirm" && sel.network && sel.fuel) {
    return (
      <div className="catalog-root">
        <ConfirmSheet
          sel={{ network: sel.network, fuel: sel.fuel, volume: sel.volume }}
          onConfirm={() => setDone(true)}
          onBack={() => setStep("volume")}
        />
      </div>
    );
  }

  return (
    <div className="catalog-root">
      {/* Hero freeze banner */}
      <FreezeHero />

      {/* Step indicator */}
      <div className="step-track">
        {(["networks","fuel","volume"] as Step[]).map((s, i) => {
          const stepIdx = ["networks","fuel","volume"].indexOf(step);
          const isDone = i < stepIdx;
          const isCurr = s === step;
          return (
            <div key={s} className="step-dot-wrap">
              <div className={`step-dot ${isDone ? "done" : ""} ${isCurr ? "active" : ""}`}
                style={isCurr && sel.network ? { background: sel.network.color, boxShadow: `0 0 10px ${sel.network.color}` } : {}}>
                {isDone ? "✓" : i + 1}
              </div>
              <span className="step-label">
                {s === "networks" ? "Сеть" : s === "fuel" ? "Топливо" : "Объём"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Content area — progressive disclosure */}
      <div className="catalog-scroll">

        {/* ── STEP 1: Networks ──────────────────────────────────── */}
        <div className="section">
          <h2 className="section-title">Выберите сеть</h2>
          <div className="networks-list">
            {NETWORKS.map(net => (
              <NetworkCard
                key={net.name}
                net={net}
                onSelect={() => handleNetworkSelect(net)}
                isSelected={sel.network?.name === net.name}
              />
            ))}
          </div>
        </div>

        {/* ── STEP 2: Fuel (revealed after network pick) ────────── */}
        {sel.network && (
          <div className="section section-revealed" key={sel.network.name}>
            <div className="section-header-row">
              <h2 className="section-title">Тип топлива</h2>
              <span className="section-hint" style={{ color: sel.network.color }}>{sel.network.name}</span>
            </div>
            <FuelSelector
              network={sel.network}
              selected={sel.fuel}
              onSelect={handleFuelSelect}
            />
          </div>
        )}

        {/* ── STEP 3: Volume (revealed after fuel pick) ─────────── */}
        {sel.network && sel.fuel && (
          <div className="section section-revealed" key={sel.fuel}>
            <div className="section-header-row">
              <h2 className="section-title">Объём</h2>
              <span className="section-hint">{FUEL_LABELS[sel.fuel] ?? sel.fuel}</span>
            </div>
            <VolumeSelector
              volumes={VOLUMES}
              selected={sel.volume}
              price={sel.network.prices[sel.fuel as keyof typeof sel.network.prices]}
              onSelect={v => setSel(s => ({ ...s, volume: v }))}
              color={sel.network.color}
            />

            {/* Proceed CTA */}
            <button
              className="proceed-btn"
              style={{
                background: `linear-gradient(135deg, ${sel.network.color}, ${sel.network.color}bb)`,
                boxShadow: `0 8px 32px ${sel.network.glow}45`,
              }}
              onClick={() => setStep("confirm")}
            >
              Оформить талон →
            </button>
          </div>
        )}

        <div style={{ height: "96px" }} />
      </div>
    </div>
  );
}
