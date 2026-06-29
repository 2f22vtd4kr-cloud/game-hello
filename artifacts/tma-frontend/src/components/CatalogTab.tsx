import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { motion, AnimatePresence } from "framer-motion";
import { createNetworkStarsInvoice, createNetworkCryptoBotInvoice, adminFreePurchase } from "@/api/client";
import { useUserStore } from "@/stores/useUserStore";
import { useVaultStore } from "@/stores/useVaultStore";
import { useToast } from "@/components/Toast";
import { impact, notify } from "@/lib/haptic";

const NETWORKS = [
  { name: "Лукойл",       color: "#DC143C", glow: "#DC143C", badge: "ЭКТО",    domain: "lukoil.ru",      fuels: [
    { key: "АИ-92", label: "АИ-92" }, { key: "АИ-95", label: "АИ-95" }, { key: "АИ-95+", label: "ЭКТО Plus" },
    { key: "АИ-100", label: "ЭКТО-100" }, { key: "ДТ", label: "ДТ Евро" }, { key: "ДТ+", label: "ДТ ЭКТО" }, { key: "Газ", label: "СУГ" },
  ], prices: { "АИ-92": 65.9, "АИ-95": 74.2, "АИ-95+": 79.5, "АИ-100": 92.0, "ДТ": 80.5, "ДТ+": 85.3, "Газ": 31.2 } },
  { name: "Роснефть",     color: "#1E90FF", glow: "#1E90FF", badge: "PULSAR",  domain: "rosneft.ru",     fuels: [
    { key: "АИ-92", label: "АИ-92" }, { key: "АИ-95", label: "АИ-95" }, { key: "АИ-95+", label: "Pulsar-95" },
    { key: "АИ-100", label: "Pulsar-100" }, { key: "ДТ", label: "ДТ Евро" }, { key: "ДТ+", label: "Pulsar ДТ" }, { key: "Газ", label: "СУГ/КПГ" },
  ], prices: { "АИ-92": 65.1, "АИ-95": 72.9, "АИ-95+": 78.0, "АИ-100": 90.5, "ДТ": 79.4, "ДТ+": 84.2, "Газ": 30.5 } },
  { name: "Газпромнефть", color: "#2979FF", glow: "#4488FF", badge: "G-DRIVE", domain: "gazprom-neft.ru", fuels: [
    { key: "АИ-92", label: "АИ-92" }, { key: "АИ-95", label: "АИ-95" }, { key: "АИ-95+", label: "G-Drive 95" },
    { key: "АИ-100", label: "G-Drive 100" }, { key: "ДТ", label: "ДТ Опти" }, { key: "ДТ+", label: "G-Drive ДТ" }, { key: "Газ", label: "СУГ/КПГ" },
  ], prices: { "АИ-92": 65.4, "АИ-95": 73.4, "АИ-95+": 78.5, "АИ-100": 91.2, "ДТ": 79.9, "ДТ+": 84.7, "Газ": 30.9 } },
  { name: "Башнефть",     color: "#7C3AED", glow: "#9333EA", badge: "ATUM",    domain: "bashneft.ru",    fuels: [
    { key: "АИ-92", label: "ATUM-92" }, { key: "АИ-95", label: "ATUM-95" }, { key: "АИ-95+", label: "ATUM-98" },
    { key: "АИ-100", label: "АИ-100" }, { key: "ДТ", label: "ДТ Евро" }, { key: "Газ", label: "СУГ" },
  ], prices: { "АИ-92": 61.9, "АИ-95": 66.1, "АИ-95+": 70.7, "АИ-100": 86.0, "ДТ": 75.8, "ДТ+": 80.3, "Газ": 26.5 } },
  { name: "Татнефть",     color: "#059669", glow: "#10B981", badge: "ТАНЕКО",  domain: "tatneft.ru",     fuels: [
    { key: "АИ-92", label: "АИ-92 ТАНЕКО" }, { key: "АИ-95", label: "АИ-95 ТАНЕКО" }, { key: "АИ-95+", label: "АИ-98 ТАНЕКО" },
    { key: "ДТ", label: "ДТ Евро" }, { key: "ДТ+", label: "ДТ ТАНЕКО" }, { key: "Газ", label: "СУГ/КПГ" },
  ], prices: { "АИ-92": 62.4, "АИ-95": 66.8, "АИ-95+": 71.5, "АИ-100": 86.8, "ДТ": 76.4, "ДТ+": 81.0, "Газ": 26.9 } },
  { name: "ННК",          color: "#D97706", glow: "#F59E0B", badge: "NEO",     domain: "nnk.ru",         fuels: [
    { key: "АИ-92", label: "NEO-92" }, { key: "АИ-95", label: "NEO-95" }, { key: "АИ-95+", label: "NEO-98" },
    { key: "ДТ", label: "ДТ Евро" }, { key: "ДТ+", label: "ДТ зимнее" }, { key: "Газ", label: "СУГ" },
  ], prices: { "АИ-92": 70.5, "АИ-95": 74.8, "АИ-95+": 80.0, "АИ-100": 92.2, "ДТ": 87.9, "ДТ+": 93.2, "Газ": 35.0 } },
];

const VOLUMES = [20, 40, 60];
const STAR_RUB_RATE = 2.5;

type Net = typeof NETWORKS[0];
type Step = "networks" | "volume" | "confirm" | "success";

interface Sel { network: Net | null; fuel: { key: string; label: string } | null; volume: number; }

const COBALT_BG = "linear-gradient(160deg,#0C0EA8 0%,#090B82 40%,#060760 75%,#040450 100%)";

const CSS = `
@keyframes ctStarTwinkle { 0%,100%{opacity:var(--op)} 50%{opacity:calc(var(--op)*0.25)} }
@keyframes ctAmbientFlow { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
@keyframes ctAmbientPulse { 0%,100%{opacity:.55} 50%{opacity:1} }
.ct-amb-strip { background-size:200% 100%; animation:ctAmbientFlow 3s linear infinite, ctAmbientPulse 2.6s ease-in-out infinite; }
.ct-root { min-height:100%; background:${COBALT_BG}; color:#e2e8f0; font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif; display:flex; flex-direction:column; overflow-x:hidden; position:relative; }
.ct-hero { position:relative; margin:20px 16px 0; padding:18px 20px; border-radius:24px; background:rgba(255,255,255,0.04); border:1px solid rgba(232,98,42,0.3); overflow:hidden; flex-shrink:0; backdrop-filter:blur(12px); z-index:1; }
.ct-hero-glow { position:absolute; top:-40px; right:-40px; width:140px; height:140px; border-radius:50%; background:radial-gradient(circle,rgba(232,98,42,0.25) 0%,transparent 70%); pointer-events:none; }
.ct-hero-row { display:flex; align-items:center; gap:14px; position:relative; }
.ct-hero-icon { font-size:32px; line-height:1; flex-shrink:0; }
.ct-hero-headline { font-size:22px; font-weight:800; letter-spacing:-0.5px; color:#ffffff; line-height:1.1; display:block; }
.ct-hero-sub { font-size:12px; color:rgba(255,255,255,0.55); font-weight:500; display:block; margin-top:3px; }
.ct-steps { display:flex; align-items:flex-start; justify-content:center; gap:48px; padding:18px 20px 4px; flex-shrink:0; position:relative; z-index:1; }
.ct-step { display:flex; flex-direction:column; align-items:center; gap:5px; }
.ct-dot { width:28px; height:28px; border-radius:50%; background:rgba(255,255,255,0.06); border:1.5px solid rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:rgba(255,255,255,0.3); transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1); }
.ct-dot.active { background:rgba(232,98,42,0.25); border-color:rgba(232,98,42,0.6); color:#E8622A; transform:scale(1.1); }
.ct-dot.done { background:rgba(34,197,94,0.15); border-color:rgba(34,197,94,0.4); color:#22c55e; font-size:12px; }
.ct-step-lbl { font-size:9px; color:rgba(255,255,255,0.3); font-weight:600; letter-spacing:0.05em; text-transform:uppercase; }
.ct-scroll { flex:1; overflow-y:auto; overflow-x:hidden; padding:0 16px; -webkit-overflow-scrolling:touch; position:relative; z-index:1; }
.ct-scroll::-webkit-scrollbar { display:none; }
.ct-section { margin-top:20px; }
.ct-section-title { font-size:17px; font-weight:800; color:#E8622A; margin:0 0 12px; letter-spacing:0.18em; text-transform:uppercase; }
.ct-row { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:12px; }
.ct-row .ct-section-title { margin:0; }
.ct-hint { font-size:12px; font-weight:600; opacity:0.85; }
.ct-nets { display:flex; flex-direction:column; gap:0; }
.ct-net-wrap { display:flex; flex-direction:column; margin-bottom:10px; }
.ct-net { width:100%; display:flex; align-items:center; gap:14px; padding:14px 16px; border-radius:20px; border:1.5px solid; background:rgba(255,255,255,0.03); cursor:pointer; text-align:left; transition:border-radius 0.2s, border-color 0.25s, background 0.25s, box-shadow 0.25s; position:relative; overflow:hidden; -webkit-tap-highlight-color:transparent; }
.ct-net.expanded { border-bottom-left-radius:0; border-bottom-right-radius:0; border-bottom-color:transparent !important; }
.ct-net:active { transform:scale(0.98); }
.ct-net-logo { width:54px; height:54px; border-radius:13px; overflow:hidden; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
.ct-net-logo img { width:100%; height:100%; object-fit:contain; }
.ct-net-logo-fallback { width:54px; height:54px; border-radius:13px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:900; color:#fff; letter-spacing:-0.5px; }
.ct-net-names { display:flex; flex-direction:column; gap:2px; flex:1; min-width:0; }
.ct-net-name { font-size:16px; font-weight:700; color:#e2e8f0; letter-spacing:-0.2px; }
.ct-net-badge { font-size:10px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; opacity:0.85; }
.ct-net-right { display:flex; flex-direction:column; align-items:flex-end; gap:2px; flex-shrink:0; }
.ct-net-price { font-size:15px; font-weight:700; font-variant-numeric:tabular-nums; transition:color 0.25s; }
.ct-net-stations { font-size:10px; color:rgba(255,255,255,0.25); font-weight:500; }
.ct-net-chevron { font-size:11px; color:rgba(255,255,255,0.3); flex-shrink:0; margin-left:2px; transition:transform 0.25s; }
.ct-net-chevron.open { transform:rotate(180deg); }
.ct-accordion { overflow:hidden; border-left:1.5px solid; border-right:1.5px solid; border-bottom:1.5px solid; border-bottom-left-radius:20px; border-bottom-right-radius:20px; }
.ct-accordion-inner { padding:10px 12px 14px; display:flex; flex-wrap:wrap; gap:8px; }
.ct-fuels { display:flex; flex-wrap:wrap; gap:8px; }
.ct-fuel { display:flex; flex-direction:column; align-items:flex-start; gap:3px; padding:10px 14px; border-radius:14px; border:1.5px solid; background:rgba(255,255,255,0.03); cursor:pointer; transition:all 0.2s; min-width:88px; -webkit-tap-highlight-color:transparent; }
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
.ct-confirm { min-height:100%; display:flex; flex-direction:column; padding:0 0 100px; overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch; animation:ctReveal 0.35s cubic-bezier(0.34,1.56,0.64,1); position:relative; z-index:1; }
.ct-confirm::-webkit-scrollbar { display:none; }
@keyframes ctReveal { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
.ct-confirm-bar { height:4px; width:100%; opacity:0.7; }
.ct-confirm-hdr { display:flex; align-items:center; gap:12px; padding:20px 20px 16px; }
.ct-back { background:none; border:none; color:rgba(255,255,255,0.4); font-size:14px; font-weight:600; cursor:pointer; padding:0; }
.ct-confirm-title { font-size:18px; font-weight:800; color:#e2e8f0; letter-spacing:-0.3px; }
.ct-freeze-badge { display:flex; align-items:center; gap:8px; margin:0 16px 20px; padding:12px 16px; background:rgba(232,98,42,0.1); border:1px solid rgba(232,98,42,0.25); border-radius:16px; font-size:13px; color:#E8622A; font-weight:600; }
.ct-summary { margin:0 16px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:20px; padding:8px 0; }
.ct-sr { display:flex; justify-content:space-between; align-items:center; padding:12px 18px; }
.ct-sl { font-size:14px; color:rgba(255,255,255,0.4); }
.ct-sv { font-size:14px; font-weight:600; color:#e2e8f0; }
.ct-sdiv { height:1px; background:rgba(255,255,255,0.06); margin:4px 18px; }
.ct-sv-big { font-size:22px; font-weight:800; letter-spacing:-0.5px; }
.ct-savings { display:flex; align-items:center; gap:8px; margin:14px 16px; padding:12px 16px; background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.2); border-radius:14px; font-size:12px; }
.ct-savings-icon { font-size:16px; }
.ct-savings-txt { color:rgba(255,255,255,0.5); flex:1; line-height:1.3; }
.ct-savings-amt { color:#22c55e; font-weight:800; font-size:14px; white-space:nowrap; }
.ct-pay-row { display:flex; gap:10px; margin:auto 16px 0; padding-top:20px; }
.ct-voucher-preview { margin:14px 16px 0; border-radius:20px; overflow:hidden; position:relative; }
.ct-voucher-inner { padding:16px; display:flex; gap:14px; align-items:stretch; }
.ct-voucher-left { flex:1; min-width:0; display:flex; flex-direction:column; gap:8px; }
.ct-voucher-tag { font-size:9px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; opacity:0.6; color:#fff; }
.ct-voucher-network { font-size:18px; font-weight:900; color:#fff; letter-spacing:-0.3px; }
.ct-voucher-meta { display:flex; gap:6px; flex-wrap:wrap; }
.ct-voucher-chip { font-size:11px; font-weight:700; background:rgba(255,255,255,0.12); border-radius:8px; padding:3px 9px; color:#fff; }
.ct-voucher-desc { font-size:11px; color:rgba(255,255,255,0.55); line-height:1.45; margin-top:4px; }
.ct-voucher-qr { width:68px; flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:6px; }
.ct-voucher-qr-box { width:68px; height:68px; border-radius:10px; background:rgba(255,255,255,0.9); display:flex; align-items:center; justify-content:center; overflow:hidden; filter:blur(5px); position:relative; }
.ct-voucher-qr-grid { display:grid; grid-template-columns:repeat(7,8px); grid-template-rows:repeat(7,8px); gap:1px; }
.ct-voucher-qr-cell { border-radius:1px; }
.ct-voucher-qr-label { font-size:8px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:rgba(255,255,255,0.5); }
.ct-pay { flex:1; display:flex; align-items:center; justify-content:center; gap:8px; padding:18px; border-radius:20px; border:none; font-size:15px; font-weight:800; cursor:pointer; transition:all 0.2s; -webkit-tap-highlight-color:transparent; }
.ct-pay:active { transform:scale(0.97); }
.ct-pay:disabled { opacity:0.5; cursor:not-allowed; }
.ct-pay-stars { background:linear-gradient(135deg,#f59e0b,#d97706); color:#fff; box-shadow:0 8px 32px rgba(245,158,11,0.4); }
.ct-pay-crypto { background:rgba(59,130,246,0.15); color:#60a5fa; border:1.5px solid rgba(59,130,246,0.3) !important; }
@keyframes ctColRise { from { clip-path:inset(0 0 100% 0); opacity:0; } to { clip-path:inset(0 0 0% 0); opacity:1; } }
@keyframes ctBtnFadeIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
.ct-success { position:fixed; inset:0; z-index:99000; display:flex; flex-direction:row; background:#08080F; overflow:hidden; }
.ct-success-col { position:relative; flex:1; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden; animation:ctColRise 0.7s cubic-bezier(0.16,1,0.3,1) both; }
.ct-success-col-text { position:relative; writing-mode:vertical-lr; transform:rotate(180deg); font-size:clamp(36px,9.5vw,55px); font-weight:900; text-transform:uppercase; letter-spacing:-0.03em; line-height:1; user-select:none; }
.ct-success-col-sep { position:absolute; top:0; bottom:0; right:0; width:1px; background:rgba(255,255,255,0.06); }
.ct-success-bottom { position:absolute; bottom:calc(env(safe-area-inset-bottom,0px) + 40px); left:0; right:0; display:flex; justify-content:center; padding:0 24px; z-index:100001; pointer-events:auto; }
.ct-success-btn { background:#E8622A; border:none; border-radius:16px; color:#fff; font-size:1.1rem; font-weight:800; padding:1rem 0; width:100%; cursor:pointer; letter-spacing:-0.01em; animation:ctBtnFadeIn 0.5s ease 2.0s both; box-shadow:0 0 30px rgba(232,98,42,0.45); -webkit-tap-highlight-color:transparent; }
.ct-success-caption { position:absolute; bottom:calc(env(safe-area-inset-bottom,0px) + 14px); left:20px; z-index:100001; font-family:monospace; font-size:10px; letter-spacing:0.2em; text-transform:uppercase; color:rgba(255,255,255,0.22); }
.ct-pay-admin { background:rgba(34,197,94,0.12) !important; color:#22c55e !important; border:1.5px solid rgba(34,197,94,0.35) !important; border-radius:14px; }
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

const NETWORK_LOGOS: Record<string, { src: string; bg: string; zoom: number }> = {
  "Лукойл":       { src: "/logo-lukoil-clean.png",   bg: "#C8102E",  zoom: 1.10 },
  "Роснефть":     { src: "/logo-rosneft-clean.png",  bg: "#ffffff",  zoom: 2.00 },
  "Газпромнефть": { src: "/logo-gazprom-clean.png",  bg: "#ffffff",  zoom: 2.00 },
  "Башнефть":     { src: "/logo-bashneft-clean.png", bg: "#ffffff",  zoom: 1.80 },
  "Татнефть":     { src: "/logo-tatneft-clean.png",  bg: "#ffffff",  zoom: 1.70 },
  "ННК":          { src: "/logo-nnk-clean.png",      bg: "#ffffff",  zoom: 1.70 },
};

function NetworkLogo({ net }: { net: Net }) {
  const logo = NETWORK_LOGOS[net.name];
  if (logo) {
    const overflow = ((logo.zoom - 1) / 2) * 100;
    return (
      <div
        className="ct-net-logo"
        style={{
          background: logo.bg,
          border: "none",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          flexShrink: 0,
        }}
      >
        <img
          src={logo.src}
          alt={net.name}
          style={{
            width: `${logo.zoom * 100}%`,
            height: `${logo.zoom * 100}%`,
            margin: `-${overflow}%`,
            objectFit: "contain",
            objectPosition: "center",
            display: "block",
          }}
        />
      </div>
    );
  }
  const initials = net.name.length <= 3 ? net.name : net.name.slice(0, 2);
  return (
    <div className="ct-net-logo-fallback" style={{ background: `linear-gradient(135deg,${net.color}cc,${net.color}88)` }}>
      {initials}
    </div>
  );
}

export function CatalogTab(_props?: { initialStationId?: number; onCalcOpenChange?: (open: boolean) => void; isAdmin?: boolean; adminPass?: string }) {
  const isAdmin = _props?.isAdmin ?? false;
  const adminPass = _props?.adminPass ?? "";
  const user = useUserStore((s) => s.user);
  const refresh = useUserStore((s) => s.refresh);
  const refreshUser = useCallback(() => {
    setTimeout(() => { refresh(); }, 1500);
  }, [refresh]);
  const { add: toast } = useToast();
  const fetchVault = useVaultStore((s) => s.fetch);

  const [step, setStep] = useState<Step>("networks");
  const [sel, setSel] = useState<Sel>({ network: null, fuel: null, volume: 40 });
  const [expandedNet, setExpandedNet] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string>("");
  const qrGenRef = useRef(false);
  useEffect(() => {
    if (qrGenRef.current) return;
    qrGenRef.current = true;
    QRCode.toDataURL("TOPLIVOPREVIEW2026", {
      width: 68, margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    }).then(setQrPreviewUrl).catch(() => {});
  }, []);

  const price = sel.network && sel.fuel
    ? (sel.network.prices[sel.fuel.key as keyof typeof sel.network.prices] ?? 0)
    : 0;
  const total = price * sel.volume;
  const stars = Math.ceil(total / STAR_RUB_RATE);
  const savings3mo = ((price * 1.083 - price) * sel.volume);

  const handleNetworkClick = (net: Net) => {
    impact("light");
    if (expandedNet === net.name) {
      setExpandedNet(null);
      setSel(s => ({ ...s, network: null, fuel: null }));
    } else {
      setExpandedNet(net.name);
      setSel(s => ({ ...s, network: net, fuel: null }));
      if (step === "volume") setStep("networks");
    }
  };

  const handleFuelSelect = (net: Net, fuel: { key: string; label: string }) => {
    impact("light");
    setSel(s => ({ ...s, network: net, fuel }));
    setStep("volume");
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
              toast(`⭐ Оплата ${inv.stars_amount} Stars принята! Талон в Кармане.`, "success");
              fetchVault(user.id);
              refreshUser();
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
          refreshUser();
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

  const handleFreePurchase = useCallback(async () => {
    if (!user || !sel.network || !sel.fuel || purchasing) return;
    setPurchasing(true);
    impact("heavy");
    try {
      await adminFreePurchase(adminPass, user.id, sel.network.name, sel.fuel.key, sel.volume);
      notify("success");
      toast("✅ Талон выдан бесплатно", "success");
      fetchVault(user.id);
      refreshUser();
      setStep("success");
    } catch (e: unknown) {
      notify("error");
      toast(String(e), "error");
    } finally {
      setPurchasing(false);
    }
  }, [user, sel, adminPass, purchasing, toast, fetchVault]);

  useEffect(() => {
    const isSuccess = step === "success";
    window.dispatchEvent(new CustomEvent("tma-catalog-success", { detail: isSuccess }));
    if (isSuccess) {
      void refresh();
    }
  }, [step, refresh]);

  const reset = () => {
    setSel({ network: null, fuel: null, volume: 40 });
    setExpandedNet(null);
    setStep("networks");
  };

  const stepDots: { key: Step | "fuel"; label: string }[] = [
    { key: "networks", label: "Сеть" },
    { key: "fuel",     label: "Топливо" },
    { key: "volume",   label: "Объём" },
  ];
  const effectiveStep = sel.fuel ? "volume" : sel.network ? "fuel" : "networks";
  const stepIdx = stepDots.findIndex(d => d.key === effectiveStep);

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
      <CatalogStars />
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}>
        <line x1="33%" y1="0" x2="33%" y2="100%" stroke="rgba(99,102,241,0.07)" strokeWidth="1" />
        <line x1="66%" y1="0" x2="66%" y2="100%" stroke="rgba(99,102,241,0.07)" strokeWidth="1" />
        <line x1="0" y1="33%" x2="100%" y2="33%" stroke="rgba(99,102,241,0.07)" strokeWidth="1" />
        <line x1="0" y1="66%" x2="100%" y2="66%" stroke="rgba(99,102,241,0.07)" strokeWidth="1" />
      </svg>
      <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle,rgba(232,98,42,0.14) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <CatalogStrip color="#E8622A" style={{ top: 0, zIndex: 2 }} />

      {/* ── Success ─────────────────────────────────────────────── */}
      {step === "success" && (() => {
        const netColor = sel.network?.color ?? "#E8622A";
        const cols = [
          { text: "АХ*ЕННО!", solid: true,  delay: 0.00 },
          { text: "ВАШ",      solid: false, delay: 0.08 },
          { text: "ТАЛОНЧИК", solid: true,  delay: 0.16 },
          { text: "ЖДЁТ ВАС", solid: false, delay: 0.24 },
          { text: "В КАРМАНЕ!", solid: true, delay: 0.32 },
        ];
        return (
          <div className="ct-success">
            {cols.map((col, i) => (
              <div key={i} className="ct-success-col" style={{ animationDelay: `${col.delay}s` }}>
                <div style={{ position: "absolute", inset: 0, background: netColor, opacity: col.solid ? 1 : 0.22 }} />
                <div className="ct-success-col-text" style={{ color: "#ffffff", textShadow: !col.solid ? `0 0 40px ${netColor}aa` : "none" }}>
                  {col.text}
                </div>
                <div className="ct-success-col-sep" />
              </div>
            ))}
            <div className="ct-success-caption">Матрица Снабжения</div>
            <div className="ct-success-bottom">
              <button
                className="ct-success-btn"
                onClick={() => { reset(); window.dispatchEvent(new CustomEvent("tma-open-wallet")); }}
              >
                🎟️ Карман
              </button>
            </div>
          </div>
        );
      })()}

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

          {/* Voucher preview */}
          <div className="ct-voucher-preview" style={{ background: `linear-gradient(135deg, ${sel.network.color}cc, ${sel.network.color}88)`, border: `1px solid ${sel.network.color}55`, boxShadow: `0 4px 24px ${sel.network.color}30` }}>
            <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 12px)", pointerEvents: "none", borderRadius: "20px" }} />
            <div className="ct-voucher-inner">
              <div className="ct-voucher-left">
                <span className="ct-voucher-tag">🎫 Цифровой топливный талон</span>
                <span className="ct-voucher-network">{sel.network.name}</span>
                <div className="ct-voucher-meta">
                  <span className="ct-voucher-chip">{sel.fuel.label}</span>
                  <span className="ct-voucher-chip">{sel.volume} л</span>
                  <span className="ct-voucher-chip">{total.toFixed(0)} ₽</span>
                </div>
                <p className="ct-voucher-desc">
                  После оплаты QR-код появится в Кармане. Покажи его оператору на кассе — он сканирует и отпускает топливо. Талон действует 90 дней.
                </p>
              </div>
              <div className="ct-voucher-qr">
                <div className="ct-voucher-qr-box">
                  {qrPreviewUrl && (
                    <img src={qrPreviewUrl} alt="QR" style={{ width: 68, height: 68, display: "block" }} />
                  )}
                </div>
                <span className="ct-voucher-qr-label">QR-код</span>
              </div>
            </div>
          </div>

          <div className="ct-pay-row">
            <button className="ct-pay ct-pay-stars" disabled={purchasing} onClick={() => handlePay("stars")}>
              {purchasing ? "…" : <><span>⭐</span> {stars} Stars</>}
            </button>
            <button className="ct-pay ct-pay-crypto" disabled={purchasing} onClick={() => handlePay("crypto")}>
              {purchasing ? "…" : <><span>💎</span> {(total / 92).toFixed(2)} USDT</>}
            </button>
          </div>
          {isAdmin && (
            <button
              className="ct-pay ct-pay-admin"
              style={{ margin: "10px 16px 0", width: "calc(100% - 32px)" }}
              disabled={purchasing}
              onClick={handleFreePurchase}
            >
              {purchasing ? "…" : "🆓 Бесплатно (admin)"}
            </button>
          )}
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
            {stepDots.map(({ key, label }, i) => {
              const isDone = i < stepIdx;
              const isCurr = i === stepIdx;
              return (
                <div key={key} className="ct-step">
                  <div
                    className={`ct-dot${isDone ? " done" : ""}${isCurr ? " active" : ""}`}
                    style={isCurr && sel.network ? { background: `${sel.network.color}33`, borderColor: sel.network.color, color: sel.network.color } : {}}
                  >
                    {isDone ? "✓" : i + 1}
                  </div>
                  <span className="ct-step-lbl">{label}</span>
                </div>
              );
            })}
          </div>

          <div className="ct-scroll">
            {/* Networks with inline accordion */}
            <div className="ct-section">
              <h2 className="ct-section-title">Выберите сеть</h2>
              <div className="ct-nets">
                {NETWORKS.map(net => {
                  const isExpanded = expandedNet === net.name;
                  const isSelected = sel.network?.name === net.name;
                  const price95 = net.prices["АИ-95"];
                  return (
                    <div key={net.name} className="ct-net-wrap">
                      {/* Network button */}
                      <motion.button
                        className={`ct-net${isExpanded ? " expanded" : ""}`}
                        onClick={() => handleNetworkClick(net)}
                        whileTap={{ scale: 0.98 }}
                        style={{
                          borderColor: isSelected ? net.color : "rgba(255,255,255,0.07)",
                          background: isSelected
                            ? `linear-gradient(135deg,${net.color}18 0%,${net.color}06 100%)`
                            : "rgba(255,255,255,0.03)",
                          boxShadow: isSelected && !isExpanded
                            ? `0 0 0 1px ${net.color}44, 0 6px 24px ${net.glow}20`
                            : "none",
                        }}
                      >
                        <NetworkLogo net={net} />
                        <div className="ct-net-names">
                          <span className="ct-net-name">{net.name}</span>
                          <span className="ct-net-badge" style={{ color: net.color }}>{net.badge}</span>
                        </div>
                        <div className="ct-net-right">
                          <span className="ct-net-price" style={{ color: isSelected ? net.color : "rgba(255,255,255,0.82)" }}>
                            {price95.toFixed(1)}₽
                          </span>
                          <span className="ct-net-stations">АИ-95 · {net.fuels.length} вида</span>
                        </div>
                        <span className={`ct-net-chevron${isExpanded ? " open" : ""}`}>▼</span>
                      </motion.button>

                      {/* Inline fuel accordion */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            key="accordion"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: "easeInOut" }}
                            className="ct-accordion"
                            style={{ borderColor: net.color + "44", background: `${net.color}08` }}
                          >
                            <div className="ct-accordion-inner">
                              {net.fuels.map(fuel => {
                                const fuelPrice = net.prices[fuel.key as keyof typeof net.prices];
                                const isActive = sel.fuel?.key === fuel.key && isSelected;
                                return (
                                  <motion.button
                                    key={fuel.key}
                                    className="ct-fuel"
                                    whileTap={{ scale: 0.96 }}
                                    onClick={() => handleFuelSelect(net, fuel)}
                                    style={{
                                      borderColor: isActive ? net.color : "rgba(255,255,255,0.08)",
                                      background: isActive ? `${net.color}22` : "rgba(255,255,255,0.04)",
                                      color: isActive ? net.color : "rgba(255,255,255,0.82)",
                                      boxShadow: isActive ? `0 0 12px ${net.glow}30` : "none",
                                    }}
                                  >
                                    <span className="ct-fuel-name">{fuel.label}</span>
                                    <span className="ct-fuel-price" style={{ color: isActive ? net.color : "rgba(255,255,255,0.5)" }}>
                                      {fuelPrice?.toFixed(1) ?? "—"}₽
                                    </span>
                                  </motion.button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Volume picker — appears after fuel selected */}
            <AnimatePresence>
              {sel.network && sel.fuel && (
                <motion.div
                  key={sel.fuel.key + sel.network.name}
                  className="ct-section"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
                >
                  <div className="ct-row">
                    <h2 className="ct-section-title">Объём</h2>
                    <span className="ct-hint" style={{ color: sel.network.color }}>{sel.fuel.label}</span>
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
                      background: "linear-gradient(135deg,#E8622A,#c04d1e)",
                      boxShadow: "0 0 24px #E8622A44",
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
