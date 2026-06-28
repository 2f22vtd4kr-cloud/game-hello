import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVaultStore } from "@/stores/useVaultStore";
import { useUserStore } from "@/stores/useUserStore";
import { useFavoritesStore } from "@/stores/useFavoritesStore";
import { useStationStore } from "@/stores/useStationStore";
import { fetchReferral, fetchAchievements, fetchUserSubscriptions, unsubscribeFromStation, fetchCreditsBalance, fetchUserNotes, deleteStationNote } from "@/api/client";
import type { Achievement } from "@/api/client";
import type { Purchase, ReferralInfo, Subscription, CreditTx, TabId } from "@/types";
import { FUEL_LABELS, XP_TIER_THRESHOLDS } from "@/types";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Активен", color: "#22c55e" },
  used: { label: "Использован", color: "rgba(255,255,255,0.65)" },
  expired: { label: "Истёк", color: "#ef4444" },
};

function expiryInfo(expiresAt: string | null | undefined): { color: string; label: string; pct: number; daysLeft: number } {
  if (!expiresAt) return { color: "rgba(255,255,255,0.65)", label: "Срок неизвестен", pct: 50, daysLeft: 0 };
  const now = Date.now();
  const exp = new Date(expiresAt).getTime();
  const totalMs = 90 * 24 * 3600 * 1000;
  const leftMs = exp - now;
  const daysLeft = Math.max(0, Math.ceil(leftMs / (24 * 3600 * 1000)));
  const pct = Math.max(0, Math.min(100, (leftMs / totalMs) * 100));
  if (leftMs <= 0) return { color: "#ef4444", label: "Истёк", pct: 0, daysLeft: 0 };
  if (daysLeft <= 30) return { color: "#ef4444", label: `${daysLeft} дн. осталось`, pct, daysLeft };
  if (daysLeft <= 60) return { color: "#eab308", label: `${daysLeft} дн. осталось`, pct, daysLeft };
  return { color: "#22c55e", label: `${daysLeft} дн. осталось`, pct, daysLeft };
}

const VAULT_NET_COLORS: Record<string, string> = {
  "Роснефть": "#ef4444", "Лукойл": "#f59e0b", "Газпром": "#3b82f6",
  "Shell": "#eab308", "BP": "#22c55e", "Тотал": "#a855f7",
  "Татнефть": "#06b6d4",
};

function QRModal({ hash, onClose, expiresAt, networkName, fuelType, volume, price }: {
  hash: string;
  onClose: () => void;
  expiresAt?: string | null;
  networkName?: string | null;
  fuelType?: string | null;
  volume?: number | null;
  price?: number | null;
}) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const now = new Date();
  const expiry = expiryInfo(expiresAt);
  const netColor = networkName ? (VAULT_NET_COLORS[networkName] ?? "#a855f7") : "#a855f7";

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

  const handleSavePng = async () => {
    if (!dataUrl) return;
    setSaving(true);
    try {
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `talон_${hash.slice(0, 8)}.png`;
      link.click();
    } finally { setSaving(false); }
  };

  const handleSavePdf = () => {
    if (!dataUrl) return;
    setSaving(true);
    try {
      const doc = new jsPDF({ format: "a6", unit: "mm", orientation: "portrait" });
      doc.setFillColor(8, 9, 15);
      doc.rect(0, 0, 105, 148, "F");
      doc.setTextColor(168, 85, 247);
      doc.setFontSize(10);
      doc.text("ТОПЛИВО ⛽️ — ЦИФРОВОЙ ТАЛОН", 10, 14);
      doc.setTextColor(220, 220, 240);
      doc.setFontSize(8);
      doc.text(`Код: ${hash}`, 10, 22);
      doc.text(`Дата: ${now.toLocaleDateString("ru")} ${now.toLocaleTimeString("ru")}`, 10, 28);
      doc.addImage(dataUrl, "PNG", 22, 36, 62, 62);
      doc.setTextColor(100, 100, 130);
      doc.setFontSize(6);
      doc.text("Предъявите QR-код оператору АЗС", 10, 108);
      doc.save(`талон_${hash.slice(0, 8)}.pdf`);
    } finally { setSaving(false); }
  };

  const handleShareTg = () => {
    const text = `⛽ Мой топливный талон\n\nКод: ${hash}\nДата: ${now.toLocaleDateString("ru")}\n\n⛽ Топливный Узел — Матрица Снабжения`;
    const tgUrl = `https://t.me/share/url?text=${encodeURIComponent(text)}`;
    window.open(tgUrl, "_blank");
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
          background: `linear-gradient(160deg, #0d0d18, ${netColor}04)`,
          border: `1px solid ${netColor}55`,
          borderRadius: "24px",
          padding: "1.5rem",
          textAlign: "center",
          maxWidth: "320px",
          width: "100%",
          position: "relative",
          overflow: "hidden",
          boxShadow: `0 0 60px ${netColor}22, 0 0 120px #db277711`,
        }}
      >
        {/* Top glow */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg, transparent, ${netColor}, #db2777, transparent)` }} />

        {/* Header */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#a855f7", fontSize: "0.5rem", letterSpacing: "0.2em", marginBottom: "0.25rem" }}>
            ⛽️ ТОПЛИВНЫЙ ВАУЧЕР
          </div>
          {networkName && (
            <div style={{ marginBottom: "0.45rem" }}>
              <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: "1.05rem", margin: 0, letterSpacing: "0.02em" }}>
                {networkName}
              </div>
              <div style={{ color: "#a855f7", fontSize: "0.62rem", fontFamily: "'JetBrains Mono',monospace", marginTop: "2px" }}>
                {fuelType && <span style={{ fontWeight: 700 }}>{fuelType}</span>}
                {volume && <span style={{ color: "rgba(255,255,255,0.65)" }}> · {volume}л</span>}
                {price && price > 0 && <span style={{ color: "rgba(255,255,255,0.55)" }}> · ₽{price.toLocaleString("ru")}</span>}
              </div>
              <div style={{
                marginTop: "0.4rem",
                background: "rgba(168,85,247,0.08)",
                border: "1px solid #a855f730",
                borderRadius: "8px",
                padding: "0.28rem 0.55rem",
                display: "inline-block",
              }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#c4b5fd", fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.06em" }}>
                  ✓ ДЕЙСТВУЕТ НА ВСЕХ АЗС СЕТИ {networkName.toUpperCase()}
                </span>
              </div>
            </div>
          )}
          {!networkName && (
            <p style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "0.9rem", margin: 0 }}>
              Предъявите QR контролёру
            </p>
          )}
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.62rem", margin: "0.2rem 0 0" }}>
            {now.toLocaleDateString("ru", { day: "2-digit", month: "long", year: "numeric" })} · {now.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        {/* QR code with glow frame */}
        <div style={{ position: "relative", display: "inline-block", margin: "0 auto" }}>
          <div style={{
            width: "236px", height: "236px", margin: "0 auto",
            borderRadius: "16px", overflow: "hidden",
            border: `2px solid ${netColor}44`,
            boxShadow: `0 0 30px ${netColor}30, inset 0 0 20px ${netColor}10`,
            position: "relative",
          }}>
            {dataUrl ? (
              <img src={dataUrl} alt="QR" style={{ width: "100%", height: "100%", display: "block" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "#0b0b0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }} style={{ fontSize: "1.5rem" }}>⟳</motion.div>
              </div>
            )}
            {/* Animated scanner beam */}
            {dataUrl && (
              <motion.div
                animate={{ y: ["0%", "100%", "0%"] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  position: "absolute", left: 0, right: 0, height: "3px",
                  background: `linear-gradient(90deg,transparent,${netColor}cc,transparent)`,
                  boxShadow: `0 0 8px ${netColor}88`,
                  pointerEvents: "none",
                }}
              />
            )}
          </div>
          {/* Corner accents */}
          {[["tl"], ["tr"], ["bl"], ["br"]].map(([k]) => (
            <div key={k} style={{ position: "absolute", width: "16px", height: "16px", borderColor: netColor, borderStyle: "solid", borderWidth: 0, ...(k === "tl" ? { top: 0, left: 0, borderTopWidth: "2px", borderLeftWidth: "2px", borderTopLeftRadius: "4px" } : k === "tr" ? { top: 0, right: 0, borderTopWidth: "2px", borderRightWidth: "2px", borderTopRightRadius: "4px" } : k === "bl" ? { bottom: 0, left: 0, borderBottomWidth: "2px", borderLeftWidth: "2px", borderBottomLeftRadius: "4px" } : { bottom: 0, right: 0, borderBottomWidth: "2px", borderRightWidth: "2px", borderBottomRightRadius: "4px" }) }} />
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
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.62rem", color: "rgba(255,255,255,0.55)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {hash}
          </span>
          <span style={{ fontSize: "0.7rem", color: copied ? "#22c55e" : "rgba(255,255,255,0.65)", flexShrink: 0 }}>
            {copied ? "✓" : "⎘"}
          </span>
        </div>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.55rem", margin: "0.3rem 0 0.5rem" }}>
          {copied ? "✓ Скопировано!" : "Нажмите на код для копирования"}
        </p>

        {/* Expiry bar */}
        {expiresAt && (
          <div style={{ marginBottom: "0.75rem", background: "#0b0b0f", border: `1px solid ${expiry.color}30`, borderRadius: "10px", padding: "0.5rem 0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.48rem", color: "rgba(255,255,255,0.45)", letterSpacing: "0.1em" }}>СРОК ДЕЙСТВИЯ</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.54rem", color: expiry.color, fontWeight: 700 }}>{expiry.label}</span>
            </div>
            <div style={{ height: "5px", background: "#111118", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ width: `${expiry.pct}%`, height: "100%", background: expiry.color, borderRadius: "3px", boxShadow: `0 0 6px ${expiry.color}`, transition: "width 0.5s" }} />
            </div>
            <p style={{ margin: "0.3rem 0 0", color: "rgba(255,255,255,0.45)", fontSize: "0.44rem", fontFamily: "'JetBrains Mono',monospace", lineHeight: 1.4 }}>
              ⚠ Точный срок действия может измениться с момента получения талона
            </p>
          </div>
        )}

        {/* Action buttons grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "0.75rem" }}>
          {[
            { icon: "📷", label: "Сохранить PNG", onClick: handleSavePng },
            { icon: "📄", label: "Скачать PDF",   onClick: handleSavePdf },
            { icon: "📋", label: "Скопировать",   onClick: handleCopy    },
            { icon: "📤", label: "В Telegram",    onClick: handleShareTg },
          ].map(({ icon, label, onClick }) => (
            <button key={label} onClick={onClick} disabled={saving}
              style={{
                background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)",
                borderRadius: "10px", padding: "0.5rem 0.35rem",
                color: "#c4b5fd", fontSize: "0.65rem", fontWeight: 600,
                cursor: saving ? "wait" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                opacity: saving ? 0.6 : 1, transition: "background 0.15s",
              }}
            >
              <span style={{ fontSize: "0.8rem" }}>{icon}</span>{label}
            </button>
          ))}
        </div>

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

const FUEL_ACCENT: Record<string, string> = {
  "АИ-92": "#a855f7",
  "АИ-95": "#db2777",
  "ДТ":    "#f59e0b",
  "Газ":   "#22c55e",
};

function PurchaseCard({ purchase, accentColor }: { purchase: Purchase; accentColor?: string }) {
  const [showQr, setShowQr] = useState(false);
  const st = STATUS_LABELS[purchase.status] ?? { label: purchase.status, color: "rgba(255,255,255,0.65)" };
  const date = new Date(purchase.created_at).toLocaleDateString("ru-RU", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
  const fuelColor = accentColor ?? FUEL_ACCENT[purchase.fuel_type] ?? "#a855f7";
  const isActive = purchase.status === "active";

  return (
    <>
      <AnimatePresence>
        {showQr && (
          <QRModal
            hash={purchase.qr_hash}
            onClose={() => setShowQr(false)}
            expiresAt={purchase.expires_at}
            networkName={purchase.station_name?.replace(/^Любая АЗС сети /, "") ?? null}
            fuelType={purchase.fuel_type}
            volume={purchase.volume}
            price={purchase.price}
          />
        )}
      </AnimatePresence>

      <motion.div
        whileTap={{ scale: 0.985 }}
        animate={isActive ? {
          boxShadow: [
            `0 0 20px ${fuelColor}18, 0 0 0 1px ${fuelColor}28`,
            `0 0 32px ${fuelColor}30, 0 0 0 1px ${fuelColor}48`,
            `0 0 20px ${fuelColor}18, 0 0 0 1px ${fuelColor}28`,
          ],
        } : {}}
        transition={isActive ? { repeat: Infinity, duration: 2.8, ease: "easeInOut" } : {}}
        style={{
          background: isActive ? `linear-gradient(160deg,#0d0d18,${fuelColor}06)` : "#0b0b0f",
          border: `1px solid ${isActive ? fuelColor + "40" : "#1a1a24"}`,
          borderRadius: "16px",
          padding: "0.85rem 1rem 0.85rem 1.25rem",
          marginBottom: "0.45rem",
          cursor: isActive ? "pointer" : "default",
          position: "relative",
          overflow: "hidden",
        }}
        onClick={() => isActive && setShowQr(true)}
      >
        {/* Left accent bar */}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "3px", background: isActive ? `linear-gradient(180deg,${fuelColor},${fuelColor}55)` : "#1a1a24", borderRadius: "16px 0 0 16px" }} />

        {isActive && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg,transparent,${fuelColor},#db2777,transparent)` }} />
        )}

        {/* Top row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.4rem" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", flexWrap: "wrap" }}>
              <span style={{ color: isActive ? "#e2e8f0" : "rgba(255,255,255,0.65)", fontWeight: 700, fontSize: "0.88rem" }}>
                {FUEL_LABELS[purchase.fuel_type] ?? purchase.fuel_type}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: fuelColor, fontSize: "0.82rem", fontWeight: 800 }}>
                {purchase.volume}л
              </span>
              {purchase.price > 0 && (
                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: isActive ? "#e2e8f0" : "rgba(255,255,255,0.55)", fontSize: "0.72rem", fontWeight: 600 }}>
                  ₽{purchase.price.toLocaleString("ru")}
                </span>
              )}
            </div>
            <p style={{ margin: "0.15rem 0 0", color: "rgba(255,255,255,0.55)", fontSize: "0.65rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              ⛽ {purchase.station_name ?? "АЗС"} · {purchase.region ?? ""}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.2rem", marginLeft: "0.5rem", flexShrink: 0 }}>
            <span style={{ background: `${st.color}15`, border: `1px solid ${st.color}40`, color: st.color, borderRadius: "6px", padding: "0.15rem 0.45rem", fontSize: "0.65rem", fontWeight: 700 }}>
              {st.label}
            </span>
            {isActive && (
              <motion.span
                animate={{ opacity: [1, 0.65, 1] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                style={{ background: `linear-gradient(135deg,${fuelColor},#db2777)`, borderRadius: "6px", padding: "0.12rem 0.4rem", color: "#fff", fontSize: "0.6rem", fontWeight: 700, boxShadow: `0 0 8px ${fuelColor}40` }}
              >
                📱 QR
              </motion.span>
            )}
          </div>
        </div>

        {/* Bottom row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.58rem", color: "#2a2a36" }}>
            #{purchase.qr_hash.slice(0, 16)}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            {isActive && purchase.expires_at && (() => {
              const exp = expiryInfo(purchase.expires_at);
              return (
                <span style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: "0.54rem", fontWeight: 700,
                  color: exp.color, background: `${exp.color}15`,
                  border: `1px solid ${exp.color}40`,
                  borderRadius: "5px", padding: "0.06rem 0.35rem",
                }}>
                  {exp.label}
                </span>
              );
            })()}
            <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.6rem" }}>{date}</span>
          </div>
        </div>
      </motion.div>
    </>
  );
}

interface VaultTabProps {
  initialPurchaseId?: number;
  onNavigate?: (tab: TabId) => void;
}

export function VaultTab({ initialPurchaseId, onNavigate }: VaultTabProps) {
  const { user } = useUserStore();
  const { purchases, loading, fetch } = useVaultStore();
  const { stations } = useStationStore();
  const [highlightedId, setHighlightedId] = useState<number | undefined>(initialPurchaseId);
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [showAllAch, setShowAllAch] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [showAllSubs, setShowAllSubs] = useState(false);
  const [creditHistory, setCreditHistory] = useState<CreditTx[]>([]);
  const [showCreditHistory, setShowCreditHistory] = useState(false);
  const [stationNotes, setStationNotes] = useState<Array<{ id: number; station_id: number; station_name: string; station_region: string; body: string; updated_at: string | null }>>([]);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<"all" | "used" | "expired">("all");

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
      fetchUserNotes(user.id).then((d) => setStationNotes(d.notes)).catch(() => {});
    }
  }, [user, fetch]);

  const { favoriteRegions, removeFavorite: removeFav, favoriteStations, toggleStationFavorite } = useFavoritesStore();
  const active = purchases.filter((p) => p.status === "active");
  const historyAll = purchases.filter((p) => p.status !== "active");
  const history = historyFilter === "all" ? historyAll : historyAll.filter((p) => p.status === historyFilter);
  const totalLiters = purchases.reduce((sum, p) => sum + (p.volume ?? 0), 0);
  const usedLiters = history.reduce((sum, p) => sum + (p.volume ?? 0), 0);
  const avgVolume = purchases.length > 0 ? Math.round(totalLiters / purchases.length) : 0;
  const totalSpent = purchases.reduce((sum, p) => sum + (p.price ?? 0), 0);

  // Procedural stars — stable across renders (hooks must be before any early return)
  const stars = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
    id: i,
    x: ((i * 137.508 + 23) % 390),
    y: ((i * 97.3 + 11) % 844),
    r: i % 5 === 0 ? 1.4 : i % 3 === 0 ? 1.1 : 0.7,
    op: 0.25 + (i % 7) * 0.09,
  })), []);

  // XP progress for header
  const currentTierHdr = XP_TIER_THRESHOLDS.find(t => user && user.xp >= t.min && (t.max === null || user.xp <= t.max));
  const nextTierHdr = currentTierHdr?.max !== null ? XP_TIER_THRESHOLDS.find(t => t.min === (currentTierHdr!.max! + 1)) : null;
  const xpPctHdr = currentTierHdr && currentTierHdr.max !== null && user
    ? Math.min(100, ((user.xp - currentTierHdr.min) / (currentTierHdr.max - currentTierHdr.min)) * 100)
    : 100;
  const tierIdxHdr = XP_TIER_THRESHOLDS.findIndex(t => t === currentTierHdr);
  const tierColorHdr = tierIdxHdr >= 5 ? "#f59e0b" : tierIdxHdr >= 3 ? "#E8622A" : "#A855F7";

  if (!user) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "linear-gradient(160deg,#0B0C4A,#060730)", color: "rgba(255,255,255,0.65)" }}>
      Загрузка…
    </div>
  );

  return (
    <div style={{ height: "100%", overflowY: "auto", paddingBottom: "5rem", background: "linear-gradient(160deg, #0B0C4A 0%, #07083A 50%, #060730 100%)", position: "relative" }}>

      {/* Star field */}
      <svg style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} aria-hidden>
        {stars.map(s => <circle key={s.id} cx={s.x} cy={s.y} r={s.r} fill="white" opacity={s.op} />)}
      </svg>

      {/* Ambient glows */}
      <div style={{ position: "fixed", top: "-15%", left: "-20%", width: "60%", height: "50%", background: "#A855F7", borderRadius: "50%", filter: "blur(110px)", opacity: 0.07, pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: "10%", right: "-15%", width: "55%", height: "55%", background: "#1e3a8a", borderRadius: "50%", filter: "blur(120px)", opacity: 0.13, pointerEvents: "none", zIndex: 0 }} />

      {/* Header */}
      <div style={{ padding: "16px 16px 10px", position: "relative", zIndex: 1 }}>
        {/* Title row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "12px" }}>
          <div>
            <h2 style={{ margin: 0, color: "#fff", fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1, textShadow: "0 0 30px rgba(168,85,247,0.4)" }}>
              Хранилище
            </h2>
            <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.4)", fontSize: "0.65rem" }}>
              {active.length} активных · {totalLiters > 0 ? `⛽ ${totalLiters.toLocaleString("ru")}л` : "пусто"}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "999px", padding: "3px 10px" }}>
              <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e", display: "inline-block" }} />
              <span style={{ color: "#22c55e", fontSize: "0.52rem", fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.08em" }}>SECURE</span>
            </div>
            {user && (
              <div style={{ background: `${tierColorHdr}20`, border: `1px solid ${tierColorHdr}44`, borderRadius: "8px", padding: "2px 10px", fontSize: "0.62rem", fontWeight: 700, color: tierColorHdr, fontFamily: "'JetBrains Mono',monospace" }}>
                {user.xp.toLocaleString("ru")} XP
              </div>
            )}
          </div>
        </div>

        {/* XP progress bar */}
        {user && (
          <div style={{ marginBottom: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.58rem", fontFamily: "'JetBrains Mono',monospace" }}>{currentTierHdr?.level ?? "—"}</span>
              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.58rem", fontFamily: "'JetBrains Mono',monospace" }}>{nextTierHdr ? nextTierHdr.level : "MAX"}</span>
            </div>
            <div style={{ height: "5px", borderRadius: "3px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${xpPctHdr}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                style={{ height: "100%", borderRadius: "3px", background: `linear-gradient(90deg, ${tierColorHdr}88, ${tierColorHdr})`, boxShadow: `0 0 8px ${tierColorHdr}88` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Quick stats grid (2×2) */}
      {purchases.length > 0 && (
        <div style={{ padding: "0 12px 10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          {(() => {
            const networkActiveCount = active.filter(p => p.station_name?.startsWith("Любая АЗС сети ")).length;
            const MARKET_PRICES: Record<string, number> = { "АИ-92": 65, "АИ-95": 71, "АИ-95+": 76, "АИ-100": 88, "ДТ": 79, "ДТ+": 84, "Газ": 35, "ЭКТО Plus": 76, "G-Drive": 79, "Pulsar": 71 };
            const totalSaved = purchases
              .filter(p => p.station_name?.startsWith("Любая АЗС сети "))
              .reduce((sum, p) => {
                const market = (MARKET_PRICES[p.fuel_type] ?? 65) * p.volume;
                const actual = p.price;
                return sum + Math.max(0, market - actual);
              }, 0);
            const items: { label: string; value: string; icon: string; color: string }[] = [
              { label: "Всего топлива", value: `${totalLiters.toLocaleString("ru")}л`, icon: "⛽", color: "#a855f7" },
              { label: "Использовано", value: `${usedLiters.toLocaleString("ru")}л`, icon: "✓", color: "#22c55e" },
              { label: "Потрачено", value: totalSpent > 0 ? `${totalSpent.toLocaleString("ru")}₽` : "—", icon: "💳", color: "#db2777" },
              { label: "Ср. объём", value: avgVolume > 0 ? `${avgVolume}л` : "—", icon: "📊", color: "#f59e0b" },
            ];
            if (networkActiveCount > 0) {
              items.splice(2, 0, { label: "Сетевых", value: String(networkActiveCount), icon: "🎫", color: "#a855f7" });
            }
            if (totalSaved > 0) {
              items.splice(items.length, 0, { label: "Сэкономлено", value: `${Math.round(totalSaved).toLocaleString("ru")}₽`, icon: "💚", color: "#22c55e" });
            }
            return items;
          })().map(({ label, value, icon, color }) => (
            <div key={label} style={{
              background: `${color}08`,
              border: `1px solid ${color}22`,
              borderRadius: "11px",
              padding: "9px 10px 7px",
              display: "flex", alignItems: "center", gap: "8px",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: "3px", bottom: 0, background: color, opacity: 0.5, borderRadius: "11px 0 0 11px" }} />
              <span style={{ fontSize: "1.1rem", lineHeight: 1, marginLeft: "4px" }}>{icon}</span>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", color, fontSize: "0.75rem", fontWeight: 800, lineHeight: 1 }}>{value}</div>
                <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.47rem", marginTop: "2px" }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fuel type spending breakdown */}
      {purchases.length > 0 && (() => {
        const FUEL_COLORS: Record<string, string> = { "АИ-92": "#22c55e", "АИ-95": "#3b82f6", "АИ-98": "#a855f7", "ДТ": "#f59e0b", "Газ": "#06b6d4" };
        const fuelBreakdown = purchases.reduce<Record<string, number>>((acc, p) => {
          const f = p.fuel_type ?? "—";
          acc[f] = (acc[f] ?? 0) + (p.volume ?? 0);
          return acc;
        }, {});
        const fuels = Object.entries(fuelBreakdown).sort((a, b) => b[1] - a[1]);
        if (!fuels.length) return null;
        const maxVal = fuels[0][1];
        return (
          <div style={{ padding: "0 12px 10px" }}>
            <div className="glass-panel" style={{ padding: "10px 12px" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.45)", fontSize: "0.42rem", letterSpacing: "0.14em", marginBottom: "6px" }}>РАСПРЕДЕЛЕНИЕ ТОПЛИВА · ОБЪЁМ</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {fuels.map(([fuel, vol]) => {
                  const color = FUEL_COLORS[fuel] ?? "#6b7280";
                  const pct = maxVal > 0 ? Math.round((vol / maxVal) * 100) : 0;
                  return (
                    <div key={fuel} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.58rem", color, width: "38px", flexShrink: 0 }}>{fuel}</span>
                      <div style={{ flex: 1, height: "5px", background: "#1a1a24", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg,${color}88,${color})`, borderRadius: "3px", transition: "width 0.6s ease" }} />
                      </div>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.58rem", color: "rgba(255,255,255,0.65)", width: "36px", textAlign: "right", flexShrink: 0 }}>{vol.toLocaleString("ru")}л</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

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
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.45)", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.18rem" }}>ПРОФИЛЬ ОПЕРАТОРА · XP</div>
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
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.55)", fontSize: "0.62rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>XP</p>
                </div>
              </div>

              {/* XP progress bar */}
              <div style={{ marginBottom: "0.35rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                  <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.62rem" }}>
                    {currentTier?.level ?? "—"}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.62rem" }}>
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
                  <p style={{ margin: "0.2rem 0 0", color: "rgba(255,255,255,0.45)", fontSize: "0.6rem" }}>
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
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.45)", fontSize: "0.58rem" }}>ваучеров</p>
                </div>
                <div style={{ flex: 1, background: "#0b0b0f", borderRadius: "8px", padding: "0.4rem", textAlign: "center" }}>
                  <p style={{ margin: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: "1rem", fontWeight: 700, color: "#22c55e" }}>
                    {purchases.length}
                  </p>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.45)", fontSize: "0.58rem" }}>покупок</p>
                </div>
                <div style={{ flex: 1, background: "#0b0b0f", borderRadius: "8px", padding: "0.4rem", textAlign: "center" }}>
                  <p style={{ margin: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: "1rem", fontWeight: 700, color: "#f59e0b" }}>
                    {purchases.reduce((s, p) => s + (p.volume ?? 0), 0)}л
                  </p>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.45)", fontSize: "0.58rem" }}>топлива</p>
                </div>
                {user.neurocredits > 0 && (
                  <div style={{ flex: 1, background: "#0b0b0f", borderRadius: "8px", padding: "0.4rem", textAlign: "center" }}>
                    <p style={{ margin: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: "1rem", fontWeight: 700, color: "#db2777" }}>
                      {user.neurocredits}
                    </p>
                    <p style={{ margin: 0, color: "rgba(255,255,255,0.45)", fontSize: "0.58rem" }}>NC</p>
                  </div>
                )}
                {user.checkin_streak && user.checkin_streak > 0 ? (
                  <div style={{ flex: 1, background: "#0b0b0f", borderRadius: "8px", padding: "0.4rem", textAlign: "center" }}>
                    <p style={{ margin: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: "1rem", fontWeight: 700, color: "#f59e0b" }}>
                      {user.checkin_streak}🔥
                    </p>
                    <p style={{ margin: 0, color: "rgba(255,255,255,0.45)", fontSize: "0.58rem" }}>стрик</p>
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
                  <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.65rem" }}>
                    реф. код · {referral.uses} приглашений
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Quick action shortcuts */}
      {!loading && (
        <div style={{ margin: "0 1rem 0.75rem", display: "flex", gap: "0.4rem" }}>
          {[
            { icon: "🎫", label: "Каталог", tab: "catalog" as const, color: "#a855f7" },
            { icon: "🎮", label: "Игры", tab: "games" as const, color: "#db2777" },
            { icon: "🗺️", label: "Карта", tab: "map" as const, color: "#22c55e" },
            { icon: "📰", label: "Новости", tab: "news" as const, color: "#f59e0b" },
          ].map(({ icon, label, tab, color }) => (
            <button
              key={tab}
              onClick={() => onNavigate?.(tab)}
              style={{
                flex: 1,
                background: `${color}08`,
                border: `1px solid ${color}22`,
                borderRadius: "10px",
                padding: "0.4rem 0.3rem",
                color, cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
                transition: "background 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => { const el = e.currentTarget; el.style.background = `${color}18`; el.style.borderColor = `${color}44`; }}
              onMouseLeave={(e) => { const el = e.currentTarget; el.style.background = `${color}08`; el.style.borderColor = `${color}22`; }}
            >
              <span style={{ fontSize: "1rem" }}>{icon}</span>
              <span style={{ fontSize: "0.52rem", fontFamily: "'JetBrains Mono',monospace", color, opacity: 0.8 }}>{label}</span>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ padding: "0 1rem 1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: "70px", borderRadius: "14px", background: "linear-gradient(90deg,#14141c 25%,#1e1e2a 50%,#14141c 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
          ))}
        </div>
      )}

      {/* Spending analytics summary */}
      {purchases.length > 0 && (() => {
        const totalVolume = purchases.reduce((s, p) => s + (p.volume ?? 0), 0);
        const totalSpent = purchases.reduce((s, p) => s + (p.price ?? 0), 0);
        const fuelCounts: Record<string, number> = {};
        for (const p of purchases) { fuelCounts[p.fuel_type] = (fuelCounts[p.fuel_type] ?? 0) + (p.volume ?? 0); }
        const topFuel = Object.entries(fuelCounts).sort((a, b) => b[1] - a[1])[0];
        const FUEL_COLORS: Record<string, string> = { "АИ-92": "#a855f7", "АИ-95": "#db2777", "АИ-95+": "#8b5cf6", "ДТ": "#f59e0b", "Газ": "#14b8a6" };
        return (
          <div style={{ margin: "0 1rem 0.75rem", background: "linear-gradient(135deg,#0d0d18,#110a18)", border: "1px solid #a855f722", borderRadius: "14px", padding: "0.75rem", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#a855f7,#db2777,transparent)" }} />
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.45)", fontSize: "0.4rem", letterSpacing: "0.14em", marginBottom: "0.45rem" }}>СТАТИСТИКА РАСХОДА · ВСЕГО</div>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              {[
                { label: "Топлива", value: `${totalVolume}л`, color: "#22c55e" },
                { label: "Потрачено", value: `${totalSpent.toLocaleString("ru")}`, color: "#a855f7", suffix: " ₽" },
                { label: "Покупок", value: purchases.length, color: "#3b82f6" },
                topFuel ? { label: "Любимое", value: topFuel[0], color: FUEL_COLORS[topFuel[0]] ?? "rgba(255,255,255,0.65)" } : null,
              ].filter(Boolean).map((item) => item && (
                <div key={item.label} style={{ flex: 1, textAlign: "center", background: "#0b0b0f", borderRadius: "8px", padding: "0.4rem 0.2rem" }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", color: item.color, fontSize: "0.85rem", fontWeight: 800, lineHeight: 1 }}>{item.value}{item.suffix ?? ""}</div>
                  <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.52rem", marginTop: "2px" }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Сетевые талоны — grouped by network */}
      {(() => {
        const NET_COLORS: Record<string, string> = {
          "Роснефть": "#ef4444", "Лукойл": "#f59e0b", "Газпромнефть": "#3b82f6",
          "Газпром": "#3b82f6", "Башнефть": "#f97316", "Татнефть": "#06b6d4",
          "ННК": "#a855f7", "Shell": "#eab308", "BP": "#22c55e", "Тотал": "#db2777",
        };
        const networkVouchers = active.filter((p) => p.station_name?.startsWith("Любая АЗС сети "));
        if (!networkVouchers.length) return null;
        const byNetwork: Record<string, typeof networkVouchers> = {};
        for (const p of networkVouchers) {
          const net = p.station_name!.replace("Любая АЗС сети ", "");
          if (!byNetwork[net]) byNetwork[net] = [];
          byNetwork[net].push(p);
        }
        return (
          <div style={{ padding: "0 1rem 0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 0.6rem" }}>
              <span style={{ fontSize: "0.9rem" }}>🎫</span>
              <p style={{ color: "#a855f7", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, flex: 1 }}>
                Сетевые талоны · {networkVouchers.length}
              </p>
              {onNavigate && (
                <button
                  onClick={() => onNavigate("catalog")}
                  style={{
                    background: "rgba(168,85,247,0.1)", border: "1px solid #a855f733",
                    borderRadius: "6px", padding: "0.15rem 0.45rem",
                    color: "#a855f7", fontSize: "0.52rem", fontWeight: 700,
                    cursor: "pointer", fontFamily: "'JetBrains Mono',monospace",
                    letterSpacing: "0.04em",
                  }}
                >+ Ещё</button>
              )}
            </div>
            {Object.entries(byNetwork).map(([net, vouchers]) => {
              const netColor = NET_COLORS[net] ?? "#a855f7";
              return (
                <div key={net} style={{
                  background: `linear-gradient(135deg,#0d0d18,${netColor}06)`,
                  border: `1px solid ${netColor}30`,
                  borderRadius: "14px",
                  marginBottom: "0.5rem",
                  overflow: "hidden",
                }}>
                  {/* Network header bar */}
                  <div style={{ height: "2px", background: `linear-gradient(90deg,${netColor},${netColor}44,transparent)` }} />
                  <div style={{ padding: "0.5rem 0.75rem 0.35rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: netColor, boxShadow: `0 0 6px ${netColor}` }} />
                      <span style={{ color: netColor, fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.04em" }}>{net}</span>
                      {(() => {
                        const soonest = vouchers
                          .filter(v => v.expires_at)
                          .reduce<string | null>((acc, v) => (!acc || v.expires_at! < acc ? v.expires_at! : acc), null);
                        if (!soonest) return null;
                        const daysLeft = Math.ceil((new Date(soonest).getTime() - Date.now()) / 86400000);
                        const exColor = daysLeft <= 30 ? "#ef4444" : daysLeft <= 60 ? "#eab308" : "#22c55e";
                        return (
                          <div style={{ background: `${exColor}12`, border: `1px solid ${exColor}33`, borderRadius: "4px", padding: "0.02rem 0.25rem", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.38rem", color: exColor, fontWeight: 700 }}>
                            {daysLeft}д
                          </div>
                        );
                      })()}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.4rem", color: "rgba(255,255,255,0.45)", letterSpacing: "0.1em" }}>ДЕЙСТВУЕТ НА ВСЕХ АЗС</span>
                      <div style={{ background: `${netColor}18`, border: `1px solid ${netColor}44`, borderRadius: "4px", padding: "0.04rem 0.3rem", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.52rem", color: netColor, fontWeight: 700 }}>
                        {vouchers.length} шт
                      </div>
                    </div>
                  </div>
                  {/* Expiry overview bar */}
                  {(() => {
                    const withExpiry = vouchers.filter(v => v.expires_at);
                    if (!withExpiry.length) return null;
                    const soonest = withExpiry.reduce<string>((acc, v) => (!acc || v.expires_at! < acc ? v.expires_at! : acc), withExpiry[0].expires_at!);
                    const daysLeft = Math.max(0, Math.ceil((new Date(soonest).getTime() - Date.now()) / 86400000));
                    const pct = Math.min(100, Math.round((daysLeft / 90) * 100));
                    const exColor = daysLeft <= 30 ? "#ef4444" : daysLeft <= 60 ? "#eab308" : netColor;
                    return (
                      <div style={{ padding: "0 0.75rem 0.5rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.38rem", color: "#2a2a36", letterSpacing: "0.08em" }}>СРОК ДЕЙСТВИЯ</span>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.4rem", color: exColor, fontWeight: 700 }}>мин {daysLeft}д</span>
                        </div>
                        <div style={{ height: "3px", background: "#0b0b12", borderRadius: "2px", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: exColor, borderRadius: "2px", boxShadow: `0 0 4px ${exColor}88`, transition: "width 0.4s" }} />
                        </div>
                      </div>
                    );
                  })()}
                  <div style={{ padding: "0 0.5rem 0.5rem" }}>
                    {vouchers.map((p) => <PurchaseCard key={p.id} purchase={p} accentColor={netColor} />)}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Active single-station vouchers */}
      {(() => {
        const singleVouchers = active.filter((p) => !p.station_name?.startsWith("Любая АЗС сети "));
        if (!singleVouchers.length) return null;
        return (
          <div style={{ padding: "0 1rem 0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 0.5rem" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e", animation: "tmaPulse 2s infinite", flexShrink: 0 }} />
              <p style={{ color: "#E8622A", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.2em", margin: 0, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                Активные ваучеры · {singleVouchers.length}
              </p>
            </div>
            {singleVouchers.map((p) => <PurchaseCard key={p.id} purchase={p} />)}
          </div>
        );
      })()}

      {/* History with CSV export */}
      {history.length > 0 && (
        <div style={{ padding: "0 1rem 0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.1rem", marginTop: "0.5rem" }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.45)", fontSize: "0.43rem", letterSpacing: "0.14em" }}>АРХИВ ОРДЕРОВ · ИСТОРИЯ</div>
            <button
              onClick={() => {
                const rows = [
                  ["Дата", "АЗС", "Топливо", "Объём", "Сумма", "Статус"],
                  ...purchases.map((p) => [
                    new Date(p.created_at).toLocaleDateString("ru-RU"),
                    p.station_name ?? "",
                    p.fuel_type,
                    `${p.volume}л`,
                    `${p.price} ${p.currency}`,
                    p.status,
                  ]),
                ];
                const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
                const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `талоны_${new Date().toISOString().slice(0,10)}.csv`;
                a.click(); URL.revokeObjectURL(url);
              }}
              style={{
                background: "rgba(168,85,247,0.1)", border: "1px solid #a855f722",
                borderRadius: "6px", color: "rgba(255,255,255,0.65)", fontSize: "0.6rem",
                padding: "0.15rem 0.45rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem",
              }}
            >
              ↓ CSV
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.2em", margin: 0, fontFamily: "'JetBrains Mono',monospace" }}>
              История · {history.length}
            </p>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              {([
                { key: "all",     label: "Все",      color: "rgba(255,255,255,0.55)" },
                { key: "used",    label: "Исп.",     color: "rgba(255,255,255,0.65)" },
                { key: "expired", label: "Истёк.",   color: "#ef4444" },
              ] as const).map(({ key, label, color }) => (
                <button
                  key={key}
                  onClick={() => setHistoryFilter(key)}
                  style={{
                    background: historyFilter === key ? `${color}18` : "none",
                    border: `1px solid ${historyFilter === key ? color + "55" : "#22222f"}`,
                    borderRadius: "6px", color: historyFilter === key ? color : "rgba(255,255,255,0.45)",
                    fontSize: "0.55rem", fontWeight: historyFilter === key ? 700 : 400,
                    padding: "0.1rem 0.4rem", cursor: "pointer",
                    fontFamily: "'JetBrains Mono',monospace",
                    transition: "all 0.15s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {history.length === 0 ? (
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.65rem", textAlign: "center", padding: "0.75rem 0", fontFamily: "'JetBrains Mono',monospace" }}>— нет записей —</p>
          ) : (
            history.map((p) => <PurchaseCard key={p.id} purchase={p} />)
          )}
        </div>
      )}

      {/* Subscriptions */}
      {subscriptions.length > 0 && (
        <div style={{ padding: "0 1rem 0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.45)", fontSize: "0.46rem", letterSpacing: "0.14em", marginBottom: "0.1rem" }}>МОНИТОРИНГ АЗС · АКТИВНЫЕ</div>
              <p style={{ margin: 0, color: "#E8622A", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.2em", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
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
          {(showAllSubs ? subscriptions : subscriptions.slice(0, 3)).map((sub) => {
            const liveStation = stations.find((s) => s.id === sub.station_id);
            const liveAvg = liveStation?.fuel_statuses.length
              ? Math.round(liveStation.fuel_statuses.reduce((a, f) => a + f.availability_pct, 0) / liveStation.fuel_statuses.length)
              : null;
            const liveColor = liveAvg == null ? "#374151" : liveAvg >= 60 ? "#22c55e" : liveAvg >= 25 ? "#eab308" : "#ef4444";
            const fuelAvg = sub.fuel_type && liveStation
              ? liveStation.fuel_statuses.find((f) => f.fuel_type === sub.fuel_type)?.availability_pct ?? null
              : null;
            const displayPct = fuelAvg != null ? Math.round(fuelAvg) : liveAvg;
            const displayColor = fuelAvg != null
              ? (fuelAvg >= 60 ? "#22c55e" : fuelAvg >= 25 ? "#eab308" : "#ef4444")
              : liveColor;
            return (
            <motion.div
              key={sub.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: "linear-gradient(160deg,#0e0e1a,#110d1a)",
                border: `1px solid ${displayColor}22`,
                borderLeft: `3px solid ${displayColor}66`,
                borderRadius: "10px",
                padding: "0.55rem 0.75rem",
                marginBottom: "0.4rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg,${displayColor}33,transparent)` }} />
              <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", minWidth: 0, flex: 1 }}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "26px", height: "26px", borderRadius: "50%", background: `${displayColor}15`, border: `1px solid ${displayColor}30`, flexShrink: 0 }}>
                  🔔
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, color: "#e2e8f0", fontSize: "0.78rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {sub.station_name}
                  </p>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.65)", fontSize: "0.62rem" }}>
                    {sub.station_region}{sub.fuel_type ? ` · ${sub.fuel_type}` : ""}
                  </p>
                </div>
                {displayPct != null && (
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: displayColor, fontSize: "0.78rem", fontWeight: 800, flexShrink: 0 }}>
                    {displayPct}%
                  </span>
                )}
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
                  color: "#ef444499",
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
            );
          })}
        </div>
      )}

      {/* Station Notes */}
      {stationNotes.length > 0 && (
        <div style={{ padding: "0 1rem 0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.45)", fontSize: "0.46rem", letterSpacing: "0.14em", marginBottom: "0.1rem" }}>МОИ ЗАМЕТКИ · АЗС</div>
              <p style={{ margin: 0, color: "#E8622A", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.2em", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                📝 Заметки · {stationNotes.length} АЗС
              </p>
            </div>
            {stationNotes.length > 3 && (
              <button
                onClick={() => setShowAllNotes(!showAllNotes)}
                style={{ background: "none", border: "none", color: "#db2777", fontSize: "0.7rem", cursor: "pointer", padding: 0 }}
              >
                {showAllNotes ? "Скрыть" : "Все"}
              </button>
            )}
          </div>
          {(showAllNotes ? stationNotes : stationNotes.slice(0, 3)).map((note) => (
            <motion.div
              key={note.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: "linear-gradient(160deg,#0e0e1a,#110a18)",
                border: "1px solid #db277720",
                borderLeft: "3px solid #db277766",
                borderRadius: "10px",
                padding: "0.55rem 0.75rem",
                marginBottom: "0.4rem",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,#db277733,transparent)" }} />
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: "0 0 0.15rem", color: "#e2e8f0", fontSize: "0.78rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    ⛽ {note.station_name}
                  </p>
                  <p style={{ margin: "0 0 0.35rem", color: "rgba(255,255,255,0.65)", fontSize: "0.62rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {note.station_region}
                  </p>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.72)", fontSize: "0.7rem", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {note.body}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (!user) return;
                    deleteStationNote(note.station_id, user.id)
                      .then(() => setStationNotes((prev) => prev.filter((n) => n.id !== note.id)))
                      .catch(() => {});
                  }}
                  style={{ background: "none", border: "1px solid #ef444420", borderRadius: "6px", color: "#ef444499", fontSize: "0.65rem", padding: "0.25rem 0.45rem", cursor: "pointer", flexShrink: 0, marginLeft: "0.3rem" }}
                >✕</button>
              </div>
              {note.updated_at && (
                <p style={{ margin: "0.3rem 0 0", color: "rgba(255,255,255,0.45)", fontSize: "0.55rem" }}>
                  📅 {new Date(note.updated_at).toLocaleDateString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Favorite stations */}
      {favoriteStations.length > 0 && (
        <div style={{ padding: "0 1rem 0.75rem" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.45)", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.1rem" }}>ИЗБРАННЫЕ АЗС · БЫСТРЫЙ ДОСТУП</div>
          <p style={{ color: "#E8622A", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.2em", margin: "0 0 0.5rem", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
            ⭐ Избранные АЗС · {favoriteStations.length}
          </p>
          <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
            {favoriteStations.map((id) => {
              const st = useStationStore.getState().stations.find(s => s.id === id);
              const avg = st?.fuel_statuses.length
                ? Math.round(st.fuel_statuses.reduce((a, f) => a + f.availability_pct, 0) / st.fuel_statuses.length)
                : null;
              const dotColor = avg === null ? "#6b7280" : avg >= 60 ? "#22c55e" : avg >= 25 ? "#eab308" : "#ef4444";
              return (
                <motion.div
                  key={id}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    flexShrink: 0, minWidth: "110px", maxWidth: "140px",
                    background: "linear-gradient(160deg,#0a0a14,#14100a)",
                    border: `1px solid ${dotColor}28`,
                    borderRadius: "12px", padding: "0.5rem 0.6rem", cursor: "pointer",
                    position: "relative", overflow: "hidden",
                  }}
                >
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg,transparent,${dotColor},transparent)` }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: dotColor, boxShadow: `0 0 4px ${dotColor}`, display: "inline-block" }} />
                      {avg !== null && (
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: dotColor, fontSize: "0.6rem", fontWeight: 700 }}>{avg}%</span>
                      )}
                    </div>
                    <button
                      onClick={() => toggleStationFavorite(id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.45)", fontSize: "0.55rem", padding: 0 }}
                    >✕</button>
                  </div>
                  <p style={{ margin: "0.1rem 0 0", color: "#e2e8f0", fontSize: "0.65rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {st ? st.name : `АЗС #${id}`}
                  </p>
                  {st?.network && (
                    <p style={{ margin: "0.1rem 0 0", color: "rgba(255,255,255,0.45)", fontSize: "0.55rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{st.network}</p>
                  )}
                  {st && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onNavigate?.("map"); }}
                      style={{ marginTop: "0.25rem", background: "none", border: "1px solid #22222f", borderRadius: "5px", color: "rgba(255,255,255,0.55)", fontSize: "0.48rem", padding: "2px 6px", cursor: "pointer", width: "100%" }}
                    >🗺 На карте</button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Favorite regions */}
      {favoriteRegions.length > 0 && (
        <div style={{ padding: "0 1rem 0.75rem" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.45)", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.1rem" }}>ИЗБРАННЫЕ РЕГИОНЫ · МОНИТОРИНГ</div>
          <p style={{ color: "#E8622A", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.2em", margin: "0 0 0.5rem", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
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
                background: "linear-gradient(160deg,#0d0d18,#0e0b18)",
                border: "1px solid #eab30820",
                borderLeft: "3px solid #eab30866",
                borderRadius: "12px",
                padding: "0.6rem 0.85rem",
                marginBottom: "0.4rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,#eab30833,transparent)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                  <span style={{ fontSize: "0.9rem" }}>⭐</span>
                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 5px #22c55e", display: "inline-block", animation: "tmaPulse 2s infinite" }} />
                </div>
                <div>
                  <p style={{ margin: 0, color: "#e2e8f0", fontSize: "0.82rem", fontWeight: 600 }}>{region}</p>
                  <p style={{ margin: "0.1rem 0 0", color: "rgba(255,255,255,0.55)", fontSize: "0.62rem", fontFamily: "'JetBrains Mono',monospace" }}>
                    МОНИТОРИНГ · LIVE
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
                {(() => {
                  const regionStations = useStationStore.getState().stations.filter(s => s.region === region);
                  if (!regionStations.length) return null;
                  const avgPct = Math.round(regionStations.reduce((acc, s) => {
                    const a = s.fuel_statuses.length ? s.fuel_statuses.reduce((x, f) => x + f.availability_pct, 0) / s.fuel_statuses.length : 0;
                    return acc + a;
                  }, 0) / regionStations.length);
                  const dotColor = avgPct >= 60 ? "#22c55e" : avgPct >= 25 ? "#eab308" : "#ef4444";
                  return (
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", color: dotColor, fontSize: "0.88rem", fontWeight: 700, lineHeight: 1 }}>{avgPct}%</div>
                      <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.5rem", marginTop: "1px" }}>{regionStations.length} АЗС</div>
                    </div>
                  );
                })()}
                <button
                  onClick={() => onNavigate?.("map")}
                  title="Карта"
                  style={{ background: "none", border: "1px solid #1e1e2a", borderRadius: "6px", color: "rgba(255,255,255,0.55)", fontSize: "0.7rem", padding: "0.25rem 0.4rem", cursor: "pointer", flexShrink: 0 }}
                >🗺</button>
                <button
                  onClick={() => removeFav(region)}
                  style={{
                    background: "none", border: "1px solid #22222f",
                    borderRadius: "8px", color: "rgba(255,255,255,0.65)",
                    fontSize: "0.72rem", padding: "0.3rem 0.5rem",
                    cursor: "pointer", flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Achievements section */}
      {achievements.length > 0 && (
        <div style={{ padding: "0 1rem 0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.45)", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.1rem" }}>ДОСТИЖЕНИЯ СИСТЕМЫ · РАЗБЛОКИРОВАНО</div>
              <p style={{ margin: 0, color: "#E8622A", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.2em", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
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
                  boxShadow: ach.unlocked ? "0 0 14px #a855f738" : "none",
                  position: "relative",
                  overflow: "hidden",
                }}>
                  {ach.unlocked && (
                    <motion.div
                      initial={{ x: "-100%" }}
                      animate={{ x: "200%" }}
                      transition={{ delay: i * 0.08, duration: 0.55, ease: "easeInOut", repeat: Infinity, repeatDelay: 4 }}
                      style={{
                        position: "absolute", top: 0, bottom: 0, width: "50%",
                        background: "linear-gradient(90deg,transparent,rgba(168,85,247,0.22),transparent)",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                  {ach.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, color: ach.unlocked ? "#e2e8f0" : "rgba(255,255,255,0.55)", fontSize: "0.75rem", fontWeight: 700 }}>
                    {ach.label}
                  </p>
                  <p style={{ margin: 0, color: ach.unlocked ? "#a855f7" : "rgba(255,255,255,0.45)", fontSize: "0.62rem" }}>
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
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.75rem", textAlign: "center", padding: "0.5rem 0" }}>
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
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.45)", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.1rem" }}>НЕЙРОКРЕДИТЫ · ТРАНЗАКЦИИ</div>
              <p style={{ margin: 0, color: "#E8622A", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.2em", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
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
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.22 }}
                    style={{
                      background: tx.delta >= 0 ? "linear-gradient(135deg,#0d0b14,#0b0b0f)" : "#0b0b0f",
                      border: `1px solid ${tx.delta >= 0 ? "#db277720" : "#ef444418"}`,
                      borderRadius: "8px",
                      padding: "0.35rem 0.65rem",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      position: "relative", overflow: "hidden",
                    }}
                  >
                    {tx.delta > 0 && (
                      <div style={{ position: "absolute", left: 0, top: "20%", bottom: "20%", width: "2px", background: "#db2777", borderRadius: "0 2px 2px 0", boxShadow: "0 0 4px #db277766" }} />
                    )}
                    <div style={{ paddingLeft: tx.delta > 0 ? "0.4rem" : 0 }}>
                      <p style={{ margin: 0, color: "rgba(255,255,255,0.82)", fontSize: "0.73rem" }}>{tx.reason}</p>
                      {t && <p style={{ margin: 0, color: "rgba(255,255,255,0.45)", fontSize: "0.6rem" }}>{t}</p>}
                    </div>
                    <p style={{ margin: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: "0.82rem", fontWeight: 700, color: tx.delta >= 0 ? "#db2777" : "#ef4444", flexShrink: 0 }}>
                      {tx.delta >= 0 ? "+" : ""}{tx.delta} NC
                    </p>
                  </motion.div>
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
            <p style={{ margin: "0.3rem 0 0", color: "rgba(255,255,255,0.55)", fontSize: "0.75rem", lineHeight: 1.5 }}>
              Оформите первый ваучер в каталоге,<br />чтобы начать копить XP и историю операций.
            </p>
          </div>
          <button
            onClick={() => onNavigate?.("catalog")}
            style={{
              background: "linear-gradient(135deg,#a855f7,#db2777)",
              border: "none", borderRadius: "12px", color: "#fff",
              fontSize: "0.8rem", fontWeight: 700,
              padding: "0.6rem 1.4rem", cursor: "pointer",
              boxShadow: "0 0 16px #a855f740",
              marginTop: "0.25rem",
            }}
          >
            🎫 Открыть Каталог
          </button>
          <div style={{
            background: "#0d0d18", border: "1px solid #a855f722", borderRadius: "10px",
            padding: "0.5rem 1rem", fontSize: "0.68rem",
            fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.55)", letterSpacing: "0.06em",
          }}>
            VAULT_STATUS · EMPTY · AWAITING_FIRST_VOUCHER
          </div>
        </div>
      )}
    </div>
  );
}
