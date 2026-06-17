import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Fuse from "fuse.js";
import { fetchLimits, createStarsInvoice, createCryptoBotInvoice, createNetworkStarsInvoice, createNetworkCryptoBotInvoice, fetchStations as apiFetchStations } from "@/api/client";
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

      <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.12)", borderRadius: "8px", padding: "0.4rem 0.55rem", marginBottom: "0.6rem" }}>
        <p style={{ margin: 0, color: "#4b5563", fontSize: "0.56rem", lineHeight: 1.5 }}>
          ⚠️ Цены на талоны обновляются в реальном времени. Оплата по актуальной цене на момент покупки. Возврат средств невозможен.
        </p>
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

export function CatalogTab({ initialStationId, onCalcOpenChange }: CatalogTabProps) {
  const { user } = useUserStore();
  const { stations, loading, lastFetched } = useStationStore();
  useVaultStore();
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
  const [payMethod, setPayMethod] = useState<PayMethod>("stars");
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [refreshing, setRefreshing] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || "[]"); } catch { return []; }
  });
  const [dealFuel, setDealFuel] = useState<"АИ-92" | "АИ-95" | "ДТ">("АИ-92");
  const [activeNetwork, setActiveNetwork] = useState<string | null>(null);
  const [nvFuel, setNvFuel] = useState<string>("АИ-92");
  const [nvVolume, setNvVolume] = useState<number>(40);
  const [nvLoading, setNvLoading] = useState(false);

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
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [debouncedQuery, sortMode]);

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
    if (!debouncedQuery) return applyZone(sortStations(stations));
    if (matchedFuelType) {
      return applyZone(sortStations(stations.filter(s => s.fuel_statuses.some(f => f.fuel_type === matchedFuelType))));
    }
    // Fuse.js fuzzy search (falls back to substring if query is too short)
    if (debouncedQuery.trim().length < 2) {
      const q = debouncedQuery.toLowerCase();
      return applyZone(sortStations(stations.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.network.toLowerCase().includes(q) ||
        s.region.toLowerCase().includes(q)
      )));
    }
    const results = fuse.search(debouncedQuery);
    return applyZone(sortStations(results.map(r => r.item)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, debouncedQuery, sortMode, matchedFuelType, fuse, userCoords, zoneFilter]);

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
            style={{ padding: "0 12px 0" }}
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

      {/* ── Header ── */}
      <div style={{ padding: "12px 12px 8px" }}>
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
              <div style={{
                display: "flex", alignItems: "center", gap: "4px",
                background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)",
                borderRadius: "999px", padding: "3px 8px",
              }}>
                <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--accent-success)", boxShadow: "0 0 5px var(--accent-success)" }} />
                <span style={{ fontSize: "0.55rem", color: "var(--accent-success)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>LIVE</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Search bar ── */}
      <div style={{ padding: "0.5rem 1rem 0.35rem", position: "relative" }}>
        <div style={{ position: "absolute", left: "1.7rem", top: "50%", transform: "translateY(-50%)", color: "#4b5563", fontSize: "0.8rem", pointerEvents: "none", zIndex: 1 }}>🔍</div>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск: сеть, регион, 95, дт, дизель…"
          style={{
            width: "100%", boxSizing: "border-box",
            background: "linear-gradient(135deg,#0d0d18,#14141c)",
            border: `1px solid ${searchQuery ? "#a855f744" : "#1e1e2a"}`,
            borderRadius: "12px", color: "#e2e8f0",
            padding: "0.62rem 0.75rem 0.62rem 2.2rem", fontSize: "0.82rem",
            outline: "none", transition: "border-color 0.2s",
          }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} style={{ position: "absolute", right: "1.7rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontSize: "0.8rem", padding: "0 0.2rem" }}>✕</button>
        )}
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
            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#22222f", fontSize: "0.55rem", flexShrink: 0 }}>СЕТИ:</span>
            {top.map(([net, { cnt, sum }]) => {
              const avgAvail = Math.round(sum / cnt);
              const dotColor = avgAvail >= 60 ? "#22c55e" : avgAvail >= 25 ? "#eab308" : "#ef4444";
              return (
                <button key={net} onClick={() => { impact("light"); setSearchQuery(net); }}
                  style={{
                    flexShrink: 0, padding: "2px 8px",
                    background: "rgba(255,255,255,0.03)", border: "1px solid #1a1a24",
                    borderRadius: "6px", color: "#4b5563", fontSize: "0.58rem", cursor: "pointer",
                    fontFamily: "'JetBrains Mono',monospace",
                    display: "flex", alignItems: "center", gap: "4px",
                  }}
                >
                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                  {net} <span style={{ color: "#374151" }}>{cnt}</span>
                </button>
              );
            })}
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
          .slice(0, 3);
        if (!deals.length) return null;
        const color = DEAL_COLORS[dealFuel];
        return (
          <div style={{ padding: "0 1rem 0.5rem" }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.4rem", letterSpacing: "0.14em", marginBottom: "0.35rem" }}>ЛУЧШИЕ_ПРЕДЛОЖЕНИЯ · СЕЙЧАС</div>
            <div style={{ background: "linear-gradient(135deg,#0d0d18,#0f0c1a)", border: `1px solid ${color}22`, borderRadius: "12px", padding: "0.65rem 0.75rem", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg,transparent,${color},transparent)` }} />
              <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.5rem" }}>
                {DEAL_FUELS.map((f) => (
                  <button key={f} onClick={() => setDealFuel(f)} style={{ padding: "0.15rem 0.45rem", background: dealFuel === f ? `${DEAL_COLORS[f]}20` : "#0b0b10", border: `1px solid ${dealFuel === f ? DEAL_COLORS[f] : "#1e1e2a"}`, borderRadius: "6px", color: dealFuel === f ? DEAL_COLORS[f] : "#374151", fontSize: "0.62rem", fontWeight: dealFuel === f ? 700 : 400, cursor: "pointer" }}>{f}</button>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.28rem" }}>
                {deals.map(({ s, price, avail }, i) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  return (
                    <div key={s.id} onClick={() => { setSelectedStation(s); impact("light"); }} style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", padding: "0.22rem 0.35rem", borderRadius: "7px", background: i === 0 ? `${color}08` : "transparent" }}>
                      <span style={{ fontSize: "0.75rem", flexShrink: 0 }}>{medals[i] ?? "·"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: "#e2e8f0", fontSize: "0.65rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                        <div style={{ color: "#374151", fontSize: "0.55rem" }}>{s.network || "АЗС"}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", color, fontSize: "0.72rem", fontWeight: 700 }}>{price.toFixed(1)}₽</div>
                        <div style={{ color: avail >= 60 ? "#22c55e" : "#eab308", fontSize: "0.55rem" }}>{avail}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Network Vouchers ── */}
      {!selectedStation && !searchQuery && (
        <div style={{ padding: "0 1rem 0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.45rem" }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a855f7", fontSize: "0.45rem", letterSpacing: "0.14em" }}>СЕТЕВЫЕ_ТАЛОНЫ</span>
            <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg,#a855f722,transparent)" }} />
            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.45rem" }}>ДЕЙСТВУЕТ НА ВСЕХ АЗС СЕТИ</span>
          </div>
          <div style={{ background: "linear-gradient(135deg,#0d0d18,#0f0c1a)", border: "1px solid #a855f722", borderRadius: "12px", padding: "0.6rem", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#a855f7,transparent)" }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.3rem", marginBottom: activeNetwork ? "0.55rem" : 0 }}>
              {NETWORK_VOUCHER_NETWORKS.map(({ name, color }) => (
                <button key={name}
                  onClick={() => { impact("light"); setActiveNetwork(activeNetwork === name ? null : name); setNvFuel("АИ-92"); setNvVolume(40); }}
                  style={{ padding: "0.45rem 0.2rem", background: activeNetwork === name ? `${color}18` : "rgba(255,255,255,0.025)", border: `1px solid ${activeNetwork === name ? color + "90" : "#1a1a24"}`, borderRadius: "9px", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.18rem", cursor: "pointer", transition: "all 0.15s" }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: activeNetwork === name ? color : "#6b7280", fontSize: "0.57rem", fontWeight: activeNetwork === name ? 700 : 400, textAlign: "center", lineHeight: 1.25 }}>{name}</span>
                  <span style={{ color: "#374151", fontSize: "0.47rem" }}>{(NETWORK_PRICES[name]?.["АИ-92"] ?? 65).toFixed(1)}₽/л</span>
                </button>
              ))}
            </div>
            <AnimatePresence>
              {activeNetwork && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
                  <div style={{ display: "flex", gap: "0.25rem", marginBottom: "0.38rem", flexWrap: "wrap" }}>
                    {["АИ-92", "АИ-95", "ДТ", "Газ"].map((ft) => (
                      <button key={ft} onClick={() => { impact("light"); setNvFuel(ft); }}
                        style={{ padding: "0.22rem 0.45rem", background: nvFuel === ft ? "#a855f720" : "#0b0b10", border: `1px solid ${nvFuel === ft ? "#a855f7" : "#222230"}`, borderRadius: "7px", color: nvFuel === ft ? "#a855f7" : "#4b5563", fontSize: "0.58rem", fontWeight: nvFuel === ft ? 700 : 400, cursor: "pointer" }}>
                        {ft} · {(NETWORK_PRICES[activeNetwork]?.[ft] ?? FUEL_PRICES[ft] ?? 65).toFixed(1)}₽
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "0.25rem", marginBottom: "0.45rem" }}>
                    {VOLUMES.map((v) => (
                      <button key={v} onClick={() => { impact("light"); setNvVolume(v); }}
                        style={{ flex: 1, padding: "0.28rem", background: nvVolume === v ? "#db277718" : "#0b0b10", border: `1px solid ${nvVolume === v ? "#db2777" : "#222230"}`, borderRadius: "7px", color: nvVolume === v ? "#db2777" : "#4b5563", fontSize: "0.62rem", fontWeight: nvVolume === v ? 700 : 400, cursor: "pointer", textAlign: "center" }}>
                        {v}л
                      </button>
                    ))}
                  </div>
                  <div style={{ background: "#0b0b10", border: "1px solid #1a1a24", borderRadius: "8px", padding: "0.38rem 0.55rem", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                    <div>
                      <div style={{ color: "#6b7280", fontSize: "0.5rem" }}>Сетевой талон · 7 дней</div>
                      <div style={{ color: "#e2e8f0", fontSize: "0.7rem", fontWeight: 700 }}>{activeNetwork} · {nvFuel} · {nvVolume}л</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a855f7", fontSize: "0.85rem", fontWeight: 800 }}>
                        {((NETWORK_PRICES[activeNetwork]?.[nvFuel] ?? FUEL_PRICES[nvFuel] ?? 65) * nvVolume).toFixed(0)}₽
                      </div>
                      <div style={{ color: "#374151", fontSize: "0.48rem" }}>≈{Math.ceil((NETWORK_PRICES[activeNetwork]?.[nvFuel] ?? FUEL_PRICES[nvFuel] ?? 65) * nvVolume / STAR_RUB_RATE)}⭐</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.35rem" }}>
                    <button onClick={() => handleNetworkVoucher("stars")} disabled={nvLoading}
                      style={{ flex: 1, padding: "0.46rem", background: "linear-gradient(135deg,#a855f720,#9333ea20)", border: "1px solid #a855f740", borderRadius: "9px", color: "#a855f7", fontSize: "0.63rem", fontWeight: 700, cursor: nvLoading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem" }}>
                      ⭐ Оплатить Stars
                    </button>
                    <button onClick={() => handleNetworkVoucher("cryptobot")} disabled={nvLoading}
                      style={{ flex: 1, padding: "0.46rem", background: "linear-gradient(135deg,#22c55e15,#16a34a15)", border: "1px solid #22c55e30", borderRadius: "9px", color: "#22c55e", fontSize: "0.63rem", fontWeight: 700, cursor: nvLoading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem" }}>
                      💎 Crypto
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
                      {/* Mini per-fuel availability strip */}
                      {s.fuel_statuses.length > 0 && (
                        <div style={{ display: "flex", gap: "2px", marginTop: "0.3rem", height: "2px" }}>
                          {s.fuel_statuses.map((fs) => (
                            <div
                              key={fs.fuel_type}
                              title={`${fs.fuel_type}: ${fs.availability_pct}%`}
                              style={{
                                flex: 1, borderRadius: "1px", opacity: 0.65,
                                background: fs.availability_pct >= 60 ? "#22c55e"
                                  : fs.availability_pct >= 25 ? "#eab308" : "#ef4444",
                              }}
                            />
                          ))}
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
