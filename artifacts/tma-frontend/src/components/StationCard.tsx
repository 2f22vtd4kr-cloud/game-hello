import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import type { GasStation, SubscriptionStatus } from "@/types";
import { FUEL_LABELS, STATUS_COLORS, STATUS_LABELS } from "@/types";
import {
  reportStation,
  checkSubscriptionStatus,
  subscribeToStation,
  unsubscribeFromStation,
} from "@/api/client";
import { useUserStore } from "@/stores/useUserStore";
import { useStationStore } from "@/stores/useStationStore";
import { useToast } from "@/components/Toast";
import { impact, notify } from "@/lib/haptic";
import { usePriceStore } from "@/stores/usePriceStore";

interface Props {
  station: GasStation;
  onClose?: () => void;
}

const ZONE_LABEL: Record<string, { label: string; color: string }> = {
  critical: { label: "Крит. зона", color: "#ef4444" },
  standard: { label: "Стандарт", color: "#a855f7" },
  eastern:  { label: "Восток", color: "#f59e0b" },
};

const DISPLAY_FUELS = ["АИ-92", "АИ-95", "ДТ"];

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

  const handleReport = async (vote: "available" | "unavailable") => {
    if (!user) return;
    impact("light");
    try {
      await reportStation(station.id, user.id, vote);
      updateReport(station.id, vote === "available" ? 10 : -10);
      notify("success");
      toast(vote === "available" ? "✓ Отчёт принят. +5 XP" : "✕ Отчёт принят. +5 XP", "success");
    } catch {
      notify("error");
      toast("Не удалось отправить отчёт", "error");
    }
  };

  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);
  const [subLoading, setSubLoading] = useState(false);

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
      style={{ background: "#14141c", border: "1px solid #22222f", borderRadius: "16px", overflow: "hidden" }}
    >
      {/* Status top bar */}
      <div style={{ height: "3px", background: `linear-gradient(90deg, ${statusColor}88, ${statusColor})` }} />

      {/* Header */}
      <div style={{ padding: "0.85rem 1rem 0.6rem", borderBottom: "1px solid #22222f" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
              <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: statusColor, boxShadow: `0 0 10px ${statusColor}`, flexShrink: 0 }} />
              <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "0.95rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {station.name}
              </span>
            </div>
            <p style={{ color: "#6b7280", fontSize: "0.75rem", margin: "0 0 0.25rem" }}>{station.address}</p>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ color: "#4b5563", fontSize: "0.7rem" }}>{station.region}</span>
              <span style={{ background: `${zoneInfo.color}18`, border: `1px solid ${zoneInfo.color}33`, borderRadius: "4px", color: zoneInfo.color, fontSize: "0.6rem", padding: "0.05rem 0.35rem" }}>
                {zoneInfo.label}
              </span>
              <span style={{ background: "#a855f711", border: "1px solid #a855f733", borderRadius: "4px", color: "#a855f7", fontSize: "0.6rem", padding: "0.05rem 0.35rem" }}>
                🚗 {station.queue_cars} авто
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "4px", alignItems: "center", flexShrink: 0, marginLeft: "0.5rem" }}>
            <button onClick={handleToggleSubscription} disabled={subLoading} title={subStatus?.subscribed ? "Отписаться" : "Подписаться"}
              style={{ background: "none", border: "none", cursor: subLoading ? "wait" : "pointer", fontSize: "1.15rem", padding: "0 0.1rem", opacity: subLoading ? 0.5 : 1, filter: subStatus?.subscribed ? "drop-shadow(0 0 6px #eab308)" : "none" }}>
              {subStatus?.subscribed ? "🔔" : "🔕"}
            </button>
            {onClose && (
              <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "1.2rem", padding: "0 0 0 0.1rem" }}>✕</button>
            )}
          </div>
        </div>
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
          <span style={{ color: "#6b7280", fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Цены сейчас</span>
          <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: connected ? "#22c55e" : "#4b5563", boxShadow: connected ? "0 0 5px #22c55e" : "none" }} />
          {connected && <span style={{ color: "#22c55e44", fontSize: "0.58rem" }}>LIVE</span>}
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
        <div style={{ color: "#6b7280", fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.45rem" }}>Наличие по типам</div>
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
      <div style={{ padding: "0.65rem 1rem 0.5rem", display: "flex", gap: "0.5rem" }}>
        <button onClick={() => handleReport("available")} style={{ flex: 1, padding: "0.5rem", background: "#16a34a22", border: "1px solid #22c55e44", borderRadius: "10px", color: "#22c55e", fontSize: "0.8rem", cursor: "pointer", fontWeight: 600 }}>
          ✓ Есть
        </button>
        <button onClick={() => handleReport("unavailable")} style={{ flex: 1, padding: "0.5rem", background: "#dc262622", border: "1px solid #ef444444", borderRadius: "10px", color: "#ef4444", fontSize: "0.8rem", cursor: "pointer", fontWeight: 600 }}>
          ✕ Нет
        </button>
        <button
          onClick={() => {
            const fuels = station.fuel_statuses.map(f => `${f.fuel_type}: ${f.availability_pct}%`).join(", ");
            const text = encodeURIComponent(`⛽ ${station.name}\n📍 ${station.region} — ${station.address}\n${fuels}\n\nМатрица Снабжения`);
            const url = `https://t.me/share/url?url=${encodeURIComponent("https://t.me/")}&text=${text}`;
            window.open(url, "_blank");
          }}
          style={{ padding: "0.5rem 0.7rem", background: "#1e40af22", border: "1px solid #3b82f644", borderRadius: "10px", color: "#3b82f6", fontSize: "0.85rem", cursor: "pointer" }}
          title="Поделиться в Telegram"
        >
          ✈️
        </button>
      </div>

      {/* Footer */}
      <div style={{ padding: "0.4rem 1rem 0.7rem", fontSize: "0.68rem", color: "#374151", textAlign: "center", borderTop: "1px solid #22222f" }}>
        Данные синхронизированы · Очередь: используйте{" "}
        <a href="https://t.me/sev_fuel_ochered_bot" target="_blank" style={{ color: "#a855f7", textDecoration: "none" }}>@sev_fuel_ochered_bot</a>
      </div>
    </motion.div>
  );
}
