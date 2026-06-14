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
  const [copied, setCopied] = useState(false);
  const now = new Date();

  useEffect(() => {
    QRCode.toDataURL(hash, {
      width: 300, margin: 2,
      color: { dark: "#0f0f0f", light: "#f0f0f4" },
    }).then(setDataUrl).catch(() => {});
  }, [hash]);

  const handleCopy = () => {
    navigator.clipboard.writeText(hash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(3,3,8,0.97)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      {/* Scan line */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(168,85,247,0.02) 3px,rgba(168,85,247,0.02) 4px)" }} />
      <motion.div
        initial={{ scale: 0.85, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(160deg, #0d0d18, #120820)",
          border: "1px solid #a855f755",
          borderRadius: "24px",
          padding: "1.5rem",
          textAlign: "center",
          maxWidth: "320px",
          width: "100%",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 0 60px #a855f722, 0 0 120px #db277711",
        }}
      >
        {/* Top glow */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, #a855f7, #db2777, transparent)" }} />

        {/* Header */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a855f7", fontSize: "0.5rem", letterSpacing: "0.2em", marginBottom: "0.25rem" }}>
            МАТРИЦА СНАБЖЕНИЯ · ТОПЛИВНЫЙ ВАУЧЕР
          </div>
          <p style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "0.9rem", margin: 0 }}>
            Предъявите QR контролёру
          </p>
          <p style={{ color: "#4b5563", fontSize: "0.62rem", margin: "0.2rem 0 0" }}>
            {now.toLocaleDateString("ru", { day: "2-digit", month: "long", year: "numeric" })} · {now.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        {/* QR code with glow frame */}
        <div style={{ position: "relative", display: "inline-block", margin: "0 auto" }}>
          <div style={{
            width: "236px", height: "236px", margin: "0 auto",
            borderRadius: "16px", overflow: "hidden",
            border: "2px solid #a855f744",
            boxShadow: "0 0 30px #a855f730, inset 0 0 20px #a855f710",
            position: "relative",
          }}>
            {dataUrl ? (
              <img src={dataUrl} alt="QR" style={{ width: "100%", height: "100%", display: "block" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "#0b0b0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }} style={{ fontSize: "1.5rem" }}>⟳</motion.div>
              </div>
            )}
          </div>
          {/* Corner accents */}
          {[["top:0,left:0,borderTopWidth:2px,borderLeftWidth:2px", "tl"], ["top:0,right:0,borderTopWidth:2px,borderRightWidth:2px", "tr"], ["bottom:0,left:0,borderBottomWidth:2px,borderLeftWidth:2px", "bl"], ["bottom:0,right:0,borderBottomWidth:2px,borderRightWidth:2px", "br"]].map(([, k]) => (
            <div key={k} style={{ position: "absolute", width: "16px", height: "16px", borderColor: "#a855f7", borderStyle: "solid", borderWidth: 0, ...(k === "tl" ? { top: 0, left: 0, borderTopWidth: "2px", borderLeftWidth: "2px", borderTopLeftRadius: "4px" } : k === "tr" ? { top: 0, right: 0, borderTopWidth: "2px", borderRightWidth: "2px", borderTopRightRadius: "4px" } : k === "bl" ? { bottom: 0, left: 0, borderBottomWidth: "2px", borderLeftWidth: "2px", borderBottomLeftRadius: "4px" } : { bottom: 0, right: 0, borderBottomWidth: "2px", borderRightWidth: "2px", borderBottomRightRadius: "4px" }) }} />
          ))}
        </div>

        {/* Hash */}
        <div
          onClick={handleCopy}
          style={{
            margin: "0.9rem 0 0", padding: "0.5rem 0.75rem",
            background: "#0b0b0f", border: "1px solid #1e1e2a",
            borderRadius: "8px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "0.5rem",
            transition: "border-color 0.2s",
          }}
        >
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.62rem", color: "#4b5563", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {hash}
          </span>
          <span style={{ fontSize: "0.7rem", color: copied ? "#22c55e" : "#6b7280", flexShrink: 0 }}>
            {copied ? "✓" : "⎘"}
          </span>
        </div>
        <p style={{ color: "#374151", fontSize: "0.55rem", margin: "0.3rem 0 1rem" }}>
          {copied ? "Скопировано!" : "Нажмите, чтобы скопировать хэш"}
        </p>

        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "0.7rem",
            background: "linear-gradient(135deg,#a855f7,#db2777)",
            border: "none", borderRadius: "12px",
            color: "#fff", fontSize: "0.85rem", fontWeight: 700,
            cursor: "pointer", boxShadow: "0 0 16px #a855f740",
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
        whileTap={{ scale: 0.985 }}
        style={{
          background: purchase.status === "active"
            ? "linear-gradient(160deg,#0d0d18,#120820)"
            : "#0b0b0f",
          border: `1px solid ${purchase.status === "active" ? "#a855f740" : "#1a1a24"}`,
          borderRadius: "16px",
          padding: "0.85rem 1rem",
          marginBottom: "0.45rem",
          cursor: purchase.status === "active" ? "pointer" : "default",
          position: "relative",
          overflow: "hidden",
          boxShadow: purchase.status === "active" ? "0 0 20px #a855f718" : "none",
        }}
        onClick={() => purchase.status === "active" && setShowQr(true)}
      >
        {purchase.status === "active" && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#a855f7,#db2777,transparent)" }} />
        )}

        {/* Top row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.45rem" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ color: purchase.status === "active" ? "#e2e8f0" : "#6b7280", fontWeight: 700, fontSize: "0.88rem" }}>
                {FUEL_LABELS[purchase.fuel_type] ?? purchase.fuel_type}
              </span>
              <span style={{
                fontFamily: "'JetBrains Mono',monospace",
                color: "#a855f7", fontSize: "0.75rem", fontWeight: 700,
              }}>
                {purchase.volume}л
              </span>
            </div>
            <p style={{ margin: "0.15rem 0 0", color: "#4b5563", fontSize: "0.68rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              ⛽ {purchase.station_name ?? "АЗС"} · {purchase.region ?? ""}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.2rem", marginLeft: "0.5rem", flexShrink: 0 }}>
            <span style={{
              background: `${st.color}15`,
              border: `1px solid ${st.color}40`,
              color: st.color,
              borderRadius: "6px",
              padding: "0.15rem 0.45rem",
              fontSize: "0.65rem", fontWeight: 700,
            }}>
              {st.label}
            </span>
            {purchase.status === "active" && (
              <span style={{
                background: "linear-gradient(135deg,#a855f7,#db2777)",
                borderRadius: "6px", padding: "0.12rem 0.4rem",
                color: "#fff", fontSize: "0.6rem", fontWeight: 700,
                boxShadow: "0 0 8px #a855f740",
              }}>
                📱 ПОКАЗАТЬ QR
              </span>
            )}
          </div>
        </div>

        {/* Bottom row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: "0.6rem", color: "#374151",
          }}>
            {purchase.qr_hash.slice(0, 20)}…
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {purchase.price > 0 && (
              <span style={{ color: "#a855f7", fontSize: "0.65rem", fontWeight: 600 }}>
                {purchase.price.toLocaleString("ru")} {purchase.currency}
              </span>
            )}
            <span style={{ color: "#374151", fontSize: "0.62rem" }}>{date}</span>
          </div>
        </div>
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
      <div style={{ padding: "0.75rem 1rem 0.5rem" }}>
        <div style={{
          background: "linear-gradient(160deg,#0d0d18,#0f0b1a)",
          border: "1px solid #db277722",
          borderRadius: "16px",
          padding: "0.85rem 1rem",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#db2777,#a855f7,transparent)" }} />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "100%", pointerEvents: "none", opacity: 0.02, backgroundImage: "linear-gradient(#db2777 1px, transparent 1px), linear-gradient(90deg, #db2777 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#4b5563", fontSize: "0.5rem", letterSpacing: "0.18em", marginBottom: "0.2rem" }}>
                VAULT_TERMINAL · v4.2
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.15rem" }}>
                <span style={{ fontSize: "1rem" }}>🗄️</span>
                <h2 style={{ margin: 0, color: "#e2e8f0", fontSize: "1.05rem", fontWeight: 800, lineHeight: 1 }}>
                  Мой Сейф
                </h2>
              </div>
              <p style={{ margin: 0, color: "#4b5563", fontSize: "0.62rem" }}>
                {active.length} активных ваучеров · {history.length} использовано
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
              <div style={{ background: "#0d1f0d", border: "1px solid #22c55e44", borderRadius: "8px", padding: "0.2rem 0.5rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e", display: "inline-block", animation: "tmaPulse 2s infinite" }} />
                <span style={{ color: "#22c55e", fontSize: "0.58rem", fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>ONLINE</span>
              </div>
              {purchases.length > 0 && (
                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#db2777", fontSize: "0.55rem" }}>
                  {purchases.length} ордеров
                </span>
              )}
            </div>
          </div>
        </div>
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
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.18rem" }}>ПРОФИЛЬ_ОПЕРАТОРА · XP</div>
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
        <div style={{ padding: "0 1rem 1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: "70px", borderRadius: "14px", background: "linear-gradient(90deg,#14141c 25%,#1e1e2a 50%,#14141c 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
          ))}
        </div>
      )}

      {/* Active vouchers */}
      {active.length > 0 && (
        <div style={{ padding: "0 1rem 0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 0.5rem" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e", animation: "tmaPulse 2s infinite", flexShrink: 0 }} />
            <p style={{ color: "#22c55e", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
              Активные ваучеры · {active.length}
            </p>
          </div>
          {active.map((p) => <PurchaseCard key={p.id} purchase={p} />)}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div style={{ padding: "0 1rem 0.5rem" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.1rem", marginTop: "0.5rem" }}>АРХИВ_ОРДЕРОВ · ИСТОРИЯ</div>
          <p style={{ color: "#374151", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.5rem", fontFamily: "'JetBrains Mono',monospace" }}>
            История · {history.length} ордеров
          </p>
          {history.map((p) => <PurchaseCard key={p.id} purchase={p} />)}
        </div>
      )}

      {/* Subscriptions */}
      {subscriptions.length > 0 && (
        <div style={{ padding: "0 1rem 0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.46rem", letterSpacing: "0.14em", marginBottom: "0.1rem" }}>МОНИТОРИНГ_АЗС · АКТИВНЫЕ</div>
              <p style={{ margin: 0, color: "#a855f7", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                🔔 Подписки · {subscriptions.length} АЗС
              </p>
            </div>
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
          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.1rem" }}>ИЗБРАННЫЕ_РЕГИОНЫ · МОНИТОРИНГ</div>
          <p style={{ color: "#eab308", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.5rem", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
            ⭐ Мониторинг · {favoriteRegions.length} регионов
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
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.1rem" }}>ДОСТИЖЕНИЯ_СИСТЕМЫ · РАЗБЛОКИРОВАНО</div>
              <p style={{ margin: 0, color: "#f59e0b", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                🏆 Достижения · {achievements.filter(a => a.unlocked).length}/{achievements.length}
              </p>
            </div>
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

          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {(showAllAch ? achievements : [...achievements.filter(a => a.unlocked), ...achievements.filter(a => !a.unlocked)].slice(0, 8)).map((ach, i) => (
              <motion.div
                key={ach.code}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                style={{
                  background: ach.unlocked
                    ? "linear-gradient(135deg,#14141c,#1a0d22)"
                    : "#0b0b0f",
                  border: `1px solid ${ach.unlocked ? "#a855f740" : "#1a1a24"}`,
                  borderRadius: "12px",
                  padding: "0.6rem 0.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  opacity: ach.unlocked ? 1 : 0.35,
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: ach.unlocked ? "0 0 16px #a855f715" : "none",
                }}
              >
                {ach.unlocked && (
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#a855f766,transparent)" }} />
                )}
                <div style={{
                  width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0,
                  background: ach.unlocked ? "rgba(168,85,247,0.15)" : "#14141c",
                  border: `1px solid ${ach.unlocked ? "#a855f740" : "#22222f"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.1rem",
                  boxShadow: ach.unlocked ? "0 0 12px #a855f730" : "none",
                }}>
                  {ach.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, color: ach.unlocked ? "#e2e8f0" : "#4b5563", fontSize: "0.75rem", fontWeight: 700 }}>
                    {ach.label}
                  </p>
                  <p style={{ margin: 0, color: ach.unlocked ? "#a855f7" : "#374151", fontSize: "0.62rem" }}>
                    +{ach.xp_bonus} XP {!ach.unlocked && "· заблокировано"}
                  </p>
                </div>
                {ach.unlocked && (
                  <span style={{
                    flexShrink: 0, background: "#a855f722", border: "1px solid #a855f744",
                    borderRadius: "6px", padding: "0.15rem 0.4rem",
                    color: "#a855f7", fontSize: "0.58rem", fontWeight: 700,
                  }}>
                    ✓
                  </span>
                )}
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
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.1rem" }}>НЕЙРОКРЕДИТЫ · ТРАНЗАКЦИИ</div>
              <p style={{ margin: 0, color: "#db2777", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                ⬡ НейроКредиты · история
              </p>
            </div>
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
        <div style={{ textAlign: "center", padding: "3.5rem 2rem 2rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            width: "72px", height: "72px", borderRadius: "20px",
            background: "linear-gradient(135deg,#14141c,#1a1428)",
            border: "1px solid #a855f722",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "2rem",
            boxShadow: "0 0 32px #a855f710",
          }}>
            🗄️
          </div>
          <div>
            <p style={{ margin: 0, color: "#e2e8f0", fontSize: "0.9rem", fontWeight: 700 }}>Сейф пуст</p>
            <p style={{ margin: "0.3rem 0 0", color: "#4b5563", fontSize: "0.75rem", lineHeight: 1.5 }}>
              Оформите первый ваучер в каталоге,<br />чтобы начать копить XP и историю операций.
            </p>
          </div>
          <div style={{
            background: "#0d0d18", border: "1px solid #a855f722", borderRadius: "10px",
            padding: "0.5rem 1rem", fontSize: "0.68rem",
            fontFamily: "'JetBrains Mono',monospace", color: "#4b5563", letterSpacing: "0.06em",
          }}>
            VAULT_STATUS · EMPTY · AWAITING_FIRST_VOUCHER
          </div>
        </div>
      )}
    </div>
  );
}
