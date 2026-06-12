import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { flipCard, submitTapScore } from "@/api/client";
import { useUserStore } from "@/stores/useUserStore";
import { useGameStore } from "@/stores/useGameStore";
import { useToast } from "@/components/Toast";
import type { FlipResult } from "@/types";

const TIER_COLORS: Record<string, string> = {
  "Новичок": "#6b7280",
  "Караванщик": "#eab308",
  "Хранитель Карты": "#a855f7",
  "Легенда Тавриды": "#db2777",
};

// ─── Card Flip Game ───────────────────────────────────────────────

const CARD_EMOJIS = ["🛢️", "🎖️", "🏆", "🛢️", "🛢️", "🛢️", "🎖️", "🛢️", "🛢️", "🛢️"];

const RESULT_CONFIG: Record<string, { emoji: string; color: string; title: string }> = {
  empty:   { emoji: "🛢️", color: "#6b7280", title: "Пустая цистерна" },
  discount:{ emoji: "🎖️", color: "#eab308", title: "Приоритетный ордер" },
  voucher: { emoji: "🏆", color: "#22c55e", title: "Внеочередной Талон!" },
  blocked: { emoji: "⏰", color: "#ef4444", title: "Попытки исчерпаны" },
};

function FlipGame() {
  const { user, refresh } = useUserStore();
  const { setFlipResult, flipsRemaining, setFlipsRemaining } = useGameStore();
  const { add: toast } = useToast();

  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FlipResult | null>(null);
  const [resultCard, setResultCard] = useState<number | null>(null);

  const handleFlip = async (idx: number) => {
    if (!user || flipped.has(idx) || loading || flipsRemaining <= 0) return;
    setLoading(true);
    try {
      const res = await flipCard(user.id);
      const newFlipped = new Set(flipped);
      newFlipped.add(idx);
      setFlipped(newFlipped);
      setResult(res);
      setResultCard(idx);
      setFlipsRemaining(res.attempts_remaining);
      setFlipResult(res.result_type, res.attempts_remaining);
      if (res.result_type !== "empty") {
        toast(res.message, res.result_type === "blocked" ? "error" : "success");
      }
      await refresh();
    } catch (e: unknown) {
      toast(String(e), "error");
    } finally {
      setLoading(false);
    }
  };

  const cfg = result ? RESULT_CONFIG[result.result_type] ?? RESULT_CONFIG.empty : null;

  return (
    <div style={{ padding: "0 1rem 1.5rem" }}>
      <div style={{
        background: "#14141c", border: "1px solid #22222f",
        borderRadius: "16px", padding: "1rem",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: "0.95rem", fontWeight: 700 }}>
            🃏 Календарь поставок
          </h3>
          <span style={{
            background: flipsRemaining > 0 ? "#a855f722" : "#ef444422",
            border: `1px solid ${flipsRemaining > 0 ? "#a855f744" : "#ef444444"}`,
            color: flipsRemaining > 0 ? "#a855f7" : "#ef4444",
            borderRadius: "8px",
            padding: "0.2rem 0.5rem",
            fontSize: "0.72rem",
            fontWeight: 600,
          }}>
            {flipsRemaining} попытки
          </span>
        </div>
        <p style={{ color: "#6b7280", fontSize: "0.75rem", margin: "0 0 1rem" }}>
          Переверните карту, чтобы узнать судьбу поставок. 3 попытки в сутки.
        </p>

        {/* 10 cards grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.4rem", marginBottom: "0.75rem" }}>
          {Array.from({ length: 10 }, (_, i) => {
            const isFlipped = flipped.has(i);
            const isResult = resultCard === i;
            const resCfg = isResult && result ? RESULT_CONFIG[result.result_type] : null;
            return (
              <motion.button
                key={i}
                whileTap={{ scale: 0.92 }}
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ type: "spring", damping: 15 }}
                onClick={() => !isFlipped && handleFlip(i)}
                disabled={isFlipped || flipsRemaining <= 0 || loading}
                style={{
                  aspectRatio: "3/4",
                  background: isFlipped
                    ? (resCfg ? `${resCfg.color}22` : "#0b0b0f")
                    : "linear-gradient(135deg,#1e1e2a,#14141c)",
                  border: `1px solid ${isFlipped && resCfg ? resCfg.color + "44" : "#22222f"}`,
                  borderRadius: "10px",
                  cursor: (!isFlipped && flipsRemaining > 0 && !loading) ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: isFlipped ? "1.5rem" : "1rem",
                  transition: "background 0.3s",
                }}
              >
                {isFlipped ? (resCfg?.emoji ?? "🛢️") : "❓"}
              </motion.button>
            );
          })}
        </div>

        {/* Result banner */}
        <AnimatePresence>
          {result && cfg && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: `${cfg.color}11`,
                border: `1px solid ${cfg.color}44`,
                borderRadius: "10px",
                padding: "0.65rem",
                textAlign: "center",
              }}
            >
              <p style={{ margin: "0 0 0.2rem", color: cfg.color, fontWeight: 700, fontSize: "0.88rem" }}>
                {cfg.emoji} {cfg.title}
              </p>
              <p style={{ margin: 0, color: "#9ca3af", fontSize: "0.75rem" }}>{result.message}</p>
              {result.reward && (
                <p style={{
                  margin: "0.4rem 0 0",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.72rem", color: cfg.color,
                  background: "#0b0b0f", borderRadius: "6px", padding: "0.3rem",
                }}>
                  {result.reward}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
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
            {/* HUD */}
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
            {/* Time bar */}
            <div style={{ height: "3px", background: "#0b0b0f", borderRadius: "2px", marginBottom: "0.5rem", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${timePercent}%`,
                background: timeLeft > 10 ? "#a855f7" : "#ef4444",
                transition: "width 1s linear, background 0.3s",
              }} />
            </div>
            {/* Game arena */}
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
  { name: "Новичок",         min: 0,    max: 99 },
  { name: "Караванщик",      min: 100,  max: 499 },
  { name: "Хранитель Карты", min: 500,  max: 1499 },
  { name: "Легенда Тавриды", min: 1500, max: null },
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
                  {tier.max ? `${tier.min} – ${tier.max} XP` : `${tier.min}+ XP`}
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

// ─── Reserve Tab ──────────────────────────────────────────────────

export function ReserveTab() {
  const { user } = useUserStore();

  return (
    <div style={{ height: "100%", overflowY: "auto", paddingBottom: "5rem" }}>
      {/* Header */}
      <div style={{ padding: "1rem 1rem 0.75rem" }}>
        <h2 style={{ margin: "0 0 0.15rem", color: "#e2e8f0", fontSize: "1.1rem", fontWeight: 700 }}>
          🎰 Резервная матрица
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
              {user.xp} XP
            </span>
            <span style={{ color: "#6b7280", fontSize: "0.72rem" }}>·</span>
            <span style={{ color: TIER_COLORS[user.level] ?? "#6b7280", fontSize: "0.72rem" }}>
              {user.level}
            </span>
          </div>
        )}
      </div>

      <FlipGame />
      <TapGame />
      <XpTiers />
    </div>
  );
}

