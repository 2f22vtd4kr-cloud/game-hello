import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { purchaseVoucher, fetchLimits } from "@/api/client";
import { useUserStore } from "@/stores/useUserStore";
import { useStationStore } from "@/stores/useStationStore";
import { useVaultStore } from "@/stores/useVaultStore";
import { useToast } from "@/components/Toast";
import type { GasStation, LimitsMap } from "@/types";
import { FUEL_LABELS } from "@/types";

const FUEL_PRICES: Record<string, number> = {
  "АИ-92": 47, "АИ-95": 52, "АИ-95+": 56,
  "АИ-100": 68, "ДТ": 60, "ДТ+": 65, "Газ": 28,
};
const VOLUMES = [20, 40, 60];

function BlockOverlay({ reason, onClose }: { reason: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(5,5,7,0.95)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "2rem", textAlign: "center",
      }}
    >
      <motion.div
        initial={{ scale: 0.85 }}
        animate={{ scale: 1 }}
        style={{
          background: "#14141c",
          border: "1px solid #ef444444",
          borderRadius: "20px",
          padding: "2rem",
          maxWidth: "320px",
        }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</div>
        <h3 style={{ color: "#ef4444", fontSize: "1rem", margin: "0 0 0.75rem", fontWeight: 700 }}>
          Шлюз временно недоступен
        </h3>
        <p style={{ color: "#9ca3af", fontSize: "0.82rem", margin: "0 0 1.5rem", lineHeight: 1.5 }}>
          {reason}
        </p>
        <button
          onClick={onClose}
          style={{
            background: "linear-gradient(135deg,#a855f7,#db2777)",
            color: "#fff", border: "none", borderRadius: "12px",
            padding: "0.75rem 2rem", cursor: "pointer",
            fontSize: "0.9rem", fontWeight: 600,
            width: "100%",
          }}
        >
          Понятно
        </button>
      </motion.div>
    </motion.div>
  );
}

function FuelItem({
  fuelType,
  station,
  limits,
  userId,
  onBuy,
}: {
  fuelType: string;
  station: GasStation;
  limits: LimitsMap | null;
  userId: number;
  onBuy: (fuelType: string, volume: number) => Promise<void>;
}) {
  const [volume, setVolume] = useState(20);
  const [buying, setBuying] = useState(false);

  const limit = limits?.[fuelType];
  const pricePerL = FUEL_PRICES[fuelType] ?? 50;
  const totalPrice = pricePerL * volume;
  const remaining = limit?.remaining ?? Infinity;
  const withinLimit = volume <= remaining;

  const fuelStatus = station.fuel_statuses.find((f) => f.fuel_type === fuelType);
  const available = fuelStatus && fuelStatus.availability_pct > 0;

  const statusColor = !available
    ? "#ef4444"
    : fuelStatus.availability_pct >= 60
    ? "#22c55e"
    : "#eab308";

  const doVolume = (delta: number) => {
    const idx = VOLUMES.indexOf(volume);
    const next = VOLUMES[Math.max(0, Math.min(VOLUMES.length - 1, idx + delta))];
    if (next !== undefined) setVolume(next);
  };

  const handleBuy = async () => {
    if (buying || !withinLimit || !available) return;
    setBuying(true);
    try {
      await onBuy(fuelType, volume);
    } finally {
      setBuying(false);
    }
  };

  return (
    <motion.div
      layout
      style={{
        background: "#14141c",
        border: "1px solid #22222f",
        borderRadius: "14px",
        padding: "0.85rem",
        marginBottom: "0.5rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: statusColor, boxShadow: `0 0 6px ${statusColor}`,
          }} />
          <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "0.9rem" }}>
            {FUEL_LABELS[fuelType] ?? fuelType}
          </span>
        </div>
        <span style={{
          color: "#a855f7",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.85rem",
          fontWeight: 600,
        }}>
          {pricePerL} ₽/л
        </span>
      </div>

      {/* Limit info */}
      {limit && (
        <div style={{ marginBottom: "0.6rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
            <span style={{ color: "#6b7280", fontSize: "0.7rem" }}>Суточный лимит</span>
            <span style={{ color: remaining > 0 ? "#9ca3af" : "#ef4444", fontSize: "0.7rem" }}>
              {limit.used}л / {limit.max}л
            </span>
          </div>
          <div style={{ height: "4px", borderRadius: "2px", background: "#0b0b0f", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${Math.min(100, (limit.used / limit.max) * 100)}%`,
              background: limit.used >= limit.max ? "#ef4444" : "#a855f7",
              transition: "width 0.5s",
            }} />
          </div>
        </div>
      )}

      {/* Volume selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
        {VOLUMES.map((v) => (
          <button
            key={v}
            disabled={!withinLimit && v > remaining}
            onClick={() => setVolume(v)}
            style={{
              flex: 1,
              padding: "0.35rem",
              border: `1px solid ${volume === v ? "#a855f7" : "#22222f"}`,
              borderRadius: "8px",
              background: volume === v ? "#a855f722" : "#0b0b0f",
              color: volume === v ? "#a855f7" : "#9ca3af",
              fontSize: "0.78rem",
              cursor: (withinLimit || v <= remaining) ? "pointer" : "not-allowed",
              opacity: (!withinLimit && v > remaining) ? 0.4 : 1,
            }}
          >
            {v}л
          </button>
        ))}
      </div>

      {!withinLimit && (
        <p style={{ color: "#eab308", fontSize: "0.72rem", margin: "0 0 0.5rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
          ⚠️ Превышен суточный лимит отпуска для данного региона.
        </p>
      )}

      {/* Buy button */}
      <button
        disabled={buying || !withinLimit || !available}
        onClick={handleBuy}
        style={{
          width: "100%",
          padding: "0.65rem",
          background: (!withinLimit || !available)
            ? "#22222f"
            : "linear-gradient(135deg,#a855f7,#db2777)",
          color: (!withinLimit || !available) ? "#4b5563" : "#fff",
          border: "none", borderRadius: "10px",
          fontSize: "0.85rem", fontWeight: 600,
          cursor: (!withinLimit || !available || buying) ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
        }}
      >
        {buying ? (
          <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
        ) : !available ? (
          "Нет в наличии"
        ) : !withinLimit ? (
          "Лимит исчерпан"
        ) : (
          <>⛽ Купить ваучер — {totalPrice.toLocaleString("ru")} ₽</>
        )}
      </button>
    </motion.div>
  );
}

interface CatalogTabProps {
  /** Station to pre-select (from deep-link startParam) */
  initialStationId?: number;
}

export function CatalogTab({ initialStationId }: CatalogTabProps) {
  const { user } = useUserStore();
  const { stations } = useStationStore();
  const { addPurchase } = useVaultStore();
  const { add: toast } = useToast();

  const [selectedStation, setSelectedStation] = useState<GasStation | null>(null);

  // Honor deep-link pre-selection once stations are available
  useEffect(() => {
    if (initialStationId && stations.length > 0 && !selectedStation) {
      const found = stations.find((s) => s.id === initialStationId) ?? null;
      if (found) setSelectedStation(found);
    }
  }, [initialStationId, stations, selectedStation]);
  const [limits, setLimits] = useState<LimitsMap | null>(null);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStations = stations.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.region.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.network.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (!user || !selectedStation) return;
    fetchLimits(user.id, selectedStation.zone_type)
      .then(setLimits)
      .catch(() => {});
  }, [user, selectedStation]);

  const handleBuy = async (fuelType: string, volume: number) => {
    if (!user || !selectedStation) return;
    try {
      const result = await purchaseVoucher(user.id, fuelType, volume, selectedStation.id);
      if (result.blocked) {
        setBlockReason(result.block_reason ?? "Шлюз временно недоступен.");
        return;
      }
      if (result.purchase) {
        addPurchase(result.purchase);
        toast(`✓ Ваучер получен! QR: ${result.purchase.qr_hash.slice(0, 12)}…`, "success");
        // refresh limits
        fetchLimits(user.id, selectedStation.zone_type).then(setLimits).catch(() => {});
      }
    } catch (e: unknown) {
      toast(String(e), "error");
    }
  };

  if (!user) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#6b7280" }}>
      Загрузка профиля…
    </div>
  );

  return (
    <div style={{ height: "100%", overflowY: "auto", paddingBottom: "5rem" }}>
      <AnimatePresence>
        {blockReason && (
          <BlockOverlay reason={blockReason} onClose={() => setBlockReason(null)} />
        )}
      </AnimatePresence>

      {/* Header */}
      <div style={{ padding: "1rem 1rem 0.5rem" }}>
        <h2 style={{ margin: "0 0 0.2rem", color: "#e2e8f0", fontSize: "1.1rem", fontWeight: 700 }}>
          ⛽ Каталог топлива
        </h2>
        <p style={{ margin: 0, color: "#6b7280", fontSize: "0.75rem" }}>
          Выберите АЗС и оформите ваучер
        </p>
      </div>

      {/* Search */}
      <div style={{ padding: "0.5rem 1rem" }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск по сети, региону…"
          style={{
            width: "100%", boxSizing: "border-box",
            background: "#14141c", border: "1px solid #22222f",
            borderRadius: "10px", color: "#e2e8f0",
            padding: "0.6rem 0.75rem", fontSize: "0.85rem",
            outline: "none",
          }}
        />
      </div>

      {!selectedStation ? (
        /* Station list */
        <div style={{ padding: "0 1rem" }}>
          {filteredStations.slice(0, 50).map((s) => {
            const hasFuel = s.fuel_statuses.some((f) => f.availability_pct > 0);
            return (
              <motion.div
                key={s.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedStation(s)}
                style={{
                  background: "#14141c",
                  border: "1px solid #22222f",
                  borderRadius: "12px",
                  padding: "0.75rem",
                  marginBottom: "0.5rem",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <p style={{ margin: "0 0 0.15rem", color: "#e2e8f0", fontSize: "0.88rem", fontWeight: 600 }}>
                    {s.name}
                  </p>
                  <p style={{ margin: "0 0 0.1rem", color: "#6b7280", fontSize: "0.72rem" }}>
                    {s.region}
                  </p>
                  <p style={{ margin: 0, color: "#4b5563", fontSize: "0.7rem" }}>{s.address}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{
                    color: hasFuel ? "#22c55e" : "#ef4444",
                    fontSize: "0.7rem",
                    background: hasFuel ? "#22c55e11" : "#ef444411",
                    border: `1px solid ${hasFuel ? "#22c55e44" : "#ef444444"}`,
                    borderRadius: "6px",
                    padding: "0.2rem 0.4rem",
                    display: "block",
                    marginBottom: "0.3rem",
                  }}>
                    {hasFuel ? "Есть" : "Нет"}
                  </span>
                  <span style={{ color: "#6b7280", fontSize: "0.68rem" }}>
                    🚗 {s.queue_cars}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* Fuel catalog for selected station */
        <div style={{ padding: "0 1rem" }}>
          <button
            onClick={() => { setSelectedStation(null); setLimits(null); }}
            style={{
              background: "none", border: "none", color: "#a855f7",
              fontSize: "0.82rem", cursor: "pointer",
              padding: "0.25rem 0", marginBottom: "0.5rem",
              display: "flex", alignItems: "center", gap: "0.3rem",
            }}
          >
            ← Назад к списку
          </button>

          <div style={{
            background: "#0b0b0f",
            border: "1px solid #22222f",
            borderRadius: "12px",
            padding: "0.75rem",
            marginBottom: "0.75rem",
          }}>
            <p style={{ margin: "0 0 0.1rem", color: "#e2e8f0", fontWeight: 600, fontSize: "0.9rem" }}>
              {selectedStation.name}
            </p>
            <p style={{ margin: "0", color: "#6b7280", fontSize: "0.75rem" }}>
              {selectedStation.region} · {selectedStation.address}
            </p>
          </div>

          {selectedStation.fuel_statuses.length === 0 ? (
            <p style={{ color: "#6b7280", textAlign: "center", padding: "2rem 0" }}>
              Нет данных по топливу на этой АЗС
            </p>
          ) : (
            selectedStation.fuel_statuses.map((fs) => (
              <FuelItem
                key={fs.fuel_type}
                fuelType={fs.fuel_type}
                station={selectedStation}
                limits={limits}
                userId={user.id}
                onBuy={handleBuy}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
