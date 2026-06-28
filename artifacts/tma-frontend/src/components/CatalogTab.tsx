import React, { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createNetworkStarsInvoice, createNetworkCryptoBotInvoice } from "@/api/client";
import { useUserStore } from "@/stores/useUserStore";
import { useVaultStore } from "@/stores/useVaultStore";
import { useToast } from "@/components/Toast";
import { impact, notify } from "@/lib/haptic";

const NETWORKS = [
  { name: "Лукойл",       color: "#DC143C", glow: "#DC143C", emoji: "🔴", badge: "ЭКТО",    fuels: [
    { key: "АИ-92", label: "АИ-92" }, { key: "АИ-95", label: "АИ-95" }, { key: "АИ-95+", label: "ЭКТО Plus" },
    { key: "АИ-100", label: "ЭКТО-100" }, { key: "ДТ", label: "ДТ Евро" }, { key: "ДТ+", label: "ДТ ЭКТО" }, { key: "Газ", label: "СУГ" },
  ], prices: { "АИ-92": 65.9, "АИ-95": 74.2, "АИ-95+": 79.5, "АИ-100": 92.0, "ДТ": 80.5, "ДТ+": 85.3, "Газ": 31.2 } },
  { name: "Роснефть",     color: "#1E90FF", glow: "#1E90FF", emoji: "🔵", badge: "PULSAR",  fuels: [
    { key: "АИ-92", label: "АИ-92" }, { key: "АИ-95", label: "АИ-95" }, { key: "АИ-95+", label: "Pulsar-95" },
    { key: "АИ-100", label: "Pulsar-100" }, { key: "ДТ", label: "ДТ Евро" }, { key: "ДТ+", label: "Pulsar ДТ" }, { key: "Газ", label: "СУГ/КПГ" },
  ], prices: { "АИ-92": 65.1, "АИ-95": 72.9, "АИ-95+": 78.0, "АИ-100": 90.5, "ДТ": 79.4, "ДТ+": 84.2, "Газ": 30.5 } },
  { name: "Газпромнефть", color: "#2979FF", glow: "#4488FF", emoji: "🟦", badge: "G-DRIVE", fuels: [
    { key: "АИ-92", label: "АИ-92" }, { key: "АИ-95", label: "АИ-95" }, { key: "АИ-95+", label: "G-Drive 95" },
    { key: "АИ-100", label: "G-Drive 100" }, { key: "ДТ", label: "ДТ Опти" }, { key: "ДТ+", label: "G-Drive ДТ" }, { key: "Газ", label: "СУГ/КПГ" },
  ], prices: { "АИ-92": 65.4, "АИ-95": 73.4, "АИ-95+": 78.5, "АИ-100": 91.2, "ДТ": 79.9, "ДТ+": 84.7, "Газ": 30.9 } },
  { name: "Башнефть",     color: "#7C3AED", glow: "#9333EA", emoji: "🟣", badge: "ATUM",    fuels: [
    { key: "АИ-92", label: "ATUM-92" }, { key: "АИ-95", label: "ATUM-95" }, { key: "АИ-95+", label: "ATUM-98" },
    { key: "АИ-100", label: "АИ-100" }, { key: "ДТ", label: "ДТ Евро" }, { key: "Газ", label: "СУГ" },
  ], prices: { "АИ-92": 61.9, "АИ-95": 66.1, "АИ-95+": 70.7, "АИ-100": 86.0, "ДТ": 75.8, "ДТ+": 80.3, "Газ": 26.5 } },
  { name: "Татнефть",     color: "#059669", glow: "#10B981", emoji: "🟢", badge: "ТАНЕКО",  fuels: [
    { key: "АИ-92", label: "АИ-92 ТАНЕКО" }, { key: "АИ-95", label: "АИ-95 ТАНЕКО" }, { key: "АИ-95+", label: "АИ-98 ТАНЕКО" },
    { key: "ДТ", label: "ДТ Евро" }, { key: "ДТ+", label: "ДТ ТАНЕКО" }, { key: "Газ", label: "СУГ/КПГ" },
  ], prices: { "АИ-92": 62.4, "АИ-95": 66.8, "АИ-95+": 71.5, "АИ-100": 86.8, "ДТ": 76.4, "ДТ+": 81.0, "Газ": 26.9 } },
  { name: "ННК",          color: "#D97706", glow: "#F59E0B", emoji: "🟡", badge: "NEO",     fuels: [
    { key: "АИ-92", label: "NEO-92" }, { key: "АИ-95", label: "NEO-95" }, { key: "АИ-95+", label: "NEO-98" },
    { key: "ДТ", label: "ДТ Евро" }, { key: "ДТ+", label: "ДТ зимнее" }, { key: "Газ", label: "СУГ" },
  ], prices: { "АИ-92": 70.5, "АИ-95": 74.8, "АИ-95+": 80.0, "АИ-100": 92.2, "ДТ": 87.9, "ДТ+": 93.2, "Газ": 35.0 } },
];

const VOLUMES = [20, 40, 60];
const STAR_RUB_RATE = 2.5;

type Net = typeof NETWORKS[0];
type Step = "networks" | "fuel" | "volume" | "confirm" | "success";

interface Sel { network: Net | null; fuel: { key: string; label: string } | null; volume: number; }

const COBALT_BG = "linear-gradient(160deg,#0C0EA8 0%,#090B82 40%,#060760 75%,#040450 100%)";

const CSS = `
@keyframes ctStarTwinkle { 0%,100%{opacity:var(--op)} 50%{opacity:calc(var(--op)*0.25)} }
@keyframes ctAmbientFlow { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
@keyframes ctAmbientPulse { 0%,100%{opacity:.55} 50%{opacity:1} }
.ct-amb-strip { background-size:200% 100%; animation:ctAmbientFlow 3s linear infinite, ctAmbientPulse 2.6s ease-in-out infinite; }
.ct-root { min-height:100%; background:${COBALT_BG}; color:#e2e8f0; font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif; display:flex; flex-direction:column; overflow:hidden; position:relative; }
.ct-hero { position:relative; margin:20px 16px 0; padding:18px 20px; border-radius:24px; background:rgba(255,255,255,0.04); border:1px solid rgba(168,85,247,0.3); overflow:hidden; flex-shrink:0; backdrop-filter:blur(12px); z-index:1; }
.ct-hero-glow { position:absolute; top:-40px; right:-40px; width:140px; height:140px; border-radius:50%; background:radial-gradient(circle,rgba(139,92,246,0.3) 0%,transparent 70%); pointer-events:none; }
.ct-hero-row { display:flex; align-items:center; gap:14px; position:relative; }
.ct-hero-icon { font-size:32px; line-height:1; flex-shrink:0; }
.ct-hero-headline { font-size:22px; font-weight:800; letter-spacing:-0.5px; background:linear-gradient(135deg,#e2e8f0 0%,#a78bfa 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; line-height:1.1; display:block; }
.ct-hero-sub { font-size:12px; color:rgba(167,139,250,0.7); font-weight:500; display:block; margin-top:3px; }
.ct-steps { display:flex; align-items:flex-start; justify-content:center; gap:32px; padding:18px 20px 4px; flex-shrink:0; position:relative; z-index:1; }
.ct-step { display:flex; flex-direction:column; align-items:center; gap:5px; }
.ct-dot { width:28px; height:28px; border-radius:50%; background:rgba(255,255,255,0.06); border:1.5px solid rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:rgba(255,255,255,0.3); transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1); }
.ct-dot.active { background:rgba(139,92,246,0.25); border-color:rgba(139,92,246,0.6); color:#a78bfa; transform:scale(1.1); }
.ct-dot.done { background:rgba(0,230,118,0.15); border-color:rgba(0,230,118,0.4); color:#00E676; font-size:12px; }
.ct-step-lbl { font-size:9px; color:rgba(255,255,255,0.3); font-weight:600; letter-spacing:0.05em; text-transform:uppercase; }
.ct-scroll { flex:1; overflow-y:auto; overflow-x:hidden; padding:0 16px; -webkit-overflow-scrolling:touch; position:relative; z-index:1; }
.ct-scroll::-webkit-scrollbar { display:none; }
.ct-section { margin-top:20px; }
.ct-revealed { animation:ctReveal 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }
@keyframes ctReveal { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
.ct-section-title { font-size:17px; font-weight:800; color:#E8622A; margin:0 0 12px; letter-spacing:0.18em; text-transform:uppercase; }
.ct-row { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:12px; }
.ct-row .ct-section-title { margin:0; }
.ct-hint { font-size:12px; font-weight:600; opacity:0.85; }
.ct-nets { display:flex; flex-direction:column; gap:10px; }
.ct-net { width:100%; display:flex; align-items:center; gap:14px; padding:16px 18px; border-radius:20px; border:1.5px solid; background:rgba(255,255,255,0.03); cursor:pointer; text-align:left; transition:all 0.25s; position:relative; overflow:hidden; -webkit-tap-highlight-color:transparent; }
.ct-net:active { transform:scale(0.98); }
.ct-net-emoji { font-size:24px; line-height:1; flex-shrink:0; }
.ct-net-names { display:flex; flex-direction:column; gap:2px; flex:1; }
.ct-net-name { font-size:16px; font-weight:700; color:#e2e8f0; letter-spacing:-0.2px; }
.ct-net-badge { font-size:10px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; opacity:0.85; }
.ct-net-right { display:flex; flex-direction:column; align-items:flex-end; gap:2px; flex-shrink:0; }
.ct-net-price { font-size:15px; font-weight:700; font-variant-numeric:tabular-nums; transition:color 0.25s; }
.ct-net-stations { font-size:10px; color:rgba(255,255,255,0.25); font-weight:500; }
.ct-net-check { position:absolute; top:10px; right:10px; width:18px; height:18px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; color:#fff; font-weight:800; }
.ct-fuels { display:flex; flex-wrap:wrap; gap:8px; }
.ct-fuel { display:flex; flex-direction:column; align-items:flex-start; gap:3px; padding:12px 16px; border-radius:16px; border:1.5px solid; background:rgba(255,255,255,0.03); cursor:pointer; transition:all 0.2s; min-width:96px; -webkit-tap-highlight-color:transparent; }
.ct-fuel:active { transform:scale(0.96); }
.ct-fuel-name { font-size:13px; font-weight:700; line-height:1; }
.ct-fuel-price { font-size:11px; font-weight:600; font-variant-numeric:tabular-nums; }
.ct-vols { display:flex; gap:10px; margin-bottom:20px; }
.ct-vol { flex:1; display:flex; flex-direction:column; align-items:center; gap:5px; padding:18px 12px; border-radius:20px; border:1.5px solid; background:rgba(255,255,255,0.03); cursor:pointer; transition:all 0.25s cubic-bezier(0.34,1.56,0.64,1); -webkit-tap-highlight-color:transparent; }
.ct-vol:active { transform:scale(0.96); }
.ct-vol-l { font-size:22px; font-weight:800; letter-spacing:-0.5px; }
.ct-vol-p { font-size:11px; font-weight:600; font-variant-numeric:tabular-nums; }
.ct-proceed { width:100%; padding:18px; border-radius:20px; border:none; color:#fff; font-size:17px; font-weight:800; letter-spacing:-0.3px; cursor:pointer; transition:all 0.2s; -webkit-tap-highlight-color:transparent; }
.ct-proceed:active { transform:scale(0.97); opacity:0.9; }
.ct-confirm { min-height:100%; display:flex; flex-direction:column; padding:0 0 32px; animation:ctReveal 0.35s cubic-bezier(0.34,1.56,0.64,1); position:relative; z-index:1; }
.ct-confirm-bar { height:4px; width:100%; opacity:0.7; }
.ct-confirm-hdr { display:flex; align-items:center; gap:12px; padding:20px 20px 16px; }
.ct-back { background:none; border:none; color:rgba(255,255,255,0.4); font-size:14px; font-weight:600; cursor:pointer; padding:0; }
.ct-confirm-title { font-size:18px; font-weight:800; color:#e2e8f0; letter-spacing:-0.3px; }
.ct-freeze-badge { display:flex; align-items:center; gap:8px; margin:0 16px 20px; padding:12px 16px; background:rgba(139,92,246,0.1); border:1px solid rgba(139,92,246,0.25); border-radius:16px; font-size:13px; color:#a78bfa; font-weight:600; }
.ct-summary { margin:0 16px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:20px; padding:8px 0; }
.ct-sr { display:flex; justify-content:space-between; align-items:center; padding:12px 18px; }
.ct-sl { font-size:14px; color:rgba(255,255,255,0.4); }
.ct-sv { font-size:14px; font-weight:600; color:#e2e8f0; }
.ct-sdiv { height:1px; background:rgba(255,255,255,0.06); margin:4px 18px; }
.ct-sv-big { font-size:22px; font-weight:800; letter-spacing:-0.5px; }
.ct-savings { display:flex; align-items:center; gap:8px; margin:14px 16px; padding:12px 16px; background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.2); border-radius:14px; font-size:12px; }
.ct-savings-icon { font-size:16px; }
.ct-savings-txt { color:rgba(255,255,255,0.5); flex:1; line-height:1.3; }
.ct-savings-amt { color:#00E676; font-weight:800; font-size:14px; white-space:nowrap; }
.ct-pay-row { display:flex; gap:10px; margin:auto 16px 0; padding-top:20px; }
.ct-pay { flex:1; display:flex; align-items:center; justify-content:center; gap:8px; padding:18px; border-radius:20px; border:none; font-size:15px; font-weight:800; cursor:pointer; transition:all 0.2s; -webkit-tap-highlight-color:transparent; }
.ct-pay:active { transform:scale(0.97); }
.ct-pay:disabled { opacity:0.5; cursor:not-allowed; }
.ct-pay-stars { background:linear-gradient(135deg,#f59e0b,#d97706); color:#fff; box-shadow:0 8px 32px rgba(245,158,11,0.4); }
.ct-pay-crypto { background:rgba(59,130,246,0.15); color:#60a5fa; border:1.5px solid rgba(59,130,246,0.3) !important; }
.ct-success { min-height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 24px; gap:16px; animation:ctReveal 0.5s cubic-bezier(0.34,1.56,0.64,1); position:relative; z-index:1; }
.ct-success-icon { width:80px; height:80px; border-radius:50%; background:rgba(0,230,118,0.12); border:2px solid rgba(0,230,118,0.3); display:flex; align-items:center; justify-content:center; font-size:36px; }
.ct-success-title { font-size:26px; font-weight:800; letter-spacing:-0.5px; color:#e2e8f0; margin:0; }
.ct-success-sub { font-size:15px; color:rgba(255,255,255,0.4); margin:0; }
.ct-success-freeze { font-size:13px; color:#a78bfa; background:rgba(139,92,246,0.1); border:1px solid rgba(139,92,246,0.25); border-radius:12px; padding:10px 18px; font-weight:600; }
.ct-success-back { margin-top:8px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:14px; color:rgba(255,255,255,0.6); font-size:15px; font-weight:600; padding:14px 28px; cursor:pointer; }
`;

function CatalogStars({ n = 90 }: { n?: number }) {
  const pts = useMemo(() => Array.from({ length: n }, (_, i) => ({
    id: i, x: (i * 97 + 13) % 100, y: (i * 61 + 7) % 100,
    r: 0.3 + (i % 7) * 0.2, op: 0.1 + (i % 6) * 0.1, dur: 2 + (i % 5), del: i % 4,
  })), [n]);
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}>
      {pts.map(s => (
        <circle key={s.id} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="white"
          style={{ opacity: s.op, animation: `ctStarTwinkle ${s.dur}s ${s.del}s ease-in-out infinite`, ["--op" as string]: s.op } as React.CSSProperties}
        />
      ))}
    </svg>
  );
}

function CatalogStrip({ color, style = {} }: { color: string; style?: React.CSSProperties }) {
  return <div className="ct-amb-strip" style={{
    position: "absolute", height: "1.5px", width: "100%", pointerEvents: "none",
    background: `linear-gradient(90deg,transparent 0%,${color}00 5%,${color}cc 30%,${color} 50%,${color}cc 70%,${color}00 95%,transparent 100%)`,
    ...style,
  }} />;
}

export function CatalogTab(_props?: { initialStationId?: number; onCalcOpenChange?: (open: boolean) => void }) {
  const user = useUserStore((s) => s.user);
  const { add: toast } = useToast();
  const fetchVault = useVaultStore((s) => s.fetch);

  const [step, setStep] = useState<Step>("networks");
  const [sel, setSel] = useState<Sel>({ network: null, fuel: null, volume: 40 });
  const [purchasing, setPurchasing] = useState(false);

  const price = sel.network && sel.fuel
    ? (sel.network.prices[sel.fuel.key as keyof typeof sel.network.prices] ?? 0)
    : 0;
  const total = price * sel.volume;
  const stars = Math.ceil(total / STAR_RUB_RATE);
  const savings3mo = ((price * 1.083 - price) * sel.volume);

  const handleNetworkSelect = (net: Net) => {
    impact("light");
    setSel(s => ({ ...s, network: net, fuel: null }));
    setTimeout(() => setStep("fuel"), 120);
  };

  const handleFuelSelect = (fuel: { key: string; label: string }) => {
    impact("light");
    setSel(s => ({ ...s, fuel }));
    setTimeout(() => setStep("volume"), 120);
  };

  const handlePay = useCallback(async (method: "stars" | "crypto") => {
    if (!user || !sel.network || !sel.fuel || purchasing) return;
    setPurchasing(true);
    impact("heavy");
    try {
      if (method === "stars") {
        const inv = await createNetworkStarsInvoice(user.id, sel.network.name, sel.fuel.key, sel.volume);
        type TgWebApp = { openInvoice?: (url: string, cb: (status: string) => void) => void };
        const tg = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
        if (tg?.openInvoice && inv.invoice_link) {
          tg.openInvoice(inv.invoice_link, (status: string) => {
            if (status === "paid") {
              notify("success");
              toast(`⭐ Оплата ${inv.stars_amount} Stars принята! Талон в Хранилище.`, "success");
              fetchVault(user.id);
              setStep("success");
            } else if (status === "cancelled") {
              notify("error");
              toast("Оплата отменена.", "error");
            } else {
              notify("error");
              toast(`Ошибка: ${status}`, "error");
            }
          });
        } else if (inv.invoice_link) {
          window.open(inv.invoice_link, "_blank");
          toast(`⭐ Счёт на ${inv.stars_amount} Stars открыт.`, "success");
          setStep("success");
        } else {
          toast(`⭐ ${inv.stars_amount} Stars — откройте через Telegram.`, "success");
          setStep("success");
        }
      } else {
        const inv = await createNetworkCryptoBotInvoice(user.id, sel.network.name, sel.fuel.key, sel.volume);
        if (inv.checkout_url) {
          window.open(inv.checkout_url, "_blank");
          notify("success");
          toast("💎 Оплата через CryptoBot открыта.", "success");
          setStep("success");
        }
      }
    } catch (e: unknown) {
      notify("error");
      toast(String(e), "error");
    } finally {
      setPurchasing(false);
    }
  }, [user, sel, purchasing, toast, fetchVault]);

  const reset = () => {
    setSel({ network: null, fuel: null, volume: 40 });
    setStep("networks");
  };

  const stepIdx = ["networks", "fuel", "volume"].indexOf(step);

  if (!user) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "rgba(255,255,255,0.65)" }}>
        Загрузка…
      </div>
    );
  }

  return (
    <div className="ct-root">
      <style>{CSS}</style>
      {/* Cobalt starfield background */}
      <CatalogStars />
      {/* SVG grid lines */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}>
        <line x1="33%" y1="0" x2="33%" y2="100%" stroke="rgba(99,102,241,0.09)" strokeWidth="1" />
        <line x1="66%" y1="0" x2="66%" y2="100%" stroke="rgba(99,102,241,0.09)" strokeWidth="1" />
        <line x1="0" y1="33%" x2="100%" y2="33%" stroke="rgba(99,102,241,0.09)" strokeWidth="1" />
        <line x1="0" y1="66%" x2="100%" y2="66%" stroke="rgba(99,102,241,0.09)" strokeWidth="1" />
      </svg>
      {/* Ambient glow blooms */}
      <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle,rgba(168,85,247,0.18) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "absolute", bottom: -80, right: -40, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle,rgba(219,39,119,0.14) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      {/* Top ambient strip */}
      <CatalogStrip color="#a855f7" style={{ top: 0, zIndex: 2 }} />

      {/* ── Success ─────────────────────────────────────────────── */}
      {step === "success" && (
        <div className="ct-success">
          <div className="ct-success-icon" style={{ boxShadow: `0 0 60px ${sel.network?.color ?? "#22c55e"}55` }}>✅</div>
          <h2 className="ct-success-title">Талон активирован!</h2>
          <p className="ct-success-sub">QR-код в разделе «Хранилище»</p>
          <div className="ct-success-freeze">🔒 Цена зафиксирована на 90 дней</div>
          <button className="ct-success-back" onClick={reset}>Купить ещё</button>
        </div>
      )}

      {/* ── Confirm ─────────────────────────────────────────────── */}
      {step === "confirm" && sel.network && sel.fuel && (
        <div className="ct-confirm">
          <div className="ct-confirm-bar" style={{ background: sel.network.color }} />
          <div className="ct-confirm-hdr">
            <button className="ct-back" onClick={() => setStep("volume")}>← Назад</button>
            <span className="ct-confirm-title">Подтверждение</span>
          </div>
          <div className="ct-freeze-badge"><span>🔒</span><span>Цена заморожена на <strong>90 дней</strong></span></div>
          <div className="ct-summary">
            <div className="ct-sr"><span className="ct-sl">Сеть</span><span className="ct-sv" style={{ color: sel.network.color }}>{sel.network.name}</span></div>
            <div className="ct-sr"><span className="ct-sl">Топливо</span><span className="ct-sv">{sel.fuel.label}</span></div>
            <div className="ct-sr"><span className="ct-sl">Объём</span><span className="ct-sv">{sel.volume} л</span></div>
            <div className="ct-sdiv" />
            <div className="ct-sr"><span className="ct-sl">Цена за литр</span><span className="ct-sv">{price.toFixed(1)} ₽</span></div>
            <div className="ct-sr"><span className="ct-sl">Итого</span><span className="ct-sv-big" style={{ color: sel.network.color }}>{total.toFixed(0)} ₽</span></div>
          </div>
          <div className="ct-savings">
            <span className="ct-savings-icon">📈</span>
            <span className="ct-savings-txt">Экономия за 3 месяца при росте рынка +8%:</span>
            <span className="ct-savings-amt">+{savings3mo.toFixed(0)} ₽</span>
          </div>
          <div className="ct-pay-row">
            <button
              className="ct-pay ct-pay-stars"
              disabled={purchasing}
              onClick={() => handlePay("stars")}
            >
              {purchasing ? "…" : <><span>⭐</span> {stars} Stars</>}
            </button>
            <button
              className="ct-pay ct-pay-crypto"
              disabled={purchasing}
              onClick={() => handlePay("crypto")}
            >
              {purchasing ? "…" : <><span>💎</span> {(total / 92).toFixed(2)} USDT</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Main flow ───────────────────────────────────────────── */}
      {step !== "confirm" && step !== "success" && (
        <>
          {/* Hero */}
          <div className="ct-hero">
            <div className="ct-hero-glow" />
            <div className="ct-hero-row">
              <span className="ct-hero-icon">🔒</span>
              <div>
                <span className="ct-hero-headline">Цена заморожена</span>
                <span className="ct-hero-sub">на 90 дней · защита от роста рынка</span>
              </div>
            </div>
          </div>

          {/* Step dots */}
          <div className="ct-steps">
            {(["networks", "fuel", "volume"] as const).map((s, i) => {
              const isDone = i < stepIdx;
              const isCurr = s === step;
              return (
                <div key={s} className="ct-step">
                  <div
                    className={`ct-dot${isDone ? " done" : ""}${isCurr ? " active" : ""}`}
                    style={isCurr && sel.network ? { background: `${sel.network.color}44`, borderColor: sel.network.color, color: sel.network.color } : {}}
                  >
                    {isDone ? "✓" : i + 1}
                  </div>
                  <span className="ct-step-lbl">{s === "networks" ? "Сеть" : s === "fuel" ? "Топливо" : "Объём"}</span>
                </div>
              );
            })}
          </div>

          <div className="ct-scroll">
            {/* Step 1: Networks */}
            <div className="ct-section">
              <h2 className="ct-section-title">Выберите сеть</h2>
              <div className="ct-nets">
                {NETWORKS.map(net => {
                  const isSelected = sel.network?.name === net.name;
                  const price95 = net.prices["АИ-95"];
                  return (
                    <motion.button
                      key={net.name}
                      className="ct-net"
                      onClick={() => handleNetworkSelect(net)}
                      whileTap={{ scale: 0.98 }}
                      style={{
                        borderColor: isSelected ? net.color : "rgba(255,255,255,0.07)",
                        background: isSelected
                          ? `linear-gradient(135deg,${net.color}18 0%,${net.color}06 100%)`
                          : "rgba(255,255,255,0.03)",
                        boxShadow: isSelected
                          ? `0 0 0 1px ${net.color}55, 0 8px 32px ${net.glow}25`
                          : "none",
                      }}
                    >
                      <span className="ct-net-emoji">{net.emoji}</span>
                      <div className="ct-net-names">
                        <span className="ct-net-name">{net.name}</span>
                        <span className="ct-net-badge" style={{ color: net.color }}>{net.badge}</span>
                      </div>
                      <div className="ct-net-right">
                        <span className="ct-net-price" style={{ color: isSelected ? net.color : "rgba(255,255,255,0.72)" }}>
                          {price95.toFixed(1)}₽
                        </span>
                        <span className="ct-net-stations">АИ-95 · {net.fuels.length} вида</span>
                      </div>
                      {isSelected && <div className="ct-net-check" style={{ background: net.color }}>✓</div>}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Fuel */}
            <AnimatePresence>
              {sel.network && (
                <motion.div
                  key={sel.network.name}
                  className="ct-section ct-revealed"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
                >
                  <div className="ct-row">
                    <h2 className="ct-section-title">Тип топлива</h2>
                    <span className="ct-hint" style={{ color: sel.network.color }}>{sel.network.name}</span>
                  </div>
                  <div className="ct-fuels">
                    {sel.network.fuels.map(fuel => {
                      const fuelPrice = sel.network!.prices[fuel.key as keyof typeof sel.network.prices];
                      const isActive = sel.fuel?.key === fuel.key;
                      return (
                        <motion.button
                          key={fuel.key}
                          className="ct-fuel"
                          whileTap={{ scale: 0.96 }}
                          onClick={() => handleFuelSelect(fuel)}
                          style={{
                            borderColor: isActive ? sel.network!.color : "rgba(255,255,255,0.08)",
                            background: isActive ? `${sel.network!.color}18` : "rgba(255,255,255,0.03)",
                            color: isActive ? sel.network!.color : "rgba(255,255,255,0.72)",
                            boxShadow: isActive ? `0 0 16px ${sel.network!.glow}30` : "none",
                          }}
                        >
                          <span className="ct-fuel-name">{fuel.label}</span>
                          <span className="ct-fuel-price" style={{ color: isActive ? sel.network!.color : "rgba(255,255,255,0.65)" }}>
                            {fuelPrice?.toFixed(1) ?? "—"}₽
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step 3: Volume */}
            <AnimatePresence>
              {sel.network && sel.fuel && (
                <motion.div
                  key={sel.fuel.key}
                  className="ct-section ct-revealed"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
                >
                  <div className="ct-row">
                    <h2 className="ct-section-title">Объём</h2>
                    <span className="ct-hint">{sel.fuel.label}</span>
                  </div>
                  <div className="ct-vols">
                    {VOLUMES.map(v => {
                      const isActive = sel.volume === v;
                      const tot = (price * v).toFixed(0);
                      return (
                        <motion.button
                          key={v}
                          className="ct-vol"
                          whileTap={{ scale: 0.96 }}
                          onClick={() => { impact("light"); setSel(s => ({ ...s, volume: v })); }}
                          style={{
                            borderColor: isActive ? sel.network!.color : "rgba(255,255,255,0.08)",
                            background: isActive ? `${sel.network!.color}18` : "rgba(255,255,255,0.03)",
                            boxShadow: isActive ? `0 0 20px ${sel.network!.glow}35` : "none",
                          }}
                        >
                          <span className="ct-vol-l" style={{ color: isActive ? sel.network!.color : "#e2e8f0" }}>{v} л</span>
                          <span className="ct-vol-p" style={{ color: isActive ? `${sel.network!.color}bb` : "rgba(255,255,255,0.65)" }}>{tot} ₽</span>
                        </motion.button>
                      );
                    })}
                  </div>

                  <motion.button
                    className="ct-proceed"
                    whileTap={{ scale: 0.97 }}
                    style={{
                      background: "linear-gradient(135deg,#a855f7,#db2777)",
                      boxShadow: "0 0 24px #a855f744",
                    }}
                    onClick={() => { impact("medium"); setStep("confirm"); }}
                  >
                    Оформить талон →
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ height: "96px" }} />
          </div>
        </>
      )}
    </div>
  );
}
