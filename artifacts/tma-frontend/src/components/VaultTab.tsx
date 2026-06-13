import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVaultStore } from "@/stores/useVaultStore";
import { useUserStore } from "@/stores/useUserStore";
import { useFavoritesStore } from "@/stores/useFavoritesStore";
import { fetchReferral, fetchAchievements, fetchUserSubscriptions, unsubscribeFromStation, fetchCreditsBalance } from "@/api/client";
import type { Achievement } from "@/api/client";
import type { Purchase, ReferralInfo, Subscription, CreditTx } from "@/types";
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
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [showAllAch, setShowAllAch] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [showAllSubs, setShowAllSubs] = useState(false);
  const [creditHistory, setCreditHistory] = useState<CreditTx[]>([]);
  const [showCreditHistory, setShowCreditHistory] = useState(false);

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
      fetchAchievements(user.id).then((d) => setAchievements(d.achievements)).catch(() => {});
      fetchUserSubscriptions(user.id).then((d) => setSubscriptions(d.subscriptions)).catch(() => {});
      fetchCreditsBalance(user.id).then((d) => setCreditHistory(d.history)).catch(() => {});
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
        const tierIdx = XP_TIER_THRESHOLDS.findIndex(t => t === currentTier);
        const tierColor = tierIdx >= 5 ? "#f59e0b" : tierIdx >= 3 ? "#db2777" : "#a855f7";
        return (
          <div style={{
            margin: "0 1rem 0.75rem",
            background: "linear-gradient(135deg, #14141c, #1a0d22)",
            border: `1px solid ${tierColor}33`,
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: `0 0 20px ${tierColor}18`,
          }}>
            {/* Top gradient bar */}
            <div style={{ height: "3px", background: `linear-gradient(90deg, ${tierColor}88, ${tierColor}, #db2777)` }} />

            <div style={{ padding: "0.9rem 1rem 0.75rem" }}>
              {/* User row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.6rem" }}>
                <div>
                  <p style={{ margin: "0 0 0.15rem", color: "#e2e8f0", fontWeight: 700, fontSize: "1rem" }}>
                    {user.username ? `@${user.username}` : `Пользователь #${user.id}`}
                  </p>
                  <span style={{
                    background: `${tierColor}22`, border: `1px solid ${tierColor}44`,
                    borderRadius: "6px", padding: "0.1rem 0.5rem",
                    color: tierColor, fontSize: "0.72rem", fontWeight: 700,
                  }}>
                    {currentTier?.level ?? user.level}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{
                    margin: 0,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "1.5rem", fontWeight: 700, color: tierColor,
                    lineHeight: 1, textShadow: `0 0 12px ${tierColor}66`,
                  }}>
                    {user.xp.toLocaleString("ru")}
                  </p>
                  <p style={{ margin: 0, color: "#4b5563", fontSize: "0.62rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>XP</p>
                </div>
              </div>

              {/* XP progress bar */}
              <div style={{ marginBottom: "0.35rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                  <span style={{ color: "#4b5563", fontSize: "0.62rem" }}>
                    {currentTier?.level ?? "—"}
                  </span>
                  <span style={{ color: "#4b5563", fontSize: "0.62rem" }}>
                    {nextTier ? nextTier.level : "MAX"}
                  </span>
                </div>
                <div style={{ height: "5px", borderRadius: "2.5px", background: "#0b0b0f", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${pct}%`,
                    background: `linear-gradient(90deg, ${tierColor}88, ${tierColor})`,
                    boxShadow: `0 0 8px ${tierColor}`, transition: "width 0.8s",
                  }} />
                </div>
                {nextTier && (
                  <p style={{ margin: "0.2rem 0 0", color: "#374151", fontSize: "0.6rem" }}>
                    До «{nextTier.level}»: <span style={{ color: tierColor }}>{(nextTier.min - user.xp).toLocaleString("ru")} XP</span>
                  </p>
                )}
              </div>

              {/* Stats row */}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <div style={{ flex: 1, background: "#0b0b0f", borderRadius: "8px", padding: "0.4rem", textAlign: "center" }}>
                  <p style={{ margin: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: "1rem", fontWeight: 700, color: "#a855f7" }}>
                    {active.length}
                  </p>
                  <p style={{ margin: 0, color: "#374151", fontSize: "0.58rem" }}>ваучеров</p>
                </div>
                <div style={{ flex: 1, background: "#0b0b0f", borderRadius: "8px", padding: "0.4rem", textAlign: "center" }}>
                  <p style={{ margin: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: "1rem", fontWeight: 700, color: "#22c55e" }}>
                    {purchases.length}
                  </p>
                  <p style={{ margin: 0, color: "#374151", fontSize: "0.58rem" }}>всего покупок</p>
                </div>
                {user.neurocredits > 0 && (
                  <div style={{ flex: 1, background: "#0b0b0f", borderRadius: "8px", padding: "0.4rem", textAlign: "center" }}>
                    <p style={{ margin: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: "1rem", fontWeight: 700, color: "#db2777" }}>
                      {user.neurocredits}
                    </p>
                    <p style={{ margin: 0, color: "#374151", fontSize: "0.58rem" }}>NC</p>
                  </div>
                )}
                {user.checkin_streak && user.checkin_streak > 0 ? (
                  <div style={{ flex: 1, background: "#0b0b0f", borderRadius: "8px", padding: "0.4rem", textAlign: "center" }}>
                    <p style={{ margin: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: "1rem", fontWeight: 700, color: "#f59e0b" }}>
                      {user.checkin_streak}🔥
                    </p>
                    <p style={{ margin: 0, color: "#374151", fontSize: "0.58rem" }}>стрик</p>
                  </div>
                ) : null}
              </div>

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
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#a855f7", fontSize: "0.78rem", letterSpacing: "0.06em" }}>
                    {referral.code}
                  </span>
                  <span style={{ color: "#4b5563", fontSize: "0.65rem" }}>
                    реф. код · {referral.uses} приглашений
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

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

      {/* Subscriptions */}
      {subscriptions.length > 0 && (
        <div style={{ padding: "0 1rem 0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <p style={{ margin: 0, color: "#9ca3af", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              🔔 Подписки на АЗС — {subscriptions.length}
            </p>
            {subscriptions.length > 3 && (
              <button
                onClick={() => setShowAllSubs(!showAllSubs)}
                style={{ background: "none", border: "none", color: "#a855f7", fontSize: "0.7rem", cursor: "pointer", padding: 0 }}
              >
                {showAllSubs ? "Скрыть" : "Все"}
              </button>
            )}
          </div>
          {(showAllSubs ? subscriptions : subscriptions.slice(0, 3)).map((sub) => (
            <motion.div
              key={sub.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: "#14141c",
                border: "1px solid #22222f",
                borderRadius: "10px",
                padding: "0.55rem 0.75rem",
                marginBottom: "0.4rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, color: "#e2e8f0", fontSize: "0.78rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {sub.station_name}
                </p>
                <p style={{ margin: 0, color: "#6b7280", fontSize: "0.65rem" }}>
                  {sub.station_region}{sub.fuel_type ? ` · ${sub.fuel_type}` : ""}
                </p>
              </div>
              <button
                onClick={() => {
                  unsubscribeFromStation(sub.id, sub.user_id)
                    .then(() => setSubscriptions((prev) => prev.filter((s) => s.id !== sub.id)))
                    .catch(() => {});
                }}
                style={{
                  background: "none",
                  border: "1px solid #ef444420",
                  borderRadius: "6px",
                  color: "#ef4444",
                  fontSize: "0.65rem",
                  padding: "0.25rem 0.45rem",
                  cursor: "pointer",
                  flexShrink: 0,
                  marginLeft: "0.5rem",
                }}
              >
                ✕
              </button>
            </motion.div>
          ))}
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

      {/* Achievements section */}
      {achievements.length > 0 && (
        <div style={{ padding: "0 1rem 0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <p style={{ margin: 0, color: "#9ca3af", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              🏆 Достижения — {achievements.filter(a => a.unlocked).length}/{achievements.length}
            </p>
            <button
              onClick={() => setShowAllAch(!showAllAch)}
              style={{ background: "none", border: "none", color: "#a855f7", fontSize: "0.7rem", cursor: "pointer", padding: 0 }}
            >
              {showAllAch ? "Скрыть" : "Все"}
            </button>
          </div>

          {/* Progress bar for achievements */}
          <div style={{ height: "3px", background: "#0b0b0f", borderRadius: "2px", marginBottom: "0.65rem", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${(achievements.filter(a => a.unlocked).length / achievements.length) * 100}%`,
              background: "linear-gradient(90deg,#a855f7,#db2777)",
              transition: "width 0.6s",
            }} />
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "0.4rem",
          }}>
            {(showAllAch ? achievements : achievements.filter(a => a.unlocked).slice(0, 6)).map((ach) => (
              <motion.div
                key={ach.code}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  background: ach.unlocked ? "#14141c" : "#0b0b0f",
                  border: `1px solid ${ach.unlocked ? "#a855f730" : "#22222f"}`,
                  borderRadius: "10px",
                  padding: "0.55rem 0.7rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  opacity: ach.unlocked ? 1 : 0.4,
                }}
              >
                <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>{ach.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, color: ach.unlocked ? "#e2e8f0" : "#6b7280", fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {ach.label}
                  </p>
                  <p style={{ margin: 0, color: "#4b5563", fontSize: "0.62rem" }}>
                    +{ach.xp_bonus} XP
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {!showAllAch && achievements.filter(a => a.unlocked).length === 0 && (
            <p style={{ color: "#4b5563", fontSize: "0.75rem", textAlign: "center", padding: "0.5rem 0" }}>
              Выполняйте действия в приложении, чтобы разблокировать достижения.
            </p>
          )}
        </div>
      )}

      {/* NC Credit History */}
      {creditHistory.length > 0 && (
        <div style={{ padding: "0 1rem 0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.45rem" }}>
            <p style={{ margin: 0, color: "#9ca3af", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              ⬡ История НейроКредитов
            </p>
            <button
              onClick={() => setShowCreditHistory(!showCreditHistory)}
              style={{ background: "none", border: "none", color: "#db2777", fontSize: "0.7rem", cursor: "pointer", padding: 0 }}
            >
              {showCreditHistory ? "Скрыть" : "Показать"}
            </button>
          </div>
          {showCreditHistory && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              {creditHistory.slice(0, 10).map((tx, i) => {
                const t = tx.created_at ? new Date(tx.created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
                return (
                  <div key={i} style={{
                    background: "#0b0b0f", border: "1px solid #1a1a24", borderRadius: "8px",
                    padding: "0.35rem 0.65rem", display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <p style={{ margin: 0, color: "#d1d5db", fontSize: "0.73rem" }}>{tx.reason}</p>
                      {t && <p style={{ margin: 0, color: "#374151", fontSize: "0.6rem" }}>{t}</p>}
                    </div>
                    <p style={{ margin: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: "0.82rem", fontWeight: 700, color: tx.delta >= 0 ? "#db2777" : "#ef4444", flexShrink: 0 }}>
                      {tx.delta >= 0 ? "+" : ""}{tx.delta} NC
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!loading && purchases.length === 0 && favoriteRegions.length === 0 && subscriptions.length === 0 && achievements.filter(a => a.unlocked).length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem 2rem", color: "#4b5563" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🗄️</div>
          <p style={{ fontSize: "0.85rem" }}>Ваш сейф пуст. Оформите первый ваучер в каталоге.</p>
        </div>
      )}
    </div>
  );
}
