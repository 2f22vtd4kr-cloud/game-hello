import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchAdminStats, adminTriggerJob, adminResetCrisis, adminReseedDb } from "@/api/client";
import type { AdminStats } from "@/api/client";

interface Props {
  onClose: () => void;
}

export function AdminPanel({ onClose }: Props) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLog, setActionLog] = useState<{ msg: string; ok: boolean; ts: number }[]>([]);
  const [activeSection, setActiveSection] = useState<"overview" | "jobs" | "crisis" | "db">("overview");

  const log = (msg: string, ok = true) => {
    setActionLog((prev) => [{ msg, ok, ts: Date.now() }, ...prev].slice(0, 20));
  };

  const loadStats = () => {
    setLoading(true);
    fetchAdminStats()
      .then((s) => { setStats(s); setLoading(false); })
      .catch(() => { setLoading(false); log("Ошибка загрузки статистики", false); });
  };

  useEffect(() => { loadStats(); }, []);

  const triggerJob = async (job: string, label: string) => {
    try {
      await adminTriggerJob(job);
      log(`✓ Запущено: ${label}`);
      setTimeout(loadStats, 1500);
    } catch {
      log(`✗ Ошибка: ${label}`, false);
    }
  };

  const resetCrisis = async (region?: string) => {
    try {
      await adminResetCrisis(region);
      log(`✓ Кризис сброшен${region ? ": " + region.split(" ").slice(-1)[0] : " (все)"}`);
      setTimeout(loadStats, 1000);
    } catch {
      log("✗ Ошибка сброса кризиса", false);
    }
  };

  const runReseed = async () => {
    try {
      await adminReseedDb();
      log("✓ Пересев данных запущен");
    } catch {
      log("✗ Ошибка пересева", false);
    }
  };

  const JOBS = [
    { id: "simulate", label: "Симуляция доступности", icon: "⚡", desc: "Сдвинуть % наличия топлива" },
    { id: "analytics", label: "Снимок аналитики", icon: "📊", desc: "Сгенерировать аналитические данные" },
    { id: "cleanup", label: "Очистка репортов", icon: "🧹", desc: "Удалить устаревшие репорты (7+ дней)" },
    { id: "prices", label: "Обновление цен", icon: "💹", desc: "Пересчитать ценовые мультипликаторы" },
  ];

  const SECTIONS = [
    { id: "overview" as const, label: "Обзор", icon: "📡" },
    { id: "jobs" as const, label: "Задачи", icon: "⚙️" },
    { id: "crisis" as const, label: "Кризис", icon: "🚨" },
    { id: "db" as const, label: "База данных", icon: "🗄️" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 99000,
        background: "rgba(3,3,8,0.97)",
        display: "flex", alignItems: "flex-end",
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(232,98,42,0.015) 2px,rgba(232,98,42,0.015) 4px)" }} />

      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.3 }}
        onDragEnd={(_e, info) => { if (info.offset.y > 80 || info.velocity.y > 400) onClose(); }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxHeight: "92dvh",
          background: "linear-gradient(180deg, #0d0d18 0%, #080810 100%)",
          borderTop: "1px solid #E8622A55",
          borderRadius: "24px 24px 0 0",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 -8px 60px rgba(232,98,42,0.15)",
          touchAction: "none",
        }}
      >
        <div style={{ height: "2px", background: "linear-gradient(90deg, transparent, #E8622A, #E8622A, transparent)", flexShrink: 0 }} />
        <div style={{ display: "flex", justifyContent: "center", paddingTop: "10px", paddingBottom: "2px" }}>
          <div style={{ width: "40px", height: "4px", borderRadius: "99px", background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Header */}
        <div style={{
          padding: "1rem 1.25rem 0.75rem",
          borderBottom: "1px solid #1e1e2a",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#E8622A", fontSize: "0.52rem", letterSpacing: "0.2em", marginBottom: "0.2rem" }}>
              ADMIN · СИСТЕМА УПРАВЛЕНИЯ
            </div>
            <h2 style={{ color: "#e2e8f0", fontSize: "1rem", fontWeight: 800, margin: 0 }}>
              🛡️ Панель Администратора
            </h2>
          </div>
          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <button
              onClick={loadStats}
              style={{ background: "none", border: "1px solid #1e1e2a", borderRadius: "8px", color: "#6b7280", padding: "0.35rem 0.6rem", fontSize: "0.75rem", cursor: "pointer" }}
            >
              ↻
            </button>
            <button
              onClick={onClose}
              style={{ background: "none", border: "1px solid #1e1e2a", borderRadius: "8px", color: "#6b7280", padding: "0.35rem 0.6rem", fontSize: "0.75rem", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Section tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #1e1e2a", flexShrink: 0 }}>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              style={{
                flex: 1,
                padding: "0.6rem 0.25rem",
                background: "none", border: "none",
                borderBottom: activeSection === s.id ? "2px solid #E8622A" : "2px solid transparent",
                color: activeSection === s.id ? "#E8622A" : "#4b5563",
                fontSize: "0.58rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
                transition: "color 0.2s",
              }}
            >
              <span style={{ fontSize: "0.9rem" }}>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem 2rem" }}>
          {loading && (
            <div style={{ textAlign: "center", padding: "3rem", color: "#4b5563" }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} style={{ display: "inline-block", fontSize: "1.5rem", marginBottom: "0.5rem" }}>⚙️</motion.div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.65rem" }}>ЗАГРУЗКА...</div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {!loading && activeSection === "overview" && (
              <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {stats && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                      {[
                        { label: "Станций", value: stats.stations_total, color: "#22c55e", icon: "⛽" },
                        { label: "Пользователей", value: stats.users_total, color: "#E8622A", icon: "👥" },
                        { label: "Покупок", value: stats.vouchers_total, color: "#06b6d4", icon: "🎫" },
                        { label: "Репортов (24ч)", value: stats.reports_24h, color: "#eab308", icon: "📝" },
                      ].map((m) => (
                        <div key={m.label} style={{
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid #1e1e2a",
                          borderRadius: "12px",
                          padding: "0.75rem",
                        }}>
                          <div style={{ fontSize: "0.9rem", marginBottom: "0.3rem" }}>{m.icon}</div>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "1.3rem", fontWeight: 700, color: m.color }}>{m.value.toLocaleString()}</div>
                          <div style={{ fontSize: "0.6rem", color: "#6b7280", marginTop: "0.1rem" }}>{m.label}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1e1e2a", borderRadius: "12px", padding: "0.75rem" }}>
                      <div style={{ fontSize: "0.6rem", color: "#6b7280", marginBottom: "0.6rem", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.1em" }}>СИСТЕМНЫЙ СТАТУС</div>
                      {[
                        { label: "Backend API", ok: true },
                        { label: "APScheduler", ok: stats.scheduler_running },
                        { label: "WebSocket", ok: true },
                        { label: "SQLite WAL", ok: true },
                      ].map((item) => (
                        <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.3rem 0", borderBottom: "1px solid #0e0e18" }}>
                          <span style={{ fontSize: "0.73rem", color: "#94a3b8" }}>{item.label}</span>
                          <span style={{ fontSize: "0.58rem", color: item.ok ? "#22c55e" : "#ef4444", fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>
                            ● {item.ok ? "ONLINE" : "OFFLINE"}
                          </span>
                        </div>
                      ))}
                    </div>

                    {stats.crisis_zones.length > 0 && (
                      <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid #ef444433", borderRadius: "12px", padding: "0.75rem" }}>
                        <div style={{ fontSize: "0.6rem", color: "#ef4444", marginBottom: "0.5rem", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.1em" }}>
                          ⚠ КРИЗИСНЫЕ ЗОНЫ ({stats.crisis_zones.length})
                        </div>
                        {stats.crisis_zones.slice(0, 5).map((z) => (
                          <div key={z} style={{ fontSize: "0.7rem", color: "#9ca3af", padding: "0.12rem 0" }}>· {z}</div>
                        ))}
                        {stats.crisis_zones.length > 5 && (
                          <div style={{ fontSize: "0.6rem", color: "#4b5563", marginTop: "0.25rem" }}>+{stats.crisis_zones.length - 5} ещё</div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {!loading && activeSection === "jobs" && (
              <motion.div key="jobs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                <div style={{ fontSize: "0.6rem", color: "#6b7280", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.1em", marginBottom: "0.25rem" }}>
                  ПЛАНИРОВЩИК ЗАДАЧ · APScheduler
                </div>
                {JOBS.map((job) => (
                  <div key={job.id} style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid #1e1e2a",
                    borderRadius: "12px",
                    padding: "0.75rem",
                    display: "flex", alignItems: "center", gap: "0.75rem",
                  }}>
                    <div style={{ fontSize: "1.2rem", flexShrink: 0 }}>{job.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.77rem", fontWeight: 600, color: "#e2e8f0", marginBottom: "0.1rem" }}>{job.label}</div>
                      <div style={{ fontSize: "0.63rem", color: "#4b5563" }}>{job.desc}</div>
                    </div>
                    <button
                      onClick={() => triggerJob(job.id, job.label)}
                      style={{
                        background: "linear-gradient(135deg,rgba(232,98,42,0.15),rgba(232,98,42,0.15))",
                        border: "1px solid #E8622A40",
                        borderRadius: "8px",
                        color: "#E8622A",
                        fontSize: "0.63rem",
                        fontWeight: 700,
                        padding: "0.35rem 0.65rem",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      ▶ RUN
                    </button>
                  </div>
                ))}
              </motion.div>
            )}

            {!loading && activeSection === "crisis" && (
              <motion.div key="crisis" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ fontSize: "0.6rem", color: "#6b7280", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.1em" }}>
                  УПРАВЛЕНИЕ КРИЗИСОМ
                </div>
                <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid #ef444433", borderRadius: "12px", padding: "0.85rem" }}>
                  <div style={{ fontSize: "0.75rem", color: "#e2e8f0", marginBottom: "0.6rem", fontWeight: 600 }}>Массовый сброс</div>
                  <button
                    onClick={() => resetCrisis()}
                    style={{
                      width: "100%",
                      background: "linear-gradient(135deg,#7f1d1d,#991b1b)",
                      border: "1px solid #ef444455",
                      borderRadius: "10px",
                      color: "#fca5a5",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      padding: "0.7rem",
                      cursor: "pointer",
                      marginBottom: "0.4rem",
                    }}
                  >
                    🚨 Сбросить все кризисы
                  </button>
                  <div style={{ fontSize: "0.58rem", color: "#4b5563", textAlign: "center" }}>
                    Восстановит нормальный уровень доступности во всех регионах
                  </div>
                </div>

                {stats && stats.crisis_zones.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <div style={{ fontSize: "0.6rem", color: "#6b7280", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.1em" }}>СБРОС ПО РЕГИОНУ</div>
                    {stats.crisis_zones.map((z) => (
                      <div key={z} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", border: "1px solid #1e1e2a", borderRadius: "8px", padding: "0.5rem 0.75rem" }}>
                        <span style={{ fontSize: "0.7rem", color: "#ef4444" }}>⚠ {z.split(" ").slice(-1)[0]}</span>
                        <button
                          onClick={() => resetCrisis(z)}
                          style={{ background: "none", border: "1px solid #ef444433", borderRadius: "6px", color: "#ef4444", fontSize: "0.6rem", padding: "0.25rem 0.5rem", cursor: "pointer" }}
                        >
                          Сбросить
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {stats && stats.crisis_zones.length === 0 && (
                  <div style={{ textAlign: "center", padding: "1.5rem", color: "#22c55e", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.65rem" }}>
                    ● Кризисных зон нет
                  </div>
                )}
              </motion.div>
            )}

            {!loading && activeSection === "db" && (
              <motion.div key="db" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ fontSize: "0.6rem", color: "#6b7280", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.1em" }}>
                  БАЗА ДАННЫХ · SQLite WAL
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {[
                    { label: "Режим", value: "WAL (Write-Ahead Logging)" },
                    { label: "Размер", value: stats ? `${stats.db_size_mb.toFixed(2)} MB` : "—" },
                    { label: "Таблиц", value: "6 моделей данных" },
                    { label: "Путь", value: "/home/runner/workspace/tma.db" },
                  ].map((row) => (
                    <div key={row.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #1e1e2a", borderRadius: "8px", padding: "0.6rem 0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.63rem", color: "#6b7280" }}>{row.label}</span>
                      <span style={{ fontSize: "0.65rem", color: "#94a3b8", fontFamily: "'JetBrains Mono',monospace", maxWidth: "55%", textAlign: "right", wordBreak: "break-all" }}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={runReseed}
                  style={{
                    background: "rgba(6,182,212,0.08)",
                    border: "1px solid #06b6d433",
                    borderRadius: "10px",
                    color: "#06b6d4",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    padding: "0.75rem",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  🔄 Пересев данных (reseed)
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action log */}
          {actionLog.length > 0 && (
            <div style={{
              marginTop: "1rem",
              background: "rgba(0,0,0,0.4)",
              border: "1px solid #0e0e18",
              borderRadius: "10px",
              padding: "0.6rem 0.75rem",
              maxHeight: "130px",
              overflowY: "auto",
            }}>
              <div style={{ fontSize: "0.52rem", color: "#374151", fontFamily: "'JetBrains Mono',monospace", marginBottom: "0.4rem", letterSpacing: "0.1em" }}>ACTION LOG</div>
              {actionLog.map((entry) => (
                <div key={entry.ts} style={{ fontSize: "0.62rem", color: entry.ok ? "#22c55e" : "#ef4444", fontFamily: "'JetBrains Mono',monospace", padding: "0.1rem 0" }}>
                  [{new Date(entry.ts).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}] {entry.msg}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
