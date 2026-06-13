import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { flipCard, submitTapScore, dailyCheckin, fetchLeaderboard, fetchReferral, useReferralCode } from "@/api/client";
import { useUserStore } from "@/stores/useUserStore";
import { useGameStore } from "@/stores/useGameStore";
import { useToast } from "@/components/Toast";
import type { FlipResult, FlipCard, Leaderboard, ReferralInfo } from "@/types";
import { RARITY_COLORS } from "@/types";

const TIER_COLORS: Record<string, string> = {
  "🚶 Пешеход":          "#6b7280",
  "🚲 Самокатчик":       "#22c55e",
  "🛵 Мопедист":         "#3b82f6",
  "🚗 Извозчик":         "#eab308",
  "🚛 Дальнобойщик":     "#f97316",
  "⚡ Бензиновый Барон": "#a855f7",
  "👑 Владелец НПЗ":     "#db2777",
};

const RESULT_GLOW: Record<string, string> = {
  mythic:    "#db2777",
  legendary: "#f59e0b",
  epic:      "#a855f7",
  rare:      "#3b82f6",
  cursed:    "#ef4444",
  common:    "#6b7280",
  blocked:   "#ef4444",
};

// ─── Card Flip Game ───────────────────────────────────────────────

function CardTile({ card, delay }: { card: FlipCard; delay: number }) {
  const [revealed, setRevealed] = useState(false);
  const color = RARITY_COLORS[card.rarity] ?? "#6b7280";
  const isPositive = card.xp >= 0;

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <motion.div
      initial={{ rotateY: 180, opacity: 0.3 }}
      animate={revealed ? { rotateY: 0, opacity: 1 } : { rotateY: 180, opacity: 0.3 }}
      transition={{ type: "spring", damping: 18, stiffness: 200 }}
      style={{
        background: revealed ? `${color}18` : "linear-gradient(135deg,#1e1e2a,#14141c)",
        border: `1px solid ${revealed ? color + "55" : "#22222f"}`,
        borderRadius: "12px",
        padding: "0.55rem 0.35rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.25rem",
        minHeight: "90px",
        boxShadow: revealed ? `0 0 14px ${color}33` : "none",
        transition: "box-shadow 0.4s",
      }}
    >
      <span style={{ fontSize: "1.6rem", lineHeight: 1 }}>
        {revealed ? card.emoji : "❓"}
      </span>
      {revealed && (
        <>
          <span style={{
            fontSize: "0.58rem", color, fontWeight: 700, textAlign: "center",
            lineHeight: 1.2, maxWidth: "90%",
          }}>
            {card.name}
          </span>
          <span style={{
            fontSize: "0.65rem",
            color: isPositive ? "#22c55e" : "#ef4444",
            fontWeight: 800,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {isPositive ? "+" : ""}{card.xp.toLocaleString("ru")}
          </span>
          <span style={{
            fontSize: "0.5rem", color,
            background: `${color}22`,
            borderRadius: "4px",
            padding: "0.1rem 0.3rem",
          }}>
            {card.rarity}
          </span>
        </>
      )}
    </motion.div>
  );
}

function FlipGame() {
  const { user, refresh } = useUserStore();
  const { setFlipResult, flipsRemaining, setFlipsRemaining } = useGameStore();
  const { add: toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FlipResult | null>(null);
  const [played, setPlayed] = useState(false);

  const hasAttempts = flipsRemaining > 0 && !played;
  const glowColor = result ? RESULT_GLOW[result.result_type] ?? "#6b7280" : "#a855f7";

  const handleDraw = async () => {
    if (!user || loading || !hasAttempts) return;
    setLoading(true);
    try {
      const res = await flipCard(user.id);
      setResult(res);
      setPlayed(true);
      setFlipsRemaining(res.attempts_remaining);
      setFlipResult(res.result_type, res.attempts_remaining);
      const xp = res.total_xp_delta;
      const sign = xp >= 0 ? "+" : "";
      if (res.result_type === "mythic" || res.result_type === "legendary") {
        toast(`🏆 ${res.message}`, "success");
      } else if (res.result_type === "cursed") {
        toast(`💀 ${sign}${xp.toLocaleString("ru")} XP`, "error");
      } else {
        toast(`🃏 Набор вскрыт: ${sign}${xp.toLocaleString("ru")} XP`, "success");
      }
      await refresh();
    } catch (e: unknown) {
      toast(String(e), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "0 1rem 1.5rem" }}>
      <div style={{
        background: "#14141c",
        border: `1px solid ${result ? glowColor + "55" : "#22222f"}`,
        borderRadius: "16px",
        padding: "1rem",
        boxShadow: result ? `0 0 24px ${glowColor}22` : "none",
        transition: "border-color 0.5s, box-shadow 0.5s",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
          <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: "0.95rem", fontWeight: 700 }}>
            🃏 Бензиновое Таро...мда🤞
          </h3>
          <span style={{
            background: hasAttempts ? "#a855f722" : "#22222f",
            border: `1px solid ${hasAttempts ? "#a855f744" : "#33333f"}`,
            color: hasAttempts ? "#a855f7" : "#4b5563",
            borderRadius: "8px",
            padding: "0.2rem 0.5rem",
            fontSize: "0.7rem",
            fontWeight: 600,
          }}>
            {played ? "Сыграно" : "1 раз в сутки"}
          </span>
        </div>

        <p style={{ color: "#6b7280", fontSize: "0.73rem", margin: "0 0 0.75rem" }}>
          Один бросок в сутки — 5 случайных карт из 200+. XP начисляется мгновенно.
        </p>

        {/* Card grid or result */}
        {!result ? (
          <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={handleDraw}
              disabled={!hasAttempts || loading}
              style={{
                background: (!hasAttempts || loading)
                  ? "#22222f"
                  : "linear-gradient(135deg,#a855f7,#db2777)",
                color: (!hasAttempts || loading) ? "#4b5563" : "#fff",
                border: "none",
                borderRadius: "14px",
                padding: "0.85rem 2.5rem",
                fontSize: "0.95rem",
                fontWeight: 700,
                cursor: (!hasAttempts || loading) ? "not-allowed" : "pointer",
                boxShadow: (!hasAttempts || loading) ? "none" : "0 0 20px #a855f755",
              }}
            >
              {loading ? "🔀 Перемешиваю колоду…" : played ? "⏳ Завтра — новый розыгрыш" : "🃏 Вскрыть 5 карт"}
            </motion.button>
          </div>
        ) : (
          <>
            {/* 5-card grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "0.35rem",
              marginBottom: "0.75rem",
            }}>
              {result.cards.map((card, i) => (
                <CardTile key={i} card={card} delay={i * 200} />
              ))}
            </div>

            {/* Result banner */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              style={{
                background: `${glowColor}11`,
                border: `1px solid ${glowColor}44`,
                borderRadius: "10px",
                padding: "0.65rem",
                textAlign: "center",
              }}
            >
              <p style={{
                margin: "0 0 0.2rem",
                color: glowColor,
                fontWeight: 700,
                fontSize: "0.85rem",
              }}>
                {result.message}
              </p>
              <p style={{ margin: 0, color: "#9ca3af", fontSize: "0.7rem" }}>
                Следующий розыгрыш — завтра после полуночи
              </p>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Tap Game ─────────────────────────────────────────────────────

const GAME_DURATION = 30;

interface Spawnable {
  id: number;
  x: number;
  y: number;
  type: "pump" | "canister";
  alive: boolean;
}

function TapGame() {
  const { user, refresh } = useUserStore();
  const { setTapScore, tapHighScore } = useGameStore();
  const { add: toast } = useToast();

  const [phase, setPhase] = useState<"idle" | "playing" | "result">("idle");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [items, setItems] = useState<Spawnable[]>([]);
  const nextId = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scoreRef = useRef(0);

  const spawnItem = useCallback(() => {
    const id = nextId.current++;
    const type = Math.random() < 0.65 ? "pump" : "canister";
    const item: Spawnable = {
      id, x: 5 + Math.random() * 80, y: 5 + Math.random() * 70,
      type, alive: true,
    };
    setItems((prev) => [...prev, item]);
    setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }, 1500);
  }, []);

  const endGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (spawnRef.current) clearInterval(spawnRef.current);
    setPhase("result");
    setItems([]);
    setTapScore(scoreRef.current);

    if (user) {
      submitTapScore(user.id, scoreRef.current, GAME_DURATION)
        .then((res) => {
          toast(`+${res.xp_earned} XP заработано!`, "success");
          if (res.new_level) toast(`🏆 Новый уровень: ${res.level}!`, "success");
          refresh();
        })
        .catch(() => {});
    }
  }, [user, setTapScore, toast, refresh]);

  const startGame = () => {
    scoreRef.current = 0;
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setItems([]);
    setPhase("playing");

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          endGame();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    spawnRef.current = setInterval(spawnItem, 600);
  };

  const tapItem = (id: number, type: "pump" | "canister") => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    const delta = type === "pump" ? 1 : -1;
    scoreRef.current = Math.max(0, scoreRef.current + delta);
    setScore(scoreRef.current);
  };

  const timePercent = (timeLeft / GAME_DURATION) * 100;

  return (
    <div style={{ padding: "0 1rem 1.5rem" }}>
      <div style={{
        background: "#14141c", border: "1px solid #22222f",
        borderRadius: "16px", padding: "1rem", overflow: "hidden",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: "0.95rem", fontWeight: 700 }}>
            ⚡ Заправка на скорость
          </h3>
          <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>
            Рекорд: <span style={{ color: "#eab308", fontWeight: 700 }}>{tapHighScore}</span>
          </span>
        </div>

        {phase === "idle" && (
          <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
            <p style={{ color: "#6b7280", fontSize: "0.78rem", margin: "0 0 1rem" }}>
              30 секунд. Нажимайте ⛽, избегайте 🔴. Заработайте XP!
            </p>
            <button
              onClick={startGame}
              style={{
                background: "linear-gradient(135deg,#a855f7,#db2777)",
                color: "#fff", border: "none", borderRadius: "12px",
                padding: "0.75rem 2rem", fontSize: "0.9rem",
                fontWeight: 600, cursor: "pointer",
              }}
            >
              Начать игру
            </button>
          </div>
        )}

        {phase === "playing" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "1.2rem", fontWeight: 700, color: "#22c55e",
              }}>
                {score}
              </span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.9rem",
                color: timeLeft <= 10 ? "#ef4444" : "#e2e8f0",
              }}>
                {timeLeft}s
              </span>
            </div>
            <div style={{ height: "3px", background: "#0b0b0f", borderRadius: "2px", marginBottom: "0.5rem", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${timePercent}%`,
                background: timeLeft > 10 ? "#a855f7" : "#ef4444",
                transition: "width 1s linear, background 0.3s",
              }} />
            </div>
            <div style={{
              position: "relative",
              height: "220px",
              background: "#0b0b0f",
              borderRadius: "12px",
              overflow: "hidden",
              border: "1px solid #22222f",
              userSelect: "none",
              WebkitUserSelect: "none",
            }}>
              <AnimatePresence>
                {items.map((item) => (
                  <motion.button
                    key={item.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => tapItem(item.id, item.type)}
                    style={{
                      position: "absolute",
                      left: `${item.x}%`,
                      top: `${item.y}%`,
                      transform: "translate(-50%,-50%)",
                      background: item.type === "pump" ? "#22c55e22" : "#ef444422",
                      border: `2px solid ${item.type === "pump" ? "#22c55e" : "#ef4444"}`,
                      borderRadius: "50%",
                      width: "48px", height: "48px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "1.4rem",
                      cursor: "pointer",
                      boxShadow: `0 0 12px ${item.type === "pump" ? "#22c55e88" : "#ef444488"}`,
                    }}
                  >
                    {item.type === "pump" ? "⛽" : "🔴"}
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}

        {phase === "result" && (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>
              {score >= 20 ? "🏆" : score >= 10 ? "🎖️" : "⛽"}
            </div>
            <p style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "1.2rem", margin: "0 0 0.25rem" }}>
              Счёт: {score}
            </p>
            {score > tapHighScore && (
              <p style={{ color: "#eab308", fontSize: "0.8rem", margin: "0 0 0.75rem" }}>
                🏅 Новый рекорд!
              </p>
            )}
            <button
              onClick={() => setPhase("idle")}
              style={{
                background: "linear-gradient(135deg,#a855f7,#db2777)",
                color: "#fff", border: "none", borderRadius: "12px",
                padding: "0.65rem 2rem", fontSize: "0.85rem",
                fontWeight: 600, cursor: "pointer",
              }}
            >
              Играть ещё
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── XP Tiers ─────────────────────────────────────────────────────

const TIERS = [
  { name: "🚶 Пешеход",          min: 0,       max: 9999 },
  { name: "🚲 Самокатчик",       min: 10000,   max: 49999 },
  { name: "🛵 Мопедист",         min: 50000,   max: 149999 },
  { name: "🚗 Извозчик",         min: 150000,  max: 299999 },
  { name: "🚛 Дальнобойщик",     min: 300000,  max: 499999 },
  { name: "⚡ Бензиновый Барон", min: 500000,  max: 799999 },
  { name: "👑 Владелец НПЗ",     min: 800000,  max: null },
];

function XpTiers() {
  const { user } = useUserStore();
  const xp = user?.xp ?? 0;

  return (
    <div style={{ padding: "0 1rem 1rem" }}>
      <div style={{
        background: "#14141c", border: "1px solid #22222f",
        borderRadius: "16px", padding: "1rem",
      }}>
        <h3 style={{ margin: "0 0 0.75rem", color: "#e2e8f0", fontSize: "0.95rem", fontWeight: 700 }}>
          ⭐ Ранги участника
        </h3>
        {TIERS.map((tier) => {
          const isActive = xp >= tier.min && (tier.max === null || xp <= tier.max);
          const color = TIER_COLORS[tier.name] ?? "#6b7280";
          return (
            <div key={tier.name} style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              padding: "0.6rem 0",
              borderBottom: "1px solid #22222f",
            }}>
              <div style={{
                width: "10px", height: "10px", borderRadius: "50%",
                background: isActive ? color : "#22222f",
                boxShadow: isActive ? `0 0 10px ${color}` : "none",
                flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, color: isActive ? color : "#4b5563", fontWeight: isActive ? 700 : 400, fontSize: "0.85rem" }}>
                  {tier.name}
                </p>
                <p style={{ margin: 0, color: "#4b5563", fontSize: "0.68rem" }}>
                  {tier.max !== null ? `${tier.min.toLocaleString("ru")} – ${tier.max.toLocaleString("ru")} XP` : `${tier.min.toLocaleString("ru")}+ XP`}
                </p>
              </div>
              {isActive && (
                <span style={{
                  background: `${color}22`, border: `1px solid ${color}44`,
                  color, borderRadius: "8px",
                  padding: "0.15rem 0.4rem", fontSize: "0.68rem", fontWeight: 700,
                }}>
                  Текущий
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Daily Check-in ───────────────────────────────────────────────

function DailyCheckin() {
  const { user, refresh } = useUserStore();
  const { add: toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [nextAt, setNextAt] = useState<string | null>(null);

  const handleCheckin = async () => {
    if (!user || loading || done) return;
    setLoading(true);
    try {
      const res = await dailyCheckin(user.id);
      if (res.already_done) {
        setDone(true);
        if (res.next_checkin_at) setNextAt(res.next_checkin_at);
        toast("Ежедневный бонус уже получен сегодня", "error");
      } else {
        setDone(true);
        if (res.next_checkin_at) setNextAt(res.next_checkin_at);
        toast(`✅ +${res.xp_awarded} XP — ежедневный бонус получен!`, "success");
        await refresh();
      }
    } catch (e: unknown) {
      toast(String(e), "error");
    } finally {
      setLoading(false);
    }
  };

  const nextTime = nextAt
    ? new Date(nextAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div style={{ padding: "0 1rem 1rem" }}>
      <motion.div
        whileTap={{ scale: 0.98 }}
        style={{
          background: done ? "#0d1f0d" : "linear-gradient(135deg,#14141c,#1a0a1f)",
          border: `1px solid ${done ? "#22c55e44" : "#a855f744"}`,
          borderRadius: "16px",
          padding: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <div style={{ fontSize: "2rem" }}>{done ? "✅" : "🎁"}</div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, color: "#e2e8f0", fontWeight: 700, fontSize: "0.9rem" }}>
            Ежедневный бонус
          </p>
          <p style={{ margin: "0.1rem 0 0", color: "#6b7280", fontSize: "0.72rem" }}>
            {done
              ? `Получен. Следующий${nextTime ? ` в ${nextTime}` : " завтра"}`
              : "+50 XP каждые 24 часа — просто загляните сюда"}
          </p>
        </div>
        <button
          onClick={handleCheckin}
          disabled={done || loading}
          style={{
            background: done
              ? "#22222f"
              : "linear-gradient(135deg,#22c55e,#16a34a)",
            border: "none",
            borderRadius: "10px",
            color: done ? "#4b5563" : "#fff",
            padding: "0.5rem 0.9rem",
            fontSize: "0.78rem",
            fontWeight: 700,
            cursor: done || loading ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "…" : done ? "Готово" : "Получить"}
        </button>
      </motion.div>
    </div>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────

function LeaderboardSection() {
  const { user } = useUserStore();
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (board) { setOpen((v) => !v); return; }
    setLoading(true);
    try {
      const data = await fetchLeaderboard(user?.id);
      setBoard(data);
      setOpen(true);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "0 1rem 1rem" }}>
      <div style={{
        background: "#14141c", border: "1px solid #22222f",
        borderRadius: "16px", overflow: "hidden",
      }}>
        <button
          onClick={load}
          style={{
            width: "100%", display: "flex", alignItems: "center",
            justifyContent: "space-between",
            padding: "0.9rem 1rem",
            background: "none", border: "none", cursor: "pointer",
          }}
        >
          <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "0.95rem" }}>
            🏆 Таблица лидеров
          </span>
          <span style={{ color: "#6b7280", fontSize: "0.8rem" }}>
            {loading ? "…" : open ? "▲" : "▼"}
          </span>
        </button>

        <AnimatePresence>
          {open && board && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: "hidden" }}
            >
              {board.user_rank && (
                <div style={{
                  margin: "0 0.75rem 0.5rem",
                  background: "#a855f711",
                  border: "1px solid #a855f733",
                  borderRadius: "10px",
                  padding: "0.4rem 0.75rem",
                  display: "flex", justifyContent: "space-between",
                  fontSize: "0.75rem",
                }}>
                  <span style={{ color: "#a855f7" }}>Ваша позиция</span>
                  <span style={{ color: "#e2e8f0", fontWeight: 700 }}>
                    #{board.user_rank} · {(board.user_xp ?? 0).toLocaleString("ru")} XP
                  </span>
                </div>
              )}
              {board.entries.slice(0, 10).map((entry) => {
                const isMe = entry.user_id === user?.id;
                const medal = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`;
                return (
                  <div key={entry.user_id} style={{
                    display: "flex", alignItems: "center", gap: "0.6rem",
                    padding: "0.5rem 0.75rem",
                    background: isMe ? "#a855f711" : "none",
                    borderBottom: "1px solid #1a1a24",
                  }}>
                    <span style={{ width: "2rem", textAlign: "center", fontSize: "0.8rem" }}>{medal}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, color: isMe ? "#a855f7" : "#e2e8f0", fontSize: "0.82rem", fontWeight: isMe ? 700 : 400 }}>
                        {entry.username ? `@${entry.username}` : `User #${entry.user_id}`}
                      </p>
                      <p style={{ margin: 0, color: "#4b5563", fontSize: "0.65rem" }}>{entry.level}</p>
                    </div>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "0.78rem", color: "#a855f7", fontWeight: 700,
                    }}>
                      {entry.xp.toLocaleString("ru")}
                    </span>
                  </div>
                );
              })}
              <p style={{ textAlign: "center", color: "#4b5563", fontSize: "0.65rem", padding: "0.5rem" }}>
                Топ-10 по XP · обновляется в реальном времени
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Referral ─────────────────────────────────────────────────────

function ReferralSection() {
  const { user } = useUserStore();
  const { add: toast } = useToast();
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [inputCode, setInputCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchReferral(user.id).then(setInfo).catch(() => {});
  }, [user]);

  const handleCopy = () => {
    if (!info) return;
    navigator.clipboard.writeText(info.code).then(() => toast("Код скопирован!", "success")).catch(() => {});
  };

  const handleUse = async () => {
    if (!user || !inputCode.trim()) return;
    setSubmitting(true);
    try {
      const res = await useReferralCode(user.id, inputCode.trim().toUpperCase());
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) setInputCode("");
    } catch (e: unknown) {
      toast(String(e), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: "0 1rem 1.5rem" }}>
      <div style={{
        background: "#14141c", border: "1px solid #22222f",
        borderRadius: "16px", padding: "1rem",
      }}>
        <h3 style={{ margin: "0 0 0.6rem", color: "#e2e8f0", fontSize: "0.95rem", fontWeight: 700 }}>
          🔗 Реферальная программа
        </h3>
        <p style={{ margin: "0 0 0.75rem", color: "#6b7280", fontSize: "0.72rem", lineHeight: 1.5 }}>
          Пригласите друга — оба получат <span style={{ color: "#a855f7", fontWeight: 700 }}>+200 XP</span> при первом использовании.
        </p>

        {info && (
          <div
            onClick={handleCopy}
            style={{
              background: "#050507",
              border: "1px dashed #a855f744",
              borderRadius: "10px",
              padding: "0.6rem 0.8rem",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              cursor: "pointer",
              marginBottom: "0.75rem",
            }}
          >
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              color: "#a855f7", fontSize: "0.88rem", fontWeight: 700, letterSpacing: "0.08em",
            }}>
              {info.code}
            </span>
            <span style={{ color: "#4b5563", fontSize: "0.7rem" }}>
              {info.uses} использ. · нажмите чтобы скопировать
            </span>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.4rem" }}>
          <input
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
            placeholder="Введите чужой код FUEL-XXXXXX-XXX"
            style={{
              flex: 1, background: "#0b0b0f", border: "1px solid #22222f",
              borderRadius: "8px", color: "#e2e8f0", padding: "0.5rem 0.65rem",
              fontSize: "0.75rem", outline: "none", fontFamily: "monospace",
            }}
          />
          <button
            onClick={handleUse}
            disabled={submitting || !inputCode.trim()}
            style={{
              background: "linear-gradient(135deg,#a855f7,#db2777)",
              border: "none", borderRadius: "8px",
              color: "#fff", padding: "0.5rem 0.8rem",
              fontSize: "0.75rem", fontWeight: 700,
              cursor: submitting || !inputCode.trim() ? "not-allowed" : "pointer",
              opacity: submitting || !inputCode.trim() ? 0.5 : 1,
            }}
          >
            Активировать
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Fortune Tab ──────────────────────────────────────────────────

export function ReserveTab() {
  const { user } = useUserStore();

  return (
    <div style={{ height: "100%", overflowY: "auto", paddingBottom: "5rem" }}>
      {/* Header */}
      <div style={{ padding: "1rem 1rem 0.75rem" }}>
        <h2 style={{ margin: "0 0 0.15rem", color: "#e2e8f0", fontSize: "1.1rem", fontWeight: 700 }}>
          🎰 Заправочный автомат
        </h2>
        <p style={{ margin: 0, color: "#6b7280", fontSize: "0.75rem" }}>
          Игровые механики · XP · Ежедневные бонусы
        </p>
        {user && (
          <div style={{
            marginTop: "0.5rem",
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            background: "#a855f722", border: "1px solid #a855f744",
            borderRadius: "8px", padding: "0.2rem 0.5rem",
          }}>
            <span style={{ color: "#a855f7", fontSize: "0.75rem", fontWeight: 700 }}>
              {user.xp.toLocaleString("ru")} XP
            </span>
            <span style={{ color: "#6b7280", fontSize: "0.72rem" }}>·</span>
            <span style={{ color: TIER_COLORS[user.level] ?? "#6b7280", fontSize: "0.72rem" }}>
              {user.level}
            </span>
          </div>
        )}
      </div>

      <DailyCheckin />
      <FlipGame />
      <TapGame />
      <LeaderboardSection />
      <ReferralSection />
      <XpTiers />
    </div>
  );
}
