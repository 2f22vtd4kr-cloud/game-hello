import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Fuse from "fuse.js";
import { fetchLimits, createStarsInvoice, createCryptoBotInvoice, createNetworkStarsInvoice, createNetworkCryptoBotInvoice, fetchStations as apiFetchStations, setPriceAlert, fetchPriceAlerts, deletePriceAlert } from "@/api/client";
import type { PriceAlertOut } from "@/api/client";
import { useUserStore } from "@/stores/useUserStore";
import { usePriceStore } from "@/stores/usePriceStore";
import { useStationStore } from "@/stores/useStationStore";
import { useVaultStore } from "@/stores/useVaultStore";
import { useToast } from "@/components/Toast";
import { StationLogo } from "@/components/StationLogo";
import { FuelCalculatorModal } from "@/components/FuelCalculatorModal";
import { impact, notify } from "@/lib/haptic";
import { useFavoritesStore } from "@/stores/useFavoritesStore";
import type { GasStation, LimitsMap } from "@/types";
import { FUEL_LABELS } from "@/types";

const FUEL_PRICES: Record<string, number> = {
  "АИ-92": 65, "АИ-95": 71, "АИ-95+": 76,
  "АИ-100": 88, "ДТ": 79, "ДТ+": 84, "Газ": 35,
};
const NETWORK_PRICES: Record<string, Record<string, number>> = {
  "Лукойл":          { "АИ-92": 65.9, "АИ-95": 74.2, "АИ-95+": 79.5, "АИ-100": 92.0, "ДТ": 80.5, "ДТ+": 85.3, "Газ": 31.2 },
  "Роснефть":        { "АИ-92": 65.1, "АИ-95": 72.9, "АИ-95+": 78.0, "АИ-100": 90.5, "ДТ": 79.4, "ДТ+": 84.2, "Газ": 30.5 },
  "Газпромнефть":    { "АИ-92": 65.4, "АИ-95": 73.4, "АИ-95+": 78.5, "АИ-100": 91.2, "ДТ": 79.9, "ДТ+": 84.7, "Газ": 30.9 },
  "Газпром":         { "АИ-92": 65.4, "АИ-95": 73.4, "АИ-95+": 78.5, "АИ-100": 91.2, "ДТ": 79.9, "ДТ+": 84.7, "Газ": 30.9 },
  "Башнефть":        { "АИ-92": 61.9, "АИ-95": 66.1, "АИ-95+": 70.7, "АИ-100": 86.0, "ДТ": 75.8, "ДТ+": 80.3, "Газ": 26.5 },
  "Татнефть":        { "АИ-92": 62.4, "АИ-95": 66.8, "АИ-95+": 71.5, "АИ-100": 86.8, "ДТ": 76.4, "ДТ+": 81.0, "Газ": 26.9 },
  "ННК":             { "АИ-92": 70.5, "АИ-95": 74.8, "АИ-95+": 80.0, "АИ-100": 92.2, "ДТ": 87.9, "ДТ+": 93.2, "Газ": 35.0 },
  "Teboil":          { "АИ-92": 64.8, "АИ-95": 71.2, "АИ-95+": 76.2, "АИ-100": 88.5, "ДТ": 79.2, "ДТ+": 83.9, "Газ": 30.1 },
  "Тебойл":          { "АИ-92": 64.8, "АИ-95": 71.2, "АИ-95+": 76.2, "АИ-100": 88.5, "ДТ": 79.2, "ДТ+": 83.9, "Газ": 30.1 },
  "Нефтьмагистраль": { "АИ-92": 64.5, "АИ-95": 70.9, "АИ-95+": 75.9, "АИ-100": 88.0, "ДТ": 78.5, "ДТ+": 83.2, "Газ": 29.8 },
  "ТРАССА":          { "АИ-92": 64.2, "АИ-95": 70.5, "АИ-95+": 75.4, "АИ-100": 87.5, "ДТ": 78.0, "ДТ+": 82.7, "Газ": 29.5 },
};
const NETWORK_VOUCHER_NETWORKS = [
  { name: "Лукойл",       color: "#ef4444" },
  { name: "Роснефть",     color: "#0ea5e9" },
  { name: "Газпромнефть", color: "#3b82f6" },
  { name: "Башнефть",     color: "#8b5cf6" },
  { name: "Татнефть",     color: "#22c55e" },
  { name: "ННК",          color: "#f59e0b" },
];

const NETWORK_BADGES: Record<string, { text: string; bg: string; fg: string }> = {
  "Лукойл":       { text: "🔥 ТОП",     bg: "#ef444422", fg: "#ef4444" },
  "Роснефть":     { text: "⚡ PULSAR",   bg: "#0ea5e922", fg: "#0ea5e9" },
  "Газпромнефть": { text: "✦ G-DRIVE",  bg: "#3b82f622", fg: "#3b82f6" },
  "Башнефть":     { text: "⚗ ATUM",     bg: "#8b5cf622", fg: "#8b5cf6" },
  "Татнефть":     { text: "◆ ТАНЕКО",   bg: "#22c55e22", fg: "#22c55e" },
  "ННК":          { text: "🌿 NEO",      bg: "#f59e0b22", fg: "#f59e0b" },
};

const POPULAR_COMBOS: { network: string; fuelKey: string; fuelLabel: string; volume: number; badge: string; color: string }[] = [
  { network: "Лукойл",       fuelKey: "АИ-95+", fuelLabel: "ЭКТО Plus",  volume: 40, badge: "🔥 Хит",     color: "#ef4444" },
  { network: "Газпромнефть", fuelKey: "АИ-95+", fuelLabel: "G-Drive 95", volume: 40, badge: "✦ Топ",      color: "#3b82f6" },
  { network: "Роснефть",     fuelKey: "АИ-92",  fuelLabel: "АИ-92",      volume: 60, badge: "⚡ Выгодно", color: "#0ea5e9" },
  { network: "Татнефть",     fuelKey: "ДТ+",    fuelLabel: "ДТ ТАНЕКО",  volume: 40, badge: "◆ ДТ",       color: "#22c55e" },
];

const NETWORK_FUELS: Record<string, { key: string; label: string }[]> = {
  "Лукойл": [
    { key: "АИ-92",  label: "АИ-92" },
    { key: "АИ-95",  label: "АИ-95" },
    { key: "АИ-95+", label: "ЭКТО Plus" },
    { key: "АИ-100", label: "ЭКТО-100" },
    { key: "ДТ",     label: "ДТ Евро" },
    { key: "ДТ+",    label: "ДТ ЭКТО" },
    { key: "Газ",    label: "СУГ" },
  ],
  "Роснефть": [
    { key: "АИ-92",  label: "АИ-92" },
    { key: "АИ-95",  label: "АИ-95" },
    { key: "АИ-95+", label: "Pulsar-95" },
    { key: "АИ-100", label: "Pulsar-100" },
    { key: "ДТ",     label: "ДТ Евро" },
    { key: "ДТ+",    label: "Pulsar ДТ" },
    { key: "Газ",    label: "СУГ / КПГ" },
  ],
  "Газпромнефть": [
    { key: "АИ-92",  label: "АИ-92" },
    { key: "АИ-95",  label: "АИ-95" },
    { key: "АИ-95+", label: "G-Drive 95" },
    { key: "АИ-100", label: "G-Drive 100" },
    { key: "ДТ",     label: "ДТ Опти" },
    { key: "ДТ+",    label: "G-Drive ДТ" },
    { key: "Газ",    label: "СУГ / КПГ" },
  ],
  "Башнефть": [
    { key: "АИ-92",  label: "ATUM-92" },
    { key: "АИ-95",  label: "ATUM-95" },
    { key: "АИ-100", label: "АИ-100" },
    { key: "ДТ",     label: "ДТ Евро" },
    { key: "Газ",    label: "СУГ" },
  ],
  "Татнефть": [
    { key: "АИ-92",  label: "АИ-92 ТАНЕКО" },
    { key: "АИ-95",  label: "АИ-95 ТАНЕКО" },
    { key: "АИ-95+", label: "АИ-98 ТАНЕКО" },
    { key: "АИ-100", label: "АИ-100 ТАНЕКО" },
    { key: "ДТ",     label: "ДТ Евро" },
    { key: "ДТ+",    label: "ДТ ТАНЕКО" },
    { key: "Газ",    label: "СУГ / КПГ" },
  ],
  "ННК": [
    { key: "АИ-92",  label: "NEO-92" },
    { key: "АИ-95",  label: "NEO-95" },
    { key: "АИ-95+", label: "NEO-98" },
    { key: "ДТ",     label: "ДТ Евро" },
    { key: "ДТ+",    label: "ДТ зимнее" },
    { key: "Газ",    label: "СУГ" },
  ],
};
const VOLUMES = [20, 40, 60];
const STAR_RUB_RATE = 2.5; // ~$0.013 per Star × ~90 RUB/USD; adjusted to match real fuel prices
const PAGE_SIZE = 25;
const MAX_INLINE = 150;

/** Canonical fuel type matched by fuzzy query → fuel_type key */
const FUEL_ALIASES: Record<string, string> = {
  // АИ-92
  "92": "АИ-92", "аи92": "АИ-92", "аи-92": "АИ-92", "ai92": "АИ-92", "ai-92": "АИ-92",
  "аи 92": "АИ-92",
  // АИ-95
  "95": "АИ-95", "аи95": "АИ-95", "аи-95": "АИ-95", "ai95": "АИ-95", "ai-95": "АИ-95",
  "аи 95": "АИ-95",
  // АИ-95+
  "95+": "АИ-95+", "аи95+": "АИ-95+", "аи-95+": "АИ-95+", "95 плюс": "АИ-95+",
  // АИ-100
  "100": "АИ-100", "аи100": "АИ-100", "аи-100": "АИ-100", "ai100": "АИ-100",
  // ДТ
  "дт": "ДТ", "дизель": "ДТ", "diesel": "ДТ", "dt": "ДТ", "диз": "ДТ", "соляра": "ДТ",
  "солярка": "ДТ",
  // ДТ+
  "дт+": "ДТ+", "дизель+": "ДТ+", "евродизель": "ДТ+", "евро": "ДТ+",
  // Газ
  "газ": "Газ", "lpg": "Газ", "метан": "Газ", "пропан": "Газ", "гаs": "Газ",
};

/** Returns canonical fuel type if query matches an alias, else null */
function matchFuelAlias(query: string): string | null {
  const q = query.trim().toLowerCase();
  return FUEL_ALIASES[q] ?? null;
}

type PayMethod = "stars" | "cryptobot";

// ─── BlockOverlay ──────────────────────────────────────────────────────────
function BlockOverlay({ reason, onClose }: { reason: string; onClose: () => void }) {
  const [countdown, setCountdown] = useState(15);
  useEffect(() => {
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(5,5,7,0.97)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "1.5rem", textAlign: "center",
      }}
    >
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(239,68,68,0.03) 2px,rgba(239,68,68,0.03) 4px)",
      }} />
      <motion.div
        initial={{ scale: 0.82, y: 30 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        style={{
          background: "linear-gradient(160deg,#14141c,#1a050a)",
          border: "1px solid #ef444455", borderRadius: "24px",
          padding: "2rem 1.5rem", maxWidth: "320px", width: "100%",
          position: "relative", overflow: "hidden",
          boxShadow: "0 0 60px #ef444422, inset 0 1px 0 #ef444422",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(90deg, transparent, #ef4444, transparent)" }} />
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
          style={{ fontSize: "3rem", marginBottom: "0.75rem", filter: "drop-shadow(0 0 16px #ef444488)" }}
        >🚫</motion.div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#ef4444", fontSize: "0.55rem", letterSpacing: "0.15em", marginBottom: "0.5rem", opacity: 0.7 }}>
          СИСТЕМА · БЛОКИРОВКА · {new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
        <h3 style={{ color: "#ef4444", fontSize: "1rem", margin: "0 0 0.75rem", fontWeight: 800, lineHeight: 1.2 }}>
          Шлюз временно недоступен
        </h3>
        <p style={{ color: "#9ca3af", fontSize: "0.8rem", margin: "0 0 1.25rem", lineHeight: 1.6 }}>{reason}</p>
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
            <span style={{ color: "#4b5563", fontSize: "0.62rem" }}>Авто-закрытие через</span>
            <span style={{ color: countdown > 5 ? "#ef4444" : "#f97316", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.72rem", fontWeight: 700 }}>{countdown}с</span>
          </div>
          <div style={{ height: "3px", background: "#1e1e2a", borderRadius: "2px", overflow: "hidden" }}>
            <motion.div
              initial={{ width: "100%" }} animate={{ width: "0%" }}
              transition={{ duration: 15, ease: "linear" }}
              style={{ height: "100%", background: "linear-gradient(90deg,#ef4444,#dc2626)", borderRadius: "2px" }}
            />
          </div>
        </div>
        <button onClick={onClose} style={{
          background: "linear-gradient(135deg,#a855f7,#db2777)", color: "#fff",
          border: "none", borderRadius: "12px", padding: "0.8rem 2rem",
          cursor: "pointer", fontSize: "0.9rem", fontWeight: 700, width: "100%",
          boxShadow: "0 0 20px #a855f740",
        }}>Принять и закрыть</button>
      </motion.div>
    </motion.div>
  );
}

// ─── PaymentConfirmModal ───────────────────────────────────────────────────
interface PendingConfirm { fuelType: string; volume: number; method: PayMethod; starsAmount: number; totalPrice: number; }

function PaymentConfirmModal({ pending, onConfirm, onCancel }: { pending: PendingConfirm; onConfirm: () => void; onCancel: () => void; }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 9100, background: "rgba(5,5,7,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
    >
      <motion.div
        initial={{ scale: 0.88, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 12 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        style={{
          background: "linear-gradient(160deg,#0d0d18,#0f0820)",
          border: "1px solid #a855f733", borderRadius: "22px",
          padding: "1.6rem 1.4rem", maxWidth: "320px", width: "100%",
          position: "relative", overflow: "hidden",
          boxShadow: "0 0 60px #a855f722, inset 0 1px 0 #a855f718",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(90deg,transparent,#a855f7,#db2777,transparent)" }} />
        <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
          <motion.div
            animate={{ rotate: [0, 8, -8, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            style={{ fontSize: "2.4rem", marginBottom: "0.6rem" }}
          >⛽</motion.div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#4b5563", fontSize: "0.5rem", letterSpacing: "0.16em", marginBottom: "0.4rem" }}>ПОДГОТОВКА_ОПЛАТЫ</div>
          <h3 style={{ margin: "0 0 0.3rem", color: "#e2e8f0", fontSize: "1.1rem", fontWeight: 800 }}>Подтвердите заказ</h3>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "0.78rem", lineHeight: 1.5 }}>{pending.volume}л {pending.fuelType}</p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", marginTop: "0.45rem", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: "20px", padding: "0.2rem 0.55rem" }}>
            <span style={{ fontSize: "0.65rem" }}>🔒</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#22c55e", fontSize: "0.44rem", fontWeight: 700 }}>ЦЕНА ЗАМОРОЖЕНА · 90 ДНЕЙ</span>
          </div>
        </div>
        <div style={{ background: "#14141c", border: "1px solid #22222f", borderRadius: "14px", padding: "0.85rem 1rem", marginBottom: "1.1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.45rem" }}>
            <span style={{ color: "#6b7280", fontSize: "0.72rem" }}>Объём</span>
            <span style={{ color: "#e2e8f0", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.8rem", fontWeight: 700 }}>{pending.volume} л</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.45rem" }}>
            <span style={{ color: "#6b7280", fontSize: "0.72rem" }}>Сумма</span>
            <span style={{ color: "#a855f7", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.8rem", fontWeight: 700 }}>{pending.totalPrice.toFixed(0)} ₽</span>
          </div>
          <div style={{ height: "1px", background: "#22222f", margin: "0.45rem 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#6b7280", fontSize: "0.72rem" }}>Оплата</span>
            <span style={{ color: pending.method === "stars" ? "#f59e0b" : "#3b82f6", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.82rem", fontWeight: 800 }}>
              {pending.method === "stars" ? `⭐ ${pending.starsAmount} Stars` : `💎 ${(pending.totalPrice / 92).toFixed(2)} USDT`}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button
            onClick={() => { notify("warning" as any); impact("light"); onCancel(); }}
            style={{ flex: 1, padding: "0.85rem", background: "#14141c", border: "1px solid #22222f", borderRadius: "12px", color: "#6b7280", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer" }}
          >Отмена</button>
          <motion.button
            onClick={() => { impact("heavy"); onConfirm(); }}
            whileTap={{ scale: 0.96 }}
            animate={{ boxShadow: ["0 0 16px rgba(168,85,247,0.35)","0 0 28px rgba(168,85,247,0.6)","0 0 16px rgba(168,85,247,0.35)"] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            style={{ flex: 2, padding: "0.85rem", background: "linear-gradient(135deg,#a855f7,#db2777)", border: "none", borderRadius: "12px", color: "#fff", fontSize: "0.95rem", fontWeight: 800, cursor: "pointer", letterSpacing: "0.02em" }}
          >Продолжить ⛽</motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── PaymentMethodSelector ─────────────────────────────────────────────────
function PaymentMethodSelector({ value, onChange }: { value: PayMethod; onChange: (m: PayMethod) => void }) {
  const methods: { id: PayMethod; label: string; emoji: string; color: string }[] = [
    { id: "stars",     label: "Telegram Stars", emoji: "⭐", color: "#f59e0b" },
    { id: "cryptobot", label: "Криптовалюта",   emoji: "💎", color: "#3b82f6" },
  ];
  return (
    <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.6rem" }}>
      {methods.map((m) => (
        <button key={m.id} onClick={() => onChange(m.id)} style={{
          flex: 1, padding: "0.4rem 0.3rem",
          border: `1px solid ${value === m.id ? m.color : "#22222f"}`,
          borderRadius: "8px",
          background: value === m.id ? `${m.color}22` : "#0b0b0f",
          color: value === m.id ? m.color : "#6b7280",
          fontSize: "0.72rem", fontWeight: value === m.id ? 700 : 400,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem",
        }}>{m.emoji} {m.label}</button>
      ))}
    </div>
  );
}

// ─── LiveMarketWidget ──────────────────────────────────────────────────────
function LiveMarketWidget({
  fuelType, lockedPrice, volume, compact = false,
}: {
  fuelType: string; lockedPrice: number; volume: number; compact?: boolean;
}) {
  const prices = usePriceStore((s) => s.prices);
  const connected = usePriceStore((s) => s.connected);
  const user = useUserStore((s) => s.user);
  const { add: toast } = useToast();
  const [flash, setFlash] = useState(false);
  const prevMarket = useRef(lockedPrice);

  // ── Alert state ──
  const [activeAlert, setActiveAlert] = useState<PriceAlertOut | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [threshold, setThreshold] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [saving, setSaving] = useState(false);

  const marketPrice = useMemo(() => {
    const vals = Object.values(prices)
      .map(r => (r[fuelType] as { effective?: number } | undefined)?.effective ?? 0)
      .filter(v => v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : lockedPrice;
  }, [prices, fuelType, lockedPrice]);

  // Load existing alert for this fuel type
  useEffect(() => {
    if (!user?.id) return;
    fetchPriceAlerts(user.id)
      .then(alerts => {
        const match = alerts.find(a => a.fuel_type === fuelType) ?? null;
        setActiveAlert(match);
      })
      .catch(() => {});
  }, [user?.id, fuelType]);

  // Flash border on price move
  useEffect(() => {
    if (Math.abs(marketPrice - prevMarket.current) > 0.05) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 700);
      prevMarket.current = marketPrice;
      return () => clearTimeout(t);
    }
  }, [marketPrice]);

  const handleBellClick = () => {
    if (activeAlert) {
      handleDeleteAlert();
    } else {
      setThreshold(String(Math.round(direction === "above" ? marketPrice + 2 : marketPrice - 2)));
      setAlertOpen(v => !v);
    }
  };

  const handleSaveAlert = async () => {
    if (!user?.id) return;
    const val = parseFloat(threshold);
    if (isNaN(val) || val <= 0) { toast("Введите корректную цену", "error"); return; }
    setSaving(true);
    try {
      const result = await setPriceAlert(user.id, user.id, fuelType, val, direction);
      setActiveAlert(result);
      setAlertOpen(false);
      toast(`🔔 Уведомление: ${fuelType} ${direction === "above" ? "≥" : "≤"} ${val}₽/л`, "success");
    } catch {
      toast("Не удалось сохранить уведомление", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAlert = async () => {
    if (!activeAlert || !user?.id) return;
    try {
      await deletePriceAlert(activeAlert.id, user.id);
      setActiveAlert(null);
      setAlertOpen(false);
      toast("🔕 Уведомление отключено", "info");
    } catch {
      toast("Ошибка при удалении уведомления", "error");
    }
  };

  const baseFuelPrice = FUEL_PRICES[fuelType] ?? lockedPrice;
  const premium = Math.max(0, marketPrice / baseFuelPrice - 1);
  const monthlyRate = Math.min(0.05, 0.028 + premium * 0.15);

  const pts = [0, 1, 2, 3].map(mo => ({
    mo,
    market: marketPrice * Math.pow(1 + monthlyRate, mo),
    locked: lockedPrice,
  }));
  const savings3mo = Math.max(0, (pts[3].market - lockedPrice) * volume);

  const W = 280, H = compact ? 46 : 56;
  const padL = 38, padR = 16, padT = 10, padB = 16;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const allVals = pts.flatMap(p => [p.market, p.locked]);
  const minP = Math.min(...allVals) * 0.994;
  const maxP = Math.max(...allVals) * 1.006;
  const range = maxP - minP || 1;
  const toX = (mo: number) => padL + (mo / 3) * chartW;
  const toY = (p: number) => padT + chartH - ((p - minP) / range) * chartH;

  const mktLine = pts.map(p => `${toX(p.mo).toFixed(1)},${toY(p.market).toFixed(1)}`).join(' ');
  const lckLine = pts.map(p => `${toX(p.mo).toFixed(1)},${toY(p.locked).toFixed(1)}`).join(' ');
  const fillPoly = [
    ...pts.map(p => `${toX(p.mo).toFixed(1)},${toY(p.market).toFixed(1)}`),
    ...[...pts].reverse().map(p => `${toX(p.mo).toFixed(1)},${toY(p.locked).toFixed(1)}`),
  ].join(' ');

  return (
    <div style={{
      background: flash ? "rgba(239,68,68,0.07)" : "#0a0a14",
      border: `1px solid ${flash ? "#ef444433" : "#1e1e2a"}`,
      borderRadius: "12px", padding: "0.5rem 0.65rem", marginBottom: "0.65rem",
      transition: "background 0.3s, border-color 0.3s",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.35rem" }}>
        <div style={{
          width: "5px", height: "5px", borderRadius: "50%",
          background: connected ? "#22c55e" : "#374151",
          boxShadow: connected ? "0 0 5px #22c55e" : "none", flexShrink: 0, transition: "all 0.3s",
        }} />
        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.4rem", letterSpacing: "0.1em" }}>
          РЫНОК vs ТАЛОН · {connected ? "LIVE" : "—"}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", color: "#22c55e", fontWeight: 800 }}>
            +{savings3mo.toFixed(0)}₽
          </span>
          <span style={{ color: "#374151", fontSize: "0.38rem" }}>за {volume}л · 3мес</span>
          {/* Bell alert button */}
          <button
            onClick={handleBellClick}
            title={activeAlert ? `Отключить уведомление (${activeAlert.direction === "above" ? "≥" : "≤"}${activeAlert.threshold_rub.toFixed(0)}₽)` : "Настроить ценовое уведомление"}
            style={{
              background: activeAlert ? "rgba(245,158,11,0.15)" : "rgba(55,65,81,0.15)",
              border: `1px solid ${activeAlert ? "#f59e0b55" : "#22222f"}`,
              borderRadius: "6px", padding: "0.15rem 0.3rem", cursor: "pointer",
              color: activeAlert ? "#f59e0b" : "#4b5563",
              fontSize: "0.62rem", display: "flex", alignItems: "center", gap: "0.2rem",
              transition: "all 0.2s", lineHeight: 1,
            }}
          >
            {activeAlert ? "🔔" : "🔕"}
            {activeAlert && (
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.37rem", color: "#f59e0b" }}>
                {activeAlert.direction === "above" ? "≥" : "≤"}{activeAlert.threshold_rub.toFixed(0)}₽
              </span>
            )}
          </button>
        </div>
      </div>

      {/* SVG chart */}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
        <polygon points={fillPoly} fill="rgba(239,68,68,0.1)" />
        <polyline points={mktLine} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={lckLine} fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3" />
        {pts.map((p) => (
          <g key={p.mo}>
            <circle cx={toX(p.mo)} cy={toY(p.market)} r="2.5" fill="#ef4444" />
            {p.mo === 0 && <circle cx={toX(p.mo)} cy={toY(p.locked)} r="2.5" fill="#22c55e" />}
          </g>
        ))}
        {pts.map((p) => (
          <text key={p.mo} x={toX(p.mo)} y={H - 1} textAnchor="middle" fill="#2a2a36" fontSize="7" fontFamily="JetBrains Mono, monospace">
            {p.mo === 0 ? "сейч" : `+${p.mo}м`}
          </text>
        ))}
        {(() => {
          const yMkt = toY(pts[3].market);
          const yLck = toY(lockedPrice);
          // Keep labels at least 10px apart; push them away from each other
          const gap = 10;
          let yMktLabel = yMkt + 3;
          let yLckLabel = yLck + 3;
          if (Math.abs(yMktLabel - yLckLabel) < gap) {
            const mid = (yMktLabel + yLckLabel) / 2;
            yMktLabel = mid - gap / 2;
            yLckLabel = mid + gap / 2;
          }
          return (
            <>
              <text x={padL - 3} y={yMktLabel} textAnchor="end" fill="#ef4444" fontSize="7.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                {pts[3].market.toFixed(0)}₽
              </text>
              <text x={padL - 3} y={yLckLabel} textAnchor="end" fill="#22c55e" fontSize="7.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                {lockedPrice.toFixed(0)}₽
              </text>
              <text x={toX(3) + 4} y={yMkt + 3} fill="#ef4444" fontSize="8" fontFamily="JetBrains Mono, monospace">▲</text>
            </>
          );
        })()}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        {([["#ef4444", "▲ Рынок (прогноз)"], ["#22c55e", "— Ваш талон"]] as [string, string][]).map(([color, label]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <div style={{ width: "10px", height: "1.5px", background: color, borderRadius: "1px", flexShrink: 0 }} />
            <span style={{ color: "#374151", fontSize: "0.4rem", fontFamily: "'JetBrains Mono',monospace" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Alert setup panel */}
      {alertOpen && !activeAlert && (
        <div style={{
          marginTop: "0.55rem", padding: "0.55rem 0.6rem",
          background: "#08080f", borderRadius: "8px", border: "1px solid #1a1a28",
        }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#4b5563", fontSize: "0.38rem", letterSpacing: "0.1em", marginBottom: "0.45rem" }}>
            УВЕДОМИТЬ КОГДА {fuelType}
          </div>
          {/* Direction toggle */}
          <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.45rem" }}>
            {(["above", "below"] as const).map(d => (
              <button key={d} onClick={() => {
                setDirection(d);
                setThreshold(String(Math.round(d === "above" ? marketPrice + 2 : marketPrice - 2)));
              }} style={{
                flex: 1, padding: "0.2rem 0.4rem", borderRadius: "5px", cursor: "pointer",
                fontSize: "0.52rem", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700,
                background: direction === d
                  ? (d === "above" ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.12)")
                  : "#0b0b0f",
                border: `1px solid ${direction === d ? (d === "above" ? "#ef444466" : "#22c55e55") : "#1e1e2a"}`,
                color: direction === d ? (d === "above" ? "#ef4444" : "#22c55e") : "#374151",
                transition: "all 0.15s",
              }}>
                {d === "above" ? "↑ вырастет до" : "↓ упадёт до"}
              </button>
            ))}
          </div>
          {/* Input + save row */}
          <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
            <input
              type="number"
              value={threshold}
              onChange={e => setThreshold(e.target.value)}
              min={1}
              style={{
                flex: 1, background: "#0b0b0f", border: "1px solid #22222f",
                borderRadius: "6px", color: "#e2e8f0",
                fontFamily: "'JetBrains Mono',monospace", fontSize: "0.72rem",
                padding: "0.28rem 0.45rem", outline: "none",
              }}
              placeholder={`${Math.round(marketPrice)}₽`}
            />
            <span style={{ color: "#374151", fontSize: "0.55rem", fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>₽/л</span>
            <button onClick={handleSaveAlert} disabled={saving} style={{
              background: "rgba(168,85,247,0.15)", border: "1px solid #a855f755",
              borderRadius: "6px", color: "#a855f7",
              fontFamily: "'JetBrains Mono',monospace", fontSize: "0.58rem", fontWeight: 800,
              padding: "0.28rem 0.55rem", cursor: saving ? "wait" : "pointer", flexShrink: 0,
              transition: "opacity 0.2s", opacity: saving ? 0.5 : 1,
            }}>
              {saving ? "…" : "🔔 Вкл"}
            </button>
            <button onClick={() => setAlertOpen(false)} style={{
              background: "transparent", border: "1px solid #1e1e2a",
              borderRadius: "6px", color: "#374151",
              fontSize: "0.6rem", padding: "0.28rem 0.42rem", cursor: "pointer", flexShrink: 0,
            }}>✕</button>
          </div>
          <div style={{ marginTop: "0.3rem", color: "#2a2a36", fontSize: "0.37rem", fontFamily: "'JetBrains Mono',monospace" }}>
            Сейчас: {marketPrice.toFixed(1)}₽/л · уведомление раз в 6 ч
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FuelItem ──────────────────────────────────────────────────────────────
function FuelItem({ fuelType, station, limits, userId, payMethod, onBuy }: {
  fuelType: string; station: GasStation; limits: LimitsMap | null;
  userId: number; payMethod: PayMethod;
  onBuy: (fuelType: string, volume: number, payMethod: PayMethod) => void;
}) {
  const [volume, setVolume] = useState(20);
  const getPrice = usePriceStore((s) => s.getPrice);

  const limit = limits?.[fuelType];
  const priceData = getPrice(station.region, fuelType);
  const pricePerL = priceData?.effective ?? FUEL_PRICES[fuelType] ?? 50;
  const isCrisis = (priceData?.multiplier ?? 1) > 1.15;
  const totalPrice = pricePerL * volume;
  const remaining = limit?.remaining ?? Infinity;
  const withinLimit = volume <= remaining;

  const fuelStatus = station.fuel_statuses.find((f) => f.fuel_type === fuelType);
  const available = fuelStatus && fuelStatus.availability_pct > 0;
  const statusColor = !available ? "#ef4444" : fuelStatus.availability_pct >= 60 ? "#22c55e" : "#eab308";
  const starsAmount = Math.ceil(totalPrice / STAR_RUB_RATE);

  const btnLabel = () => {
    if (!available) return "Нет в наличии";
    if (!withinLimit) return "Лимит исчерпан";
    if (payMethod === "stars") return `⭐ ${starsAmount.toLocaleString("ru")} Stars`;
    if (payMethod === "cryptobot") return `💎 ${(totalPrice / 92).toFixed(2)} USDT`;
    return `⛽ ${totalPrice.toLocaleString("ru")} ₽`;
  };

  return (
    <motion.div layout className={isCrisis ? "crisis-badge" : ""} style={{
      background: "#14141c",
      border: `1px solid ${isCrisis ? "#ff008855" : "#22222f"}`,
      borderRadius: "14px", padding: "0.85rem", marginBottom: "0.5rem",
      transition: "border-color 0.4s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
          <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "0.9rem" }}>{FUEL_LABELS[fuelType] ?? fuelType}</span>
          {isCrisis && (
            <span style={{ background: "rgba(255,0,136,0.15)", border: "1px solid #ff008866", borderRadius: "4px", padding: "0.05rem 0.35rem", fontSize: "0.65rem", color: "#ff0088", fontWeight: 700, letterSpacing: "0.04em" }}>КРИЗИС</span>
          )}
        </div>
        <span className={isCrisis ? "crisis-price-text" : ""} style={isCrisis ? undefined : { color: "#a855f7", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.85rem", fontWeight: 600 }}>
          {pricePerL.toFixed(1)} ₽/л
        </span>
      </div>

      {limit && (
        <div style={{ marginBottom: "0.6rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.4rem", letterSpacing: "0.12em", marginBottom: "1px" }}>ЛИМИТ_СУТОЧНЫЙ</div>
              <span style={{ color: "#6b7280", fontSize: "0.7rem" }}>Суточный лимит</span>
            </div>
            <span style={{ color: remaining > 0 ? "#9ca3af" : "#ef4444", fontSize: "0.7rem", fontFamily: "'JetBrains Mono',monospace" }}>{limit.used}л / {limit.max}л</span>
          </div>
          <div style={{ height: "4px", borderRadius: "2px", background: "#0b0b0f", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, (limit.used / limit.max) * 100)}%`, background: limit.used >= limit.max ? "#ef4444" : "#a855f7", transition: "width 0.5s" }} />
          </div>
        </div>
      )}

      <LiveMarketWidget fuelType={fuelType} lockedPrice={pricePerL} volume={volume} compact />

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
        {VOLUMES.map((v) => (
          <button key={v} disabled={!withinLimit && v > remaining} onClick={() => setVolume(v)} style={{
            flex: 1, padding: "0.35rem",
            border: `1px solid ${volume === v ? "#a855f7" : "#22222f"}`,
            borderRadius: "8px",
            background: volume === v ? "#a855f722" : "#0b0b0f",
            color: volume === v ? "#a855f7" : "#9ca3af",
            fontSize: "0.78rem",
            cursor: (withinLimit || v <= remaining) ? "pointer" : "not-allowed",
            opacity: (!withinLimit && v > remaining) ? 0.4 : 1,
          }}>{v}л</button>
        ))}
      </div>

      {!withinLimit && (
        <p style={{ color: "#eab308", fontSize: "0.72rem", margin: "0 0 0.5rem" }}>
          ⚠️ Превышен суточный лимит отпуска для данного региона.
        </p>
      )}

      <div style={{ background: "linear-gradient(135deg,rgba(34,197,94,0.07),rgba(168,85,247,0.05))", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "10px", padding: "0.45rem 0.65rem", marginBottom: "0.6rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.85rem", flexShrink: 0 }}>🔒</span>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#22c55e", fontSize: "0.44rem", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.15rem" }}>ЦЕНА ЗАМОРОЖЕНА · 90 ДНЕЙ</div>
          <div style={{ color: "#4b5563", fontSize: "0.54rem", lineHeight: 1.45 }}>Оплатите сейчас — заправляйтесь по сегодняшней цене в течение трёх месяцев.</div>
        </div>
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#22c55e", fontSize: "0.55rem", fontWeight: 800 }}>+{(pricePerL * 0.085 * volume).toFixed(0)}₽</div>
          <div style={{ color: "#374151", fontSize: "0.38rem" }}>экономия·3мес</div>
        </div>
      </div>

      <motion.button
        disabled={!withinLimit || !available} onClick={() => { if (!withinLimit || !available) return; onBuy(fuelType, volume, payMethod); }}
        whileTap={(!withinLimit || !available) ? undefined : { scale: 0.97 }}
        animate={(!withinLimit || !available) ? {} : { boxShadow: ["0 0 16px rgba(168,85,247,0.35), 0 4px 16px rgba(219,39,119,0.2)","0 0 28px rgba(168,85,247,0.55), 0 4px 20px rgba(219,39,119,0.35)","0 0 16px rgba(168,85,247,0.35), 0 4px 16px rgba(219,39,119,0.2)"] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: "100%", padding: "0.95rem 1rem",
          background: (!withinLimit || !available) ? "#1a1a2a" : "linear-gradient(135deg,#a855f7,#db2777)",
          color: (!withinLimit || !available) ? "#374151" : "#fff",
          border: (!withinLimit || !available) ? "1px solid #22222f" : "none",
          borderRadius: "14px", fontSize: "0.97rem", fontWeight: 800,
          cursor: (!withinLimit || !available) ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
          letterSpacing: (!withinLimit || !available) ? "0" : "0.02em",
          transition: "background 0.3s",
        }}
      >
        <>{available && withinLimit && <span>⛽</span>}{btnLabel()}</>
      </motion.button>
    </motion.div>
  );
}

// ─── CatalogTab ────────────────────────────────────────────────────────────
interface CatalogTabProps { initialStationId?: number; onCalcOpenChange?: (open: boolean) => void; }

const RECENTLY_VIEWED_KEY = "tma-recently-viewed";
const RECENT_SEARCHES_KEY = "tma-recent-searches";

export function CatalogTab({ initialStationId, onCalcOpenChange }: CatalogTabProps) {
  const { user } = useUserStore();
  const { stations, loading, lastFetched } = useStationStore();
  const { purchases: vaultPurchases } = useVaultStore();
  const { add: toast } = useToast();
  const getPrice = usePriceStore((s) => s.getPrice);

  const { favoriteStations, isStationFavorite, toggleStationFavorite } = useFavoritesStore();
  const [compareStation, setCompareStation] = useState<GasStation | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const [selectedStation, setSelectedStation] = useState<GasStation | null>(null);
  const [limits, setLimits] = useState<LimitsMap | null>(null);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sortMode, setSortMode] = useState<"name" | "availability" | "queue" | "price" | "nearest">("availability");
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [zoneFilter, setZoneFilter] = useState<"critical" | "standard" | "eastern" | null>(null);
  const [availFilter, setAvailFilter] = useState<"green" | "yellow" | "red" | null>(null);
  const [payMethod, setPayMethod] = useState<PayMethod>("stars");
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [refreshing, setRefreshing] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || "[]"); } catch { return []; }
  });
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]"); } catch { return []; }
  });
  const [searchFocused, setSearchFocused] = useState(false);
  const [dealFuel, setDealFuel] = useState<"АИ-92" | "АИ-95" | "ДТ">("АИ-92");
  const [activeNetwork, setActiveNetworkRaw] = useState<string | null>(() => {
    try { return localStorage.getItem("tma-last-network") ?? null; } catch { return null; }
  });
  const setActiveNetwork = (net: string | null) => {
    setActiveNetworkRaw(net);
    try { if (net) localStorage.setItem("tma-last-network", net); } catch {}
  };
  const [nvFuel, setNvFuelRaw] = useState<string>(() => {
    try { return localStorage.getItem("tma-last-nvfuel") ?? "АИ-92"; } catch { return "АИ-92"; }
  });
  const setNvFuel = (f: string) => { setNvFuelRaw(f); try { localStorage.setItem("tma-last-nvfuel", f); } catch {} };
  const [nvVolume, setNvVolumeRaw] = useState<number>(() => {
    try { return Number(localStorage.getItem("tma-last-nvvolume")) || 40; } catch { return 40; }
  });
  const setNvVolume = (v: number) => { setNvVolumeRaw(v); try { localStorage.setItem("tma-last-nvvolume", String(v)); } catch {} };
  const [nvLoading, setNvLoading] = useState(false);
  const [nvSortByPrice, setNvSortByPrice] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const [networkFilter, setNetworkFilter] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialStationId && stations.length > 0 && !selectedStation) {
      const found = stations.find((s) => s.id === initialStationId) ?? null;
      if (found) setSelectedStation(found);
    }
  }, [initialStationId, stations, selectedStation]);

  useEffect(() => {
    if (!user || !selectedStation) return;
    fetchLimits(user.id, selectedStation.zone_type).then(setLimits).catch(() => {});
  }, [user, selectedStation]);

  // Debounce search query by 200ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Reset pagination when search/sort changes
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [debouncedQuery, sortMode, cityFilter, networkFilter, availFilter]);

  // IntersectionObserver auto-load-more
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, MAX_INLINE));
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [selectedStation]);

  // ── Recently viewed helper ────────────────────────────────────────────────
  const addRecentlyViewed = useCallback((id: number) => {
    setRecentlyViewed((prev) => {
      const updated = [id, ...prev.filter((x) => x !== id)].slice(0, 5);
      localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // ── Recent search helper ──────────────────────────────────────────────────
  const addRecentSearch = useCallback((query: string) => {
    const q = query.trim();
    if (!q || q.length < 2) return;
    setRecentSearches((prev) => {
      const updated = [q, ...prev.filter((x) => x !== q)].slice(0, 8);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // ── Pull-to-refresh ───────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    impact("medium");
    useStationStore.setState({ lastFetched: null });
    try { await useStationStore.getState().fetch(); } finally { setRefreshing(false); }
  }, [refreshing]);

  const handleNetworkVoucher = useCallback(async (method: PayMethod) => {
    if (!activeNetwork || !user) return;
    setNvLoading(true);
    try {
      if (method === "stars") {
        const inv = await createNetworkStarsInvoice(user.id, activeNetwork, nvFuel, nvVolume);
        type TgWebApp = { openInvoice?: (url: string, cb: (s: string) => void) => void };
        const tg = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
        if (tg?.openInvoice && inv.invoice_link) {
          tg.openInvoice(inv.invoice_link, (status: string) => {
            if (status === "paid") {
              notify("success");
              toast(`⭐ Сетевой талон ${activeNetwork} на ${inv.stars_amount} Stars оформлен!`, "success");
              setActiveNetwork(null);
            } else if (status === "cancelled") {
              toast("Оплата отменена.", "info");
            } else {
              toast(`Ошибка оплаты: ${status}`, "error");
            }
          });
          return;
        }
        if (inv.invoice_link) { window.open(inv.invoice_link, "_blank"); }
        toast(`⭐ Талон ${activeNetwork}: ${inv.stars_amount} Stars`, "success");
        setActiveNetwork(null);
      } else {
        const inv = await createNetworkCryptoBotInvoice(user.id, activeNetwork, nvFuel, nvVolume);
        if (inv.checkout_url) { window.open(inv.checkout_url, "_blank"); }
        toast(`💎 Крипто-инвойс для ${activeNetwork} открыт`, "success");
        setActiveNetwork(null);
      }
    } catch (e: unknown) {
      notify("error");
      toast(String(e), "error");
    } finally {
      setNvLoading(false);
    }
  }, [activeNetwork, user, nvFuel, nvVolume, toast]);

  // ── Crisis count ──────────────────────────────────────────────────────────
  const crisisCount = useMemo(() => stations.filter((s) => {
    const avg = s.fuel_statuses.length ? s.fuel_statuses.reduce((a, b) => a + b.availability_pct, 0) / s.fuel_statuses.length : 0;
    return avg < 25;
  }).length, [stations]);

  const networkStationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of stations) {
      if (s.network) counts[s.network] = (counts[s.network] ?? 0) + 1;
    }
    return counts;
  }, [stations]);

  const activeVouchersByNetwork = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of vaultPurchases) {
      if (p.status === "active" && p.station_name) {
        const net = p.station_name.replace(/^Любая АЗС сети /, "");
        counts[net] = (counts[net] ?? 0) + 1;
      }
    }
    return counts;
  }, [vaultPurchases]);

  const networkFuelAvailability = useMemo(() => {
    const result: Record<string, Record<string, { available: number; total: number }>> = {};
    for (const s of stations) {
      const net = s.network;
      if (!result[net]) result[net] = {};
      for (const fs of s.fuel_statuses) {
        if (!result[net][fs.fuel_type]) result[net][fs.fuel_type] = { available: 0, total: 0 };
        result[net][fs.fuel_type].total++;
        if (fs.availability_pct > 0) result[net][fs.fuel_type].available++;
      }
    }
    return result;
  }, [stations]);

  const lastPurchasedByNetwork = useMemo(() => {
    const latest: Record<string, string> = {};
    for (const p of vaultPurchases) {
      if (p.station_name) {
        const net = p.station_name.replace(/^Любая АЗС сети /, "");
        if (!latest[net] || p.created_at > latest[net]) {
          latest[net] = p.created_at;
        }
      }
    }
    return latest;
  }, [vaultPurchases]);

  const lastNetworkPurchase = useMemo(() => {
    let best: (typeof vaultPurchases)[0] | null = null;
    for (const p of vaultPurchases) {
      if (p.station_name?.startsWith("Любая АЗС сети ") && p.status === "active") {
        if (!best || p.created_at > best.created_at) best = p;
      }
    }
    return best;
  }, [vaultPurchases]);

  const cheapestNetworkPerFuel = useMemo(() => {
    const result: Record<string, string> = {};
    for (const fuel of ["АИ-92", "АИ-95", "ДТ"]) {
      let best = NETWORK_VOUCHER_NETWORKS[0].name;
      let bestP = NETWORK_PRICES[best]?.[fuel] ?? 999;
      for (const { name } of NETWORK_VOUCHER_NETWORKS) {
        const p = NETWORK_PRICES[name]?.[fuel] ?? 999;
        if (p < bestP) { bestP = p; best = name; }
      }
      result[fuel] = best;
    }
    return result;
  }, []);

  // ── Fuse.js fuzzy search instance ────────────────────────────────────────
  const fuse = useMemo(() => new Fuse(stations, {
    keys: [
      { name: "name",    weight: 0.40 },
      { name: "network", weight: 0.30 },
      { name: "region",  weight: 0.20 },
      { name: "address", weight: 0.10 },
    ],
    threshold: 0.38,
    minMatchCharLength: 2,
    includeScore: true,
  }), [stations]);

  // ── Fuel-alias detection ─────────────────────────────────────────────────
  const matchedFuelType = matchFuelAlias(debouncedQuery);

  const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const sortStations = (arr: GasStation[]) =>
    [...arr].sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name, "ru");
      if (sortMode === "queue") return a.queue_cars - b.queue_cars;
      if (sortMode === "price") {
        const pA = getPrice(a.region, "АИ-92")?.effective ?? 999;
        const pB = getPrice(b.region, "АИ-92")?.effective ?? 999;
        return pA - pB;
      }
      if (sortMode === "nearest" && userCoords) {
        const dA = haversineKm(userCoords.lat, userCoords.lng, a.lat, a.lng);
        const dB = haversineKm(userCoords.lat, userCoords.lng, b.lat, b.lng);
        return dA - dB;
      }
      const avgA = a.fuel_statuses.length ? a.fuel_statuses.reduce((s, f) => s + f.availability_pct, 0) / a.fuel_statuses.length : 0;
      const avgB = b.fuel_statuses.length ? b.fuel_statuses.reduce((s, f) => s + f.availability_pct, 0) / b.fuel_statuses.length : 0;
      return avgB - avgA;
    });

  const filteredStations = useMemo(() => {
    const applyZone = (arr: GasStation[]) => zoneFilter ? arr.filter(s => s.zone_type === zoneFilter) : arr;
    const applyCity = (arr: GasStation[]) => {
      if (!cityFilter) return arr;
      if (cityFilter === "__CRIMEA__") return arr.filter(s => s.zone_type === "critical");
      return arr.filter(s => s.region === cityFilter);
    };
    const applyNetwork = (arr: GasStation[]) =>
      networkFilter ? arr.filter(s => s.network === networkFilter) : arr;
    const applyAvail = (arr: GasStation[]) => {
      if (!availFilter) return arr;
      return arr.filter(s => {
        if (!s.fuel_statuses.length) return availFilter === "red";
        const avg = s.fuel_statuses.reduce((a, f) => a + f.availability_pct, 0) / s.fuel_statuses.length;
        if (availFilter === "green") return avg >= 60;
        if (availFilter === "yellow") return avg >= 25 && avg < 60;
        return avg < 25;
      });
    };
    const apply = (arr: GasStation[]) => applyAvail(applyNetwork(applyCity(applyZone(arr))));
    if (!debouncedQuery) return apply(sortStations(stations));
    if (matchedFuelType) {
      return apply(sortStations(stations.filter(s => s.fuel_statuses.some(f => f.fuel_type === matchedFuelType))));
    }
    if (debouncedQuery.trim().length < 2) {
      const q = debouncedQuery.toLowerCase();
      return apply(sortStations(stations.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.network.toLowerCase().includes(q) ||
        s.region.toLowerCase().includes(q)
      )));
    }
    const results = fuse.search(debouncedQuery);
    return apply(sortStations(results.map(r => r.item)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, debouncedQuery, sortMode, matchedFuelType, fuse, userCoords, zoneFilter, cityFilter, networkFilter, availFilter]);

  const visibleStations = filteredStations.slice(0, Math.min(visibleCount, MAX_INLINE));
  const hasMore = filteredStations.length > visibleCount && visibleCount < MAX_INLINE;
  const hitCap = filteredStations.length > MAX_INLINE && visibleCount >= MAX_INLINE;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleBuy = (fuelType: string, volume: number, method: PayMethod) => {
    if (!user || !selectedStation || purchasing) return;
    const priceData = getPrice(selectedStation.region, fuelType);
    const pricePerL = priceData?.effective ?? FUEL_PRICES[fuelType] ?? 50;
    const totalPrice = pricePerL * volume;
    const starsAmount = Math.ceil(totalPrice / STAR_RUB_RATE);
    impact("medium");
    setPendingConfirm({ fuelType, volume, method, starsAmount, totalPrice });
  };

  const handleConfirmPurchase = async () => {
    if (!pendingConfirm || !user || !selectedStation) return;
    const { fuelType, volume, method } = pendingConfirm;
    impact("heavy");
    setPendingConfirm(null);
    setPurchasing(true);
    try {
      if (method === "stars") {
        const inv = await createStarsInvoice(user.id, fuelType, volume, selectedStation.id);
        type TgWebApp = { openInvoice?: (url: string, cb: (status: string) => void) => void };
        const tg = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
        if (tg?.openInvoice && inv.invoice_link) {
          tg.openInvoice(inv.invoice_link, (status: string) => {
            if (status === "paid") {
              notify("success");
              toast(`⭐ Оплата ${inv.stars_amount} Stars принята! Ваучер отправлен в чат.`, "success");
            } else if (status === "cancelled") {
              notify("error");
              toast("Оплата отменена.", "error");
            } else {
              notify("error");
              toast(`Ошибка оплаты: ${status}`, "error");
            }
          });
        } else if (inv.invoice_link) {
          window.open(inv.invoice_link, "_blank");
          toast(`⭐ Счёт на ${inv.stars_amount} Stars открыт.`, "success");
        } else {
          toast(`⭐ Требуется ${inv.stars_amount} Stars — откройте через Telegram.`, "success");
        }
      } else if (method === "cryptobot") {
        const inv = await createCryptoBotInvoice(user.id, fuelType, volume, selectedStation.id);
        if (inv.checkout_url) {
          window.open(inv.checkout_url, "_blank");
          notify("success");
          toast("💎 Оплата через CryptoBot открыта", "success");
        }
      } else {
        notify("error");
        toast("Выберите способ оплаты: Telegram Stars или Криптовалюта.", "error");
      }
    } catch (e: unknown) {
      notify("error");
      toast(String(e), "error");
    } finally {
      setPurchasing(false);
    }
  };

  // ── Early exit ────────────────────────────────────────────────────────────
  if (!user) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#6b7280" }}>
      Загрузка профиля…
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100%", overflowY: "auto", paddingBottom: "5rem" }}>
      <AnimatePresence>
        {blockReason && <BlockOverlay reason={blockReason} onClose={() => setBlockReason(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {pendingConfirm && (
          <PaymentConfirmModal pending={pendingConfirm} onConfirm={handleConfirmPurchase} onCancel={() => { impact("light"); setPendingConfirm(null); }} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showCalculator && <FuelCalculatorModal onClose={() => { setShowCalculator(false); onCalcOpenChange?.(false); }} />}
      </AnimatePresence>

      {/* ── Crisis alert bar ── */}
      <AnimatePresence>
        {!selectedStation && crisisCount >= 8 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            style={{ padding: "0 12px 14px" }}
          >
            <div style={{
              background: "linear-gradient(135deg,rgba(239,68,68,0.12),rgba(220,38,38,0.08))",
              border: "1px solid rgba(239,68,68,0.35)",
              borderRadius: "12px", padding: "8px 12px",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                style={{ fontSize: "0.9rem" }}
              >🚨</motion.span>
              <div style={{ flex: 1 }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#ef4444", fontSize: "0.6rem", letterSpacing: "0.12em", fontWeight: 700 }}>
                  КРИЗИС · {crisisCount} АЗС
                </span>
                <span style={{ color: "#9ca3af", fontSize: "0.62rem", marginLeft: "6px" }}>с критически низким запасом топлива</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Anti-inflation hero banner ── */}
      {!selectedStation && (
        <div style={{ padding: "0 12px 10px" }}>
          <div style={{
            background: "linear-gradient(135deg,#0d0d20,#130820)",
            border: "1px solid #a855f733",
            borderRadius: "16px",
            padding: "0.85rem 1rem",
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#a855f7,#db2777,transparent)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
              <div style={{ fontSize: "1.6rem", flexShrink: 0, filter: "drop-shadow(0 0 10px #a855f766)" }}>🔒</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a855f7", fontSize: "0.44rem", letterSpacing: "0.15em", marginBottom: "0.2rem" }}>АНТИИНФЛЯЦИОННАЯ ЗАЩИТА</div>
                <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: "0.82rem", lineHeight: 1.2, marginBottom: "0.2rem" }}>
                  Заплати сейчас — цена заморожена на <span style={{ background: "linear-gradient(90deg,#a855f7,#db2777)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>90 дней</span>
                </div>
                <div style={{ color: "#6b7280", fontSize: "0.58rem" }}>Топливо дорожает ~2–4% в месяц. Ваш талон — нет.</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.7rem" }}>
              {[
                { icon: "📈", v: "+2–4%", sub: "рост/мес" },
                { icon: "💰", v: "+8–12%", sub: "за 90 дней" },
                { icon: "🛡️", v: "90 дн.", sub: "гарантия" },
              ].map(({ icon, v, sub }) => (
                <div key={sub} style={{ flex: 1, background: "#0a0a14", borderRadius: "10px", padding: "0.4rem 0.3rem", textAlign: "center", border: "1px solid #1e1e2a" }}>
                  <div style={{ fontSize: "0.7rem" }}>{icon}</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a855f7", fontSize: "0.5rem", fontWeight: 700 }}>{v}</div>
                  <div style={{ color: "#374151", fontSize: "0.38rem" }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── FLAGSHIP: Network Vouchers ── */}
      {!selectedStation && (
        <div style={{ padding: "0 12px 6px" }}>

          {/* Section label row */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.55rem" }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a855f7", fontSize: "0.65rem", letterSpacing: "0.15em", fontWeight: 700 }}>СЕТЕВЫЕ_ТАЛОНЫ</span>
            <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg,#a855f744,transparent)" }} />
            {Object.values(activeVouchersByNetwork).reduce((s, n) => s + n, 0) > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: "0.25rem",
                background: "#22c55e12", border: "1px solid #22c55e44",
                borderRadius: "6px", padding: "0.06rem 0.3rem",
                flexShrink: 0,
              }}>
                <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 5px #22c55e" }} />
                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#22c55e", fontSize: "0.42rem", fontWeight: 700 }}>
                  МОИ: {Object.values(activeVouchersByNetwork).reduce((s, n) => s + n, 0)}
                </span>
              </div>
            )}
            <button
              onClick={() => { impact("light"); setNvSortByPrice(v => !v); }}
              style={{
                background: nvSortByPrice ? "#22c55e14" : "transparent",
                border: `1px solid ${nvSortByPrice ? "#22c55e44" : "#1e1e2a"}`,
                borderRadius: "6px", padding: "0.06rem 0.32rem",
                cursor: "pointer", display: "flex", alignItems: "center", gap: "0.2rem",
                flexShrink: 0, transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: "0.5rem" }}>{nvSortByPrice ? "↑" : "⇅"}</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: nvSortByPrice ? "#22c55e" : "#4b5563", fontSize: "0.42rem", fontWeight: nvSortByPrice ? 700 : 400 }}>
                {nvSortByPrice ? "ЦЕНА" : "СОРТ"}
              </span>
            </button>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#4b5563", fontSize: "0.44rem", flexShrink: 0 }}>НА ВСЕХ АЗС</span>
          </div>

          {/* Quick reorder — last active network voucher */}
          {lastNetworkPurchase && (() => {
            const lNet = lastNetworkPurchase.station_name!.replace(/^Любая АЗС сети /, "");
            const lColor = NETWORK_VOUCHER_NETWORKS.find(n => n.name === lNet)?.color ?? "#a855f7";
            const lFuel = lastNetworkPurchase.fuel_type;
            const lVol = lastNetworkPurchase.volume;
            const lPrice = lastNetworkPurchase.price;
            return (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                style={{
                  background: `linear-gradient(135deg,${lColor}10,${lColor}06)`,
                  border: `1px solid ${lColor}44`,
                  borderRadius: "12px", padding: "0.55rem 0.75rem",
                  marginBottom: "0.6rem",
                  display: "flex", alignItems: "center", gap: "0.6rem",
                  cursor: "pointer",
                }}
                onClick={() => {
                  impact("light");
                  setActiveNetwork(lNet);
                  setNvFuel(lFuel);
                  setNvVolume(lVol);
                }}
              >
                <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: lColor, boxShadow: `0 0 8px ${lColor}`, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", color: lColor, fontSize: "0.52rem", fontWeight: 800, letterSpacing: "0.06em" }}>↩ ПОВТОРИТЬ ЗАКАЗ</div>
                  <div style={{ color: "#6b7280", fontSize: "0.46rem", fontFamily: "'JetBrains Mono',monospace", marginTop: "0.08rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {lNet} · {lFuel} · {lVol}л · {lPrice.toFixed(0)}₽
                  </div>
                </div>
                <div style={{
                  background: `${lColor}1a`, border: `1px solid ${lColor}55`, borderRadius: "7px",
                  padding: "0.22rem 0.5rem", fontFamily: "'JetBrains Mono',monospace",
                  color: lColor, fontSize: "0.44rem", fontWeight: 700, flexShrink: 0,
                }}>ВЫБРАТЬ</div>
              </motion.div>
            );
          })()}

          {/* Best deal chip */}
          {(() => {
            let bestNet = "", bestFuel = "", bestPrice = 999, bestAvail = 0, bestColor = "#a855f7";
            for (const { name, color } of NETWORK_VOUCHER_NETWORKS) {
              for (const fuel of ["АИ-92", "АИ-95", "ДТ"]) {
                const p = NETWORK_PRICES[name]?.[fuel] ?? 999;
                const avail = networkFuelAvailability[name]?.[fuel];
                const score = p - (avail ? (avail.available / Math.max(avail.total, 1)) * 2 : 0);
                if (score < bestPrice || (score === bestPrice && bestAvail < (avail?.available ?? 0))) {
                  bestNet = name; bestFuel = fuel; bestPrice = score; bestColor = color;
                  bestAvail = avail?.available ?? 0;
                }
              }
            }
            if (!bestNet) return null;
            const actualPrice = NETWORK_PRICES[bestNet]?.[bestFuel] ?? 65;
            return (
              <div
                style={{
                  display: "flex", alignItems: "center", gap: "0.45rem",
                  background: `${bestColor}0d`, border: `1px solid ${bestColor}30`,
                  borderRadius: "9px", padding: "0.3rem 0.6rem", marginBottom: "0.45rem",
                  cursor: "pointer",
                }}
                onClick={() => { impact("light"); setActiveNetwork(bestNet); setNvFuel(bestFuel); setNvSortByPrice(false); }}
              >
                <span style={{ fontSize: "0.7rem" }}>🏆</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: bestColor, fontSize: "0.48rem", fontWeight: 800 }}>ЛУЧШАЯ ЦЕНА · </span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#9ca3af", fontSize: "0.46rem" }}>{bestNet} {bestFuel} — {actualPrice.toFixed(1)}₽/л</span>
                </div>
                <div style={{ background: `${bestColor}1a`, border: `1px solid ${bestColor}44`, borderRadius: "5px", padding: "0.04rem 0.2rem", fontFamily: "'JetBrains Mono',monospace", color: bestColor, fontSize: "0.4rem", fontWeight: 700, flexShrink: 0 }}>ВЫБРАТЬ</div>
              </div>
            );
          })()}

          {/* "То за чем вы здесь" hero banner */}
          <motion.div
            animate={{ boxShadow: ["0 0 14px #a855f755", "0 0 32px #db277766", "0 0 14px #a855f755"] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            style={{
              background: "linear-gradient(135deg,#7c3aed,#a855f7,#db2777,#9333ea)",
              borderRadius: "13px", padding: "0.7rem 1rem",
              marginBottom: "0.7rem", textAlign: "center",
              position: "relative", overflow: "hidden",
            }}
          >
            <motion.div
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "linear", repeatDelay: 1.2 }}
              style={{
                position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)",
                width: "60%",
              }}
            />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.85rem", fontWeight: 900, color: "#fff", letterSpacing: "0.06em", textTransform: "uppercase", textShadow: "0 0 24px rgba(255,255,255,0.5)" }}>
                ✦ ТО, ЗА ЧЕМ ВЫ ЗДЕСЬ
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.48rem", color: "rgba(255,255,255,0.55)", letterSpacing: "0.15em", marginTop: "0.2rem" }}>
                ТАЛОН НА ТОПЛИВО · ДЕЙСТВУЕТ НА ВСЕЙ СЕТИ
              </div>
            </div>
          </motion.div>

          {/* Main card */}
          <div style={{
            background: "linear-gradient(160deg,#100b1e,#130d22,#0d0d18)",
            border: "1.5px solid #a855f755",
            borderRadius: "18px", padding: "1.1rem",
            position: "relative", overflow: "hidden",
            boxShadow: "0 0 60px #a855f714, 0 0 24px #db27770a, 0 10px 36px #00000088",
          }}>
            {/* animated top bar */}
            <motion.div
              animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
              style={{
                position: "absolute", top: 0, left: 0, right: 0, height: "2px",
                background: "linear-gradient(90deg,#a855f7,#db2777,#9333ea,#a855f7)",
                backgroundSize: "200% 100%",
              }}
            />
            <div style={{ position: "absolute", top: "-25%", right: "-8%", width: "50%", height: "50%", background: "radial-gradient(circle,#a855f70c,transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: "-15%", left: "3%", width: "38%", height: "38%", background: "radial-gradient(circle,#db27770c,transparent 70%)", pointerEvents: "none" }} />

            {/* Network cards grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.5rem", marginBottom: "0.7rem" }}>
              {(nvSortByPrice
                ? [...NETWORK_VOUCHER_NETWORKS].sort((a, b) => (NETWORK_PRICES[a.name]?.[nvFuel] ?? 999) - (NETWORK_PRICES[b.name]?.[nvFuel] ?? 999))
                : NETWORK_VOUCHER_NETWORKS
              ).map(({ name, color }) => {
                const isActive = activeNetwork === name;
                const price92 = NETWORK_PRICES[name]?.["АИ-92"] ?? 65;
                const stCount = networkStationCounts[name] ?? 0;
                const fuelCount = NETWORK_FUELS[name]?.length ?? 4;
                return (
                  <motion.button
                    key={name}
                    whileTap={{ scale: 0.92 }}
                    animate={isActive
                      ? { boxShadow: [`0 0 18px ${color}55`, `0 0 36px ${color}77`, `0 0 18px ${color}55`] }
                      : { boxShadow: [`0 0 0px ${color}00`, `0 0 10px ${color}25`, `0 0 0px ${color}00`] }
                    }
                    transition={{ duration: isActive ? 1.6 : 3.5, repeat: Infinity, ease: "easeInOut" }}
                    onClick={() => { impact("light"); setActiveNetwork(isActive ? null : name); setNvFuel("АИ-92"); setNvVolume(40); }}
                    style={{
                      padding: "0.85rem 0.25rem 0.72rem",
                      background: isActive ? `linear-gradient(160deg,${color}28,${color}14)` : "rgba(255,255,255,0.04)",
                      border: `1.5px solid ${isActive ? color + "cc" : color + "33"}`,
                      borderRadius: "14px",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: "0.28rem",
                      cursor: "pointer", transition: "background 0.2s, border-color 0.2s",
                      position: "relative", overflow: "hidden",
                    }}
                  >
                    {isActive && (
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg,transparent,${color},transparent)` }} />
                    )}
                    {/* Brand badge top-right */}
                    {NETWORK_BADGES[name] && (
                      <div style={{
                        position: "absolute", top: "5px", right: "5px",
                        background: NETWORK_BADGES[name].bg,
                        borderRadius: "4px", padding: "0.06rem 0.22rem",
                        fontSize: "0.38rem", fontWeight: 700,
                        color: NETWORK_BADGES[name].fg,
                        fontFamily: "'JetBrains Mono',monospace",
                        letterSpacing: "0.04em", lineHeight: 1.4,
                        border: `1px solid ${NETWORK_BADGES[name].fg}33`,
                      }}>{NETWORK_BADGES[name].text}</div>
                    )}
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: color, boxShadow: `0 0 ${isActive ? 16 : 7}px ${color}${isActive ? "" : "88"}`, flexShrink: 0 }} />
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", color: isActive ? color : "#d1d5db", fontSize: "0.64rem", fontWeight: isActive ? 800 : 600, textAlign: "center", lineHeight: 1.2 }}>{name}</span>
                    <span style={{ color: isActive ? color : "#6b7280", fontSize: "0.55rem", fontFamily: "'JetBrains Mono',monospace", fontWeight: isActive ? 700 : 400 }}>{price92.toFixed(1)}₽/л</span>
                    {stCount > 0 && (
                      <span style={{ fontSize: "0.43rem", color: isActive ? color + "bb" : "#374151", fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>
                        {stCount} АЗС · {fuelCount}вида
                      </span>
                    )}
                    {/* Active voucher count */}
                    {(activeVouchersByNetwork[name] ?? 0) > 0 && (
                      <div style={{
                        position: "absolute", top: "5px", left: "5px",
                        background: "#22c55e22", border: "1px solid #22c55e55",
                        borderRadius: "4px", padding: "0.04rem 0.2rem",
                        fontSize: "0.38rem", fontWeight: 800, color: "#22c55e",
                        fontFamily: "'JetBrains Mono',monospace",
                      }}>✓{activeVouchersByNetwork[name]}</div>
                    )}
                    {/* Last purchased timestamp */}
                    {lastPurchasedByNetwork[name] && (
                      <div style={{
                        position: "absolute", bottom: (cheapestNetworkPerFuel["АИ-92"] === name ? "18px" : "4px"), left: "50%", transform: "translateX(-50%)",
                        whiteSpace: "nowrap",
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: "0.34rem", color: "#374151",
                      }}>
                        {new Date(lastPurchasedByNetwork[name]).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}
                      </div>
                    )}
                    {/* Last session badge */}
                    {(() => {
                      try {
                        const last = localStorage.getItem("tma-last-network");
                        if (last === name && activeNetwork !== name) {
                          return (
                            <div style={{
                              position: "absolute", top: "5px", left: "5px",
                              background: `${color}18`, border: `1px solid ${color}44`,
                              borderRadius: "3px", padding: "0.03rem 0.18rem",
                              fontSize: "0.32rem", fontWeight: 700,
                              color, fontFamily: "'JetBrains Mono',monospace",
                              letterSpacing: "0.04em",
                            }}>↩</div>
                          );
                        }
                      } catch {}
                      return null;
                    })()}
                    {/* Best price badge bottom */}
                    {cheapestNetworkPerFuel["АИ-92"] === name && (
                      <div style={{
                        position: "absolute", bottom: "4px", left: "50%", transform: "translateX(-50%)",
                        background: "linear-gradient(90deg,#22c55e22,#22c55e33)",
                        border: "1px solid #22c55e55",
                        borderRadius: "4px", padding: "0.04rem 0.26rem",
                        fontSize: "0.35rem", fontWeight: 800, color: "#22c55e",
                        fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.06em",
                        whiteSpace: "nowrap",
                      }}>↓ ЛУЧШАЯ ЦЕНА</div>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Popular combos quick-pick */}
            <div style={{ marginBottom: "0.65rem" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.4rem", letterSpacing: "0.12em", marginBottom: "0.3rem" }}>ПОПУЛЯРНЫЕ КОМБИНАЦИИ</div>
              <div style={{ display: "flex", gap: "0.35rem", overflowX: "auto", paddingBottom: "2px" }}>
                {POPULAR_COMBOS.map((c) => {
                  const isSelected = activeNetwork === c.network && nvFuel === c.fuelKey && nvVolume === c.volume;
                  const comboPrice = (NETWORK_PRICES[c.network]?.[c.fuelKey] ?? FUEL_PRICES[c.fuelKey] ?? 65) * c.volume;
                  return (
                    <button
                      key={c.badge}
                      onClick={() => { impact("light"); setActiveNetwork(c.network); setNvFuel(c.fuelKey); setNvVolume(c.volume); }}
                      style={{
                        flexShrink: 0, background: isSelected ? `${c.color}22` : "rgba(255,255,255,0.03)",
                        border: `1px solid ${isSelected ? c.color + "88" : "#1f2937"}`,
                        borderRadius: "10px", padding: "0.32rem 0.55rem",
                        cursor: "pointer", display: "flex", flexDirection: "column", gap: "0.12rem", alignItems: "flex-start",
                        transition: "background 0.15s, border-color 0.15s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.28rem" }}>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.44rem", color: isSelected ? c.color : "#9ca3af", fontWeight: 700 }}>{c.badge}</span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.44rem", color: isSelected ? c.color : "#6b7280", fontWeight: 600 }}>{c.network}</span>
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#4b5563", fontSize: "0.4rem" }}>{c.fuelLabel} · {c.volume}л · {comboPrice.toFixed(0)}₽</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stats pills */}
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: activeNetwork ? "0.8rem" : 0 }}>
              {([
                { label: "СЕТЕЙ", value: String(NETWORK_VOUCHER_NETWORKS.length) },
                { label: "АЗС ОХВАЧЕНО", value: String(NETWORK_VOUCHER_NETWORKS.reduce((a, { name }) => a + (networkStationCounts[name] ?? 0), 0)) },
                { label: "БРЕНДОВ ТОПЛИВА", value: "до 7" },
                { label: "СРОК", value: "до мес." },
              ] as { label: string; value: string }[]).map(({ label, value }) => (
                <div key={label} style={{ background: "rgba(168,85,247,0.08)", border: "1px solid #a855f725", borderRadius: "7px", padding: "0.18rem 0.42rem", display: "flex", gap: "0.28rem", alignItems: "baseline" }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a855f7", fontSize: "0.62rem", fontWeight: 800 }}>{value}</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.4rem", letterSpacing: "0.08em" }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Expanded panel */}
            <AnimatePresence>
              {activeNetwork && (() => {
                const netColor = NETWORK_VOUCHER_NETWORKS.find((n) => n.name === activeNetwork)?.color ?? "#a855f7";
                const pricePerL = NETWORK_PRICES[activeNetwork]?.[nvFuel] ?? FUEL_PRICES[nvFuel] ?? 65;
                const totalPrice = pricePerL * nvVolume;
                const fuels = NETWORK_FUELS[activeNetwork] ?? [
                  { key: "АИ-92", label: "АИ-92" }, { key: "АИ-95", label: "АИ-95" },
                  { key: "ДТ", label: "ДТ" }, { key: "Газ", label: "Газ" },
                ];
                return (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22 }}
                    style={{ overflow: "hidden" }}
                  >
                    {/* Network name header */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.65rem", padding: "0.42rem 0.65rem", background: `${netColor}12`, borderRadius: "10px", border: `1px solid ${netColor}33` }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: netColor, boxShadow: `0 0 10px ${netColor}`, flexShrink: 0 }} />
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", color: netColor, fontSize: "0.75rem", fontWeight: 800 }}>{activeNetwork}</span>
                      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        {activeVouchersByNetwork[activeNetwork] > 0 && (
                          <div style={{ background: "#22c55e1a", border: "1px solid #22c55e44", borderRadius: "4px", padding: "0.04rem 0.22rem", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.38rem", color: "#22c55e", fontWeight: 700 }}>
                            ✓{activeVouchersByNetwork[activeNetwork]}
                          </div>
                        )}
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#4b5563", fontSize: "0.46rem" }}>
                          {networkStationCounts[activeNetwork] ?? 0} АЗС · {fuels.length} вида топлива
                        </span>
                      </div>
                    </div>

                    {/* Fuel chips — horizontal scroll */}
                    {(() => {
                      const FUEL_DOTS: Record<string, string> = { "АИ-92": "#22c55e", "АИ-95": "#3b82f6", "АИ-95+": "#a855f7", "ЭКТО Plus": "#6366f1", "АИ-100": "#8b5cf6", "ДТ": "#f59e0b", "ДТ+": "#f97316", "Газ": "#14b8a6", "G-Drive": "#db2777", "Pulsar": "#0ea5e9" };
                      return (
                        <div style={{ overflowX: "auto", marginBottom: "0.6rem", paddingBottom: "3px", scrollbarWidth: "none" }}>
                          <div style={{ display: "flex", gap: "0.32rem", width: "max-content" }}>
                            {fuels.map(({ key: ft, label }) => {
                              const ftPrice = NETWORK_PRICES[activeNetwork]?.[ft] ?? FUEL_PRICES[ft] ?? 65;
                              const isFtActive = nvFuel === ft;
                              const dotColor = FUEL_DOTS[ft] ?? netColor;
                              return (
                                <motion.button key={ft} whileTap={{ scale: 0.93 }} onClick={() => { impact("light"); setNvFuel(ft); }}
                                  style={{
                                    padding: "0.34rem 0.65rem",
                                    background: isFtActive ? `${netColor}28` : "#0b0b10",
                                    border: `1px solid ${isFtActive ? netColor + "cc" : "#1e1e2a"}`,
                                    borderRadius: "9px", whiteSpace: "nowrap",
                                    cursor: "pointer", transition: "all 0.14s",
                                    boxShadow: isFtActive ? `0 0 12px ${netColor}44` : "none",
                                    display: "flex", flexDirection: "column", alignItems: "center", gap: "0.1rem",
                                  }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                                    <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: dotColor, boxShadow: isFtActive ? `0 0 4px ${dotColor}` : "none", flexShrink: 0 }} />
                                    <span style={{ fontFamily: "'JetBrains Mono',monospace", color: isFtActive ? netColor : "#9ca3af", fontSize: "0.62rem", fontWeight: isFtActive ? 800 : 500 }}>{label}</span>
                                  </div>
                                  <span style={{ color: isFtActive ? netColor + "cc" : "#374151", fontSize: "0.5rem" }}>{ftPrice.toFixed(1)}₽/л</span>
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    <LiveMarketWidget fuelType={nvFuel} lockedPrice={pricePerL} volume={nvVolume} />

                    {/* Price comparison bar across all networks for selected fuel */}
                    <div style={{ marginBottom: "0.65rem" }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.4rem", letterSpacing: "0.12em", marginBottom: "0.35rem" }}>СРАВНЕНИЕ ЦЕН · {nvFuel}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.22rem" }}>
                        {NETWORK_VOUCHER_NETWORKS.map(({ name: n, color: c }) => {
                          const p = NETWORK_PRICES[n]?.[nvFuel] ?? FUEL_PRICES[nvFuel] ?? 65;
                          const allPrices = NETWORK_VOUCHER_NETWORKS.map(({ name: nn }) => NETWORK_PRICES[nn]?.[nvFuel] ?? FUEL_PRICES[nvFuel] ?? 65);
                          const minP = Math.min(...allPrices);
                          const maxP = Math.max(...allPrices);
                          const pct = maxP === minP ? 100 : Math.round(((p - minP) / (maxP - minP)) * 100);
                          const barWidth = 20 + (100 - pct) * 0.8;
                          const isCur = n === activeNetwork;
                          const isCheap = p === minP;
                          return (
                            <div key={n} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.46rem", color: isCur ? c : "#4b5563", fontWeight: isCur ? 700 : 400, width: "70px", flexShrink: 0 }}>{n}</span>
                              <div style={{ flex: 1, height: "5px", background: "#0d0d18", borderRadius: "3px", overflow: "hidden" }}>
                                <div style={{ width: `${barWidth}%`, height: "100%", background: isCur ? c : `${c}66`, borderRadius: "3px", transition: "width 0.3s" }} />
                              </div>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", color: isCheap ? "#22c55e" : (isCur ? c : "#4b5563"), fontWeight: isCheap || isCur ? 700 : 400, width: "38px", textAlign: "right", flexShrink: 0 }}>{p.toFixed(1)}₽</span>
                              {isCheap && <span style={{ fontSize: "0.38rem", color: "#22c55e", flexShrink: 0 }}>↓МИН</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Volume selector — large visual buttons */}
                    <div style={{ display: "flex", gap: "0.45rem", marginBottom: "0.65rem" }}>
                      {VOLUMES.map((v) => {
                        const vPrice = pricePerL * v;
                        const isVol = nvVolume === v;
                        return (
                          <motion.button key={v} whileTap={{ scale: 0.93 }} onClick={() => { impact("light"); setNvVolume(v); }}
                            style={{
                              flex: 1, padding: "0.65rem 0.2rem",
                              background: isVol ? `${netColor}1c` : "#0b0b10",
                              border: `1.5px solid ${isVol ? netColor + "aa" : "#1e1e2a"}`,
                              borderRadius: "11px", cursor: "pointer",
                              transition: "all 0.15s", textAlign: "center",
                              boxShadow: isVol ? `0 0 14px ${netColor}33` : "none",
                            }}>
                            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "1.05rem", fontWeight: 900, color: isVol ? netColor : "#6b7280", lineHeight: 1 }}>
                              {v}<span style={{ fontSize: "0.52rem", fontWeight: 600 }}>л</span>
                            </div>
                            <div style={{ fontSize: "0.5rem", color: isVol ? netColor + "bb" : "#374151", marginTop: "0.22rem", fontFamily: "'JetBrains Mono',monospace" }}>{vPrice.toFixed(0)}₽</div>
                            <div style={{ fontSize: "0.4rem", color: isVol ? "#eab308" : "#2a2a36", fontFamily: "'JetBrains Mono',monospace", marginTop: "0.08rem" }}>
                              ≈{Math.ceil((vPrice * 1.03) / STAR_RUB_RATE)}⭐
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* Price summary card */}
                    {(() => {
                      const platformFee = Math.round(totalPrice * 0.03);
                      const grandTotal = totalPrice + platformFee;
                      const starsTotal = Math.ceil(grandTotal / STAR_RUB_RATE);
                      const usdtTotal = (grandTotal / 92).toFixed(2);
                      const netStations = networkStationCounts[activeNetwork] ?? 0;
                      const fuelAvail = networkFuelAvailability[activeNetwork]?.[nvFuel];
                      const availColor = !fuelAvail ? "#6b7280" : fuelAvail.available >= fuelAvail.total * 0.6 ? "#22c55e" : fuelAvail.available >= fuelAvail.total * 0.3 ? "#eab308" : "#ef4444";
                      return (
                        <div style={{
                          background: `linear-gradient(135deg,${netColor}0e,${netColor}06)`,
                          border: `1px solid ${netColor}33`,
                          borderRadius: "13px", padding: "0.75rem 0.9rem",
                          marginBottom: "0.6rem",
                        }}>
                          {/* Header row */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.55rem" }}>
                            <div>
                              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.44rem", letterSpacing: "0.12em", marginBottom: "4px" }}>СЕТЕВОЙ_ТАЛОН · ИТОГО</div>
                              <div style={{ display: "flex", gap: "0.32rem", alignItems: "center" }}>
                                <span style={{ background: `${netColor}22`, border: `1px solid ${netColor}55`, borderRadius: "5px", padding: "0.06rem 0.32rem", color: netColor, fontSize: "0.56rem", fontWeight: 800, fontFamily: "'JetBrains Mono',monospace" }}>{nvFuel}</span>
                                <span style={{ color: "#6b7280", fontSize: "0.56rem" }}>{nvVolume}л</span>
                              </div>
                              {fuelAvail && (
                                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "5px" }}>
                                  <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: availColor, boxShadow: `0 0 5px ${availColor}` }} />
                                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: availColor, fontSize: "0.42rem", fontWeight: 700 }}>
                                    {fuelAvail.available}/{fuelAvail.total} АЗС в наличии
                                  </span>
                                </div>
                              )}
                              {!fuelAvail && netStations > 0 && (
                                <div style={{ marginTop: "4px", color: "#374151", fontSize: "0.42rem", fontFamily: "'JetBrains Mono',monospace" }}>
                                  ⛽ {netStations} АЗС в сети
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0, paddingLeft: "0.5rem" }}>
                              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: netColor, fontSize: "1.4rem", fontWeight: 900, lineHeight: 1, textShadow: `0 0 22px ${netColor}66` }}>
                                {grandTotal.toFixed(0)}₽
                              </div>
                              <div style={{ color: "#374151", fontSize: "0.44rem", marginTop: "2px", fontFamily: "'JetBrains Mono',monospace" }}>≈{starsTotal}⭐ · {usdtTotal}$</div>
                            </div>
                          </div>
                          {/* Breakdown rows */}
                          {(() => {
                            const marketPricePerL = FUEL_PRICES[nvFuel] ?? 65;
                            const marketTotal = marketPricePerL * nvVolume;
                            const savings = Math.round(marketTotal - grandTotal);
                            return (
                              <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", borderTop: `1px solid ${netColor}18`, paddingTop: "0.4rem" }}>
                                {[
                                  { label: "Топливо", value: `${nvVolume}л × ${pricePerL.toFixed(1)}₽`, amount: `${totalPrice.toFixed(0)}₽`, dim: false },
                                  { label: "Сервис (3%)", value: "", amount: `+${platformFee}₽`, dim: true },
                                ].map(({ label, value, amount, dim }) => (
                                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                                      <span style={{ fontFamily: "'JetBrains Mono',monospace", color: dim ? "#374151" : "#6b7280", fontSize: "0.46rem" }}>{label}</span>
                                      {value && <span style={{ color: "#2a2a36", fontSize: "0.4rem", fontFamily: "'JetBrains Mono',monospace" }}>{value}</span>}
                                    </div>
                                    <span style={{ fontFamily: "'JetBrains Mono',monospace", color: dim ? "#374151" : "#6b7280", fontSize: "0.5rem", fontWeight: dim ? 400 : 600 }}>{amount}</span>
                                  </div>
                                ))}
                                {savings > 0 && (
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.18rem", borderTop: `1px solid ${netColor}12` }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                      <span style={{ fontSize: "0.5rem" }}>💚</span>
                                      <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#22c55e", fontSize: "0.44rem", fontWeight: 700 }}>Экономия vs рынок сейчас</span>
                                    </div>
                                    <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#22c55e", fontSize: "0.5rem", fontWeight: 800 }}>−{savings}₽</span>
                                  </div>
                                )}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.18rem", borderTop: `1px solid ${netColor}12` }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                    <span style={{ fontSize: "0.5rem" }}>🔒</span>
                                    <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a855f7", fontSize: "0.44rem", fontWeight: 700 }}>Заморожено на 90 дней</span>
                                  </div>
                                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a855f7", fontSize: "0.5rem", fontWeight: 800 }}>+{Math.round(grandTotal * 0.085)}₽ экон.</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}

                    {/* Payment buttons */}
                    {(() => {
                      const platformFee = Math.round(totalPrice * 0.03);
                      const grandTotal = totalPrice + platformFee;
                      const starsTotal = Math.ceil(grandTotal / STAR_RUB_RATE);
                      const usdtTotal = (grandTotal / 92).toFixed(2);
                      return (
                        <div style={{ display: "flex", gap: "0.45rem" }}>
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            animate={!nvLoading ? { boxShadow: [`0 0 18px ${netColor}28`, `0 0 32px ${netColor}50`, `0 0 18px ${netColor}28`] } : {}}
                            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                            onClick={() => handleNetworkVoucher("stars")} disabled={nvLoading}
                            style={{ flex: 1, padding: "0.65rem 0.5rem", background: `linear-gradient(135deg,${netColor}30,${netColor}18)`, border: `1.5px solid ${netColor}66`, borderRadius: "12px", color: netColor, fontSize: "0.65rem", fontWeight: 800, cursor: nvLoading ? "wait" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.1rem", transition: "all 0.2s", opacity: nvLoading ? 0.6 : 1 }}>
                            {nvLoading ? "…" : (
                              <>
                                <span>⭐ Telegram Stars</span>
                                <span style={{ fontSize: "0.55rem", fontWeight: 900, opacity: 0.9 }}>{starsTotal} Stars</span>
                              </>
                            )}
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            animate={!nvLoading ? { boxShadow: ["0 0 18px #22c55e28", "0 0 32px #22c55e50", "0 0 18px #22c55e28"] } : {}}
                            transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
                            onClick={() => handleNetworkVoucher("cryptobot")} disabled={nvLoading}
                            style={{ flex: 1, padding: "0.65rem 0.5rem", background: "linear-gradient(135deg,#22c55e1e,#16a34a12)", border: "1.5px solid #22c55e55", borderRadius: "12px", color: "#22c55e", fontSize: "0.65rem", fontWeight: 800, cursor: nvLoading ? "wait" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.1rem", transition: "all 0.2s", opacity: nvLoading ? 0.6 : 1 }}>
                            {nvLoading ? "…" : (
                              <>
                                <span>💎 CryptoBot</span>
                                <span style={{ fontSize: "0.55rem", fontWeight: 900, opacity: 0.9 }}>{usdtTotal} USDT</span>
                              </>
                            )}
                          </motion.button>
                        </div>
                      );
                    })()}
                  </motion.div>
                );
              })()}
            </AnimatePresence>
          </div>

          {/* ── Как это работает ── */}
          <div style={{ marginTop: "0.55rem" }}>
            <button
              onClick={() => { impact("light"); setShowHowItWorks((v) => !v); }}
              style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.3rem 0.2rem" }}
            >
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#4b5563", fontSize: "0.5rem", letterSpacing: "0.1em" }}>КАК ЭТО РАБОТАЕТ?</span>
              <motion.span
                animate={{ rotate: showHowItWorks ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ color: "#4b5563", fontSize: "0.6rem", display: "inline-block" }}
              >▾</motion.span>
            </button>
            <AnimatePresence>
              {showHowItWorks && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ background: "rgba(168,85,247,0.05)", border: "1px solid #a855f720", borderRadius: "12px", padding: "0.75rem", marginTop: "0.3rem", display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                    {[
                      { icon: "1", title: "Выбери сеть", desc: "Нажми на карточку нужной сети — Лукойл, Роснефть, Газпромнефть, Башнефть, Татнефть или ННК." },
                      { icon: "2", title: "Выбери топливо и объём", desc: "Укажи тип топлива (в т.ч. фирменные бренды — ЭКТО, Pulsar, G-Drive и др.) и нужный объём: 20, 40 или 60 литров." },
                      { icon: "3", title: "Оплати Stars или Crypto", desc: "Оплата через Telegram Stars или CryptoBot. Талон сразу появляется в Сейфе с QR-кодом." },
                      { icon: "4", title: "Заправляйся на любой АЗС сети", desc: "QR-код действует на любой заправке выбранной сети по всему региону. Точный срок действия указан на талоне." },
                    ].map(({ icon, title, desc }) => (
                      <div key={icon} style={{ display: "flex", gap: "0.55rem", alignItems: "flex-start" }}>
                        <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "linear-gradient(135deg,#a855f7,#db2777)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.48rem", fontWeight: 900, color: "#fff" }}>{icon}</span>
                        </div>
                        <div>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#e2e8f0", fontSize: "0.58rem", fontWeight: 700, marginBottom: "2px" }}>{title}</div>
                          <div style={{ color: "#6b7280", fontSize: "0.54rem", lineHeight: 1.45 }}>{desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      )}

      {/* ── Search bar ── */}
      <div style={{ padding: "0.5rem 1rem 0.35rem", position: "relative", zIndex: 20 }}>
        <div style={{ position: "absolute", left: "1.7rem", top: "1.3rem", color: "#4b5563", fontSize: "0.8rem", pointerEvents: "none", zIndex: 1 }}>🔍</div>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setTimeout(() => setSearchFocused(false), 160)}
          onKeyDown={(e) => { if (e.key === "Enter" && searchQuery.trim().length >= 2) addRecentSearch(searchQuery); }}
          placeholder="Поиск: сеть, регион, 95, дт, дизель…"
          style={{
            width: "100%", boxSizing: "border-box",
            background: "linear-gradient(135deg,#0d0d18,#14141c)",
            border: `1px solid ${searchQuery || searchFocused ? "#a855f744" : "#1e1e2a"}`,
            borderRadius: "12px", color: "#e2e8f0",
            padding: "0.62rem 0.75rem 0.62rem 2.2rem", fontSize: "0.82rem",
            outline: "none", transition: "border-color 0.2s",
          }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} style={{ position: "absolute", right: "1.7rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontSize: "0.8rem", padding: "0 0.2rem" }}>✕</button>
        )}
        <AnimatePresence>
          {searchFocused && !searchQuery && recentSearches.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              style={{
                position: "absolute", top: "calc(100% - 2px)", left: 0, right: 0,
                background: "rgba(8,7,16,0.97)", backdropFilter: "blur(20px)",
                border: "1px solid #a855f733", borderRadius: "0 0 14px 14px",
                padding: "0.5rem 0.5rem 0.55rem",
                boxShadow: "0 12px 32px #00000099",
                zIndex: 50,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem", padding: "0 0.2rem" }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.48rem", letterSpacing: "0.12em" }}>НЕДАВНИЕ_ЗАПРОСЫ</span>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setRecentSearches([]); localStorage.removeItem(RECENT_SEARCHES_KEY); impact("light"); }}
                  style={{ background: "none", border: "none", color: "#374151", fontSize: "0.65rem", cursor: "pointer", padding: "0 0.2rem", lineHeight: 1 }}
                >✕</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                {recentSearches.map((q) => (
                  <button
                    key={q}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setSearchQuery(q); addRecentSearch(q); impact("light"); }}
                    style={{
                      background: "rgba(168,85,247,0.07)", border: "1px solid #a855f722",
                      borderRadius: "8px", color: "#9ca3af", fontSize: "0.65rem",
                      padding: "0.22rem 0.6rem", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "0.28rem",
                      transition: "background 0.15s",
                    }}
                  >
                    <span style={{ color: "#4b5563", fontSize: "0.58rem" }}>🕐</span>
                    {q}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Skeleton loading ── */}
      {loading && stations.length === 0 && (
        <div style={{ padding: "0 1rem" }}>
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.12 }}
              style={{ background: "linear-gradient(160deg,#0d0d18,#14141c)", border: "1px solid #1a1a24", borderRadius: "14px", padding: "0.65rem 0.8rem", marginBottom: "0.35rem", height: "62px" }}
            />
          ))}
        </div>
      )}

      {/* ── Fuel-type hint pill ── */}
      <AnimatePresence>
        {matchedFuelType && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            style={{ padding: "0 1rem 0.4rem" }}
          >
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "0.4rem",
              background: "rgba(168,85,247,0.1)", border: "1px solid #a855f740",
              borderRadius: "8px", padding: "0.25rem 0.65rem",
              fontFamily: "'JetBrains Mono',monospace", fontSize: "0.62rem", color: "#a855f7",
            }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#a855f7", boxShadow: "0 0 6px #a855f7" }} />
              Фильтр по топливу: <strong>{matchedFuelType}</strong> · {filteredStations.length} АЗС
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Zone filter chips ── */}
      {!selectedStation && (
        <div style={{ padding: "0 1rem 0.4rem", display: "flex", gap: "0.3rem", alignItems: "center" }}>
          <span style={{ color: "#374151", fontSize: "0.58rem", flexShrink: 0 }}>Зона:</span>
          {([
            { key: null,         label: "Все",       color: "#6b7280", bg: "none",                    border: "#22222f" },
            { key: "critical",   label: "🔴 Крит.",  color: "#ef4444", bg: "rgba(239,68,68,0.1)",    border: "#ef444430" },
            { key: "standard",   label: "🟣 Станд.", color: "#a855f7", bg: "rgba(168,85,247,0.1)",   border: "#a855f730" },
            { key: "eastern",    label: "🟡 Восток", color: "#f59e0b", bg: "rgba(245,158,11,0.1)",   border: "#f59e0b30" },
          ] as const).map(({ key, label, color, bg, border }) => {
            const isActive = zoneFilter === key;
            return (
              <button key={String(key)} onClick={() => { impact("light"); setZoneFilter(key); }}
                style={{
                  flexShrink: 0, padding: "0.18rem 0.5rem",
                  background: isActive ? bg : "none",
                  border: `1px solid ${isActive ? border : "#1a1a24"}`,
                  borderRadius: "6px", color: isActive ? color : "#374151",
                  fontSize: "0.6rem", cursor: "pointer", fontWeight: isActive ? 700 : 400,
                }}
              >{label}</button>
            );
          })}
          {zoneFilter && (
            <span style={{ marginLeft: "auto", color: "#374151", fontSize: "0.57rem", flexShrink: 0 }}>
              {filteredStations.length} АЗС
            </span>
          )}
        </div>
      )}

      {/* ── Availability status filter chips ── */}
      {!selectedStation && (
        <div style={{ padding: "0 1rem 0.4rem", display: "flex", gap: "0.3rem", alignItems: "center" }}>
          <span style={{ color: "#374151", fontSize: "0.58rem", flexShrink: 0 }}>Статус:</span>
          {([
            { key: null,     label: "Все",      color: "#6b7280", dot: "#6b7280" },
            { key: "green",  label: "🟢 Норма", color: "#22c55e", dot: "#22c55e" },
            { key: "yellow", label: "🟡 Мало",  color: "#eab308", dot: "#eab308" },
            { key: "red",    label: "🔴 Нет",   color: "#ef4444", dot: "#ef4444" },
          ] as const).map(({ key, label, color }) => {
            const isActive = availFilter === key;
            return (
              <button key={String(key)} onClick={() => { impact("light"); setAvailFilter(key); }}
                style={{
                  flexShrink: 0, padding: "0.18rem 0.5rem",
                  background: isActive ? `${color}18` : "none",
                  border: `1px solid ${isActive ? color : "#1a1a24"}`,
                  borderRadius: "6px", color: isActive ? color : "#374151",
                  fontSize: "0.6rem", cursor: "pointer", fontWeight: isActive ? 700 : 400,
                  transition: "all 0.15s",
                }}
              >{label}</button>
            );
          })}
          {availFilter && (
            <span style={{ marginLeft: "auto", color: "#374151", fontSize: "0.57rem", flexShrink: 0 }}>
              {filteredStations.length} АЗС
            </span>
          )}
        </div>
      )}

      {/* ── City quick filter chips ── */}
      {!selectedStation && (() => {
          const mskCount = stations.filter(s => s.region === "г. Москва и Новая Москва").length;
          const crimeaCount = stations.filter(s => s.zone_type === "critical").length;
          const spbCount = stations.filter(s => s.region === "г. Санкт-Петербург").length;
          const tatCount = stations.filter(s => s.region === "Республика Татарстан").length;
          const chips = [
            { key: null,                          label: "🌐 Все",       count: stations.length, color: "#6b7280", bg: "none",                    border: "#22222f" },
            { key: "г. Москва и Новая Москва",    label: "🏙 Москва",    count: mskCount,        color: "#3b82f6", bg: "rgba(59,130,246,0.1)",   border: "#3b82f630" },
            { key: "__CRIMEA__",                  label: "🌊 Крым",      count: crimeaCount,     color: "#a855f7", bg: "rgba(168,85,247,0.1)",   border: "#a855f730" },
            { key: "г. Санкт-Петербург",          label: "⚓ Питер",     count: spbCount,        color: "#06b6d4", bg: "rgba(6,182,212,0.1)",   border: "#06b6d430" },
            { key: "Республика Татарстан",        label: "🟢 Татарстан", count: tatCount,        color: "#22c55e", bg: "rgba(34,197,94,0.1)",   border: "#22c55e30" },
          ] as { key: string | null; label: string; count: number; color: string; bg: string; border: string }[];
          return (
            <div style={{ padding: "0 1rem 0.4rem", display: "flex", gap: "0.3rem", alignItems: "center", overflowX: "auto" }}>
              <span style={{ color: "#374151", fontSize: "0.58rem", flexShrink: 0 }}>Город:</span>
              {chips.map(({ key, label, count, color, bg, border }) => {
                const isActive = cityFilter === key;
                return (
                  <button key={String(key)} onClick={() => { impact("light"); setCityFilter(key); }}
                    style={{
                      flexShrink: 0, padding: "0.18rem 0.5rem",
                      background: isActive ? bg : "none",
                      border: `1px solid ${isActive ? border : "#1a1a24"}`,
                      borderRadius: "6px", color: isActive ? color : "#374151",
                      fontSize: "0.6rem", cursor: "pointer", fontWeight: isActive ? 700 : 400,
                      whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "0.25rem",
                    }}
                  >
                    {label}
                    {count > 0 && key !== null && (
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", opacity: 0.7 }}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })()}

      {/* ── Network summary bar ── */}
      {!selectedStation && !debouncedQuery && stations.length > 0 && (() => {
        const nets: Record<string, { cnt: number; sum: number }> = {};
        stations.forEach(s => {
          const n = s.network || "Другие";
          const avg = s.fuel_statuses.length ? s.fuel_statuses.reduce((a, b) => a + b.availability_pct, 0) / s.fuel_statuses.length : 0;
          if (!nets[n]) nets[n] = { cnt: 0, sum: 0 };
          nets[n].cnt++;
          nets[n].sum += avg;
        });
        const top = Object.entries(nets).sort((a, b) => b[1].cnt - a[1].cnt).slice(0, 5);
        const green = stations.filter(s => (s.fuel_statuses.reduce((a, b) => a + b.availability_pct, 0) / Math.max(s.fuel_statuses.length, 1)) >= 60).length;
        return (
          <div style={{ padding: "0 1rem 0.5rem", display: "flex", gap: "0.3rem", alignItems: "center", overflowX: "auto" }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: networkFilter ? "#a855f7" : "#22222f", fontSize: "0.55rem", flexShrink: 0 }}>СЕТИ:</span>
            {top.map(([net, { cnt, sum }]) => {
              const avgAvail = Math.round(sum / cnt);
              const dotColor = avgAvail >= 60 ? "#22c55e" : avgAvail >= 25 ? "#eab308" : "#ef4444";
              const isActive = networkFilter === net;
              return (
                <button key={net} onClick={() => { impact("light"); setNetworkFilter(isActive ? null : net); }}
                  style={{
                    flexShrink: 0, padding: "2px 8px",
                    background: isActive ? `${dotColor}18` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isActive ? dotColor : "#1a1a24"}`,
                    borderRadius: "6px", color: isActive ? dotColor : "#4b5563",
                    fontSize: "0.58rem", cursor: "pointer", fontWeight: isActive ? 700 : 400,
                    fontFamily: "'JetBrains Mono',monospace",
                    display: "flex", alignItems: "center", gap: "4px",
                    transition: "all 0.18s",
                  }}
                >
                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                  {net} <span style={{ color: isActive ? dotColor : "#374151", opacity: 0.8 }}>{cnt}</span>
                </button>
              );
            })}
            {networkFilter && (
              <button onClick={() => { impact("light"); setNetworkFilter(null); }} style={{ flexShrink: 0, background: "rgba(239,68,68,0.08)", border: "1px solid #ef444430", borderRadius: "6px", color: "#ef4444", fontSize: "0.6rem", padding: "2px 6px", cursor: "pointer" }}>✕</button>
            )}
            <div style={{ marginLeft: "auto", flexShrink: 0, display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 4px #22c55e" }} />
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#22c55e", fontSize: "0.58rem", fontWeight: 700 }}>{green}</span>
            </div>
          </div>
        );
      })()}

      {/* ── Crisis heat bar ── */}
      {!selectedStation && stations.length > 0 && (() => {
        const crisisCount = stations.filter(s => (s.fuel_statuses.reduce((a, b) => a + b.availability_pct, 0) / Math.max(s.fuel_statuses.length, 1)) < 25).length;
        const lowCount    = stations.filter(s => { const a = s.fuel_statuses.reduce((acc, b) => acc + b.availability_pct, 0) / Math.max(s.fuel_statuses.length, 1); return a >= 25 && a < 60; }).length;
        const goodCount   = stations.length - crisisCount - lowCount;
        const crisisP = (crisisCount / stations.length) * 100;
        const lowP    = (lowCount    / stations.length) * 100;
        const goodP   = (goodCount   / stations.length) * 100;
        const heatLevel = crisisP >= 30 ? "КРИТИЧНО" : crisisP >= 15 ? "НАПРЯЖЁННО" : "НОРМА";
        const heatColor = crisisP >= 30 ? "#ef4444" : crisisP >= 15 ? "#eab308" : "#22c55e";
        return (
          <div style={{ padding: "0 1rem 0.4rem" }}>
            <div style={{ background: "#0b0b10", border: "1px solid #1a1a24", borderRadius: "9px", padding: "0.4rem 0.6rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: heatColor, boxShadow: `0 0 5px ${heatColor}` }} />
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: heatColor, fontSize: "0.52rem", fontWeight: 700, letterSpacing: "0.06em" }}>{heatLevel}</span>
                </div>
                <div style={{ display: "flex", gap: "0.55rem" }}>
                  <span style={{ color: "#22c55e88", fontSize: "0.52rem" }}>🟢 {goodCount}</span>
                  <span style={{ color: "#eab30888", fontSize: "0.52rem" }}>🟡 {lowCount}</span>
                  <span style={{ color: "#ef444488", fontSize: "0.52rem" }}>🔴 {crisisCount}</span>
                </div>
              </div>
              <div style={{ height: "4px", borderRadius: "2px", overflow: "hidden", background: "#050507", display: "flex", gap: "1px" }}>
                {goodP   > 0 && <div style={{ width: `${goodP}%`,   background: "#22c55e", transition: "width 0.8s" }} />}
                {lowP    > 0 && <div style={{ width: `${lowP}%`,    background: "#eab308", transition: "width 0.8s" }} />}
                {crisisP > 0 && <div style={{ width: `${crisisP}%`, background: "#ef4444", transition: "width 0.8s", animation: crisisP >= 30 ? "tmaPulse 2s infinite" : "none" }} />}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Active filters clear-all bar ── */}
      {!selectedStation && (cityFilter || networkFilter || zoneFilter || availFilter) && (
        <div style={{ padding: "0 1rem 0.4rem", display: "flex", gap: "0.3rem", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a855f7", fontSize: "0.52rem", letterSpacing: "0.06em" }}>ФИЛЬТРЫ:</span>
          {cityFilter && (
            <span style={{
              background: "rgba(59,130,246,0.12)", border: "1px solid #3b82f630",
              borderRadius: "6px", padding: "1px 7px",
              color: "#3b82f6", fontSize: "0.58rem",
              display: "flex", alignItems: "center", gap: "4px",
            }}>
              🏙 {cityFilter === "__CRIMEA__" ? "Крым" : cityFilter.split(" ").slice(-1)[0]}
              <button onClick={() => { impact("light"); setCityFilter(null); }} style={{ background: "none", border: "none", color: "#3b82f6", cursor: "pointer", fontSize: "0.6rem", padding: "0", lineHeight: 1 }}>✕</button>
            </span>
          )}
          {networkFilter && (
            <span style={{
              background: "rgba(168,85,247,0.12)", border: "1px solid #a855f730",
              borderRadius: "6px", padding: "1px 7px",
              color: "#a855f7", fontSize: "0.58rem",
              display: "flex", alignItems: "center", gap: "4px",
            }}>
              🏭 {networkFilter}
              <button onClick={() => { impact("light"); setNetworkFilter(null); }} style={{ background: "none", border: "none", color: "#a855f7", cursor: "pointer", fontSize: "0.6rem", padding: "0", lineHeight: 1 }}>✕</button>
            </span>
          )}
          {zoneFilter && (
            <span style={{
              background: "rgba(245,158,11,0.12)", border: "1px solid #f59e0b30",
              borderRadius: "6px", padding: "1px 7px",
              color: "#f59e0b", fontSize: "0.58rem",
              display: "flex", alignItems: "center", gap: "4px",
            }}>
              🗺 {zoneFilter}
              <button onClick={() => { impact("light"); setZoneFilter(null); }} style={{ background: "none", border: "none", color: "#f59e0b", cursor: "pointer", fontSize: "0.6rem", padding: "0", lineHeight: 1 }}>✕</button>
            </span>
          )}
          {availFilter && (
            <span style={{
              background: availFilter === "green" ? "rgba(34,197,94,0.12)" : availFilter === "yellow" ? "rgba(234,179,8,0.12)" : "rgba(239,68,68,0.12)",
              border: `1px solid ${availFilter === "green" ? "#22c55e30" : availFilter === "yellow" ? "#eab30830" : "#ef444430"}`,
              borderRadius: "6px", padding: "1px 7px",
              color: availFilter === "green" ? "#22c55e" : availFilter === "yellow" ? "#eab308" : "#ef4444",
              fontSize: "0.58rem",
              display: "flex", alignItems: "center", gap: "4px",
            }}>
              {availFilter === "green" ? "🟢 Норма" : availFilter === "yellow" ? "🟡 Мало" : "🔴 Нет"}
              <button onClick={() => { impact("light"); setAvailFilter(null); }} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "0.6rem", padding: "0", lineHeight: 1 }}>✕</button>
            </span>
          )}
          <button
            onClick={() => { impact("medium"); setCityFilter(null); setNetworkFilter(null); setZoneFilter(null); setAvailFilter(null); }}
            style={{ marginLeft: "auto", background: "rgba(239,68,68,0.1)", border: "1px solid #ef444430", borderRadius: "6px", color: "#ef4444", fontSize: "0.58rem", padding: "1px 8px", cursor: "pointer", flexShrink: 0 }}
          >✕ Сбросить всё</button>
        </div>
      )}

      {/* ── Quick fuel-type chips ── */}
      {!selectedStation && !matchedFuelType && (
        <div style={{ padding: "0 1rem 0.5rem", display: "flex", gap: "0.35rem", overflowX: "auto", paddingBottom: "0.5rem" }}>
          {([
            { ft: "АИ-92",  icon: "⛽", color: "#22c55e", q: "92" },
            { ft: "АИ-95",  icon: "⛽", color: "#3b82f6", q: "95" },
            { ft: "АИ-95+", icon: "✨", color: "#a855f7", q: "95+" },
            { ft: "АИ-100", icon: "🏎", color: "#f59e0b", q: "100" },
            { ft: "ДТ",     icon: "🚛", color: "#f97316", q: "дт" },
            { ft: "ДТ+",    icon: "🚛", color: "#d97706", q: "дт+" },
            { ft: "Газ",    icon: "💧", color: "#14b8a6", q: "газ" },
          ] as const).map(({ ft, icon, color, q }) => (
            <button
              key={ft}
              onClick={() => { impact("light"); setSearchQuery(q); }}
              style={{
                flexShrink: 0,
                padding: "0.25rem 0.65rem",
                background: `${color}10`,
                border: `1px solid ${color}35`,
                borderRadius: "8px",
                color: color,
                fontSize: "0.65rem",
                cursor: "pointer",
                fontFamily: "'JetBrains Mono',monospace",
                fontWeight: 600,
                display: "flex", alignItems: "center", gap: "0.28rem",
                boxShadow: `0 0 8px ${color}12`,
                transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.background = `${color}22`;
                el.style.borderColor = `${color}66`;
                el.style.boxShadow = `0 0 12px ${color}28`;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.background = `${color}10`;
                el.style.borderColor = `${color}35`;
                el.style.boxShadow = `0 0 8px ${color}12`;
              }}
            >
              <span style={{ fontSize: "0.68rem" }}>{icon}</span>
              {ft}
            </button>
          ))}
        </div>
      )}

      {/* ── Best deals widget ── top-3 cheapest+available stations */}
      {!selectedStation && !searchQuery && stations.length > 0 && (() => {
        const DEAL_FUELS = ["АИ-92", "АИ-95", "ДТ"] as const;
        type DealFuel = typeof DEAL_FUELS[number];
        const DEAL_COLORS: Record<DealFuel, string> = { "АИ-92": "#a855f7", "АИ-95": "#db2777", "ДТ": "#f59e0b" };
        const deals = stations
          .filter((s) => s.fuel_statuses.some((f) => f.fuel_type === dealFuel && f.availability_pct > 0))
          .map((s) => {
            const p = getPrice(s.region, dealFuel);
            const networkP = NETWORK_PRICES[s.network]?.[dealFuel];
            const price = networkP ?? p?.effective ?? FUEL_PRICES[dealFuel] ?? 70;
            const avail = s.fuel_statuses.find((f) => f.fuel_type === dealFuel)?.availability_pct ?? 0;
            return { s, price, avail };
          })
          .sort((a, b) => a.price - b.price || b.avail - a.avail)
          .filter((item, idx, arr) => {
            const key = item.s.network?.trim() || item.s.name;
            return arr.findIndex((x) => (x.s.network?.trim() || x.s.name) === key) === idx;
          })
          .slice(0, 3);
        if (!deals.length) return null;
        const color = DEAL_COLORS[dealFuel];
        return (
          <div style={{ padding: "0 1rem 0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.4rem" }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.42rem", letterSpacing: "0.14em" }}>ЛУЧШИЕ_ПРЕДЛОЖЕНИЯ · СЕЙЧАС</span>
              <div style={{ flex: 1, height: "1px", background: `linear-gradient(90deg,${color}33,transparent)` }} />
            </div>
            <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.55rem" }}>
              {DEAL_FUELS.map((f) => (
                <button key={f} onClick={() => setDealFuel(f)} style={{ padding: "0.15rem 0.45rem", background: dealFuel === f ? `${DEAL_COLORS[f]}20` : "#0b0b10", border: `1px solid ${dealFuel === f ? DEAL_COLORS[f] : "#1e1e2a"}`, borderRadius: "6px", color: dealFuel === f ? DEAL_COLORS[f] : "#374151", fontSize: "0.62rem", fontWeight: dealFuel === f ? 700 : 400, cursor: "pointer" }}>{f}</button>
              ))}
            </div>
            {deals.length >= 3 ? (() => {
              const avgPrice = deals.reduce((s, d) => s + d.price, 0) / deals.length;
              const podiumOrder = [deals[1], deals[0], deals[2]];
              const podiumRanks = [2, 1, 3];
              const rankColors = ["#94a3b8", "#f59e0b", "#cd7f32"];
              const rankMedals = ["", "🥇", "🥈", "🥉"];
              const rankBg = [
                "linear-gradient(160deg,#0c0d14,#10101e)",
                "linear-gradient(160deg,#120f04,#0e0b10)",
                "linear-gradient(160deg,#0c0d14,#100e0c)",
              ];
              return (
                <div style={{ display: "flex", gap: "0.4rem", alignItems: "flex-end" }}>
                  {podiumOrder.map(({ s, price, avail }, colIdx) => {
                    const rank = podiumRanks[colIdx];
                    const rc = rankColors[colIdx];
                    const isFirst = rank === 1;
                    const savings = Math.max(0, avgPrice - price);
                    const availColor = avail >= 60 ? "#22c55e" : avail >= 25 ? "#eab308" : "#ef4444";
                    return (
                      <motion.div
                        key={s.id}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => { setSelectedStation(s); impact("light"); }}
                        style={{
                          flex: 1, background: rankBg[colIdx],
                          border: `1.5px solid ${rc}${isFirst ? "66" : "33"}`,
                          borderRadius: isFirst ? "14px" : "12px",
                          padding: isFirst ? "0.7rem 0.4rem 0.55rem" : "0.5rem 0.35rem 0.45rem",
                          cursor: "pointer", position: "relative", overflow: "hidden",
                          boxShadow: isFirst ? `0 0 22px ${rc}22, 0 4px 16px #00000066` : "none",
                          textAlign: "center",
                          marginBottom: isFirst ? 0 : "4px",
                        }}
                      >
                        {isFirst && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1.5px", background: `linear-gradient(90deg,transparent,${rc},transparent)` }} />}
                        <div style={{ fontSize: isFirst ? "1.15rem" : "0.85rem", lineHeight: 1, marginBottom: "0.18rem" }}>{rankMedals[rank]}</div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", color: rc, fontSize: isFirst ? "0.58rem" : "0.5rem", fontWeight: 800, letterSpacing: "0.05em", marginBottom: "0.18rem" }}>#{rank}</div>
                        <div style={{ color: isFirst ? "#e2e8f0" : "#9ca3af", fontSize: isFirst ? "0.63rem" : "0.56rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "0.22rem" }}>{s.network || s.name}</div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", color: rc, fontSize: isFirst ? "0.95rem" : "0.78rem", fontWeight: 900, lineHeight: 1, marginBottom: "0.28rem" }}>{price.toFixed(1)}₽</div>
                        <div style={{ height: "3px", background: "#1a1a24", borderRadius: "2px", overflow: "hidden", marginBottom: "0.18rem" }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${avail}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            style={{ height: "100%", background: availColor, borderRadius: "2px" }}
                          />
                        </div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", color: availColor, fontSize: "0.48rem", marginBottom: savings > 0.1 ? "0.2rem" : 0 }}>{avail}%</div>
                        {savings > 0.1 && (
                          <div style={{ background: `${rc}18`, border: `1px solid ${rc}33`, borderRadius: "4px", padding: "0.06rem 0.28rem", color: rc, fontSize: "0.44rem", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                            −{savings.toFixed(1)}₽
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              );
            })() : (
              <div style={{ background: "linear-gradient(135deg,#0d0d18,#0f0c1a)", border: `1px solid ${color}22`, borderRadius: "12px", padding: "0.65rem 0.75rem", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg,transparent,${color},transparent)` }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "0.28rem" }}>
                  {deals.map(({ s, price, avail }, i) => (
                    <div key={s.id} onClick={() => { setSelectedStation(s); impact("light"); }} style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", padding: "0.22rem 0.35rem", borderRadius: "7px", background: i === 0 ? `${color}08` : "transparent" }}>
                      <span style={{ fontSize: "0.75rem", flexShrink: 0 }}>{["🥇","🥈","🥉"][i] ?? "·"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: "#e2e8f0", fontSize: "0.65rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                        <div style={{ color: "#374151", fontSize: "0.55rem" }}>{s.network || "АЗС"}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", color, fontSize: "0.72rem", fontWeight: 700 }}>{price.toFixed(1)}₽</div>
                        <div style={{ color: avail >= 60 ? "#22c55e" : "#eab308", fontSize: "0.55rem" }}>{avail}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Топливный терминал header (moved from top) ── */}
      {!selectedStation && !searchQuery && (
        <div style={{ padding: "0 12px 8px" }}>
          <div className="glass-panel" style={{ padding: "14px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,var(--accent-primary),var(--accent-secondary),transparent)" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: "0 0 2px", fontSize: "0.52rem", color: "var(--text-tertiary)", letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
                  Топливный терминал
                </p>
                <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1.1rem", fontWeight: 800, lineHeight: 1 }}>
                  🎫 Талоны
                </h2>
                <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.68rem" }}>
                  {stations.length.toLocaleString("ru")} станций
                  {lastFetched && (
                    <span style={{ color: "var(--text-tertiary)", marginLeft: "6px" }}>
                      · {(() => { const m = Math.floor((Date.now() - lastFetched) / 60000); return m < 1 ? "только что" : `${m} мин назад`; })()}
                    </span>
                  )}
                </p>
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0, marginLeft: "8px" }}>
                <button
                  onClick={() => { impact("light"); setShowCalculator(true); onCalcOpenChange?.(true); }}
                  title="Калькулятор расхода"
                  style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: "10px", color: "#a855f7", fontSize: "1.1rem", padding: "4px 9px", cursor: "pointer", lineHeight: 1 }}
                >🧮</button>
                <motion.button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  title="Обновить данные"
                  animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
                  transition={refreshing ? { duration: 0.8, repeat: Infinity, ease: "linear" } : { duration: 0.3 }}
                  style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: "10px", color: refreshing ? "#a855f7" : "#6b7280", fontSize: "0.9rem", padding: "4px 9px", cursor: refreshing ? "not-allowed" : "pointer", lineHeight: 1 }}
                >↻</motion.button>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: "999px", padding: "3px 8px" }}>
                  <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--accent-success)", boxShadow: "0 0 5px var(--accent-success)" }} />
                  <span style={{ fontSize: "0.55rem", color: "var(--accent-success)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>LIVE</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sort row ── */}
      <div style={{ padding: "0 1rem 0.5rem", display: "flex", gap: "0.35rem", alignItems: "center", overflowX: "auto" }}>
        <span style={{ color: "#4b5563", fontSize: "0.65rem", marginRight: "0.1rem", flexShrink: 0 }}>Сорт:</span>
        {(["availability", "name", "queue", "price"] as const).map((mode) => (
          <button key={mode} onClick={() => setSortMode(mode)} style={{
            flexShrink: 0,
            background: sortMode === mode ? "rgba(168,85,247,0.2)" : "none",
            border: `1px solid ${sortMode === mode ? "#a855f7" : "#22222f"}`,
            borderRadius: "6px", color: sortMode === mode ? "#a855f7" : "#6b7280",
            fontSize: "0.67rem", padding: "0.2rem 0.45rem", cursor: "pointer",
          }}>
            {mode === "availability" ? "Наличие" : mode === "name" ? "Назв." : mode === "queue" ? "Очередь" : "Цена↑"}
          </button>
        ))}
        <button
          onClick={() => {
            if (sortMode === "nearest" && userCoords) { setSortMode("availability"); return; }
            navigator.geolocation?.getCurrentPosition(
              (pos) => {
                setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setSortMode("nearest");
                toast("📍 Сортировка: ближайшие АЗС", "success");
              },
              () => toast("Геолокация недоступна", "error"),
              { timeout: 6000, maximumAge: 60000 }
            );
          }}
          style={{
            flexShrink: 0,
            background: sortMode === "nearest" ? "rgba(34,197,94,0.15)" : "none",
            border: `1px solid ${sortMode === "nearest" ? "#22c55e" : "#22222f"}`,
            borderRadius: "6px", color: sortMode === "nearest" ? "#22c55e" : "#6b7280",
            fontSize: "0.67rem", padding: "0.2rem 0.45rem", cursor: "pointer",
          }}
        >
          📍 Рядом
        </button>
        <span style={{ marginLeft: "auto", color: "#4b5563", fontSize: "0.65rem", flexShrink: 0 }}>
          {filteredStations.length.toLocaleString("ru")} АЗС
        </span>
      </div>

      {/* ── Recently viewed strip ── */}
      {!selectedStation && !searchQuery && recentlyViewed.length > 0 && (
        <div style={{ padding: "0 1rem 0.65rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.45rem" }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#6b7280", fontSize: "0.46rem", letterSpacing: "0.14em" }}>НЕДАВНО_ПРОСМОТРЕНО</span>
            <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg,#6b728022,transparent)" }} />
          </div>
          <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
            {recentlyViewed.map((id) => {
              const s = stations.find((st) => st.id === id);
              if (!s) return null;
              const avg = s.fuel_statuses.length ? Math.round(s.fuel_statuses.reduce((acc, f) => acc + f.availability_pct, 0) / s.fuel_statuses.length) : 0;
              const color = avg >= 60 ? "#22c55e" : avg >= 25 ? "#eab308" : "#ef4444";
              return (
                <motion.div key={s.id} whileTap={{ scale: 0.95 }}
                  onClick={() => { addRecentlyViewed(s.id); setSelectedStation(s); }}
                  style={{
                    flexShrink: 0, minWidth: "100px", maxWidth: "120px",
                    background: "linear-gradient(160deg,#0a0a14,#0d0d18)",
                    border: "1px solid #22222f", borderRadius: "12px",
                    padding: "0.5rem 0.6rem", cursor: "pointer",
                    position: "relative", overflow: "hidden",
                  }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg,transparent,${color}88,transparent)` }} />
                  <p style={{ margin: "0 0 0.1rem", fontFamily: "'JetBrains Mono',monospace", color, fontSize: "0.95rem", fontWeight: 800, lineHeight: 1 }}>{avg}%</p>
                  <p style={{ margin: 0, color: "#e2e8f0", fontSize: "0.62rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</p>
                  <p style={{ margin: "0.1rem 0 0", color: "#374151", fontSize: "0.55rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🕐 {s.network || "АЗС"}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Favorites strip ── */}
      {!selectedStation && !searchQuery && favoriteStations.length > 0 && (
        <div style={{ padding: "0 1rem 0.65rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.45rem" }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#f59e0b", fontSize: "0.46rem", letterSpacing: "0.14em" }}>ИЗБРАННОЕ</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.46rem" }}>({favoriteStations.length})</span>
            <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg,#f59e0b22,transparent)" }} />
          </div>
          <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
            {favoriteStations.map((id) => {
              const s = stations.find((st) => st.id === id);
              if (!s) return null;
              const avg = s.fuel_statuses.length ? Math.round(s.fuel_statuses.reduce((acc, f) => acc + f.availability_pct, 0) / s.fuel_statuses.length) : 0;
              const color = avg >= 60 ? "#22c55e" : avg >= 25 ? "#eab308" : "#ef4444";
              return (
                <motion.div key={s.id} whileTap={{ scale: 0.95 }} onClick={() => { addRecentlyViewed(s.id); setSelectedStation(s); }} style={{
                  flexShrink: 0, minWidth: "110px", maxWidth: "130px",
                  background: "linear-gradient(160deg,#0a0a14,#14100a)",
                  border: "1px solid #f59e0b30", borderRadius: "12px",
                  padding: "0.5rem 0.6rem", cursor: "pointer",
                  position: "relative", overflow: "hidden",
                  boxShadow: "0 0 10px #f59e0b0a",
                }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#f59e0b,transparent)" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
                    <span style={{ fontSize: "0.65rem" }}>⭐</span>
                    <button onClick={(e) => { e.stopPropagation(); toggleStationFavorite(s.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#374151", fontSize: "0.55rem", padding: 0 }}>✕</button>
                  </div>
                  <p style={{ margin: "0 0 0.1rem", fontFamily: "'JetBrains Mono',monospace", color, fontSize: "1.0rem", fontWeight: 800, lineHeight: 1 }}>{avg}%</p>
                  <p style={{ margin: 0, color: "#e2e8f0", fontSize: "0.62rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</p>
                  <p style={{ margin: "0.1rem 0 0", color: "#4b5563", fontSize: "0.55rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.network || "АЗС"}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Top-5 availability strip (only default view) ── */}
      {!selectedStation && !searchQuery && sortMode === "availability" && (
        <div style={{ padding: "0 1rem 0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.45rem" }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#22c55e", fontSize: "0.46rem", letterSpacing: "0.14em" }}>ТОП_ДОСТУПНОСТЬ</span>
          </div>
          <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
            {[...stations]
              .sort((a, b) => {
                const avgA = a.fuel_statuses.length ? a.fuel_statuses.reduce((s, f) => s + f.availability_pct, 0) / a.fuel_statuses.length : 0;
                const avgB = b.fuel_statuses.length ? b.fuel_statuses.reduce((s, f) => s + f.availability_pct, 0) / b.fuel_statuses.length : 0;
                return avgB - avgA;
              })
              .slice(0, 5)
              .map((s, rank) => {
                const avg = s.fuel_statuses.length ? Math.round(s.fuel_statuses.reduce((acc, f) => acc + f.availability_pct, 0) / s.fuel_statuses.length) : 0;
                const color = avg >= 60 ? "#22c55e" : avg >= 25 ? "#eab308" : "#ef4444";
                return (
                  <motion.div key={s.id} whileTap={{ scale: 0.95 }} onClick={() => { addRecentlyViewed(s.id); setSelectedStation(s); }} style={{
                    flexShrink: 0, minWidth: "120px", maxWidth: "135px",
                    background: `linear-gradient(160deg,#0a0d18,${color}08)`,
                    border: `1px solid ${color}30`, borderRadius: "12px",
                    padding: "0.55rem 0.65rem", cursor: "pointer",
                    position: "relative", overflow: "hidden",
                    boxShadow: `0 0 12px ${color}12`,
                  }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg,transparent,${color},transparent)` }} />
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.42rem", marginBottom: "0.15rem" }}>#{rank + 1}</div>
                    <p style={{ margin: "0 0 0.1rem", color, fontFamily: "'JetBrains Mono',monospace", fontSize: "1.15rem", fontWeight: 800, lineHeight: 1, textShadow: `0 0 8px ${color}44` }}>{avg}%</p>
                    <p style={{ margin: 0, color: "#e2e8f0", fontSize: "0.65rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</p>
                    <p style={{ margin: "0.1rem 0 0", color: "#374151", fontSize: "0.57rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.network || "АЗС"}</p>
                  </motion.div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── Station list / selected station ── */}
      {!selectedStation ? (
        <div style={{ padding: "0 1rem" }}>
          {filteredStations.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
              <motion.div
                animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 2.4, repeat: Infinity }}
                style={{ width: "64px", height: "64px", borderRadius: "18px", background: "linear-gradient(135deg,#0d0d18,#14141c)", border: "1px solid #a855f722", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem", boxShadow: "0 0 20px #a855f710" }}
              >🔍</motion.div>
              <div>
                <p style={{ margin: "0 0 0.25rem", color: "#e2e8f0", fontSize: "0.88rem", fontWeight: 700 }}>АЗС не найдены</p>
                <p style={{ margin: 0, color: "#4b5563", fontSize: "0.72rem" }}>Нет совпадений по запросу «{debouncedQuery}»</p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => { setSearchQuery(""); impact("light"); }}
                  style={{ background: "rgba(168,85,247,0.12)", border: "1px solid #a855f740", borderRadius: "10px", color: "#a855f7", fontSize: "0.72rem", fontWeight: 700, padding: "0.45rem 1rem", cursor: "pointer" }}
                >✕ Сбросить</button>
                <button
                  onClick={handleRefresh}
                  style={{ background: "rgba(59,130,246,0.1)", border: "1px solid #3b82f640", borderRadius: "10px", color: "#3b82f6", fontSize: "0.72rem", fontWeight: 700, padding: "0.45rem 1rem", cursor: "pointer" }}
                >↻ Обновить</button>
              </div>
              <div style={{ background: "#0d0d18", border: "1px solid #1e1e2a", borderRadius: "8px", padding: "0.3rem 0.75rem", fontSize: "0.58rem", fontFamily: "'JetBrains Mono',monospace", color: "#374151" }}>
                SEARCH_RESULT · 0 STATIONS
              </div>
            </div>
          ) : (
            <>
              {visibleStations.map((s: GasStation) => {
                const hasFuel = s.fuel_statuses.some((f) => f.availability_pct > 0);
                // addRecentlyViewed is called on click below
                const avgAvail = s.fuel_statuses.length
                  ? Math.round(s.fuel_statuses.reduce((acc, f) => acc + f.availability_pct, 0) / s.fuel_statuses.length)
                  : 0;
                const availColor = avgAvail >= 60 ? "#22c55e" : avgAvail >= 25 ? "#eab308" : "#ef4444";

                // When filtering by fuel type, highlight that fuel's availability
                const highlightFs = matchedFuelType
                  ? s.fuel_statuses.find((f) => f.fuel_type === matchedFuelType)
                  : null;
                const highlightPct = highlightFs?.availability_pct ?? null;
                const highlightColor = highlightPct == null ? "#6b7280" : highlightPct >= 60 ? "#22c55e" : highlightPct >= 25 ? "#eab308" : "#ef4444";

                return (
                  <motion.div
                    key={s.id} whileTap={{ scale: 0.975 }} onClick={() => { addRecentlyViewed(s.id); setSelectedStation(s); }}
                    style={{
                      background: avgAvail < 25 ? "linear-gradient(160deg,#100606,#0d0d14)" : avgAvail >= 60 ? "linear-gradient(160deg,#060f0a,#0d0d14)" : "#0d0d14",
                      border: `1px solid ${avgAvail < 25 ? "#ef444428" : avgAvail >= 60 ? "#22c55e20" : "#1a1a24"}`,
                      borderRadius: "14px", padding: "0.65rem 0.8rem", marginBottom: "0.35rem",
                      cursor: "pointer", position: "relative", overflow: "hidden",
                    }}
                  >
                    <div style={{ position: "absolute", left: 0, top: "15%", bottom: "15%", width: "2px", background: availColor, borderRadius: "0 2px 2px 0", boxShadow: `0 0 6px ${availColor}66` }} />
                    <div style={{ paddingLeft: "0.6rem", display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                      <StationLogo network={s.network || "АЗС"} size={30} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.3rem" }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.05rem" }}>
                            <p style={{ margin: 0, color: "#e2e8f0", fontSize: "0.85rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em", flex: 1, minWidth: 0 }}>
                              {s.name}
                            </p>
                            {sortMode === "nearest" && userCoords && (
                              <span style={{ flexShrink: 0, background: "rgba(34,197,94,0.1)", border: "1px solid #22c55e30", borderRadius: "5px", color: "#22c55e", fontSize: "0.52rem", padding: "0.05rem 0.25rem", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                                📍{haversineKm(userCoords.lat, userCoords.lng, s.lat, s.lng).toFixed(1)}км
                              </span>
                            )}
                          </div>
                          <p style={{ margin: 0, color: "#374151", fontSize: "0.62rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {s.region.split(" ").slice(-1)[0]} · {s.network || "АЗС"}
                          </p>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "0.5rem" }}>
                          {matchedFuelType && highlightPct != null ? (
                            <>
                              <p style={{ margin: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: "1rem", fontWeight: 800, color: highlightColor, textShadow: `0 0 10px ${highlightColor}44`, lineHeight: 1 }}>
                                {highlightPct}%
                              </p>
                              <span style={{ color: "#4b5563", fontSize: "0.56rem", fontFamily: "'JetBrains Mono',monospace" }}>{matchedFuelType}</span>
                            </>
                          ) : (
                            <>
                              <p style={{ margin: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: "1rem", fontWeight: 800, color: hasFuel ? availColor : "#ef4444", textShadow: `0 0 10px ${availColor}44`, lineHeight: 1 }}>
                                {hasFuel ? `${avgAvail}%` : "—"}
                              </p>
                              <span style={{ color: s.queue_cars > 8 ? "#ef4444" : "#374151", fontSize: "0.58rem" }}>🚗{s.queue_cars}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                        {["АИ-92", "АИ-95", "ДТ"].map((ft) => {
                          const p = getPrice(s.region, ft);
                          if (!p) return null;
                          const isHighlighted = ft === matchedFuelType;
                          return (
                            <span key={ft} style={{
                              background: isHighlighted ? "#a855f715" : p.is_crisis ? "#ef444415" : "#111118",
                              border: `1px solid ${isHighlighted ? "#a855f740" : p.is_crisis ? "#ef444430" : "#222230"}`,
                              borderRadius: "5px",
                              fontFamily: "'JetBrains Mono',monospace",
                              fontSize: "0.6rem",
                              color: isHighlighted ? "#a855f7" : p.is_crisis ? "#ef4444" : p.multiplier > 1.03 ? "#f59e0b" : "#4b5563",
                              padding: "0.1rem 0.35rem",
                              fontWeight: isHighlighted || p.is_crisis ? 700 : 400,
                            }}>
                              {ft} {p.effective.toFixed(0)}₽{p.is_crisis && " ▲"}
                            </span>
                          );
                        })}
                      </div>
                      {/* Mini per-fuel progress bars */}
                      {s.fuel_statuses.length > 0 && (
                        <div style={{ display: "flex", gap: "3px", marginTop: "0.32rem", alignItems: "flex-end" }}>
                          {s.fuel_statuses
                            .filter((fs) => ["АИ-92", "АИ-95", "ДТ", "Газ"].includes(fs.fuel_type))
                            .slice(0, 5)
                            .map((fs) => {
                              const barColor = fs.availability_pct >= 60 ? "#22c55e" : fs.availability_pct >= 25 ? "#eab308" : "#ef4444";
                              const label = fs.fuel_type === "АИ-92" ? "92" : fs.fuel_type === "АИ-95" ? "95" : fs.fuel_type === "ДТ" ? "ДТ" : "Г";
                              return (
                                <div key={fs.fuel_type} title={`${fs.fuel_type}: ${fs.availability_pct}%`} style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1px", alignItems: "center" }}>
                                  <div style={{ width: "100%", height: "3px", background: "#1a1a24", borderRadius: "2px", overflow: "hidden" }}>
                                    <div style={{ width: `${fs.availability_pct}%`, height: "100%", background: barColor, borderRadius: "2px", transition: "width 0.5s ease" }} />
                                  </div>
                                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.38rem", color: "#374151", letterSpacing: "-0.01em" }}>{label}</span>
                                </div>
                              );
                            })}
                        </div>
                      )}
                      </div>
                      {/* Compare button */}
                      {compareStation?.id !== s.id && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setCompareStation(s as GasStation); setShowCompare(true); }}
                          style={{
                            background: compareStation?.id === (s as GasStation).id ? "rgba(59,130,246,0.15)" : "none",
                            border: `1px solid ${compareStation?.id === (s as GasStation).id ? "#3b82f6" : "#22222f"}`,
                            borderRadius: "6px", color: compareStation?.id === (s as GasStation).id ? "#3b82f6" : "#374151",
                            fontSize: "0.6rem", padding: "0.15rem 0.35rem", cursor: "pointer", flexShrink: 0,
                            marginTop: "0.25rem",
                          }}
                        >⇌ Сравнить</button>
                      )}
                    </div>
                  </motion.div>
                );
              })}

              {/* Intersection sentinel for auto-load */}
              {hasMore && <div ref={sentinelRef} style={{ height: "1px" }} />}

              {/* Load-more button (visible fallback) */}
              {hasMore && (
                <motion.button
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, MAX_INLINE))}
                  style={{
                    width: "100%", padding: "0.75rem",
                    background: "linear-gradient(135deg,#0d0d18,#14141c)",
                    border: "1px solid #a855f733", borderRadius: "12px",
                    color: "#a855f7", fontSize: "0.82rem", fontWeight: 700,
                    cursor: "pointer", marginBottom: "0.5rem",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                  }}
                >
                  ↓ Загрузить ещё АЗС
                  <span style={{ color: "#4b5563", fontSize: "0.68rem", fontFamily: "'JetBrains Mono',monospace" }}>
                    {visibleCount} / {Math.min(filteredStations.length, MAX_INLINE)}
                  </span>
                </motion.button>
              )}

              {/* Cap reached notice */}
              {hitCap && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: "linear-gradient(160deg,#0d0d18,#100820)",
                    border: "1px solid #a855f733", borderRadius: "14px",
                    padding: "1rem 1.1rem", marginBottom: "0.5rem",
                    textAlign: "center", position: "relative", overflow: "hidden",
                  }}
                >
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#a855f7,#db2777,transparent)" }} />
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#4b5563", fontSize: "0.46rem", letterSpacing: "0.16em", marginBottom: "0.4rem" }}>
                    ЛИМИТ_ОТОБРАЖЕНИЯ · {MAX_INLINE}_СТАНЦИЙ
                  </div>
                  <p style={{ margin: "0 0 0.35rem", color: "#e2e8f0", fontSize: "0.82rem", fontWeight: 700 }}>
                    Показано {MAX_INLINE} из {filteredStations.length.toLocaleString("ru")} АЗС
                  </p>
                  <p style={{ margin: 0, color: "#6b7280", fontSize: "0.72rem", lineHeight: 1.5 }}>
                    Остальные АЗС доступны на 📍 карте или через поиск по названию / региону
                  </p>
                </motion.div>
              )}
            </>
          )}
        </div>
      ) : (
        /* ── Selected station detail ── */
        <div style={{ padding: "0 1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <button
              onClick={() => { setSelectedStation(null); setLimits(null); }}
              style={{ background: "none", border: "none", color: "#a855f7", fontSize: "0.82rem", cursor: "pointer", padding: "0.25rem 0", display: "flex", alignItems: "center", gap: "0.3rem" }}
            >← Назад</button>
            {compareStation && showCompare && (
              <button
                onClick={() => setShowCompare(false)}
                style={{ marginLeft: "auto", background: "rgba(59,130,246,0.12)", border: "1px solid #3b82f644", borderRadius: "6px", color: "#3b82f6", fontSize: "0.65rem", padding: "0.2rem 0.5rem", cursor: "pointer" }}
              >✕ Сравнение</button>
            )}
          </div>

          {/* ── Station comparison panel ── */}
          {showCompare && compareStation && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{ marginBottom: "0.65rem", background: "linear-gradient(135deg,#0a0a14,#0d0c18)", border: "1px solid #3b82f633", borderRadius: "14px", padding: "0.6rem 0.7rem", position: "relative", overflow: "hidden" }}
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#3b82f6,#a855f7,transparent)" }} />
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.42rem", letterSpacing: "0.14em", marginBottom: "0.45rem" }}>СРАВНЕНИЕ_СТАНЦИЙ · АНАЛИЗ</div>
              {(() => {
                const pair = [compareStation, selectedStation];
                const avgs = pair.map((s) => s.fuel_statuses.length ? Math.round(s.fuel_statuses.reduce((a, f) => a + f.availability_pct, 0) / s.fuel_statuses.length) : 0);
                const betterAvail = avgs[0] >= avgs[1] ? 0 : 1;
                const betterQueue = pair[0].queue_cars <= pair[1].queue_cars ? 0 : 1;
                const COMPARE_COLORS = ["#3b82f6", "#a855f7"];
                return (
                  <div style={{ display: "flex", gap: "0.45rem", alignItems: "stretch" }}>
                    {pair.map((s, idx) => {
                      const avg = avgs[idx];
                      const ac = avg >= 60 ? "#22c55e" : avg >= 25 ? "#eab308" : "#ef4444";
                      const cc = COMPARE_COLORS[idx];
                      return (
                        <div key={s.id} style={{ flex: 1, background: `${cc}08`, border: `1px solid ${cc}33`, borderRadius: "10px", padding: "0.45rem 0.4rem" }}>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: cc, fontSize: "0.42rem", letterSpacing: "0.1em", marginBottom: "0.18rem" }}>
                            {idx === 0 ? "СРАВНИВАЕМ" : "ТЕКУЩАЯ"}
                          </div>
                          <div style={{ color: "#e2e8f0", fontSize: "0.6rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "0.08rem" }}>{s.network || s.name}</div>
                          <div style={{ color: "#4b5563", fontSize: "0.5rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "0.2rem" }}>{s.name}</div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: "3px", marginBottom: "0.18rem" }}>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: ac, fontSize: "0.95rem", fontWeight: 900 }}>{avg}%</span>
                            {betterAvail === idx && <span style={{ fontSize: "0.48rem", color: "#22c55e", fontWeight: 700 }}>▲</span>}
                          </div>
                          <div style={{ height: "3px", background: "#1a1a24", borderRadius: "2px", overflow: "hidden", marginBottom: "0.18rem" }}>
                            <motion.div
                              initial={{ width: 0 }} animate={{ width: `${avg}%` }}
                              transition={{ duration: 0.7, ease: "easeOut" }}
                              style={{ height: "100%", background: ac, borderRadius: "2px" }}
                            />
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "3px", marginBottom: "0.2rem" }}>
                            <span style={{ color: s.queue_cars > 8 ? "#ef4444" : "#4b5563", fontSize: "0.5rem", fontFamily: "'JetBrains Mono',monospace" }}>🚗{s.queue_cars}</span>
                            {betterQueue === idx && <span style={{ color: "#22c55e", fontSize: "0.45rem" }}>✓</span>}
                          </div>
                          <div style={{ display: "flex", gap: "2px" }}>
                            {s.fuel_statuses.filter((f) => ["АИ-92","АИ-95","ДТ"].includes(f.fuel_type)).slice(0, 3).map((fs) => {
                              const fc = fs.availability_pct >= 60 ? "#22c55e" : fs.availability_pct >= 25 ? "#eab308" : "#ef4444";
                              return (
                                <div key={fs.fuel_type} style={{ flex: 1 }}>
                                  <div style={{ height: "2px", background: "#1a1a24", borderRadius: "1px", overflow: "hidden" }}>
                                    <div style={{ width: `${fs.availability_pct}%`, height: "100%", background: fc }} />
                                  </div>
                                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.35rem", color: "#374151", textAlign: "center", marginTop: "1px" }}>
                                    {fs.fuel_type === "АИ-92" ? "92" : fs.fuel_type === "АИ-95" ? "95" : "ДТ"}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </motion.div>
          )}

          {(() => {
            const selAvg = selectedStation.fuel_statuses.length ? Math.round(selectedStation.fuel_statuses.reduce((a, f) => a + f.availability_pct, 0) / selectedStation.fuel_statuses.length) : 0;
            const selColor = selAvg >= 60 ? "#22c55e" : selAvg >= 25 ? "#eab308" : "#ef4444";
            return (
              <div style={{
                background: "linear-gradient(160deg,#0d0d18,#100a18)",
                border: `1px solid ${selColor}30`, borderRadius: "14px",
                padding: "0.9rem 1rem", marginBottom: "0.75rem",
                position: "relative", overflow: "hidden",
                boxShadow: `0 0 20px ${selColor}12`,
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg,transparent,${selColor},transparent)` }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.18rem" }}>ВЫБРАННАЯ_СТАНЦИЯ · ЗАПРАВКА</div>
                    <p style={{ margin: "0 0 0.15rem", color: "#f1f5f9", fontWeight: 800, fontSize: "0.95rem", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {selectedStation.name}
                    </p>
                    <p style={{ margin: "0 0 0.25rem", color: "#4b5563", fontSize: "0.68rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      📍 {selectedStation.region} · {selectedStation.address}
                    </p>
                    <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                      {selectedStation.network && (
                        <span style={{ background: "#14141c", border: "1px solid #1e1e2a", borderRadius: "5px", color: "#6b7280", fontSize: "0.58rem", padding: "0.05rem 0.35rem" }}>{selectedStation.network}</span>
                      )}
                      <span style={{ background: `${selColor}15`, border: `1px solid ${selColor}30`, borderRadius: "5px", color: selColor, fontSize: "0.58rem", fontWeight: 700, padding: "0.05rem 0.35rem" }}>
                        {selAvg}% наличие
                      </span>
                      <span style={{ background: "#a855f710", border: "1px solid #a855f730", borderRadius: "5px", color: "#a855f7", fontSize: "0.58rem", padding: "0.05rem 0.35rem" }}>
                        🚗 {selectedStation.queue_cars} авто
                      </span>
                    </div>
                    {/* Per-fuel price row */}
                    {(() => {
                      const FUEL_COLORS_SEL: Record<string, string> = { "АИ-92": "#a855f7", "АИ-95": "#db2777", "ДТ": "#f59e0b", "Газ": "#22c55e" };
                      const fuelPrices = selectedStation.fuel_statuses
                        .filter((fs) => ["АИ-92","АИ-95","ДТ","Газ"].includes(fs.fuel_type))
                        .map((fs) => ({ fuel: fs.fuel_type, price: getPrice(selectedStation.region, fs.fuel_type)?.effective }))
                        .filter((x) => x.price != null && x.price > 0);
                      if (!fuelPrices.length) return null;
                      return (
                        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
                          {fuelPrices.map(({ fuel, price }) => (
                            <span key={fuel} style={{ background: `${FUEL_COLORS_SEL[fuel] ?? "#a855f7"}12`, border: `1px solid ${FUEL_COLORS_SEL[fuel] ?? "#a855f7"}35`, borderRadius: "5px", padding: "0.05rem 0.4rem", display: "flex", alignItems: "center", gap: "3px" }}>
                              <span style={{ color: FUEL_COLORS_SEL[fuel] ?? "#a855f7", fontSize: "0.52rem", fontWeight: 700 }}>{fuel}</span>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#e2e8f0", fontSize: "0.56rem", fontWeight: 700 }}>₽{price!.toFixed(1)}</span>
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "0.5rem" }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "1.6rem", fontWeight: 800, color: selColor, lineHeight: 1, textShadow: `0 0 16px ${selColor}66` }}>{selAvg}%</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Payment method */}
          <div style={{ marginBottom: "0.25rem" }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.1rem" }}>СПОСОБ_ОПЛАТЫ · ШЛЮЗ</div>
            <p style={{ color: "#6b7280", fontSize: "0.68rem", margin: "0 0 0.35rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Способ оплаты</p>
            <PaymentMethodSelector value={payMethod} onChange={setPayMethod} />
          </div>

          {payMethod === "stars" && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} style={{
              background: "linear-gradient(135deg,#f59e0b12,#0d0d18)", border: "1px solid #f59e0b33",
              borderRadius: "12px", padding: "0.55rem 0.8rem", marginBottom: "0.75rem",
              fontSize: "0.7rem", color: "#f59e0b", position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#f59e0b66,transparent)" }} />
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.46rem", letterSpacing: "0.12em", color: "#f59e0b88", marginBottom: "0.1rem" }}>TELEGRAM_STARS</div>
              ⭐ Оплата через Telegram Stars — нажмите кнопку, откроется платёж в Telegram
            </motion.div>
          )}
          {payMethod === "cryptobot" && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} style={{
              background: "linear-gradient(135deg,#3b82f612,#0d0d18)", border: "1px solid #3b82f633",
              borderRadius: "12px", padding: "0.55rem 0.8rem", marginBottom: "0.75rem",
              fontSize: "0.7rem", color: "#3b82f6", position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#3b82f666,transparent)" }} />
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.46rem", letterSpacing: "0.12em", color: "#3b82f688", marginBottom: "0.1rem" }}>CRYPTO_BOT_USDT</div>
              💎 Оплата USDT через @CryptoBot — откроется в новой вкладке
            </motion.div>
          )}

          {selectedStation.fuel_statuses.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2.5rem 1rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem" }}>
              <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "linear-gradient(135deg,#0d0d18,#14141c)", border: "1px solid #ef444422", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>⛽</div>
              <p style={{ margin: 0, color: "#6b7280", fontSize: "0.78rem" }}>Нет данных по топливу на этой АЗС</p>
              <div style={{ background: "#0d0d18", border: "1px solid #1e1e2a", borderRadius: "8px", padding: "0.3rem 0.75rem", fontSize: "0.58rem", fontFamily: "'JetBrains Mono',monospace", color: "#374151" }}>
                FUEL_STATUS · NO_DATA
              </div>
            </div>
          ) : (
            selectedStation.fuel_statuses.map((fs) => (
              <FuelItem
                key={fs.fuel_type} fuelType={fs.fuel_type} station={selectedStation}
                limits={limits} userId={user.id} payMethod={payMethod} onBuy={handleBuy}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
