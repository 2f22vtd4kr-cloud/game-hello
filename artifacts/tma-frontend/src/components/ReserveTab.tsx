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
        background: result ? `linear-gradient(160deg,#0d0d18,${glowColor}08)` : "linear-gradient(160deg,#0d0d18,#14141c)",
        border: `1px solid ${result ? glowColor + "44" : "#1e1e2a"}`,
        borderRadius: "18px",
        padding: "1rem",
        boxShadow: result ? `0 0 32px ${glowColor}20` : "0 4px 20px #00000030",
        transition: "border-color 0.5s, box-shadow 0.5s, background 0.5s",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: result ? `linear-gradient(90deg,transparent,${glowColor},transparent)` : "linear-gradient(90deg,transparent,#a855f7,transparent)" }} />
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.55rem" }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.48rem", letterSpacing: "0.15em", marginBottom: "0.15rem" }}>СИСТЕМА_ТАРО · v2.0</div>
            <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: "0.92rem", fontWeight: 800 }}>
              🃏 Бензиновое Таро
            </h3>
          </div>
          <span style={{
            background: hasAttempts ? "#a855f718" : "#14141c",
            border: `1px solid ${hasAttempts ? "#a855f740" : "#22222f"}`,
            color: hasAttempts ? "#a855f7" : "#374151",
            borderRadius: "8px", padding: "0.2rem 0.5rem",
            fontSize: "0.65rem", fontWeight: 700, fontFamily: "'JetBrains Mono',monospace",
          }}>
            {played ? "✓ Сыграно" : "× 1/день"}
          </span>
        </div>

        <p style={{ color: "#4b5563", fontSize: "0.7rem", margin: "0 0 0.75rem", lineHeight: 1.4 }}>
          5 случайных карт из 200+. XP начисляется мгновенно. Следующий бросок — завтра.
        </p>

        {/* Card grid or result */}
        {!result ? (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            {hasAttempts && (
              <div style={{ display: "flex", justifyContent: "center", gap: "0.3rem", marginBottom: "1rem" }}>
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ rotateY: [0, 10, -10, 0], y: [0, -4, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                    style={{
                      width: "36px", height: "52px", borderRadius: "6px",
                      background: `linear-gradient(135deg,#1e1e2a,#a855f718)`,
                      border: "1px solid #a855f733",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "1.1rem",
                      boxShadow: "0 4px 12px #00000040",
                    }}
                  >❓</motion.div>
                ))}
              </div>
            )}
            <motion.button
              whileTap={{ scale: 0.93 }}
              whileHover={hasAttempts && !loading ? { scale: 1.03 } : {}}
              onClick={handleDraw}
              disabled={!hasAttempts || loading}
              style={{
                background: (!hasAttempts || loading) ? "#14141c" : "linear-gradient(135deg,#a855f7,#db2777)",
                color: (!hasAttempts || loading) ? "#374151" : "#fff",
                border: `1px solid ${(!hasAttempts || loading) ? "#22222f" : "transparent"}`,
                borderRadius: "14px", padding: "0.85rem 2.5rem",
                fontSize: "0.92rem", fontWeight: 700,
                cursor: (!hasAttempts || loading) ? "not-allowed" : "pointer",
                boxShadow: (!hasAttempts || loading) ? "none" : "0 0 24px #a855f760, 0 4px 16px #00000040",
              }}
            >
              {loading ? "🔀 Перемешиваю…" : played ? "⏳ Завтра" : "🃏 Вскрыть 5 карт"}
            </motion.button>
            {!hasAttempts && !played && (
              <p style={{ color: "#374151", fontSize: "0.65rem", marginTop: "0.5rem" }}>Попытки исчерпаны</p>
            )}
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
        background: phase === "playing"
          ? (timeLeft <= 8 ? "linear-gradient(160deg,#1a0808,#0d0d18)" : "linear-gradient(160deg,#0a0d18,#0d0d18)")
          : "linear-gradient(160deg,#0d0d18,#14141c)",
        border: `1px solid ${phase === "playing" ? (timeLeft <= 8 ? "#ef444433" : "#22c55e22") : "#1e1e2a"}`,
        borderRadius: "18px", padding: "1rem", overflow: "hidden",
        transition: "background 0.5s, border-color 0.5s",
        position: "relative",
        boxShadow: phase === "playing" ? (timeLeft <= 8 ? "0 0 24px #ef444418" : "0 0 24px #22c55e18") : "0 4px 20px #00000030",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: phase === "playing" ? (timeLeft <= 8 ? "linear-gradient(90deg,transparent,#ef4444,transparent)" : "linear-gradient(90deg,transparent,#22c55e,transparent)") : "linear-gradient(90deg,transparent,#22c55e88,transparent)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.48rem", letterSpacing: "0.15em", marginBottom: "0.12rem" }}>ИГРА_СКОРОСТИ · 30с</div>
            <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: "0.92rem", fontWeight: 800 }}>
              ⚡ Заправка на скорость
            </h3>
          </div>
          {tapHighScore > 0 && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#eab308", fontSize: "0.9rem", fontWeight: 700, lineHeight: 1 }}>{tapHighScore}</div>
              <div style={{ color: "#374151", fontSize: "0.52rem" }}>рекорд</div>
            </div>
          )}
        </div>

        {phase === "idle" && (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", marginBottom: "0.85rem" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.2rem" }}>⛽</div>
                <div style={{ color: "#22c55e", fontSize: "0.58rem", fontFamily: "'JetBrains Mono',monospace" }}>+1 очко</div>
              </div>
              <div style={{ width: "1px", background: "#1e1e2a" }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.2rem" }}>🪣</div>
                <div style={{ color: "#ef4444", fontSize: "0.58rem", fontFamily: "'JetBrains Mono',monospace" }}>-1 очко</div>
              </div>
              <div style={{ width: "1px", background: "#1e1e2a" }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "1rem", fontWeight: 700, color: "#eab308" }}>30с</div>
                <div style={{ color: "#4b5563", fontSize: "0.58rem" }}>таймер</div>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.94 }}
              whileHover={{ scale: 1.04 }}
              onClick={startGame}
              style={{
                background: "linear-gradient(135deg,#22c55e,#16a34a)",
                color: "#fff", border: "none", borderRadius: "14px",
                padding: "0.8rem 2.2rem", fontSize: "0.9rem", fontWeight: 700,
                cursor: "pointer", boxShadow: "0 0 20px #22c55e50, 0 4px 16px #00000040",
              }}
            >
              ⚡ Начать игру
            </motion.button>
            {tapHighScore > 0 && (
              <p style={{ color: "#4b5563", fontSize: "0.62rem", marginTop: "0.5rem", fontFamily: "'JetBrains Mono',monospace" }}>
                Ваш рекорд: <span style={{ color: "#eab308" }}>{tapHighScore}</span>
              </p>
            )}
          </div>
        )}

        {phase === "playing" && (
          <>
            {/* HUD */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
              <div style={{ flex: 1, textAlign: "center" }}>
                <p style={{ margin: 0, color: "#4b5563", fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>очки</p>
                <p style={{
                  margin: 0, fontFamily: "'JetBrains Mono',monospace",
                  fontSize: "1.5rem", fontWeight: 800, color: "#22c55e", lineHeight: 1,
                  textShadow: "0 0 12px #22c55e88",
                }}>
                  {score}
                </p>
              </div>
              <div style={{ flex: 2 }}>
                <div style={{ height: "6px", background: "#0b0b0f", borderRadius: "3px", overflow: "hidden", marginBottom: "0.2rem" }}>
                  <motion.div
                    style={{ height: "100%", borderRadius: "3px" }}
                    animate={{
                      width: `${timePercent}%`,
                      background: timeLeft > 15 ? "#a855f7" : timeLeft > 8 ? "#f59e0b" : "#ef4444",
                      boxShadow: timeLeft <= 8 ? "0 0 8px #ef4444" : "none",
                    }}
                    transition={{ duration: 0.8, ease: "linear" }}
                  />
                </div>
                <p style={{ margin: 0, color: timeLeft <= 8 ? "#ef4444" : "#6b7280", fontSize: "0.6rem", textAlign: "center", fontFamily: "'JetBrains Mono',monospace" }}>
                  {timeLeft}с
                  {timeLeft <= 8 && <span style={{ animation: "tmaPulse 0.5s infinite" }}> ⚠</span>}
                </p>
              </div>
              <div style={{ flex: 1, textAlign: "center" }}>
                <p style={{ margin: 0, color: "#4b5563", fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>рекорд</p>
                <p style={{ margin: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: "0.9rem", fontWeight: 700, color: "#eab308", lineHeight: 1 }}>
                  {tapHighScore}
                </p>
              </div>
            </div>

            {/* Arena */}
            <div style={{
              position: "relative",
              height: "230px",
              background: "#050508",
              borderRadius: "14px",
              overflow: "hidden",
              border: `1px solid ${timeLeft <= 8 ? "#ef444444" : "#a855f722"}`,
              userSelect: "none",
              WebkitUserSelect: "none",
              boxShadow: timeLeft <= 8 ? "0 0 20px #ef444422, inset 0 0 30px #ef444408" : "inset 0 0 30px #a855f708",
              transition: "border-color 0.3s, box-shadow 0.3s",
            }}>
              {/* Grid background */}
              <div style={{
                position: "absolute", inset: 0, opacity: 0.06, pointerEvents: "none",
                backgroundImage: "linear-gradient(#a855f7 1px,transparent 1px),linear-gradient(90deg,#a855f7 1px,transparent 1px)",
                backgroundSize: "32px 32px",
              }} />
              <AnimatePresence>
                {items.map((item) => (
                  <motion.button
                    key={item.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0, rotate: item.type === "pump" ? 45 : 0 }}
                    transition={{ duration: 0.18, type: "spring", stiffness: 400, damping: 20 }}
                    onClick={() => tapItem(item.id, item.type)}
                    style={{
                      position: "absolute",
                      left: `${item.x}%`, top: `${item.y}%`,
                      transform: "translate(-50%,-50%)",
                      background: item.type === "pump"
                        ? "radial-gradient(circle,#22c55e22,#22c55e08)"
                        : "radial-gradient(circle,#ef444422,#ef444408)",
                      border: `2px solid ${item.type === "pump" ? "#22c55e" : "#ef4444"}`,
                      borderRadius: "50%",
                      width: "52px", height: "52px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "1.5rem",
                      cursor: "pointer",
                      boxShadow: `0 0 16px ${item.type === "pump" ? "#22c55eaa" : "#ef4444aa"}, inset 0 0 8px ${item.type === "pump" ? "#22c55e22" : "#ef444422"}`,
                    }}
                  >
                    {item.type === "pump" ? "⛽" : "🪣"}
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}

        {phase === "result" && (() => {
          const isRecord = score > 0 && score >= tapHighScore;
          const grade = score >= 25 ? { icon: "🏆", label: "Легенда", color: "#f59e0b" }
            : score >= 15 ? { icon: "🎖️", label: "Профи", color: "#a855f7" }
            : score >= 8  ? { icon: "⛽", label: "Оператор", color: "#22c55e" }
            : { icon: "📉", label: "Новичок", color: "#6b7280" };

          return (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                background: `linear-gradient(160deg,${grade.color}08,#050508)`,
                border: `1px solid ${grade.color}30`,
                borderRadius: "14px",
                padding: "1.25rem 1rem",
                textAlign: "center",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Top accent line */}
              <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: "1px", background: `linear-gradient(90deg,transparent,${grade.color},transparent)` }} />

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
                style={{ fontSize: "2.8rem", marginBottom: "0.4rem" }}
              >
                {grade.icon}
              </motion.div>

              <p style={{ margin: "0 0 0.1rem", color: grade.color, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                {grade.label}
              </p>
              <p style={{
                margin: "0 0 0.5rem", fontWeight: 800,
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: "2.2rem", lineHeight: 1,
                textShadow: `0 0 20px ${grade.color}66`,
                color: grade.color,
              }}>
                {score}
              </p>
              <p style={{ margin: "0 0 0.75rem", color: "#4b5563", fontSize: "0.68rem" }}>
                очков · рекорд: {Math.max(score, tapHighScore)}
              </p>

              {isRecord && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: "#1a1200", border: "1px solid #f59e0b44",
                    borderRadius: "8px", padding: "0.3rem 0.8rem",
                    display: "inline-block", marginBottom: "0.75rem",
                  }}
                >
                  <p style={{ margin: 0, color: "#f59e0b", fontSize: "0.72rem", fontWeight: 700 }}>🏅 Новый рекорд!</p>
                </motion.div>
              )}

              <div>
                <button
                  onClick={() => setPhase("idle")}
                  style={{
                    background: "linear-gradient(135deg,#a855f7,#db2777)",
                    color: "#fff", border: "none", borderRadius: "10px",
                    padding: "0.6rem 1.8rem", fontSize: "0.82rem",
                    fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 0 16px #a855f740",
                  }}
                >
                  Играть снова
                </button>
              </div>
            </motion.div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── XP Tiers ─────────────────────────────────────────────────────

const TIERS = [
  { name: "🚶 Пешеход",          short: "Пешеход",    min: 0,       max: 9999   },
  { name: "🚲 Самокатчик",       short: "Самокатчик", min: 10000,   max: 49999  },
  { name: "🛵 Мопедист",         short: "Мопедист",   min: 50000,   max: 149999 },
  { name: "🚗 Извозчик",         short: "Извозчик",   min: 150000,  max: 299999 },
  { name: "🚛 Дальнобойщик",     short: "Дальнобой",  min: 300000,  max: 499999 },
  { name: "⚡ Бензиновый Барон", short: "Барон",      min: 500000,  max: 799999 },
  { name: "👑 Владелец НПЗ",     short: "Владелец НПЗ", min: 800000, max: null  },
];

function XpTiers() {
  const { user } = useUserStore();
  const xp = user?.xp ?? 0;
  const currentIdx = TIERS.findIndex((t) => xp >= t.min && (t.max === null || xp <= t.max));
  const current = TIERS[currentIdx];
  const next = TIERS[currentIdx + 1] ?? null;

  const progressPct = current && next
    ? Math.min(100, ((xp - current.min) / (next.min - current.min)) * 100)
    : 100;

  return (
    <div style={{ padding: "0 1rem 2rem" }}>
      <div style={{ background: "linear-gradient(160deg,#0d0d18,#0f0b1a)", border: "1px solid #1e1e2a", borderRadius: "16px", padding: "1rem", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#a855f7,transparent)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.46rem", letterSpacing: "0.14em", marginBottom: "0.15rem" }}>РАНГОВЫЙ_ПУТЬ · УЧАСТНИКА</div>
            <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: "0.9rem", fontWeight: 800 }}>⭐ Путь участника</h3>
          </div>
          {next && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.46rem", letterSpacing: "0.08em", marginBottom: "0.1rem" }}>СЛЕДУЮЩИЙ</div>
              <span style={{ color: TIER_COLORS[next.name] ?? "#9ca3af", fontWeight: 700, fontSize: "0.65rem" }}>{next.short}</span>
              <span style={{ color: "#374151", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.62rem" }}> −{(next.min - xp).toLocaleString("ru")} XP</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ height: "4px", background: "#0b0b0f", borderRadius: "3px", marginBottom: "1rem", overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${progressPct}%`,
            background: `linear-gradient(90deg, ${TIER_COLORS[current?.name ?? ""] ?? "#a855f7"}, ${TIER_COLORS[next?.name ?? ""] ?? "#db2777"})`,
            borderRadius: "3px",
            transition: "width 1s ease",
            boxShadow: "0 0 6px #a855f799",
          }} />
        </div>

        {/* Tier path — horizontal scroll */}
        <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
          {TIERS.map((tier, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            const color = TIER_COLORS[tier.name] ?? "#6b7280";
            const [icon, ...nameParts] = tier.name.split(" ");
            return (
              <div
                key={tier.name}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem",
                  minWidth: "60px",
                  padding: "0.5rem 0.35rem",
                  borderRadius: "12px",
                  background: active ? `${color}18` : done ? "#0d0d14" : "#0b0b0f",
                  border: `1px solid ${active ? color + "88" : done ? "#1a1a24" : "#16161f"}`,
                  boxShadow: active ? `0 0 16px ${color}44, inset 0 0 8px ${color}11` : "none",
                  flexShrink: 0,
                  transition: "all 0.3s",
                  opacity: done ? 0.55 : 1,
                  position: "relative",
                }}
              >
                {/* Active pulse ring */}
                {active && (
                  <div style={{
                    position: "absolute", inset: "-3px",
                    borderRadius: "14px",
                    border: `2px solid ${color}`,
                    animation: "pulse-ring 2s ease-in-out infinite",
                    pointerEvents: "none",
                  }} />
                )}
                <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>{icon}</span>
                <span style={{
                  fontSize: "0.52rem", fontWeight: 700, textAlign: "center",
                  color: active ? color : done ? "#4b5563" : "#374151",
                  lineHeight: 1.2,
                }}>
                  {nameParts.join(" ") || tier.short}
                </span>
                {done && (
                  <span style={{ fontSize: "0.55rem", color: "#22c55e", fontWeight: 700 }}>✓</span>
                )}
                {active && (
                  <span style={{
                    fontSize: "0.48rem", fontWeight: 800,
                    color: color, letterSpacing: "0.05em",
                    background: `${color}22`, borderRadius: "4px",
                    padding: "1px 4px",
                  }}>
                    ТЕКУЩИЙ
                  </span>
                )}
              </div>
            );
          })}
        </div>
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
  const [streak, setStreak] = useState(0);

  const handleCheckin = async () => {
    if (!user || loading || done) return;
    setLoading(true);
    try {
      const res = await dailyCheckin(user.id);
      if (res.checkin_streak !== undefined) setStreak(res.checkin_streak);
      if (res.already_done) {
        setDone(true);
        if (res.next_checkin_at) setNextAt(res.next_checkin_at);
        toast("Ежедневный бонус уже получен сегодня", "error");
      } else {
        setDone(true);
        if (res.next_checkin_at) setNextAt(res.next_checkin_at);
        const streakMsg = res.checkin_streak && res.checkin_streak >= 3
          ? ` 🔥 Серия ${res.checkin_streak}!` : "";
        toast(`✅ +${res.xp_awarded} XP — ежедневный бонус получен!${streakMsg}`, "success");
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

  const streakDots = Array.from({ length: 7 }, (_, i) => i < streak);

  return (
    <div style={{ padding: "0 1rem 1rem" }}>
      <motion.div
        whileTap={{ scale: 0.98 }}
        style={{
          background: done
            ? "linear-gradient(135deg,#0a1a0a,#0d1f0d)"
            : "linear-gradient(135deg,#0d0d18,#1a0a1f)",
          border: `1px solid ${done ? "#22c55e44" : "#a855f733"}`,
          borderRadius: "18px",
          padding: "1rem",
          position: "relative",
          overflow: "hidden",
          boxShadow: done ? "0 0 24px #22c55e12" : "0 0 24px #a855f712",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: done ? "linear-gradient(90deg,transparent,#22c55e,transparent)" : "linear-gradient(90deg,transparent,#a855f7,#db2777,transparent)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <motion.div
            animate={done ? {} : { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            style={{ fontSize: "2rem", flexShrink: 0 }}
          >
            {done ? "✅" : "🎁"}
          </motion.div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.1rem" }}>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.4rem", letterSpacing: "0.12em", marginBottom: "1px" }}>ЕЖЕДНЕВНЫЙ_БОНУС · СЕРИЯ</div>
              <p style={{ margin: 0, color: "#e2e8f0", fontWeight: 800, fontSize: "0.88rem" }}>
                Ежедневный бонус
              </p>
              </div>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", background: "#f59e0b18", border: "1px solid #f59e0b33", borderRadius: "4px", color: "#f59e0b", fontSize: "0.52rem", fontWeight: 700, padding: "0.08rem 0.3rem" }}>
                +50 XP
              </span>
            </div>
            <p style={{ margin: "0 0 0.5rem", color: "#4b5563", fontSize: "0.68rem" }}>
              {done
                ? `Получен${nextTime ? ` · следующий в ${nextTime}` : " · до завтра"}`
                : "Каждые 24 часа. Серия дней = бонусные XP"}
            </p>
            {/* Streak dots */}
            <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
              {streakDots.map((filled, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.06 }}
                  style={{
                    width: "12px", height: "12px", borderRadius: "50%",
                    background: filled ? "#f59e0b" : "#1a1a24",
                    border: `1px solid ${filled ? "#f59e0b66" : "#2a2a38"}`,
                    boxShadow: filled ? "0 0 6px #f59e0b66" : "none",
                    transition: "all 0.3s",
                    flexShrink: 0,
                  }}
                />
              ))}
              {streak > 0 && (
                <span style={{ color: "#f59e0b", fontSize: "0.62rem", marginLeft: "4px", fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>
                  {streak >= 7 ? "🔥 MAX!" : `🔥 ×${streak}`}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleCheckin}
            disabled={done || loading}
            style={{
              background: done ? "#14141c" : "linear-gradient(135deg,#22c55e,#16a34a)",
              border: `1px solid ${done ? "#22222f" : "transparent"}`,
              borderRadius: "12px", color: done ? "#374151" : "#fff",
              padding: "0.55rem 1rem", fontSize: "0.78rem", fontWeight: 700,
              cursor: done || loading ? "not-allowed" : "pointer",
              whiteSpace: "nowrap", flexShrink: 0,
              boxShadow: done ? "none" : "0 0 16px #22c55e50",
            }}
          >
            {loading ? "…" : done ? "✓ Готово" : "Получить"}
          </button>
        </div>
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

  const RANK_STYLES: Record<number, { bg: string; border: string; badge: string; color: string }> = {
    1: { bg: "#1a1200", border: "#f59e0b44", badge: "🥇", color: "#f59e0b" },
    2: { bg: "#0f1118", border: "#9ca3af44", badge: "🥈", color: "#9ca3af" },
    3: { bg: "#0f0a08", border: "#cd7c3344", badge: "🥉", color: "#cd7c33" },
  };

  return (
    <div style={{ padding: "0 1rem 1rem" }}>
      <div style={{
        background: "linear-gradient(160deg,#0d0d18,#120c1a)",
        border: "1px solid #a855f722",
        borderRadius: "20px",
        overflow: "hidden",
        boxShadow: "0 0 24px #a855f710",
      }}>
        {/* Header button */}
        <button
          onClick={load}
          style={{
            width: "100%", display: "flex", alignItems: "center",
            justifyContent: "space-between",
            padding: "0.9rem 1rem",
            background: "none", border: "none", cursor: "pointer",
            borderBottom: open ? "1px solid #a855f722" : "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0,
              background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.1rem", boxShadow: "0 0 10px rgba(245,158,11,0.2)",
            }}>🏆</div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.46rem", letterSpacing: "0.14em", marginBottom: "0.1rem" }}>РЕЙТИНГ_ОПЕРАТОРОВ · XP</div>
              <p style={{ margin: 0, color: "#e2e8f0", fontWeight: 700, fontSize: "0.9rem", lineHeight: 1 }}>
                Таблица лидеров
              </p>
              {board && (
                <p style={{ margin: "0.15rem 0 0", color: "#4b5563", fontSize: "0.6rem" }}>
                  {board.total_users || "?"} участников · XP рейтинг
                </p>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {loading && (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                style={{ color: "#a855f7", fontSize: "0.8rem", display: "inline-block" }}
              >
                ⟳
              </motion.span>
            )}
            <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>
              {open ? "▲" : "▼"}
            </span>
          </div>
        </button>

        <AnimatePresence>
          {open && board && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: "hidden" }}
            >
              {/* My rank banner */}
              {board.user_rank && (
                <div style={{
                  margin: "0.6rem 0.75rem",
                  background: "linear-gradient(135deg,#a855f718,#db277718)",
                  border: "1px solid #a855f744",
                  borderRadius: "12px",
                  padding: "0.55rem 0.85rem",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <p style={{ margin: 0, color: "#a855f7", fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Ваша позиция</p>
                    <p style={{ margin: 0, color: "#e2e8f0", fontWeight: 800, fontSize: "0.9rem" }}>#{board.user_rank}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, color: "#6b7280", fontSize: "0.6rem" }}>XP</p>
                    <p style={{ margin: 0, fontFamily: "'JetBrains Mono',monospace", color: "#a855f7", fontWeight: 700, fontSize: "0.9rem" }}>
                      {(board.user_xp ?? 0).toLocaleString("ru")}
                    </p>
                  </div>
                </div>
              )}

              {/* Leaderboard rows */}
              <div style={{ padding: "0 0.75rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {board.entries.slice(0, 10).map((entry, i) => {
                  const isMe = entry.user_id === user?.id;
                  const rs = RANK_STYLES[entry.rank];
                  const rowColor = rs?.color ?? (isMe ? "#a855f7" : "#9ca3af");
                  const maxXp = board.entries[0]?.xp ?? 1;
                  const barPct = Math.round((entry.xp / maxXp) * 100);

                  return (
                    <motion.div
                      key={entry.user_id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      style={{
                        background: rs ? rs.bg : isMe ? "#a855f710" : "#0d0d14",
                        border: `1px solid ${rs ? rs.border : isMe ? "#a855f733" : "#1a1a24"}`,
                        borderRadius: "10px",
                        padding: "0.5rem 0.7rem",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      {/* XP bar background */}
                      <div style={{
                        position: "absolute", left: 0, top: 0, bottom: 0,
                        width: `${barPct}%`,
                        background: `${rowColor}08`,
                        transition: "width 0.8s",
                      }} />
                      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <span style={{ width: "1.6rem", textAlign: "center", fontSize: rs ? "1rem" : "0.72rem", fontWeight: 700, color: rs ? "inherit" : "#4b5563", flexShrink: 0 }}>
                          {rs ? rs.badge : `#${entry.rank}`}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, color: isMe ? "#a855f7" : rs ? rowColor : "#e2e8f0", fontSize: "0.8rem", fontWeight: (isMe || rs) ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {entry.username ? `@${entry.username}` : `Пользователь #${entry.user_id}`}
                            {isMe && <span style={{ color: "#a855f7", fontSize: "0.6rem", marginLeft: "0.3rem" }}>· вы</span>}
                          </p>
                          <p style={{ margin: 0, color: "#374151", fontSize: "0.58rem" }}>{entry.level}</p>
                        </div>
                        <span style={{
                          fontFamily: "'JetBrains Mono',monospace",
                          fontSize: "0.75rem", color: rowColor, fontWeight: 700, flexShrink: 0,
                        }}>
                          {entry.xp.toLocaleString("ru")}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div style={{ textAlign: "center", padding: "0 0.75rem 0.75rem" }}>
                <p style={{ margin: 0, color: "#374151", fontSize: "0.6rem" }}>
                  Топ-10 по XP · {board.total_users || "?"} операторов в сети
                </p>
              </div>
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
        background: "linear-gradient(160deg,#0d0d18,#120c1a)",
        border: "1px solid #a855f725",
        borderRadius: "20px",
        padding: "1rem",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 0 20px #a855f710",
      }}>
        {/* Top line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#a855f7,#db2777,transparent)" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
          <div style={{
            width: "38px", height: "38px", borderRadius: "10px", flexShrink: 0,
            background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.28)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.1rem", boxShadow: "0 0 10px rgba(168,85,247,0.2)",
          }}>🔗</div>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.46rem", letterSpacing: "0.14em", marginBottom: "0.1rem" }}>РЕФЕРАЛ_ПРОГРАММА · +200_XP</div>
            <p style={{ margin: 0, color: "#e2e8f0", fontWeight: 700, fontSize: "0.9rem", lineHeight: 1 }}>
              Реферальная программа
            </p>
            <p style={{ margin: "0.1rem 0 0", color: "#4b5563", fontSize: "0.6rem" }}>
              +200 XP вам и другу за каждое приглашение
            </p>
          </div>
        </div>

        {/* Bonus banner */}
        <div style={{
          background: "#a855f710", border: "1px solid #a855f730",
          borderRadius: "10px", padding: "0.45rem 0.75rem",
          display: "flex", alignItems: "center", gap: "0.5rem",
          marginBottom: "0.65rem",
        }}>
          <span style={{ fontSize: "0.9rem" }}>⭐</span>
          <p style={{ margin: 0, color: "#a855f7", fontSize: "0.7rem", lineHeight: 1.4 }}>
            Пригласите друга — оба получают <span style={{ fontWeight: 800 }}>+200 XP</span> мгновенно при активации кода
          </p>
        </div>

        {/* Your code */}
        {info && (
          <motion.div
            whileTap={{ scale: 0.97 }}
            onClick={handleCopy}
            style={{
              background: "#050507",
              border: "1px dashed #a855f750",
              borderRadius: "12px",
              padding: "0.7rem 0.9rem",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              cursor: "pointer",
              marginBottom: "0.65rem",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div>
              <p style={{ margin: "0 0 0.1rem", color: "#4b5563", fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>Ваш реф. код</p>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                color: "#a855f7", fontSize: "0.92rem", fontWeight: 800, letterSpacing: "0.06em",
                textShadow: "0 0 10px #a855f766",
              }}>
                {info.code}
              </span>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: "0 0 0.1rem", color: "#4b5563", fontSize: "0.55rem" }}>использований</p>
              <p style={{ margin: 0, color: "#e2e8f0", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.9rem", fontWeight: 700 }}>{info.uses}</p>
            </div>
          </motion.div>
        )}

        {/* Input row */}
        <p style={{ margin: "0 0 0.35rem", color: "#4b5563", fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Активировать чужой код</p>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <input
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
            placeholder="FUEL-XXXXXX-XXX"
            style={{
              flex: 1, background: "#0b0b10", border: "1px solid #22222f",
              borderRadius: "10px", color: "#e2e8f0", padding: "0.55rem 0.7rem",
              fontSize: "0.78rem", outline: "none",
              fontFamily: "'JetBrains Mono',monospace",
              letterSpacing: "0.04em",
            }}
          />
          <button
            onClick={handleUse}
            disabled={submitting || !inputCode.trim()}
            style={{
              background: submitting || !inputCode.trim() ? "#1a1a24" : "linear-gradient(135deg,#a855f7,#db2777)",
              border: "none", borderRadius: "10px",
              color: submitting || !inputCode.trim() ? "#4b5563" : "#fff",
              padding: "0.55rem 0.9rem",
              fontSize: "0.75rem", fontWeight: 700,
              cursor: submitting || !inputCode.trim() ? "not-allowed" : "pointer",
              boxShadow: submitting || !inputCode.trim() ? "none" : "0 0 12px #a855f740",
              whiteSpace: "nowrap",
            }}
          >
            {submitting ? "…" : "Активировать"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Operator Console Header ───────────────────────────────────────

function OperatorConsole() {
  const { user } = useUserStore();
  const xp = user?.xp ?? 0;
  const tierIdx = TIERS.findIndex((t) => xp >= t.min && (t.max === null || xp <= t.max));
  const tier = TIERS[Math.max(0, tierIdx)];
  const next = TIERS[tierIdx + 1] ?? null;
  const color = TIER_COLORS[tier.name] ?? "#a855f7";
  const progressPct = tier && next
    ? Math.min(100, ((xp - tier.min) / (next.min - tier.min)) * 100)
    : 100;
  const [tierIcon, ...tierName] = tier.name.split(" ");

  return (
    <div style={{ padding: "0.75rem 1rem 0" }}>
      <div style={{
        background: `linear-gradient(160deg, #0d0d18 0%, ${color}0d 100%)`,
        border: `1px solid ${color}44`,
        borderRadius: "20px",
        padding: "1.25rem",
        position: "relative",
        overflow: "hidden",
        boxShadow: `0 0 40px ${color}18, inset 0 1px 0 ${color}22`,
      }}>
        {/* Decorative grid lines */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.03,
          backgroundImage: "linear-gradient(#a855f7 1px, transparent 1px), linear-gradient(90deg, #a855f7 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }} />

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", position: "relative" }}>
          {/* Tier badge */}
          <div style={{
            width: "60px", height: "60px", borderRadius: "50%", flexShrink: 0,
            background: `radial-gradient(circle at 35% 35%, ${color}44, ${color}11)`,
            border: `2px solid ${color}66`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "2rem", lineHeight: 1,
            boxShadow: `0 0 24px ${color}44, inset 0 0 12px ${color}22`,
          }}>
            {tierIcon}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.18rem" }}>КОНСОЛЬ_ОПЕРАТОРА · СТАТУС</div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem" }}>
              <p style={{ margin: 0, color, fontWeight: 800, fontSize: "0.95rem", lineHeight: 1 }}>
                {tierName.join(" ")}
              </p>
              {(user?.checkin_streak ?? 0) > 0 && (
                <span style={{
                  background: "#f9731622", border: "1px solid #f9731644",
                  borderRadius: "6px", padding: "0.1rem 0.35rem",
                  fontSize: "0.65rem", color: "#f97316", fontWeight: 700,
                }}>
                  🔥 {user!.checkin_streak}д
                </span>
              )}
            </div>
            <p style={{ margin: "0 0 0.6rem", color: "#6b7280", fontSize: "0.68rem" }}>
              {xp.toLocaleString("ru")} XP
              {next && <span> · до {next.short}: {(next.min - xp).toLocaleString("ru")} XP</span>}
            </p>

            {/* XP progress bar */}
            <div style={{ height: "5px", background: "#0b0b0f", borderRadius: "3px", overflow: "hidden" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                style={{
                  height: "100%",
                  background: `linear-gradient(90deg, ${color}, ${TIER_COLORS[next?.name ?? ""] ?? "#db2777"})`,
                  borderRadius: "3px",
                  boxShadow: `0 0 8px ${color}88`,
                }}
              />
            </div>
            <p style={{ margin: "0.25rem 0 0", color: "#374151", fontSize: "0.58rem" }}>
              {Math.round(progressPct)}% до следующего ранга
            </p>
          </div>
        </div>

        {/* Quick stats row */}
        {user && (
          <div style={{
            marginTop: "0.9rem",
            display: "flex", gap: "0.4rem",
            borderTop: `1px solid ${color}22`,
            paddingTop: "0.75rem",
          }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <p style={{ margin: 0, color: "#e2e8f0", fontWeight: 700, fontSize: "0.9rem", fontFamily: "'JetBrains Mono', monospace" }}>
                {xp.toLocaleString("ru")}
              </p>
              <p style={{ margin: 0, color: "#4b5563", fontSize: "0.58rem" }}>XP</p>
            </div>
            <div style={{ width: "1px", background: "#22222f" }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <p style={{ margin: 0, color: "#db2777", fontWeight: 700, fontSize: "0.9rem", fontFamily: "'JetBrains Mono', monospace" }}>
                ⬡ {user.neurocredits}
              </p>
              <p style={{ margin: 0, color: "#4b5563", fontSize: "0.58rem" }}>нейрокредиты</p>
            </div>
            <div style={{ width: "1px", background: "#22222f" }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <p style={{ margin: 0, color: "#f97316", fontWeight: 700, fontSize: "0.9rem", fontFamily: "'JetBrains Mono', monospace" }}>
                {user.checkin_streak ?? 0}
              </p>
              <p style={{ margin: 0, color: "#4b5563", fontSize: "0.58rem" }}>стрик дней</p>
            </div>
            <div style={{ width: "1px", background: "#22222f" }} />
            <div style={{ flex: 1, textAlign: "center" }}>
              <p style={{ margin: 0, color: "#22c55e", fontWeight: 700, fontSize: "0.9rem", fontFamily: "'JetBrains Mono', monospace" }}>
                {user.flip_attempts_today ?? 0}/3
              </p>
              <p style={{ margin: 0, color: "#4b5563", fontSize: "0.58rem" }}>розыгрышей</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Fortune Tab ──────────────────────────────────────────────────

export function ReserveTab() {
  return (
    <div style={{ height: "100%", overflowY: "auto", paddingBottom: "5rem" }}>
      <OperatorConsole />
      <div style={{ height: "0.75rem" }} />
      <DailyCheckin />
      <FlipGame />
      <TapGame />
      <LeaderboardSection />
      <ReferralSection />
      <XpTiers />
    </div>
  );
}
