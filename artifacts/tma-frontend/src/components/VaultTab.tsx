import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVaultStore } from "@/stores/useVaultStore";
import { useUserStore } from "@/stores/useUserStore";
import { useFavoritesStore } from "@/stores/useFavoritesStore";
import { fetchReferral } from "@/api/client";
import type { Purchase, ReferralInfo } from "@/types";
import { FUEL_LABELS, XP_TIER_THRESHOLDS } from "@/types";
import QRCode from "qrcode";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Активен", color: "#22c55e" },
  used: { label: "Использован", color: "#6b7280" },
  expired: { label: "Истёк", color: "#ef4444" },
};

function QRModal({ hash, onClose }: { hash: string; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL(hash, {
      width: 256, margin: 2,
      color: { dark: "#e2e8f0", light: "#14141c" },
    }).then(setDataUrl).catch(() => {});
  }, [hash]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(5,5,7,0.95)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "2rem",
      }}
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.8 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#14141c",
          border: "1px solid #22222f",
          borderRadius: "20px",
          padding: "1.5rem",
          textAlign: "center",
          maxWidth: "300px",
          width: "100%",
        }}
      >
        <p style={{ color: "#9ca3af", fontSize: "0.78rem", margin: "0 0 1rem" }}>
          Предъявите контролёру
        </p>
        {dataUrl ? (
          <img src={dataUrl} alt="QR" style={{ width: "220px", height: "220px", borderRadius: "12px", margin: "0 auto", display: "block" }} />
        ) : (
          <div style={{ width: "220px", height: "220px", background: "#0b0b0f", borderRadius: "12px", margin: "0 auto" }} />
        )}
        <p style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.72rem", color: "#6b7280",
          margin: "0.75rem 0 0", wordBreak: "break-all",
        }}>
          {hash}
        </p>
        <button
          onClick={onClose}
          style={{
            marginTop: "1rem", width: "100%",
            padding: "0.65rem", border: "1px solid #22222f",
            borderRadius: "10px", background: "#0b0b0f",
            color: "#9ca3af", fontSize: "0.85rem", cursor: "pointer",
          }}
        >
          Закрыть
        </button>
      </motion.div>
    </motion.div>
  );
}

function PurchaseCard({ purchase }: { purchase: Purchase }) {
  const [showQr, setShowQr] = useState(false);
  const st = STATUS_LABELS[purchase.status] ?? { label: purchase.status, color: "#6b7280" };
  const date = new Date(purchase.created_at).toLocaleDateString("ru-RU", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <>
      <AnimatePresence>
        {showQr && (
          <QRModal hash={purchase.qr_hash} onClose={() => setShowQr(false)} />
        )}
      </AnimatePresence>

      <motion.div
        whileTap={{ scale: 0.98 }}
        style={{
          background: "#14141c",
          border: "1px solid #22222f",
          borderRadius: "14px",
          padding: "1rem",
          marginBottom: "0.5rem",
          cursor: "pointer",
        }}
        onClick={() => purchase.status === "active" && setShowQr(true)}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
          <div>
            <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "0.9rem" }}>
              {FUEL_LABELS[purchase.fuel_type] ?? purchase.fuel_type} · {purchase.volume}л
            </span>
            <p style={{ margin: "0.1rem 0 0", color: "#6b7280", fontSize: "0.72rem" }}>
              {purchase.station_name ?? "АЗС"} · {purchase.region ?? ""}
            </p>
          </div>
          <span style={{
            background: `${st.color}11`,
            border: `1px solid ${st.color}44`,
            color: st.color,
            borderRadius: "8px",
            padding: "0.2rem 0.5rem",
            fontSize: "0.7rem",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}>
            {st.label}
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.7rem", color: "#4b5563",
          }}>
            {purchase.qr_hash.slice(0, 16)}…
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ color: "#4b5563", fontSize: "0.68rem" }}>{date}</span>
            {purchase.status === "active" && (
              <span style={{
                background: "linear-gradient(135deg,#a855f7,#db2777)",
                borderRadius: "6px", padding: "0.2rem 0.4rem",
                color: "#fff", fontSize: "0.68rem", fontWeight: 600,
              }}>
                QR
              </span>
            )}
          </div>
        </div>

        {purchase.price > 0 && (
          <p style={{ margin: "0.4rem 0 0", color: "#6b7280", fontSize: "0.72rem" }}>
            Оплачено: <span style={{ color: "#a855f7", fontWeight: 600 }}>
              {purchase.price.toLocaleString("ru")} {purchase.currency}
            </span>
          </p>
        )}
      </motion.div>
    </>
  );
}

interface VaultTabProps {
  initialPurchaseId?: number;
}

export function VaultTab({ initialPurchaseId }: VaultTabProps) {
  const { user } = useUserStore();
  const { purchases, loading, fetch } = useVaultStore();
  const [highlightedId, setHighlightedId] = useState<number | undefined>(initialPurchaseId);
  const [referral, setReferral] = useState<ReferralInfo | null>(null);

  // Auto-clear highlight ring after 3 seconds
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (highlightedId) {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => setHighlightedId(undefined), 3000);
    }
    return () => { if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current); };
  }, [highlightedId]);

  useEffect(() => {
    if (user) {
      fetch(user.id);
      fetchReferral(user.id).then(setReferral).catch(() => {});
    }
  }, [user, fetch]);

  const { favoriteRegions, removeFavorite: removeFav } = useFavoritesStore();
  const active = purchases.filter((p) => p.status === "active");
  const history = purchases.filter((p) => p.status !== "active");

  if (!user) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#6b7280" }}>
      Загрузка…
    </div>
  );

  return (
    <div style={{ height: "100%", overflowY: "auto", paddingBottom: "5rem" }}>
      {/* Header */}
      <div style={{ padding: "1rem 1rem 0.5rem" }}>
        <h2 style={{ margin: "0 0 0.15rem", color: "#e2e8f0", fontSize: "1.1rem", fontWeight: 700 }}>
          🗄️ Мой Сейф
        </h2>
        <p style={{ margin: 0, color: "#6b7280", fontSize: "0.75rem" }}>
          Ваучеры и история транзакций
        </p>
      </div>

      {/* Profile card */}
      <div style={{
        margin: "0 1rem 0.75rem",
        background: "#14141c",
        border: "1px solid #22222f",
        borderRadius: "14px",
        padding: "0.85rem",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <div>
            <p style={{ margin: 0, color: "#e2e8f0", fontWeight: 700, fontSize: "0.95rem" }}>
              {user.username ? `@${user.username}` : `#${user.id}`}
            </p>
            <p style={{ margin: 0, color: "#a855f7", fontSize: "0.78rem" }}>{user.level}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{
              margin: 0,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "1.2rem", fontWeight: 700, color: "#a855f7",
            }}>
              {user.xp.toLocaleString("ru")} XP
            </p>
            <p style={{ margin: 0, color: "#4b5563", fontSize: "0.68rem" }}>
              {active.length} активных ваучеров
            </p>
          </div>
        </div>

        {/* XP progress bar toward next tier */}
        {(() => {
          const currentTier = XP_TIER_THRESHOLDS.find(
            (t) => user.xp >= t.min && (t.max === null || user.xp <= t.max)
          );
          const nextTier = currentTier?.max !== null
            ? XP_TIER_THRESHOLDS.find((t) => t.min === (currentTier!.max! + 1))
            : null;
          const pct = currentTier && currentTier.max !== null
            ? Math.min(100, ((user.xp - currentTier.min) / (currentTier.max - currentTier.min)) * 100)
            : 100;
          return (
            <>
              <div style={{ height: "4px", borderRadius: "2px", background: "#0b0b0f", overflow: "hidden", marginBottom: "0.3rem" }}>
                <div style={{
                  height: "100%", width: `${pct}%`,
                  background: "linear-gradient(90deg,#a855f7,#db2777)",
                  boxShadow: "0 0 8px #a855f7", transition: "width 0.8s",
                }} />
              </div>
              {nextTier && (
                <p style={{ margin: 0, color: "#4b5563", fontSize: "0.65rem" }}>
                  До «{nextTier.level}»: {(nextTier.min - user.xp).toLocaleString("ru")} XP
                </p>
              )}
            </>
          );
        })()}

        {/* Referral code */}
        {referral && (
          <div
            onClick={() => navigator.clipboard.writeText(referral.code).catch(() => {})}
            style={{
              marginTop: "0.6rem",
              background: "#050507",
              border: "1px dashed #a855f733",
              borderRadius: "8px",
              padding: "0.4rem 0.6rem",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              cursor: "pointer",
            }}
          >
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              color: "#a855f7", fontSize: "0.78rem", letterSpacing: "0.06em",
            }}>
              {referral.code}
            </span>
            <span style={{ color: "#4b5563", fontSize: "0.65rem" }}>
              реф. код · {referral.uses} приглашений
            </span>
          </div>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
          Загрузка хранилища…
        </div>
      )}

      {/* Active vouchers */}
      {active.length > 0 && (
        <div style={{ padding: "0 1rem 0.5rem" }}>
          <p style={{ color: "#9ca3af", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.5rem" }}>
            Активные ваучеры — {active.length}
          </p>
          {active.map((p) => <PurchaseCard key={p.id} purchase={p} />)}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div style={{ padding: "0 1rem 0.5rem" }}>
          <p style={{ color: "#4b5563", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0.5rem 0 0.5rem" }}>
            История — {history.length}
          </p>
          {history.map((p) => <PurchaseCard key={p.id} purchase={p} />)}
        </div>
      )}

      {/* Favorite regions */}
      {favoriteRegions.length > 0 && (
        <div style={{ padding: "0 1rem 0.75rem" }}>
          <p style={{ color: "#9ca3af", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.5rem" }}>
            ⭐ Избранные регионы — {favoriteRegions.length}
          </p>
          {favoriteRegions.map((region) => (
            <motion.div
              key={region}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{
                background: "#14141c",
                border: "1px solid #a855f720",
                borderRadius: "12px",
                padding: "0.65rem 0.85rem",
                marginBottom: "0.4rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
              }}
            >
              <div>
                <p style={{ margin: 0, color: "#e2e8f0", fontSize: "0.82rem", fontWeight: 600 }}>
                  {region}
                </p>
                <p style={{ margin: "0.1rem 0 0", color: "#6b7280", fontSize: "0.68rem" }}>
                  Отслеживается · Мониторинг доступности
                </p>
              </div>
              <button
                onClick={() => removeFav(region)}
                style={{
                  background: "none", border: "1px solid #22222f",
                  borderRadius: "8px", color: "#6b7280",
                  fontSize: "0.72rem", padding: "0.3rem 0.5rem",
                  cursor: "pointer", flexShrink: 0,
                }}
              >
                ✕
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && purchases.length === 0 && favoriteRegions.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem 2rem", color: "#4b5563" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🗄️</div>
          <p style={{ fontSize: "0.85rem" }}>Ваш сейф пуст. Оформите первый ваучер в каталоге.</p>
        </div>
      )}
    </div>
  );
}
