import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore, getGridSize } from "@/game/store";
import type { PlacedBuilding } from "@/game/store";
import { BUILDINGS, BUILDING_LIST } from "@/game/buildings";
import type { BuildingId } from "@/game/buildings";
import type { ResourceId } from "@/game/resources";
import { CRISIS_EVENTS } from "@/game/events";
import { renderFrame, getCanvasCoords } from "@/game/renderer";
import { getUpgradeCost, getProductionRates } from "@/game/engine";
import { LEVEL_TITLES, DAILY_REWARDS, CRISIS_SHOP, TILE_W, TILE_H } from "@/game/constants";
import { useUserStore } from "@/stores/useUserStore";
import { fetchEmpireLeaderboard, type EmpireLeaderboardEntry } from "@/api/client";

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}М`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}К`;
  return Math.floor(n).toString();
}

function ResourceChip({ icon, label, value, rate, color }: {
  icon: string; label: string; value: number; rate?: number; color: string;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5,
      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 999, padding: "5px 10px", flexShrink: 0, whiteSpace: "nowrap",
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{fmtNum(value)}</div>
        {rate !== undefined && rate > 0 && (
          <div style={{ fontSize: 9, color: color }}>+{rate.toFixed(1)}/с</div>
        )}
      </div>
    </div>
  );
}

function CrisisBanner({ crisisId, timeLeft }: { crisisId: string; timeLeft: number }) {
  const crisis = CRISIS_EVENTS.find(e => e.id === crisisId);
  if (!crisis) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      margin: "6px 10px", padding: "10px 12px",
      background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)",
      borderRadius: 12,
      animation: "pulseBorder 2s ease-in-out infinite",
    }}>
      <span style={{ fontSize: 18 }}>{crisis.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444" }}>{crisis.name}</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>{crisis.description}</div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#ef4444", minWidth: 44, textAlign: "right" }}>
        {Math.ceil(timeLeft)}с
      </div>
    </div>
  );
}

function DailyRewardsRow({ loginDay, lastRewardDate, onClaim }: {
  loginDay: number; lastRewardDate: string; onClaim: () => void;
}) {
  const today = new Date().toDateString();
  const canClaim = lastRewardDate !== today;
  return (
    <div style={{ padding: "8px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Ежедневные награды
        </span>
        {canClaim && (
          <button onClick={onClaim} style={{
            background: "linear-gradient(135deg,#7c3aed,#5b21b6)", border: "none",
            borderRadius: 8, color: "#fff", fontSize: 10, fontWeight: 700,
            padding: "3px 10px", cursor: "pointer",
          }}>
            Забрать
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 2 }}>
        {DAILY_REWARDS.map((r, i) => {
          const dayNum = i + 1;
          const isCurrent = loginDay === dayNum;
          const isPast = loginDay > dayNum;
          return (
            <div key={r.day} style={{
              flexShrink: 0, background: isCurrent ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${isCurrent ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.07)"}`,
              borderRadius: 10, padding: "6px 8px", textAlign: "center",
              minWidth: 48, opacity: isPast ? 0.4 : 1,
              boxShadow: isCurrent ? "0 0 12px rgba(124,58,237,0.3)" : "none",
            }}>
              {isPast && <div style={{ fontSize: 14 }}>✅</div>}
              {!isPast && <div style={{ fontSize: 13 }}>💰</div>}
              <div style={{ fontSize: 9, fontWeight: 700, color: isCurrent ? "#c4b5fd" : "rgba(255,255,255,0.5)" }}>
                {fmtNum(r.coins)}
              </div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)" }}>{r.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BuildMenu({ onBuild, playerLevel, resources, onClose }: {
  onBuild: (id: BuildingId, col: number, row: number) => void;
  playerLevel: number; resources: Record<ResourceId, number>;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      style={{
        position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 200,
        background: "rgba(10,12,20,0.97)", backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px 20px 0 0",
        maxHeight: "62vh", overflowY: "auto",
      }}
    >
      <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.18)", borderRadius: 99, margin: "10px auto" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 10px" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>🏗️ Строительство</span>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "#fff", fontSize: 14 }}>×</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "0 12px 20px" }}>
        {BUILDING_LIST.map(def => {
          const locked = playerLevel < def.unlockLevel;
          const coinCost = def.buildCost.coins ?? 0;
          const canAfford = !locked && (resources.coins ?? 0) >= coinCost;
          return (
            <button
              key={def.id}
              onClick={() => !locked && onBuild(def.id, 0, 0)}
              disabled={locked || !canAfford}
              style={{
                background: locked ? "rgba(255,255,255,0.02)" : canAfford ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${locked ? "rgba(255,255,255,0.04)" : canAfford ? "rgba(255,255,255,0.1)" : "rgba(239,68,68,0.2)"}`,
                borderRadius: 14, padding: "12px 10px", cursor: locked ? "not-allowed" : canAfford ? "pointer" : "not-allowed",
                textAlign: "left", opacity: locked ? 0.4 : 1, transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: 26, marginBottom: 4 }}>{def.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#fff", marginBottom: 2 }}>{def.name}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginBottom: 6, lineHeight: 1.3 }}>{def.description.slice(0, 48)}</div>
              {locked ? (
                <span style={{ fontSize: 9, color: "#f59e0b" }}>🔒 Ур.{def.unlockLevel}</span>
              ) : (
                <span style={{ fontSize: 10, color: canAfford ? "#f59e0b" : "#ef4444", fontWeight: 700 }}>
                  💰 {fmtNum(coinCost)}
                  {Object.keys(def.buildCost).filter(k => k !== "coins").map(k => (
                    <span key={k}> · {fmtNum(def.buildCost[k as ResourceId] ?? 0)}{k === "crude_oil" ? "🛢️" : k === "xp" ? "⭐" : ""}</span>
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

function BuildingDetailPanel({ building, onClose, onUpgrade, onDemolish }: {
  building: PlacedBuilding; onClose: () => void;
  onUpgrade: () => void; onDemolish: () => void;
}) {
  const def = BUILDINGS[building.id];
  if (!def) return null;
  const cost = getUpgradeCost(building);
  return (
    <motion.div
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      style={{
        position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 200,
        background: "rgba(10,12,20,0.97)", backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px 20px 0 0",
        padding: "0 0 24px",
      }}
    >
      <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.18)", borderRadius: 99, margin: "10px auto 0" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px 10px" }}>
        <span style={{ fontSize: 32 }}>{def.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
            {def.name}
            <span style={{ marginLeft: 8, fontSize: 11, background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 6, padding: "1px 6px", color: "#c4b5fd" }}>
              Ур.{building.level}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{def.description}</div>
        </div>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "#fff", fontSize: 14 }}>×</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "0 14px 14px" }}>
        {Object.keys(def.produces).length > 0 && (
          <div style={{ background: "rgba(0,230,118,0.05)", border: "1px solid rgba(0,230,118,0.15)", borderRadius: 10, padding: "8px 10px" }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 2 }}>Производит/с</div>
            {Object.entries(def.produces).map(([r, v]) => (
              <div key={r} style={{ fontSize: 12, fontWeight: 700, color: "#00e676" }}>
                {((v as number) * Math.pow(def.productionPerLevel, building.level - 1)).toFixed(2)}/с
              </div>
            ))}
          </div>
        )}
        <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 10, padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 2 }}>Стоимость апгрейда</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>💰 {fmtNum(cost)}</div>
        </div>
      </div>
      <div style={{ padding: "0 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {building.level < def.maxLevel && (
          <button onClick={onUpgrade} style={{
            width: "100%", height: 46, background: "linear-gradient(135deg,#7c3aed,#5b21b6)",
            border: "none", borderRadius: 13, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 4px 20px rgba(124,58,237,0.4)",
          }}>
            ⬆️ Улучшить до Ур.{building.level + 1} — {fmtNum(cost)} 💰
          </button>
        )}
        <button onClick={onDemolish} style={{
          width: "100%", height: 38,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 11, color: "#ef4444", fontSize: 12, cursor: "pointer",
        }}>
          🗑️ Снести (+{fmtNum(Math.floor((def.buildCost.coins ?? 0) * 0.3))} 💰)
        </button>
      </div>
    </motion.div>
  );
}

function CrisisShopModal({ tokens, onBuy, onClose }: {
  tokens: number; onBuy: (id: string) => void; onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "flex-end" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", background: "rgba(10,12,20,0.98)", backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px 20px 0 0",
          padding: "0 0 28px",
        }}
      >
        <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.18)", borderRadius: 99, margin: "10px auto 0" }} />
        <div style={{ padding: "10px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>🔴 Кризис-магазин</span>
          <span style={{ fontSize: 13, color: "#ef4444", fontWeight: 700 }}>🔴 {tokens} токенов</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 12px" }}>
          {CRISIS_SHOP.map(item => (
            <button
              key={item.id}
              onClick={() => onBuy(item.id)}
              disabled={tokens < item.cost}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                background: tokens >= item.cost ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${tokens >= item.cost ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 12, padding: "10px 12px", cursor: tokens >= item.cost ? "pointer" : "not-allowed",
                opacity: tokens >= item.cost ? 1 : 0.5, textAlign: "left",
              }}
            >
              <span style={{ fontSize: 24 }}>{item.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{item.name}</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#ef4444" }}>🔴 {item.cost}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function OfflineEarningsModal({ gains, onDismiss }: {
  gains: Partial<Record<ResourceId, number>>; onDismiss: () => void;
}) {
  const entries = Object.entries(gains).filter(([, v]) => (v ?? 0) > 0) as [ResourceId, number][];
  if (entries.length === 0) return null;
  const icons: Record<string, string> = { crude_oil: "🛢️", refined_fuel: "⛽", coins: "💰", xp: "⭐", crisis_tokens: "🔴" };
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <motion.div
        initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }}
        style={{ background: "rgba(10,12,24,0.98)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 20, padding: 24, width: "100%", maxWidth: 320, textAlign: "center" }}
      >
        <div style={{ fontSize: 36, marginBottom: 8 }}>😴</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Пока вы отсутствовали...</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>Ваша империя продолжала работать!</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {entries.map(([res, val]) => (
            <div key={res} style={{ display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "8px 12px" }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{icons[res] ?? "✨"} {res.replace("_", " ")}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#00e676" }}>+{fmtNum(val)}</span>
            </div>
          ))}
        </div>
        <button onClick={onDismiss} style={{ width: "100%", height: 44, background: "linear-gradient(135deg,#7c3aed,#5b21b6)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          Забрать!
        </button>
      </motion.div>
    </motion.div>
  );
}

function LeaderboardPanel({ onClose, currentUserId }: { onClose: () => void; currentUserId: number | null }) {
  const [entries, setEntries] = useState<EmpireLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmpireLeaderboard()
      .then(r => setEntries(r.entries))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 400, display: "flex", alignItems: "flex-end" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", background: "rgba(10,12,20,0.98)", backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px 20px 0 0",
          maxHeight: "72vh", overflow: "hidden", display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.18)", borderRadius: 99, margin: "10px auto 0", flexShrink: 0 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 12px", flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>🏆 Рейтинг Империй</span>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "#fff", fontSize: 14 }}>×</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "0 12px 24px" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: 32, fontSize: 13 }}>Загрузка…</div>
          ) : entries.length === 0 ? (
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: 32, fontSize: 13 }}>Пока нет игроков — будьте первым!</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {entries.map(e => {
                const isMe = currentUserId !== null && e.user_id === currentUserId;
                return (
                  <div key={e.user_id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: isMe ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${isMe ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.07)"}`,
                    borderRadius: 12, padding: "8px 12px",
                  }}>
                    <span style={{ fontSize: 18, minWidth: 24, textAlign: "center" }}>
                      {e.rank <= 3 ? medals[e.rank - 1] : `#${e.rank}`}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isMe ? "#c4b5fd" : "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {e.username ? `@${e.username}` : `Игрок ${e.user_id}`}
                        {isMe && <span style={{ marginLeft: 6, fontSize: 10, color: "#a78bfa" }}>ВЫ</span>}
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                        Ур.{e.empire_level} · {e.prestige_count > 0 ? `⭐×${e.prestige_count} · ` : ""}💰{fmtNum(e.coins)}
                      </div>
                    </div>
                    <div style={{ fontSize: 20 }}>🏭</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function GamesPage() {
  const { state, offlineGains, initGame, tickGame, placeBuilding, upgradeBuilding, demolishBuilding, claimDailyReward, buyFromCrisisShop, dismissOfflineGains, syncWithBackend, pushToBackend } = useGameStore();
  const { user } = useUserStore();
  const userId = user?.id ?? null;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const tickTimerRef = useRef<number>(0);
  const backendSyncRef = useRef<number>(0);

  const [tileW, setTileW] = useState(TILE_W);
  const [tileH, setTileH] = useState(TILE_H);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [selectedTile, setSelectedTile] = useState<{ col: number; row: number } | null>(null);
  const [hoverTile, setHoverTile] = useState<{ col: number; row: number } | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<PlacedBuilding | null>(null);
  const [showBuildMenu, setShowBuildMenu] = useState(false);
  const [pendingBuildId, setPendingBuildId] = useState<BuildingId | null>(null);
  const [showCrisisShop, setShowCrisisShop] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [notifications, setNotifications] = useState<{ id: number; text: string; type: string }[]>([]);

  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, lastX: 0, lastY: 0, moved: false });
  const pinchRef = useRef({ active: false, dist: 0 });

  useEffect(() => {
    initGame();
  }, [initGame]);

  // Sync with backend: load remote state on mount, then push every 2 minutes
  useEffect(() => {
    if (!userId) return;
    syncWithBackend(userId);
    backendSyncRef.current = window.setInterval(() => {
      pushToBackend(userId);
    }, 120_000);
    return () => clearInterval(backendSyncRef.current);
  }, [userId, syncWithBackend, pushToBackend]);

  useEffect(() => {
    const len = state.notifications.length;
    if (len === 0) return;
    const last = state.notifications[len - 1];
    setNotifications(prev => {
      if (prev.some(n => n.id === last.id)) return prev;
      const next = [...prev.slice(-3), last];
      return next;
    });
    const t = setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== last.id)), 3000);
    return () => clearTimeout(t);
  }, [state.notifications]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }, []);

  useEffect(() => {
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [resizeCanvas]);

  useEffect(() => {
    let running = true;
    const loop = (ts: number) => {
      if (!running) return;
      const dt = Math.min((ts - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = ts;
      tickTimerRef.current += dt;
      if (tickTimerRef.current >= 1) {
        tickGame(tickTimerRef.current);
        tickTimerRef.current = 0;
      }
      if (canvasRef.current) {
        renderFrame(canvasRef.current, state, ts, selectedTile, hoverTile, tileW, tileH, offsetX, offsetY);
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame((ts) => { lastTimeRef.current = ts; loop(ts); });
    return () => { running = false; cancelAnimationFrame(animFrameRef.current); };
  }, [state, selectedTile, hoverTile, tileW, tileH, offsetX, offsetY, tickGame]);

  const getBuildingAt = useCallback((col: number, row: number): PlacedBuilding | null => {
    return state.buildings.find(b => {
      const def = BUILDINGS[b.id];
      return col >= b.col && col < b.col + def.tileSize && row >= b.row && row < b.row + def.tileSize;
    }) ?? null;
  }, [state.buildings]);

  const handleTileClick = useCallback((col: number, row: number) => {
    const gridSize = getGridSize(state.level);
    if (col < 0 || row < 0 || col >= gridSize || row >= gridSize) return;

    if (pendingBuildId) {
      const err = placeBuilding(pendingBuildId, col, row);
      if (err) {
        setNotifications(prev => [...prev.slice(-3), { id: Date.now(), text: `❌ ${err}`, type: "error" }]);
        setTimeout(() => setNotifications(p => p.filter(n => n.text !== `❌ ${err}`)), 2500);
      }
      setPendingBuildId(null);
      setShowBuildMenu(false);
      return;
    }

    const building = getBuildingAt(col, row);
    if (building) {
      setSelectedBuilding(building);
      setSelectedTile({ col, row });
    } else {
      setSelectedTile({ col, row });
      setSelectedBuilding(null);
      setShowBuildMenu(true);
    }
  }, [pendingBuildId, placeBuilding, getBuildingAt, state.level]);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    const dist = Math.sqrt(Math.pow(e.clientX - dragRef.current.startX, 2) + Math.pow(e.clientY - dragRef.current.startY, 2));
    if (dist > 5) dragRef.current.moved = true;
    setOffsetX(x => x + dx);
    setOffsetY(y => y + dy);
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    if (canvasRef.current) {
      const { col, row } = getCanvasCoords(canvasRef.current, e.clientX, e.clientY, tileW, tileH, offsetX + dx, offsetY + dy);
      setHoverTile({ col, row });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current.moved && canvasRef.current) {
      const { col, row } = getCanvasCoords(canvasRef.current, e.clientX, e.clientY, tileW, tileH, offsetX, offsetY);
      handleTileClick(col, row);
    }
    dragRef.current.dragging = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setTileW(w => Math.max(TILE_W * 0.5, Math.min(TILE_W * 2, w * factor)));
    setTileH(h => Math.max(TILE_H * 0.5, Math.min(TILE_H * 2, h * factor)));
  };

  const rates = getProductionRates(state);
  const usedWorkers = state.buildings.reduce((s, b) => s + (BUILDINGS[b.id]?.workersRequired ?? 0), 0);
  const totalWorkers = 10 + state.buildings.filter(b => b.id === "worker_camp").length * 5;
  const levelTitle = LEVEL_TITLES[Math.min(state.level - 1, LEVEL_TITLES.length - 1)];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "linear-gradient(180deg,#0a0c14 0%,#080a12 100%)", overflow: "hidden", position: "relative" }}>
      <style>{`
        @keyframes pulseBorder { 0%,100% { border-color: rgba(239,68,68,0.25); } 50% { border-color: rgba(239,68,68,0.6); } }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px 6px", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>🏭</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f59e0b" }}>Нефтяная Империя</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>{levelTitle} · Ур.{state.level}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, padding: "3px 8px" }}>
            👷 {usedWorkers}/{totalWorkers}
          </div>
          <button
            onClick={() => setShowLeaderboard(true)}
            style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, padding: "3px 8px", color: "#f59e0b", fontSize: 13, cursor: "pointer" }}
            title="Рейтинг"
          >
            🏆
          </button>
          <button
            onClick={() => setShowCrisisShop(true)}
            style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "3px 8px", color: "#ef4444", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          >
            🔴 {Math.floor(state.resources.crisis_tokens ?? 0)}
          </button>
        </div>
      </div>

      {/* Resource HUD */}
      <div style={{ display: "flex", gap: 6, padding: "6px 10px", overflowX: "auto", scrollbarWidth: "none", background: "rgba(0,0,0,0.25)", flexShrink: 0 }}>
        <ResourceChip icon="🛢️" label="Нефть" value={state.resources.crude_oil ?? 0} rate={rates.crude_oil} color="#8B4513" />
        <ResourceChip icon="⛽" label="Топливо" value={state.resources.refined_fuel ?? 0} rate={rates.refined_fuel} color="#3b82f6" />
        <ResourceChip icon="💰" label="Монеты" value={state.resources.coins ?? 0} rate={rates.coins} color="#f59e0b" />
        <ResourceChip icon="⭐" label="Опыт" value={state.resources.xp ?? 0} color="#8b5cf6" />
      </div>

      {/* Crisis Banner */}
      {state.activeCrisis && (
        <CrisisBanner crisisId={state.activeCrisis} timeLeft={state.crisisTimeLeft} />
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        style={{ flex: 1, overflow: "hidden", position: "relative", cursor: dragRef.current.dragging ? "grabbing" : "grab", minHeight: 0 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => { dragRef.current.dragging = false; setHoverTile(null); }}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} style={{ display: "block", touchAction: "none" }} />
        {pendingBuildId && (
          <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", background: "rgba(124,58,237,0.9)", borderRadius: 10, padding: "6px 14px", color: "#fff", fontSize: 11, fontWeight: 700, pointerEvents: "none", zIndex: 100 }}>
            👆 Нажмите на пустую клетку для постройки
          </div>
        )}
      </div>

      {/* Daily Rewards */}
      <div style={{ flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.2)" }}>
        <DailyRewardsRow loginDay={state.loginDay} lastRewardDate={state.lastRewardDate} onClaim={claimDailyReward} />
      </div>

      {/* Notifications */}
      <div style={{ position: "absolute", top: 8, right: 8, display: "flex", flexDirection: "column", gap: 4, zIndex: 150, pointerEvents: "none" }}>
        <AnimatePresence>
          {notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
              style={{
                background: n.type === "crisis" ? "rgba(239,68,68,0.9)" : n.type === "error" ? "rgba(239,68,68,0.8)" : "rgba(0,230,118,0.85)",
                borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, color: "#fff",
                maxWidth: 200, boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
              }}
            >
              {n.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom panels */}
      <AnimatePresence>
        {showBuildMenu && !selectedBuilding && (
          <BuildMenu
            onBuild={(id) => { setPendingBuildId(id); setShowBuildMenu(false); setSelectedTile(null); }}
            playerLevel={state.level}
            resources={state.resources}
            onClose={() => { setShowBuildMenu(false); setSelectedTile(null); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedBuilding && (
          <BuildingDetailPanel
            building={selectedBuilding}
            onClose={() => { setSelectedBuilding(null); setSelectedTile(null); }}
            onUpgrade={() => { upgradeBuilding(selectedBuilding.uid); setSelectedBuilding(s => s ? { ...s, level: s.level + 1 } : null); }}
            onDemolish={() => { demolishBuilding(selectedBuilding.uid); setSelectedBuilding(null); setSelectedTile(null); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCrisisShop && (
          <CrisisShopModal
            tokens={Math.floor(state.resources.crisis_tokens ?? 0)}
            onBuy={(id) => { buyFromCrisisShop(id); setShowCrisisShop(false); }}
            onClose={() => setShowCrisisShop(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLeaderboard && (
          <LeaderboardPanel
            onClose={() => setShowLeaderboard(false)}
            currentUserId={userId}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {Object.keys(offlineGains).length > 0 && (
          <OfflineEarningsModal gains={offlineGains} onDismiss={dismissOfflineGains} />
        )}
      </AnimatePresence>
    </div>
  );
}
