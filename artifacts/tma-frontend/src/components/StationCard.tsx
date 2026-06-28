import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import type { GasStation, SubscriptionStatus } from "@/types";
import { FUEL_LABELS, STATUS_COLORS, STATUS_LABELS } from "@/types";
import {
  reportStation,
  checkSubscriptionStatus,
  subscribeToStation,
  unsubscribeFromStation,
  fetchStationNote,
  upsertStationNote,
  deleteStationNote,
} from "@/api/client";
import { useUserStore } from "@/stores/useUserStore";
import { useStationStore } from "@/stores/useStationStore";
import { useVaultStore } from "@/stores/useVaultStore";
import { useToast } from "@/components/Toast";
import { StationLogo } from "@/components/StationLogo";
import { impact, notify } from "@/lib/haptic";
import { usePriceStore } from "@/stores/usePriceStore";
import { useFavoritesStore } from "@/stores/useFavoritesStore";

interface Props {
  station: GasStation;
  onClose?: () => void;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function NearbyAlternatives({ station }: { station: GasStation }) {
  const { stations } = useStationStore();

  const alternatives = stations
    .filter((s) => s.id !== station.id)
    .map((s) => {
      const avg = s.fuel_statuses.length
        ? s.fuel_statuses.reduce((a, f) => a + f.availability_pct, 0) / s.fuel_statuses.length
        : 0;
      const dist = haversineKm(station.lat, station.lng, s.lat, s.lng);
      return { s, avg, dist };
    })
    .filter(({ avg }) => avg >= 30)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3);

  if (!alternatives.length) return null;

  return (
    <div style={{ padding: "0.5rem 1rem", borderBottom: "1px solid #0f0f17" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.4rem" }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.46rem", letterSpacing: "0.14em" }}>БЛИЖАЙШИЕ АЛЬТЕРНАТИВЫ</div>
        <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg,#1e1e2a,transparent)" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        {alternatives.map(({ s, avg, dist }) => {
          const dotColor = avg >= 60 ? "#22c55e" : avg >= 30 ? "#eab308" : "#ef4444";
          return (
            <div
              key={s.id}
              onClick={() => window.open(`https://yandex.ru/maps/?rtext=~${s.lat},${s.lng}&rtt=auto`, "_blank")}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0.5rem", background: "#0b0b0f", border: "1px solid #1e1e2a", borderRadius: "8px", cursor: "pointer", transition: "border-color 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#E8622A33")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e1e2a")}
            >
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: dotColor, boxShadow: `0 0 5px ${dotColor}`, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#e2e8f0", fontSize: "0.68rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                <div style={{ color: "#4b5563", fontSize: "0.58rem" }}>{s.network || "АЗС"}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", color: dotColor, fontSize: "0.65rem", fontWeight: 700 }}>{Math.round(avg)}%</div>
                <div style={{ color: "#374151", fontSize: "0.55rem" }}>{dist < 1 ? `${Math.round(dist * 1000)}м` : `${dist.toFixed(1)}км`}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ShareStationButton({ station }: { station: GasStation }) {
  const { add: toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const text = `⛽ ${station.name}\n📍 ${station.address}\n🗺️ https://yandex.ru/maps/?ll=${station.lng},${station.lat}&z=16&pt=${station.lng},${station.lat}\n\nТопливо ⛽️ — мониторинг АЗС`;
    try {
      if (navigator.share) {
        await navigator.share({ title: station.name, text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast("📋 Скопировано в буфер", "success");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast("📋 Скопировано в буфер", "success");
      } catch { toast("Не удалось скопировать", "error"); }
    }
  };

  return (
    <button
      onClick={handleShare}
      style={{
        width: "100%",
        background: copied ? "rgba(34,197,94,0.12)" : "rgba(232,98,42,0.08)",
        border: `1px solid ${copied ? "#22c55e44" : "#E8622A22"}`,
        borderRadius: "10px",
        color: copied ? "#22c55e" : "#6b7280",
        fontSize: "0.75rem",
        padding: "0.45rem",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
        transition: "all 0.2s",
        fontWeight: copied ? 600 : 400,
      }}
    >
      {copied ? "✓ Скопировано" : "🔗 Поделиться АЗС"}
    </button>
  );
}

const ZONE_LABEL: Record<string, { label: string; color: string }> = {
  critical: { label: "Крит. зона", color: "#ef4444" },
  standard: { label: "Стандарт", color: "#E8622A" },
  eastern:  { label: "Восток", color: "#f59e0b" },
};

const DISPLAY_FUELS = ["АИ-92", "АИ-95", "ДТ"];

function CopyTicketButton({ stationName }: { stationName: string }) {
  const { purchases } = useVaultStore();
  const { add: toast } = useToast();
  const [copied, setCopied] = useState(false);

  const active = purchases.find(p => p.station_name === stationName && p.status === "active");
  if (!active) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(active.qr_hash).then(() => {
      setCopied(true);
      toast("🎫 Код талона скопирован", "success");
      setTimeout(() => setCopied(false), 2200);
    }).catch(() => toast("Не удалось скопировать", "error"));
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "100%", padding: "0.5rem 0.75rem",
        background: copied ? "rgba(34,197,94,0.1)" : "rgba(232,98,42,0.08)",
        border: `1px solid ${copied ? "#22c55e55" : "#E8622A44"}`,
        borderRadius: "10px", cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
        <span style={{ fontSize: "0.8rem" }}>{copied ? "✓" : "📋"}</span>
        <span style={{ color: copied ? "#22c55e" : "#c084fc", fontSize: "0.75rem", fontWeight: 700 }}>
          {copied ? "Скопировано!" : "Скопировать код талона"}
        </span>
      </div>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.58rem", color: "#6b7280", maxWidth: "110px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {active.qr_hash.slice(0, 16)}…
      </span>
    </button>
  );
}

export function StationCard({ station, onClose }: Props) {
  const { user } = useUserStore();
  const { updateReport } = useStationStore();
  const { add: toast } = useToast();
  const getPrice = usePriceStore((s) => s.getPrice);
  const connected = usePriceStore((s) => s.connected);

  const dominantStatus = (() => {
    if (!station.fuel_statuses.length) return "red";
    const avg = station.fuel_statuses.reduce((a, b) => a + b.availability_pct, 0)
      / station.fuel_statuses.length;
    return avg >= 60 ? "green" : avg >= 25 ? "yellow" : "red";
  })();

  const statusColor = STATUS_COLORS[dominantStatus];
  const zoneInfo = ZONE_LABEL[station.zone_type];
  const waitMin = Math.round(station.queue_cars * 2.5);
  const avgAvail = station.fuel_statuses.length
    ? Math.round(station.fuel_statuses.reduce((a, b) => a + b.availability_pct, 0) / station.fuel_statuses.length)
    : 0;

  const { isStationFavorite, toggleStationFavorite } = useFavoritesStore();
  const isFav = isStationFavorite(station.id);

  const [reportedVote, setReportedVote] = useState<"available" | "unavailable" | null>(null);
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);

  const handleReport = async (vote: "available" | "unavailable") => {
    if (!user || reportedVote) return;
    impact("light");
    try {
      await reportStation(station.id, user.id, vote);
      updateReport(station.id, vote === "available" ? 10 : -10);
      setReportedVote(vote);
      notify("success");
      toast(vote === "available" ? "✓ Отчёт принят. +5 XP" : "✕ Отчёт принят. +5 XP", "success");
    } catch {
      notify("error");
      toast("Не удалось отправить отчёт", "error");
    }
  };
  const [subLoading, setSubLoading] = useState(false);

  // Personal notes
  const [noteText, setNoteText] = useState("");
  const [noteSaved, setNoteSaved] = useState("");
  const [noteEditing, setNoteEditing] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteLoaded, setNoteLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchStationNote(station.id, user.id)
      .then((d) => { setNoteSaved(d.body); setNoteText(d.body); setNoteLoaded(true); })
      .catch(() => setNoteLoaded(true));
  }, [user, station.id]);

  const handleSaveNote = async () => {
    if (!user || noteSaving) return;
    setNoteSaving(true);
    try {
      if (noteText.trim()) {
        await upsertStationNote(station.id, user.id, noteText.trim());
        setNoteSaved(noteText.trim());
      } else {
        await deleteStationNote(station.id, user.id);
        setNoteSaved("");
      }
      setNoteEditing(false);
      toast("📝 Заметка сохранена", "success");
    } catch {
      toast("Не удалось сохранить заметку", "error");
    } finally {
      setNoteSaving(false);
    }
  };

  const refreshSubStatus = useCallback(async () => {
    if (!user) return;
    try {
      setSubStatus(await checkSubscriptionStatus(user.id, station.id));
    } catch {}
  }, [user, station.id]);

  useEffect(() => { refreshSubStatus(); }, [refreshSubStatus]);

  const handleToggleSubscription = async () => {
    if (!user || subLoading) return;
    impact("medium");
    setSubLoading(true);
    try {
      if (subStatus?.subscribed && subStatus.subscription_id) {
        await unsubscribeFromStation(subStatus.subscription_id, user.id);
        setSubStatus({ subscribed: false });
        notify("success");
        toast("🔕 Подписка отменена", "success");
      } else {
        await subscribeToStation(user.id, user.id, station.id);
        setSubStatus({ subscribed: true });
        notify("success");
        toast("🔔 Подписка оформлена! Вы получите уведомление, когда топливо появится.", "success");
      }
      await refreshSubStatus();
    } catch {
      notify("error");
      toast("Не удалось изменить подписку", "error");
    } finally {
      setSubLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      style={{
        background: "linear-gradient(160deg,#0d0d18,#100812)",
        border: `1px solid ${statusColor}30`,
        borderRadius: "20px",
        overflow: "hidden",
        boxShadow: `0 0 28px ${statusColor}15, 0 4px 24px #00000060`,
      }}
    >
      {/* Status top bar */}
      <div style={{ height: "2px", background: `linear-gradient(90deg, transparent, ${statusColor}, ${statusColor}88, transparent)` }} />
      {/* Crisis scan-line sweep */}
      {dominantStatus === "red" && (
        <motion.div
          animate={{ top: ["0%", "100%", "0%"] }}
          transition={{ repeat: Infinity, duration: 3.5, ease: "linear" }}
          style={{
            position: "absolute",
            left: 0, right: 0, height: "1px",
            background: "linear-gradient(90deg, transparent, #ef444420, transparent)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      )}

      {/* Header */}
      <div style={{ padding: "0.9rem 1rem 0.65rem", borderBottom: `1px solid ${statusColor}15` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
            <StationLogo network={station.network || "АЗС"} size={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <span style={{
                width: "8px", height: "8px", borderRadius: "50%",
                background: statusColor,
                boxShadow: `0 0 10px ${statusColor}, 0 0 4px ${statusColor}`,
                flexShrink: 0,
                animation: dominantStatus === "red" ? "crisisPulse 1.2s infinite" : "none",
              }} />
              <span style={{ color: "#f1f5f9", fontWeight: 800, fontSize: "0.98rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
                {station.name}
              </span>
            </div>
            <p style={{ color: "#4b5563", fontSize: "0.7rem", margin: "0 0 0.3rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              📍 {station.address}
            </p>
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ color: "#374151", fontSize: "0.62rem" }}>{station.region.split(" ").slice(-1)[0]}</span>
              <span style={{ background: `${zoneInfo.color}15`, border: `1px solid ${zoneInfo.color}35`, borderRadius: "5px", color: zoneInfo.color, fontSize: "0.58rem", fontWeight: 700, padding: "0.05rem 0.35rem" }}>
                {zoneInfo.label}
              </span>
              <span style={{ background: station.queue_cars > 8 ? "#ef444415" : "#E8622A10", border: `1px solid ${station.queue_cars > 8 ? "#ef444435" : "#E8622A30"}`, borderRadius: "5px", color: station.queue_cars > 8 ? "#ef4444" : "#E8622A", fontSize: "0.58rem", fontWeight: 700, padding: "0.05rem 0.35rem" }}>
                🚗 {station.queue_cars} авто
              </span>
            </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "4px", alignItems: "center", flexShrink: 0, marginLeft: "0.5rem" }}>
            <button
              onClick={() => {
                impact("light");
                toggleStationFavorite(station.id);
                toast(isFav ? "Удалено из избранного" : "⭐ Добавлено в избранное", isFav ? "info" : "success");
              }}
              title={isFav ? "Убрать из избранного" : "В избранное"}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.05rem", padding: "0.2rem 0.3rem", opacity: isFav ? 1 : 0.45, transition: "opacity 0.15s, transform 0.15s", transform: isFav ? "scale(1.1)" : "scale(1)" }}
            >
              {isFav ? "⭐" : "☆"}
            </button>
            <button
              onClick={() => {
                const url = `https://yandex.ru/maps/?rtext=~${station.lat},${station.lng}&rtt=auto`;
                window.open(url, "_blank");
              }}
              title="Маршрут на Яндекс Картах"
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", padding: "0.2rem 0.3rem", opacity: 0.7, transition: "opacity 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
            >
              🧭
            </button>
            <button
              onClick={() => {
                const addr = `${station.name}, ${station.address}`;
                navigator.clipboard?.writeText(addr).then(() => {
                  toast("📋 Адрес скопирован", "success");
                }).catch(() => {
                  toast(addr, "info");
                });
                impact("light");
              }}
              title="Скопировать адрес"
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.95rem", padding: "0.2rem 0.3rem", opacity: 0.6, transition: "opacity 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
            >
              📋
            </button>
            <button
              onClick={handleToggleSubscription}
              disabled={subLoading}
              title={subStatus?.subscribed ? "Отписаться" : "Подписаться"}
              style={{
                background: subStatus?.subscribed ? "#1a140a" : "none",
                border: subStatus?.subscribed ? "1px solid #eab30840" : "none",
                borderRadius: "8px",
                cursor: subLoading ? "wait" : "pointer",
                fontSize: "1.1rem",
                padding: "0.2rem 0.3rem",
                opacity: subLoading ? 0.5 : 1,
                filter: subStatus?.subscribed ? "drop-shadow(0 0 8px #eab308)" : "opacity(0.6)",
              }}
            >
              {subStatus?.subscribed ? "🔔" : "🔕"}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                style={{ background: "#22222f", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "0.8rem", padding: "0.25rem 0.45rem", borderRadius: "6px" }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Buy vouchers CTA + copy active ticket */}
      <div style={{ padding: "0.55rem 1rem 0.4rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
            width: "100%", padding: "0.6rem",
            background: "linear-gradient(135deg, rgba(232,98,42,0.18), rgba(232,98,42,0.12))",
            border: "1px solid rgba(232,98,42,0.35)",
            borderRadius: "12px",
            color: "#c084fc", fontSize: "0.85rem", fontWeight: 700,
            boxShadow: "0 0 16px rgba(232,98,42,0.14)",
          }}
        >
          🎫 Купить талоны
        </div>
        <CopyTicketButton stationName={station.name} />
      </div>

      {/* Summary row */}
      <div style={{ padding: "0.5rem 1rem", borderBottom: "1px solid #0f0f17", display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "1.4rem", fontWeight: 700, color: statusColor, lineHeight: 1 }}>{avgAvail}<span style={{ fontSize: "0.8rem" }}>%</span></span>
          <div style={{ color: "#4b5563", fontSize: "0.58rem", marginTop: "2px" }}>ср. наличие</div>
        </div>
        <div style={{ width: "1px", background: "#1e1e2a", alignSelf: "stretch" }} />
        <div style={{ textAlign: "center" }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "1.4rem", fontWeight: 700, color: station.queue_cars > 10 ? "#ef4444" : station.queue_cars > 4 ? "#eab308" : "#22c55e", lineHeight: 1 }}>{waitMin}<span style={{ fontSize: "0.8rem" }}>м</span></span>
          <div style={{ color: "#4b5563", fontSize: "0.58rem", marginTop: "2px" }}>ожидание</div>
        </div>
        <div style={{ width: "1px", background: "#1e1e2a", alignSelf: "stretch" }} />
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>{dominantStatus === "green" ? "🟢" : dominantStatus === "yellow" ? "🟡" : "🔴"}</span>
          <div style={{ color: statusColor, fontSize: "0.58rem", marginTop: "2px", fontWeight: 600 }}>{STATUS_LABELS[dominantStatus]}</div>
        </div>
        <div style={{ width: "1px", background: "#1e1e2a", alignSelf: "stretch" }} />
        <div style={{ flex: 1, textAlign: "right" }}>
          <span style={{ color: "#4b5563", fontSize: "0.65rem" }}>{station.network || "АЗС"}</span>
          <div style={{ color: "#374151", fontSize: "0.58rem", marginTop: "1px" }}>сеть</div>
        </div>
      </div>

      {/* Live prices */}
      <div style={{ padding: "0.6rem 1rem", borderBottom: "1px solid #0f0f17" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.45rem" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.46rem", letterSpacing: "0.14em" }}>ЦЕНЫ СЕЙЧАС</div>
          <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: connected ? "#22c55e" : "#4b5563", boxShadow: connected ? "0 0 5px #22c55e" : "none", flexShrink: 0 }} />
          {connected && <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#22c55e66", fontSize: "0.46rem", letterSpacing: "0.1em" }}>LIVE</span>}
          <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg,#1e1e2a,transparent)" }} />
        </div>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {DISPLAY_FUELS.map((ft) => {
            const p = getPrice(station.region, ft);
            const isCrisis = p?.is_crisis;
            return (
              <div key={ft} style={{ flex: 1, background: isCrisis ? "#1a050514" : "#0b0b0f", border: `1px solid ${isCrisis ? "#ef444433" : "#1e1e2a"}`, borderRadius: "8px", padding: "0.4rem 0.35rem", textAlign: "center" }}>
                <div style={{ color: "#6b7280", fontSize: "0.62rem", marginBottom: "2px" }}>{ft}</div>
                {p ? (
                  <>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.9rem", fontWeight: 700, color: isCrisis ? "#ef4444" : p.multiplier > 1.03 ? "#f59e0b" : "#e2e8f0", lineHeight: 1 }}>
                      {p.effective.toFixed(0)}₽
                    </div>
                    {p.multiplier !== 1 && (
                      <div style={{ fontSize: "0.55rem", color: isCrisis ? "#ef444488" : "#4b5563", marginTop: "1px" }}>
                        {p.multiplier > 1 ? "▲" : "▼"}{Math.abs((p.multiplier - 1) * 100).toFixed(0)}%
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ color: "#374151", fontSize: "0.8rem" }}>—</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Fuel statuses */}
      <div style={{ padding: "0.65rem 1rem", borderBottom: "1px solid #0f0f17" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.45rem" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.46rem", letterSpacing: "0.14em" }}>НАЛИЧИЕ ТОПЛИВА</div>
          <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg,#1e1e2a,transparent)" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {station.fuel_statuses.map((fs) => {
            const fc = STATUS_COLORS[fs.status];
            return (
              <div key={fs.fuel_type}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                  <span style={{ color: "#9ca3af", fontSize: "0.72rem" }}>{FUEL_LABELS[fs.fuel_type] ?? fs.fuel_type}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: fc }} />
                    <span style={{ color: fc, fontSize: "0.7rem", fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{fs.availability_pct}%</span>
                  </div>
                </div>
                <div style={{ height: "4px", borderRadius: "2px", background: "#0b0b0f", overflow: "hidden" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${fs.availability_pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    style={{ height: "100%", background: `linear-gradient(90deg, ${fc}88, ${fc})`, borderRadius: "2px" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Report buttons */}
      <div style={{ padding: "0.65rem 1rem 0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.4rem" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.46rem", letterSpacing: "0.14em" }}>КРАУДРЕПОРТ · +5 XP</div>
          <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg,#1e1e2a,transparent)" }} />
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => handleReport("available")}
            disabled={!!reportedVote}
            style={{
              flex: 1, padding: "0.55rem 0.5rem",
              background: reportedVote === "available"
                ? "linear-gradient(135deg,#16a34a30,#22c55e20)"
                : "linear-gradient(135deg,#16a34a15,#22c55e0d)",
              border: `1px solid ${reportedVote === "available" ? "#22c55e88" : "#22c55e44"}`,
              borderRadius: "10px", color: reportedVote ? (reportedVote === "available" ? "#22c55e" : "#4b5563") : "#22c55e",
              fontSize: "0.8rem", cursor: reportedVote ? "default" : "pointer", fontWeight: 700,
              boxShadow: reportedVote === "available" ? "0 0 12px #22c55e30" : "0 0 8px #22c55e18",
              transition: "all 0.2s",
            }}
          >
            {reportedVote === "available" ? "✓ Отправлено" : "✓ Есть топливо"}
          </button>
          <button
            onClick={() => handleReport("unavailable")}
            disabled={!!reportedVote}
            style={{
              flex: 1, padding: "0.55rem 0.5rem",
              background: reportedVote === "unavailable"
                ? "linear-gradient(135deg,#dc262630,#ef444420)"
                : "linear-gradient(135deg,#dc262615,#ef44440d)",
              border: `1px solid ${reportedVote === "unavailable" ? "#ef444488" : "#ef444444"}`,
              borderRadius: "10px", color: reportedVote ? (reportedVote === "unavailable" ? "#ef4444" : "#4b5563") : "#ef4444",
              fontSize: "0.8rem", cursor: reportedVote ? "default" : "pointer", fontWeight: 700,
              boxShadow: reportedVote === "unavailable" ? "0 0 12px #ef444430" : "0 0 8px #ef444418",
              transition: "all 0.2s",
            }}
          >
            {reportedVote === "unavailable" ? "✕ Отправлено" : "✕ Нет топлива"}
          </button>
          <button
            onClick={() => {
              const fuels = station.fuel_statuses.map(f => `${f.fuel_type}: ${f.availability_pct}%`).join(", ");
              const text = encodeURIComponent(`⛽ ${station.name}\n📍 ${station.region} — ${station.address}\n${fuels}\n\n⛽️ Топливо`);
              const url = `https://t.me/share/url?url=${encodeURIComponent("https://t.me/")}&text=${text}`;
              window.open(url, "_blank");
            }}
            style={{ padding: "0.55rem 0.7rem", background: "#1e40af18", border: "1px solid #3b82f640", borderRadius: "10px", color: "#3b82f6", fontSize: "0.85rem", cursor: "pointer" }}
            title="Поделиться в Telegram"
          >✈️</button>
        </div>
      </div>

      {/* Personal notes */}
      {noteLoaded && (
        <div style={{ padding: "0.5rem 1rem", borderBottom: "1px solid #0f0f17" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.4rem" }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.46rem", letterSpacing: "0.14em" }}>МОЯ ЗАМЕТКА · ЛИЧНАЯ</div>
            <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg,#1e1e2a,transparent)" }} />
            {!noteEditing && (
              <button
                onClick={() => setNoteEditing(true)}
                style={{ background: "none", border: "none", color: "#4b5563", fontSize: "0.65rem", cursor: "pointer", padding: 0 }}
              >
                {noteSaved ? "✏️ Ред." : "+ Добавить"}
              </button>
            )}
          </div>
          {!noteEditing ? (
            noteSaved ? (
              <div
                onClick={() => setNoteEditing(true)}
                style={{
                  background: "rgba(232,98,42,0.05)", border: "1px solid #E8622A20",
                  borderRadius: "8px", padding: "0.5rem 0.65rem",
                  color: "#9ca3af", fontSize: "0.72rem", lineHeight: 1.5,
                  cursor: "pointer", whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}
              >
                📝 {noteSaved}
              </div>
            ) : (
              <button
                onClick={() => setNoteEditing(true)}
                style={{
                  width: "100%", textAlign: "left",
                  background: "rgba(255,255,255,0.02)", border: "1px dashed #1e1e2a",
                  borderRadius: "8px", padding: "0.45rem 0.65rem",
                  color: "#374151", fontSize: "0.68rem", cursor: "pointer",
                }}
              >
                Добавить личную заметку…
              </button>
            )
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Личные наблюдения: расписание, очереди, особенности…"
                autoFocus
                style={{
                  width: "100%", boxSizing: "border-box", resize: "none",
                  background: "#0b0b12", border: "1px solid #E8622A44",
                  borderRadius: "8px", color: "#e2e8f0",
                  padding: "0.5rem 0.65rem", fontSize: "0.72rem", lineHeight: 1.5,
                  outline: "none", fontFamily: "inherit",
                }}
              />
              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                <span style={{ fontSize: "0.55rem", color: "#374151", flex: 1 }}>{noteText.length}/500</span>
                <button
                  onClick={() => { setNoteText(noteSaved); setNoteEditing(false); }}
                  style={{ background: "none", border: "1px solid #1e1e2a", borderRadius: "6px", color: "#4b5563", fontSize: "0.65rem", padding: "0.25rem 0.5rem", cursor: "pointer" }}
                >Отмена</button>
                <button
                  onClick={handleSaveNote}
                  disabled={noteSaving}
                  style={{ background: "rgba(232,98,42,0.2)", border: "1px solid #E8622A55", borderRadius: "6px", color: "#E8622A", fontSize: "0.65rem", padding: "0.25rem 0.6rem", cursor: "pointer", fontWeight: 700 }}
                >{noteSaving ? "…" : "Сохранить"}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Nearby alternatives — closest green/yellow stations */}
      <NearbyAlternatives station={station} />

      {/* Share station button */}
      <div style={{ padding: "0 1rem 0.75rem" }}>
        <ShareStationButton station={station} />
      </div>

      {/* Footer */}
      <div style={{ padding: "0.35rem 1rem 0.65rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.4rem", borderTop: "1px solid #0f0f17" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 5px #22c55e" }} />
          {(() => {
            const ts = station.fuel_statuses[0]?.last_updated;
            if (!ts) return <span style={{ fontSize: "0.6rem", color: "#374151" }}>Данные синхронизированы</span>;
            const diff = Date.now() - new Date(ts).getTime();
            const m = Math.floor(diff / 60000);
            const label = m < 1 ? "сейчас" : m < 60 ? `${m}м назад` : `${Math.floor(m / 60)}ч назад`;
            return <span style={{ fontSize: "0.6rem", color: "#374151" }}>Обновлено: {label}</span>;
          })()}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {station.fuel_statuses.length > 0 && (
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", color: "#374151" }}>
              ⛽ {station.fuel_statuses.length} видов
            </span>
          )}
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.52rem", color: "#22222f" }}>
            #{station.id}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
