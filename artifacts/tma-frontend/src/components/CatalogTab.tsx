import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchLimits, createStarsInvoice, createCryptoBotInvoice } from "@/api/client";
import { useUserStore } from "@/stores/useUserStore";
import { usePriceStore } from "@/stores/usePriceStore";
import { useStationStore } from "@/stores/useStationStore";
import { useVaultStore } from "@/stores/useVaultStore";
import { useToast } from "@/components/Toast";
import { impact, notify } from "@/lib/haptic";
import type { GasStation, LimitsMap } from "@/types";
import { FUEL_LABELS } from "@/types";

const FUEL_PRICES: Record<string, number> = {
  "АИ-92": 47, "АИ-95": 52, "АИ-95+": 56,
  "АИ-100": 68, "ДТ": 60, "ДТ+": 65, "Газ": 28,
};
const VOLUMES = [20, 40, 60];
const STAR_RUB_RATE = 1.84;
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
interface CatalogTabProps { initialStationId?: number; }

export function CatalogTab({ initialStationId }: CatalogTabProps) {
  const { user } = useUserStore();
  const { stations } = useStationStore();
  useVaultStore();
  const { add: toast } = useToast();
  const getPrice = usePriceStore((s) => s.getPrice);

  const [selectedStation, setSelectedStation] = useState<GasStation | null>(null);
  const [limits, setLimits] = useState<LimitsMap | null>(null);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"name" | "availability" | "queue">("availability");
  const [payMethod, setPayMethod] = useState<PayMethod>("stars");
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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

  // Reset pagination when search/sort changes
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [searchQuery, sortMode]);

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

  // ── Fuel-alias detection ─────────────────────────────────────────────────
  const matchedFuelType = matchFuelAlias(searchQuery);

  const filteredStations = stations
    .filter((s) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();

      // Fuel-type alias search: show stations that carry this fuel
      if (matchedFuelType) {
        return s.fuel_statuses.some((f) => f.fuel_type === matchedFuelType);
      }

      // Text search: name, region, network, address
      return (
        s.name.toLowerCase().includes(q) ||
        s.region.toLowerCase().includes(q) ||
        s.network.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name, "ru");
      if (sortMode === "queue") return a.queue_cars - b.queue_cars;
      const avgA = a.fuel_statuses.length ? a.fuel_statuses.reduce((s, f) => s + f.availability_pct, 0) / a.fuel_statuses.length : 0;
      const avgB = b.fuel_statuses.length ? b.fuel_statuses.reduce((s, f) => s + f.availability_pct, 0) / b.fuel_statuses.length : 0;
      return avgB - avgA;
    });

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

      {/* ── Header ── */}
      <div style={{ padding: "0.75rem 1rem 0.5rem" }}>
        <div style={{
          background: "linear-gradient(160deg, #0d0d18, #0f0820)",
          border: "1px solid #a855f733", borderRadius: "16px",
          padding: "0.9rem 1rem", position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#a855f7,#db2777,transparent)" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#4b5563", fontSize: "0.5rem", letterSpacing: "0.18em", marginBottom: "0.2rem" }}>
                ТЕРМИНАЛ СНАБЖЕНИЯ v2.4
              </div>
              <h2 style={{ margin: 0, color: "#e2e8f0", fontSize: "1.05rem", fontWeight: 800, lineHeight: 1 }}>⛽ Каталог топлива</h2>
              <p style={{ margin: "0.2rem 0 0", color: "#6b7280", fontSize: "0.68rem" }}>
                {stations.length.toLocaleString("ru")} станций · выберите АЗС и тип
              </p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "0.75rem" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e", marginLeft: "auto", marginBottom: "0.25rem" }} />
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#22c55e", fontSize: "0.55rem", letterSpacing: "0.08em" }}>ONLINE</span>
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

      {/* ── Quick fuel-type chips ── */}
      {!selectedStation && !matchedFuelType && (
        <div style={{ padding: "0 1rem 0.5rem", display: "flex", gap: "0.3rem", overflowX: "auto", paddingBottom: "0.5rem" }}>
          {["АИ-92","АИ-95","АИ-95+","ДТ","ДТ+","Газ"].map((ft) => (
            <button key={ft} onClick={() => { impact("light"); setSearchQuery(ft.replace("АИ-","").toLowerCase()); }} style={{
              flexShrink: 0, padding: "0.22rem 0.6rem",
              background: "#0d0d18", border: "1px solid #1e1e2a",
              borderRadius: "6px", color: "#6b7280", fontSize: "0.65rem",
              cursor: "pointer", transition: "border-color 0.15s, color 0.15s",
              fontFamily: "'JetBrains Mono',monospace",
            }}
            onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.borderColor = "#a855f755"; (e.target as HTMLButtonElement).style.color = "#a855f7"; }}
            onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.borderColor = "#1e1e2a"; (e.target as HTMLButtonElement).style.color = "#6b7280"; }}
            >{ft}</button>
          ))}
        </div>
      )}

      {/* ── Sort row ── */}
      <div style={{ padding: "0 1rem 0.5rem", display: "flex", gap: "0.35rem", alignItems: "center" }}>
        <span style={{ color: "#4b5563", fontSize: "0.65rem", marginRight: "0.1rem" }}>Сорт:</span>
        {(["availability", "name", "queue"] as const).map((mode) => (
          <button key={mode} onClick={() => setSortMode(mode)} style={{
            background: sortMode === mode ? "rgba(168,85,247,0.2)" : "none",
            border: `1px solid ${sortMode === mode ? "#a855f7" : "#22222f"}`,
            borderRadius: "6px", color: sortMode === mode ? "#a855f7" : "#6b7280",
            fontSize: "0.67rem", padding: "0.2rem 0.45rem", cursor: "pointer",
          }}>
            {mode === "availability" ? "Наличие" : mode === "name" ? "Назв." : "Очередь"}
          </button>
        ))}
        <span style={{ marginLeft: "auto", color: "#4b5563", fontSize: "0.65rem" }}>
          {filteredStations.length.toLocaleString("ru")} АЗС
        </span>
      </div>

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
                  <motion.div key={s.id} whileTap={{ scale: 0.95 }} onClick={() => setSelectedStation(s)} style={{
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
              <div style={{ width: "64px", height: "64px", borderRadius: "18px", background: "linear-gradient(135deg,#0d0d18,#14141c)", border: "1px solid #a855f722", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem", boxShadow: "0 0 20px #a855f710" }}>🔍</div>
              <div>
                <p style={{ margin: "0 0 0.25rem", color: "#e2e8f0", fontSize: "0.88rem", fontWeight: 700 }}>АЗС не найдены</p>
                <p style={{ margin: 0, color: "#4b5563", fontSize: "0.72rem" }}>Попробуйте изменить запрос или фильтры</p>
              </div>
              <div style={{ background: "#0d0d18", border: "1px solid #1e1e2a", borderRadius: "8px", padding: "0.3rem 0.75rem", fontSize: "0.58rem", fontFamily: "'JetBrains Mono',monospace", color: "#374151" }}>
                SEARCH_RESULT · 0 STATIONS
              </div>
            </div>
          ) : (
            <>
              {visibleStations.map((s) => {
                const hasFuel = s.fuel_statuses.some((f) => f.availability_pct > 0);
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
                    key={s.id} whileTap={{ scale: 0.975 }} onClick={() => setSelectedStation(s)}
                    style={{
                      background: avgAvail < 25 ? "linear-gradient(160deg,#100606,#0d0d14)" : avgAvail >= 60 ? "linear-gradient(160deg,#060f0a,#0d0d14)" : "#0d0d14",
                      border: `1px solid ${avgAvail < 25 ? "#ef444428" : avgAvail >= 60 ? "#22c55e20" : "#1a1a24"}`,
                      borderRadius: "14px", padding: "0.65rem 0.8rem", marginBottom: "0.35rem",
                      cursor: "pointer", position: "relative", overflow: "hidden",
                    }}
                  >
                    <div style={{ position: "absolute", left: 0, top: "15%", bottom: "15%", width: "2px", background: availColor, borderRadius: "0 2px 2px 0", boxShadow: `0 0 6px ${availColor}66` }} />
                    <div style={{ paddingLeft: "0.6rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.3rem" }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ margin: "0 0 0.05rem", color: "#e2e8f0", fontSize: "0.85rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em" }}>
                            {s.name}
                          </p>
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
          <button
            onClick={() => { setSelectedStation(null); setLimits(null); }}
            style={{ background: "none", border: "none", color: "#a855f7", fontSize: "0.82rem", cursor: "pointer", padding: "0.25rem 0", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.3rem" }}
          >← Назад к списку</button>

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
