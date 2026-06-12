import { motion } from "framer-motion";
import type { GasStation } from "@/types";
import { FUEL_LABELS, STATUS_COLORS, STATUS_LABELS } from "@/types";
import { reportStation } from "@/api/client";
import { useUserStore } from "@/stores/useUserStore";
import { useStationStore } from "@/stores/useStationStore";
import { useToast } from "@/components/Toast";

interface Props {
  station: GasStation;
  onClose?: () => void;
}

export function StationCard({ station, onClose }: Props) {
  const { user } = useUserStore();
  const { updateReport } = useStationStore();
  const { add: toast } = useToast();

  const dominantStatus = (() => {
    if (!station.fuel_statuses.length) return "red";
    const avg = station.fuel_statuses.reduce((a, b) => a + b.availability_pct, 0)
      / station.fuel_statuses.length;
    return avg >= 60 ? "green" : avg >= 25 ? "yellow" : "red";
  })();

  const handleReport = async (vote: "available" | "unavailable") => {
    if (!user) return;
    try {
      await reportStation(station.id, user.id, vote);
      updateReport(station.id, vote === "available" ? 10 : -10);
      toast(
        vote === "available"
          ? "✓ Отчёт принят. Спасибо! +5 XP" : "✕ Отчёт принят. Спасибо! +5 XP",
        "success",
      );
    } catch {
      toast("Не удалось отправить отчёт", "error");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      style={{
        background: "#14141c",
        border: "1px solid #22222f",
        borderRadius: "16px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{
        padding: "1rem",
        borderBottom: "1px solid #22222f",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <span style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: STATUS_COLORS[dominantStatus],
              boxShadow: `0 0 8px ${STATUS_COLORS[dominantStatus]}`,
              flexShrink: 0,
            }} />
            <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "0.95rem" }}>
              {station.name}
            </span>
          </div>
          <p style={{ color: "#6b7280", fontSize: "0.78rem", margin: 0 }}>
            {station.address}
          </p>
          <p style={{ color: "#4b5563", fontSize: "0.72rem", margin: "0.15rem 0 0" }}>
            {station.region}
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "#6b7280",
            cursor: "pointer", fontSize: "1.2rem", padding: "0 0 0 0.5rem",
          }}>✕</button>
        )}
      </div>

      {/* Fuel statuses */}
      <div style={{ padding: "0.75rem 1rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
          {station.fuel_statuses.map((fs) => (
            <div key={fs.fuel_type} style={{
              background: "#0b0b0f",
              border: `1px solid ${STATUS_COLORS[fs.status]}33`,
              borderRadius: "8px",
              padding: "0.4rem 0.6rem",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                {FUEL_LABELS[fs.fuel_type] ?? fs.fuel_type}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <span style={{
                  width: "6px", height: "6px", borderRadius: "50%",
                  background: STATUS_COLORS[fs.status],
                }} />
                <span style={{ color: STATUS_COLORS[fs.status], fontSize: "0.7rem", fontWeight: 600 }}>
                  {fs.availability_pct}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Queue */}
      <div style={{
        padding: "0.4rem 1rem",
        display: "flex", alignItems: "center", gap: "0.5rem",
      }}>
        <span style={{ fontSize: "0.8rem" }}>🚗</span>
        <span style={{ color: "#6b7280", fontSize: "0.78rem" }}>
          В очереди: <span style={{ color: "#e2e8f0" }}>{station.queue_cars} авто</span>
        </span>
      </div>

      {/* Report buttons */}
      <div style={{ padding: "0.75rem 1rem 0.75rem", display: "flex", gap: "0.5rem" }}>
        <button
          onClick={() => handleReport("available")}
          style={{
            flex: 1, padding: "0.5rem",
            background: "#16a34a22", border: "1px solid #22c55e44",
            borderRadius: "10px", color: "#22c55e",
            fontSize: "0.8rem", cursor: "pointer", fontWeight: 500,
          }}
        >
          ✓ Есть
        </button>
        <button
          onClick={() => handleReport("unavailable")}
          style={{
            flex: 1, padding: "0.5rem",
            background: "#dc262622", border: "1px solid #ef444444",
            borderRadius: "10px", color: "#ef4444",
            fontSize: "0.8rem", cursor: "pointer", fontWeight: 500,
          }}
        >
          ✕ Нет
        </button>
      </div>

      {/* Community link */}
      <div style={{
        padding: "0.5rem 1rem 0.75rem",
        borderTop: "1px solid #22222f",
        fontSize: "0.7rem", color: "#6b7280", textAlign: "center",
      }}>
        Внимание: Система синхронизирована с внешними индексами. Для официальной регистрации в очередях используйте{" "}
        <a href="https://t.me/sev_fuel_ochered_bot" target="_blank"
           style={{ color: "#a855f7", textDecoration: "none" }}>
          @sev_fuel_ochered_bot
        </a>
      </div>
    </motion.div>
  );
}
