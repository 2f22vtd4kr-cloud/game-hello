import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { flipCard, submitTapScore, dailyCheckin, fetchLeaderboard, fetchReferral, useReferralCode } from "@/api/client";
import { EmpireGame } from "@/components/EmpireGame";
import { impact, notify } from "@/lib/haptic";
import { useUserStore } from "@/stores/useUserStore";
import { useGameStore } from "@/stores/useGameStore";
import { useToast } from "@/components/Toast";
import { usePriceStore } from "@/stores/usePriceStore";
import type { FlipResult, FlipCard, Leaderboard, ReferralInfo } from "@/types";
import { RARITY_COLORS } from "@/types";

const TIER_COLORS: Record<string, string> = {
  "🚶 Пешеход":          "#6b7280",
  "🚲 Самокатчик":       "#22c55e",
  "🛵 Мопедист":         "#3b82f6",
  "🚗 Извозчик":         "#eab308",
  "🚛 Дальнобойщик":     "#f97316",
  "⚡ Бензиновый Барон": "#E8622A",
  "👑 Владелец НПЗ":     "#E8622A",
};

const RESULT_GLOW: Record<string, string> = {
  mythic:    "#E8622A",
  legendary: "#f59e0b",
  epic:      "#E8622A",
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
  const isPremium = card.rarity === "legendary" || card.rarity === "mythic";
  const isEpic = card.rarity === "epic";

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
        background: revealed
          ? isPremium
            ? `linear-gradient(160deg,${color}28,${color}10)`
            : `${color}18`
          : "linear-gradient(135deg,#1e1e2a,#14141c)",
        border: `${isPremium && revealed ? "1.5px" : "1px"} solid ${revealed ? color + (isPremium ? "88" : "55") : "#22222f"}`,
        borderRadius: "12px",
        padding: "0.55rem 0.35rem",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: "0.25rem", minHeight: "90px",
        position: "relative", overflow: "hidden",
        boxShadow: revealed
          ? isPremium
            ? `0 0 26px ${color}55, 0 0 8px ${color}33, inset 0 0 12px ${color}10`
            : isEpic
            ? `0 0 16px ${color}44`
            : `0 0 14px ${color}33`
          : "none",
        transition: "box-shadow 0.4s",
      }}
    >
      {/* Shimmer sweep on legendary/mythic */}
      {revealed && isPremium && (
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: "220%" }}
          transition={{ delay: 0.25, duration: 0.75, ease: "easeInOut", repeat: Infinity, repeatDelay: 3.5 }}
          style={{
            position: "absolute", top: 0, bottom: 0, width: "40%",
            background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.14),transparent)",
            pointerEvents: "none", zIndex: 1,
          }}
        />
      )}
      {/* Epic glow pulse */}
      {revealed && isEpic && (
        <motion.div
          animate={{ opacity: [0.12, 0.28, 0.12] }}
          transition={{ repeat: Infinity, duration: 2.5 }}
          style={{
            position: "absolute", inset: 0, borderRadius: "12px",
            background: `radial-gradient(circle at 50% 30%, ${color}40, transparent 70%)`,
            pointerEvents: "none",
          }}
        />
      )}

      <motion.span
        animate={revealed && isPremium ? { scale: [1, 1.1, 1] } : {}}
        transition={{ delay: 0.3, duration: 0.5 }}
        style={{ fontSize: isPremium && revealed ? "1.9rem" : "1.6rem", lineHeight: 1, zIndex: 2 }}
      >
        {revealed ? card.emoji : "❓"}
      </motion.span>
      {revealed && (
        <>
          <span style={{
            fontSize: "0.58rem", color, fontWeight: 700, textAlign: "center",
            lineHeight: 1.2, maxWidth: "90%", zIndex: 2,
          }}>
            {card.name}
          </span>
          <span style={{
            fontSize: "0.65rem",
            color: isPositive ? "#22c55e" : "#ef4444",
            fontWeight: 800,
            fontFamily: "'JetBrains Mono', monospace",
            zIndex: 2,
          }}>
            {isPositive ? "+" : ""}{card.xp.toLocaleString("ru")}
          </span>
          <span style={{
            fontSize: "0.5rem", color,
            background: `${color}${isPremium ? "35" : "22"}`,
            border: isPremium ? `1px solid ${color}44` : "none",
            borderRadius: "4px", padding: "0.1rem 0.3rem", zIndex: 2,
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
  const glowColor = result ? RESULT_GLOW[result.result_type] ?? "#6b7280" : "#E8622A";

  const handleDraw = async () => {
    if (!user || loading || !hasAttempts) return;
    impact("heavy");
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
        notify("success");
        setTimeout(() => impact("heavy"), 150);
        if (xp >= 100) setTimeout(() => impact("heavy"), 350);
        toast(`🏆 ${res.message}`, "success");
      } else if (res.result_type === "cursed" || res.result_type === "blocked") {
        notify("error");
        toast(`💀 ${sign}${xp.toLocaleString("ru")} XP`, "error");
      } else {
        notify("success");
        toast(`🃏 Набор вскрыт: ${sign}${xp.toLocaleString("ru")} XP`, "success");
      }
      await refresh();
    } catch (e: unknown) {
      notify("error");
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
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: result ? `linear-gradient(90deg,transparent,${glowColor},transparent)` : "linear-gradient(90deg,transparent,#E8622A,transparent)" }} />
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.55rem" }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.48rem", letterSpacing: "0.15em", marginBottom: "0.15rem" }}>СИСТЕМА ТАРО · v2.0</div>
            <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: "0.92rem", fontWeight: 800 }}>
              🃏 Бензиновое Таро
            </h3>
          </div>
          <span style={{
            background: hasAttempts ? "#E8622A18" : "#14141c",
            border: `1px solid ${hasAttempts ? "#E8622A40" : "#22222f"}`,
            color: hasAttempts ? "#E8622A" : "#374151",
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
                      background: `linear-gradient(135deg,#1e1e2a,#E8622A18)`,
                      border: "1px solid #E8622A33",
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
                background: (!hasAttempts || loading) ? "#14141c" : "linear-gradient(135deg,#E8622A,#E8622A)",
                color: (!hasAttempts || loading) ? "#374151" : "#fff",
                border: `1px solid ${(!hasAttempts || loading) ? "#22222f" : "transparent"}`,
                borderRadius: "14px", padding: "0.85rem 2.5rem",
                fontSize: "0.92rem", fontWeight: 700,
                cursor: (!hasAttempts || loading) ? "not-allowed" : "pointer",
                boxShadow: (!hasAttempts || loading) ? "none" : "0 0 24px #E8622A60, 0 4px 16px #00000040",
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
                background: `linear-gradient(160deg,${glowColor}18,${glowColor}06)`,
                border: `1px solid ${glowColor}55`,
                borderRadius: "12px",
                padding: "0.75rem",
                textAlign: "center",
                position: "relative",
                overflow: "hidden",
                boxShadow: (result.result_type === "legendary" || result.result_type === "mythic")
                  ? `0 0 28px ${glowColor}35`
                  : "none",
              }}
            >
              {/* Top accent line */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg,transparent,${glowColor},transparent)` }} />

              {/* Shimmer on legendary/mythic */}
              {(result.result_type === "legendary" || result.result_type === "mythic") && (
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: "220%" }}
                  transition={{ delay: 1.5, duration: 0.9, ease: "easeInOut" }}
                  style={{
                    position: "absolute", top: 0, bottom: 0, width: "40%",
                    background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)",
                    pointerEvents: "none",
                  }}
                />
              )}

              {/* XP delta */}
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 1.3, type: "spring", stiffness: 300, damping: 20 }}
                style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: "1.55rem", fontWeight: 900,
                  color: result.total_xp_delta >= 0 ? "#22c55e" : "#ef4444",
                  marginBottom: "0.3rem",
                  lineHeight: 1,
                }}
              >
                {result.total_xp_delta >= 0 ? "+" : ""}{result.total_xp_delta.toLocaleString("ru")} XP
              </motion.div>

              <p style={{ margin: "0 0 0.25rem", color: glowColor, fontWeight: 700, fontSize: "0.82rem" }}>
                {result.message}
              </p>
              <p style={{ margin: 0, color: "#4b5563", fontSize: "0.6rem" }}>
                ⏳ Следующий розыгрыш — завтра после полуночи
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

interface Particle {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
}

function TapGame() {
  const { user, refresh } = useUserStore();
  const { setTapScore, tapHighScore } = useGameStore();
  const { add: toast } = useToast();

  const [phase, setPhase] = useState<"idle" | "playing" | "result">("idle");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [items, setItems] = useState<Spawnable[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const nextId = useRef(0);
  const particleId = useRef(0);
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
    impact(scoreRef.current >= 20 ? "heavy" : "medium");

    if (user) {
      submitTapScore(user.id, scoreRef.current, GAME_DURATION)
        .then((res) => {
          if (res.xp_earned >= 50) {
            notify("success");
            setTimeout(() => impact("heavy"), 120);
          } else {
            notify("success");
          }
          toast(`+${res.xp_earned} XP заработано!`, "success");
          if (res.new_level) {
            notify("success");
            setTimeout(() => impact("heavy"), 200);
            toast(`🏆 Новый уровень: ${res.level}!`, "success");
          }
          refresh();
        })
        .catch(() => {});
    }
  }, [user, setTapScore, toast, refresh]);

  const startGame = () => {
    impact("medium");
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

  const tapItem = (id: number, type: "pump" | "canister", px: number, py: number) => {
    impact(type === "pump" ? "light" : "medium");
    setItems((prev) => prev.filter((i) => i.id !== id));
    const delta = type === "pump" ? 1 : -1;
    scoreRef.current = Math.max(0, scoreRef.current + delta);
    setScore(scoreRef.current);
    const pid = particleId.current++;
    const p: Particle = {
      id: pid, x: px, y: py,
      text: type === "pump" ? "+1" : "−1",
      color: type === "pump" ? "#22c55e" : "#ef4444",
    };
    setParticles((prev) => [...prev, p]);
    setTimeout(() => setParticles((prev) => prev.filter((q) => q.id !== pid)), 750);
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
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.48rem", letterSpacing: "0.15em", marginBottom: "0.12rem" }}>ИГРА СКОРОСТИ · 30с</div>
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
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.45rem",
                  background: "linear-gradient(135deg,#1a1200,#0d0d00)",
                  border: "1px solid #f59e0b44",
                  borderRadius: "10px", padding: "0.35rem 1rem",
                  marginTop: "0.65rem",
                  boxShadow: "0 0 12px #f59e0b18",
                }}
              >
                <span style={{ fontSize: "0.85rem" }}>🏅</span>
                <span style={{ color: "#78716c", fontSize: "0.6rem", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.06em" }}>РЕКОРД</span>
                <span style={{ color: "#f59e0b", fontFamily: "'JetBrains Mono',monospace", fontSize: "1.15rem", fontWeight: 800, lineHeight: 1, textShadow: "0 0 10px #f59e0b66" }}>
                  {tapHighScore}
                </span>
              </motion.div>
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
                      background: timeLeft > 15 ? "#E8622A" : timeLeft > 8 ? "#f59e0b" : "#ef4444",
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
              border: `1px solid ${timeLeft <= 8 ? "#ef444444" : "#E8622A22"}`,
              userSelect: "none",
              WebkitUserSelect: "none",
              boxShadow: timeLeft <= 8 ? "0 0 20px #ef444422, inset 0 0 30px #ef444408" : "inset 0 0 30px #E8622A08",
              transition: "border-color 0.3s, box-shadow 0.3s",
            }}>
              {/* Grid background */}
              <div style={{
                position: "absolute", inset: 0, opacity: 0.06, pointerEvents: "none",
                backgroundImage: "linear-gradient(#E8622A 1px,transparent 1px),linear-gradient(90deg,#E8622A 1px,transparent 1px)",
                backgroundSize: "32px 32px",
              }} />
              {/* Tap particles */}
              <AnimatePresence>
                {particles.map((p) => (
                  <motion.div
                    key={`p-${p.id}`}
                    initial={{ opacity: 1, y: 0, scale: 0.8 }}
                    animate={{ opacity: 0, y: -48, scale: 1.3 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.65, ease: "easeOut" }}
                    style={{
                      position: "absolute",
                      left: `${p.x}%`, top: `${p.y}%`,
                      transform: "translate(-50%,-50%)",
                      color: p.color,
                      fontFamily: "'JetBrains Mono',monospace",
                      fontSize: "1.05rem", fontWeight: 900,
                      pointerEvents: "none", zIndex: 50,
                      textShadow: `0 0 10px ${p.color}`,
                    }}
                  >
                    {p.text}
                  </motion.div>
                ))}
              </AnimatePresence>

              <AnimatePresence>
                {items.map((item) => (
                  <motion.button
                    key={item.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0, rotate: item.type === "pump" ? 45 : 0 }}
                    transition={{ duration: 0.18, type: "spring", stiffness: 400, damping: 20 }}
                    onClick={() => tapItem(item.id, item.type, item.x, item.y)}
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
            : score >= 15 ? { icon: "🎖️", label: "Профи", color: "#E8622A" }
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
                    background: "linear-gradient(135deg,#E8622A,#E8622A)",
                    color: "#fff", border: "none", borderRadius: "10px",
                    padding: "0.6rem 1.8rem", fontSize: "0.82rem",
                    fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 0 16px #E8622A40",
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

// ─── Price Guess Game ─────────────────────────────────────────────

const GUESS_FUELS = ["АИ-92", "АИ-95", "ДТ"] as const;
type GuessFuel = typeof GUESS_FUELS[number];

const FUEL_COLORS_GUESS: Record<GuessFuel, string> = {
  "АИ-92": "#38bdf8",
  "АИ-95": "#E8622A",
  "ДТ": "#f59e0b",
};

function generateQuestion(prices: import("@/types").PricesMap) {
  const regions = Object.keys(prices);
  if (regions.length < 2) return null;
  const fuel = GUESS_FUELS[Math.floor(Math.random() * GUESS_FUELS.length)];
  const regionA = regions[Math.floor(Math.random() * regions.length)];
  let regionB = regions[Math.floor(Math.random() * regions.length)];
  while (regionB === regionA) regionB = regions[Math.floor(Math.random() * regions.length)];
  const priceA = (prices[regionA] as Record<string, { effective?: number }>)[fuel]?.effective ?? 0;
  const priceB = (prices[regionB] as Record<string, { effective?: number }>)[fuel]?.effective ?? 0;
  if (!priceA || !priceB || Math.abs(priceA - priceB) < 0.3) return null;
  const higher = priceA > priceB ? "A" : "B";
  return { fuel, regionA, regionB, priceA: Math.round(priceA * 10) / 10, priceB: Math.round(priceB * 10) / 10, higher };
}

function PriceGuessGame() {
  const prices = usePriceStore((s) => s.prices);
  const { add: toast } = useToast();

  type Phase = "idle" | "playing" | "result";
  const [phase, setPhase] = useState<Phase>("idle");
  const [question, setQuestion] = useState<ReturnType<typeof generateQuestion>>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [totalPlayed, setTotalPlayed] = useState(0);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [chosen, setChosen] = useState<"A" | "B" | null>(null);

  const startGame = () => {
    const q = generateQuestion(prices);
    if (!q) { toast("Нет данных о ценах — попробуйте позже", "warning"); return; }
    setQuestion(q);
    setScore(0);
    setStreak(0);
    setLastCorrect(null);
    setChosen(null);
    setPhase("playing");
  };

  const nextQuestion = () => {
    const q = generateQuestion(prices);
    if (!q) { setPhase("result"); return; }
    setQuestion(q);
    setLastCorrect(null);
    setChosen(null);
  };

  const handleGuess = (choice: "A" | "B") => {
    if (!question || chosen) return;
    impact("medium");
    const correct = choice === question.higher;
    setChosen(choice);
    setLastCorrect(correct);
    setTotalPlayed((p) => p + 1);
    if (correct) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      setBestStreak((b) => Math.max(b, newStreak));
      const bonus = newStreak >= 5 ? 3 : newStreak >= 3 ? 2 : 1;
      setScore((s) => s + bonus);
      notify("success");
      toast(newStreak >= 3 ? `🔥 Серия ×${newStreak}! +${bonus} очка` : "✓ Верно!", "success");
    } else {
      setStreak(0);
      notify("error");
      toast("✗ Неверно", "error");
    }
    setTimeout(() => {
      if (score >= 9) { setPhase("result"); return; }
      nextQuestion();
    }, 1200);
  };

  if (!Object.keys(prices).length) return null;

  return (
    <div style={{ padding: "0 1rem 1rem" }}>
      <div style={{ background: "linear-gradient(160deg,#0d0d18,#0f0a1c)", border: "1px solid #f59e0b22", borderRadius: "16px", overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(90deg,transparent,#f59e0b,#E8622A,transparent)" }} />
        <div style={{ padding: "0.85rem 1rem 0.6rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.15rem" }}>ТОПЛИВНЫЙ ТРЕЙДЕР · МИНИ ИГРА</div>
            <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: "0.9rem", fontWeight: 800 }}>💹 Угадай цену</h3>
            <p style={{ margin: "0.1rem 0 0", color: "#4b5563", fontSize: "0.62rem" }}>Где дороже? Угадай регион с большей ценой</p>
          </div>
          {phase !== "idle" && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#f59e0b", fontSize: "1.1rem", fontWeight: 800 }}>{score}</div>
              <div style={{ color: "#374151", fontSize: "0.52rem" }}>очков</div>
              {streak >= 2 && <div style={{ color: "#ef4444", fontSize: "0.58rem", fontWeight: 700 }}>🔥 ×{streak}</div>}
            </div>
          )}
        </div>

        <div style={{ padding: "0 1rem 1rem" }}>
          <AnimatePresence mode="wait">
            {phase === "idle" && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ textAlign: "center", paddingBottom: "0.25rem" }}>
                <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                  {GUESS_FUELS.map((f) => (
                    <div key={f} style={{ textAlign: "center" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: FUEL_COLORS_GUESS[f], margin: "0 auto 0.2rem", boxShadow: `0 0 8px ${FUEL_COLORS_GUESS[f]}` }} />
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", color: FUEL_COLORS_GUESS[f], fontSize: "0.62rem", fontWeight: 700 }}>{f}</div>
                    </div>
                  ))}
                </div>
                {bestStreak > 0 && <p style={{ color: "#f59e0b", fontSize: "0.65rem", margin: "0 0 0.5rem" }}>🏆 Лучшая серия: {bestStreak}</p>}
                <button
                  onClick={startGame}
                  style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#000", border: "none", borderRadius: "10px", padding: "0.55rem 1.8rem", fontSize: "0.82rem", fontWeight: 800, cursor: "pointer", boxShadow: "0 0 16px #f59e0b44" }}
                >
                  ⚡ Начать игру
                </button>
              </motion.div>
            )}

            {phase === "playing" && question && (
              <motion.div key={`q-${question.regionA}-${question.regionB}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                <div style={{ textAlign: "center", marginBottom: "0.6rem" }}>
                  <span style={{ background: `${FUEL_COLORS_GUESS[question.fuel as GuessFuel]}20`, border: `1px solid ${FUEL_COLORS_GUESS[question.fuel as GuessFuel]}44`, borderRadius: "8px", color: FUEL_COLORS_GUESS[question.fuel as GuessFuel], fontFamily: "'JetBrains Mono',monospace", fontSize: "0.72rem", fontWeight: 700, padding: "0.2rem 0.65rem" }}>
                    {question.fuel} — где дороже?
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  {(["A", "B"] as const).map((side) => {
                    const region = side === "A" ? question.regionA : question.regionB;
                    const isChosen = chosen === side;
                    const isCorrect = chosen ? side === question.higher : null;
                    const bgColor = chosen
                      ? isChosen
                        ? lastCorrect ? "#0a1a0a" : "#1a0a0a"
                        : "#0d0d18"
                      : "#0d0d18";
                    const borderColor = chosen
                      ? isChosen
                        ? lastCorrect ? "#22c55e" : "#ef4444"
                        : isCorrect ? "#22c55e44" : "#1e1e2a"
                      : "#1e1e2a";
                    return (
                      <motion.button
                        key={side}
                        whileTap={!chosen ? { scale: 0.96 } : {}}
                        onClick={() => handleGuess(side)}
                        disabled={!!chosen}
                        style={{ background: bgColor, border: `1.5px solid ${borderColor}`, borderRadius: "12px", padding: "0.75rem 0.5rem", cursor: chosen ? "default" : "pointer", textAlign: "center", transition: "all 0.2s" }}
                      >
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#6b7280", fontSize: "0.5rem", marginBottom: "0.2rem" }}>{side === "A" ? "РЕГИОН А" : "РЕГИОН Б"}</div>
                        <div style={{ color: "#e2e8f0", fontSize: "0.72rem", fontWeight: 600, lineHeight: 1.3, marginBottom: "0.3rem" }}>
                          {region.split(" ").slice(-1)[0].slice(0, 16)}
                        </div>
                        {chosen && (
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", color: side === question.higher ? "#22c55e" : "#ef4444", fontSize: "0.85rem", fontWeight: 800 }}>
                            {side === "A" ? question.priceA : question.priceB} ₽
                          </div>
                        )}
                        {!chosen && <div style={{ color: "#374151", fontSize: "1.1rem" }}>?</div>}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {phase === "result" && (
              <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.4rem" }}>{score >= 8 ? "🏆" : score >= 5 ? "🥈" : "⛽"}</div>
                <p style={{ margin: "0 0 0.2rem", color: "#e2e8f0", fontWeight: 800, fontSize: "1.1rem" }}>{score} очков</p>
                <div style={{ display: "flex", justifyContent: "center", gap: "1rem", margin: "0 0 0.55rem" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#6b7280", fontSize: "0.48rem", marginBottom: "1px" }}>РАУНДЫ</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#e2e8f0", fontSize: "0.85rem", fontWeight: 700 }}>{totalPlayed}</div>
                  </div>
                  <div style={{ width: "1px", background: "#1e1e2a" }} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#6b7280", fontSize: "0.48rem", marginBottom: "1px" }}>ТОЧНОСТЬ</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#22c55e", fontSize: "0.85rem", fontWeight: 700 }}>{totalPlayed > 0 ? Math.round((score / totalPlayed) * 100) : 0}%</div>
                  </div>
                  <div style={{ width: "1px", background: "#1e1e2a" }} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#6b7280", fontSize: "0.48rem", marginBottom: "1px" }}>СЕРИЯ</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#f59e0b", fontSize: "0.85rem", fontWeight: 700 }}>🔥{bestStreak}</div>
                  </div>
                </div>
                <button
                  onClick={startGame}
                  style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#000", border: "none", borderRadius: "10px", padding: "0.5rem 1.5rem", fontSize: "0.78rem", fontWeight: 800, cursor: "pointer" }}
                >
                  Играть снова
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#E8622A,transparent)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.46rem", letterSpacing: "0.14em", marginBottom: "0.15rem" }}>РАНГОВЫЙ ПУТЬ · УЧАСТНИКА</div>
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
            background: `linear-gradient(90deg, ${TIER_COLORS[current?.name ?? ""] ?? "#E8622A"}, ${TIER_COLORS[next?.name ?? ""] ?? "#E8622A"})`,
            borderRadius: "3px",
            transition: "width 1s ease",
            boxShadow: "0 0 6px #E8622A99",
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

function useCountdown(targetISO: string | null): string | null {
  const [display, setDisplay] = useState<string | null>(null);
  useEffect(() => {
    if (!targetISO) { setDisplay(null); return; }
    const update = () => {
      const diff = new Date(targetISO).getTime() - Date.now();
      if (diff <= 0) { setDisplay("00:00:00"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setDisplay(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetISO]);
  return display;
}

function DailyCheckin() {
  const { user, refresh } = useUserStore();
  const { add: toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [nextAt, setNextAt] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const countdown = useCountdown(done ? nextAt : null);

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
  const streakBonus = streak >= 7 ? 100 : streak >= 5 ? 75 : streak >= 3 ? 50 : streak >= 2 ? 25 : 0;

  return (
    <div style={{ padding: "0 1rem 1rem" }}>
      <motion.div
        whileTap={{ scale: 0.98 }}
        style={{
          background: done
            ? "linear-gradient(135deg,#0a1a0a,#0d1f0d)"
            : "linear-gradient(135deg,#0d0d18,#1a0a1f)",
          border: `1px solid ${done ? "#22c55e44" : "#E8622A33"}`,
          borderRadius: "18px",
          padding: "1rem",
          position: "relative",
          overflow: "hidden",
          boxShadow: done ? "0 0 24px #22c55e12" : "0 0 24px #E8622A12",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: done ? "linear-gradient(90deg,transparent,#22c55e,transparent)" : "linear-gradient(90deg,transparent,#E8622A,#E8622A,transparent)" }} />
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
                <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.4rem", letterSpacing: "0.12em", marginBottom: "1px" }}>ЕЖЕДНЕВНЫЙ БОНУС · СЕРИЯ</div>
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
                ? countdown
                  ? <span>Следующий через <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#E8622A", fontWeight: 700 }}>{countdown}</span></span>
                  : `Получен${nextTime ? ` · следующий в ${nextTime}` : " · до завтра"}`
                : streak < 7
                  ? <span>Серия <strong style={{ color: "#f59e0b" }}>{streak}</strong> дн · следующий порог <strong style={{ color: "#fde047" }}>{streak < 2 ? 2 : streak < 3 ? 3 : streak < 5 ? 5 : 7} дн</strong> = +{streak < 2 ? 25 : streak < 3 ? 50 : streak < 5 ? 75 : 100}%&nbsp;XP</span>
                  : "Серия 7+ дней — максимальный бонус +100% XP активен!"}
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
              {streakBonus > 0 && (
                <span style={{ marginLeft: "4px", background: "#f59e0b18", border: "1px solid #f59e0b44", borderRadius: "5px", color: "#fde047", fontSize: "0.5rem", fontWeight: 700, padding: "1px 5px", fontFamily: "'JetBrains Mono',monospace" }}>
                  +{streakBonus}%&nbsp;XP
                </span>
              )}
            </div>

            {/* 28-day streak calendar */}
            {streak > 0 && (
              <div style={{ marginTop: "0.55rem" }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.38rem", letterSpacing: "0.1em", marginBottom: "0.3rem" }}>КАЛЕНДАРЬ СЕРИИ · 28Д</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "3px" }}>
                  {Array.from({ length: 28 }, (_, i) => {
                    const daysAgo = 27 - i;
                    const filled = daysAgo < streak;
                    const isToday = daysAgo === 0;
                    return (
                      <div key={i} style={{
                        height: "9px", borderRadius: "2px",
                        background: filled ? (isToday ? "#f59e0b" : "#f59e0b66") : "#1a1a24",
                        border: `1px solid ${isToday ? "#f59e0b" : filled ? "#f59e0b33" : "#2a2a38"}`,
                        boxShadow: isToday ? "0 0 4px #f59e0b" : "none",
                      }} />
                    );
                  })}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px" }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.37rem", color: "#374151" }}>−27д</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.37rem", color: "#f59e0b" }}>сегодня</span>
                </div>
              </div>
            )}
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

  const load = async (force = false) => {
    if (board && !force) { setOpen((v) => !v); return; }
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
        border: "1px solid #E8622A22",
        borderRadius: "20px",
        overflow: "hidden",
        boxShadow: "0 0 24px #E8622A10",
      }}>
        {/* Header button */}
        <button
          onClick={() => void load()}
          style={{
            width: "100%", display: "flex", alignItems: "center",
            justifyContent: "space-between",
            padding: "0.9rem 1rem",
            background: "none", border: "none", cursor: "pointer",
            borderBottom: open ? "1px solid #E8622A22" : "none",
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
              <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.46rem", letterSpacing: "0.14em", marginBottom: "0.1rem" }}>РЕЙТИНГ ОПЕРАТОРОВ · XP</div>
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
            {loading ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                style={{ color: "#E8622A", fontSize: "0.8rem", display: "inline-block" }}
              >
                ⟳
              </motion.span>
            ) : open && (
              <button
                onClick={(e) => { e.stopPropagation(); void load(true); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: "0.75rem", padding: "2px 4px", borderRadius: "4px" }}
                title="Обновить рейтинг"
              >↻</button>
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
                  background: "linear-gradient(135deg,#E8622A18,#E8622A18)",
                  border: "1px solid #E8622A44",
                  borderRadius: "12px",
                  padding: "0.55rem 0.85rem",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <p style={{ margin: 0, color: "#E8622A", fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Ваша позиция</p>
                    <p style={{ margin: 0, color: "#e2e8f0", fontWeight: 800, fontSize: "0.9rem" }}>#{board.user_rank}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, color: "#6b7280", fontSize: "0.6rem" }}>XP</p>
                    <p style={{ margin: 0, fontFamily: "'JetBrains Mono',monospace", color: "#E8622A", fontWeight: 700, fontSize: "0.9rem" }}>
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
                  const rowColor = rs?.color ?? (isMe ? "#E8622A" : "#9ca3af");
                  const maxXp = board.entries[0]?.xp ?? 1;
                  const barPct = Math.round((entry.xp / maxXp) * 100);

                  return (
                    <motion.div
                      key={entry.user_id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      style={{
                        background: rs ? rs.bg : isMe ? "#E8622A10" : "#0d0d14",
                        border: `1px solid ${rs ? rs.border : isMe ? "#E8622A33" : "#1a1a24"}`,
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
                          <p style={{ margin: 0, color: isMe ? "#E8622A" : rs ? rowColor : "#e2e8f0", fontSize: "0.8rem", fontWeight: (isMe || rs) ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {entry.username ? `@${entry.username}` : `Пользователь #${entry.user_id}`}
                            {isMe && <span style={{ color: "#E8622A", fontSize: "0.6rem", marginLeft: "0.3rem" }}>· вы</span>}
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
        border: "1px solid #E8622A25",
        borderRadius: "20px",
        padding: "1rem",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 0 20px #E8622A10",
      }}>
        {/* Top line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,#E8622A,#E8622A,transparent)" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
          <div style={{
            width: "38px", height: "38px", borderRadius: "10px", flexShrink: 0,
            background: "rgba(232,98,42,0.12)", border: "1px solid rgba(232,98,42,0.28)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.1rem", boxShadow: "0 0 10px rgba(232,98,42,0.2)",
          }}>🔗</div>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.46rem", letterSpacing: "0.14em", marginBottom: "0.1rem" }}>РЕФЕРАЛ ПРОГРАММА · +200_XP</div>
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
          background: "#E8622A10", border: "1px solid #E8622A30",
          borderRadius: "10px", padding: "0.45rem 0.75rem",
          display: "flex", alignItems: "center", gap: "0.5rem",
          marginBottom: "0.65rem",
        }}>
          <span style={{ fontSize: "0.9rem" }}>⭐</span>
          <p style={{ margin: 0, color: "#E8622A", fontSize: "0.7rem", lineHeight: 1.4 }}>
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
              border: "1px dashed #E8622A50",
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
                color: "#E8622A", fontSize: "0.92rem", fontWeight: 800, letterSpacing: "0.06em",
                textShadow: "0 0 10px #E8622A66",
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
              background: submitting || !inputCode.trim() ? "#1a1a24" : "linear-gradient(135deg,#E8622A,#E8622A)",
              border: "none", borderRadius: "10px",
              color: submitting || !inputCode.trim() ? "#4b5563" : "#fff",
              padding: "0.55rem 0.9rem",
              fontSize: "0.75rem", fontWeight: 700,
              cursor: submitting || !inputCode.trim() ? "not-allowed" : "pointer",
              boxShadow: submitting || !inputCode.trim() ? "none" : "0 0 12px #E8622A40",
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
  const color = TIER_COLORS[tier.name] ?? "#E8622A";
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
          backgroundImage: "linear-gradient(#E8622A 1px, transparent 1px), linear-gradient(90deg, #E8622A 1px, transparent 1px)",
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
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.43rem", letterSpacing: "0.14em", marginBottom: "0.18rem" }}>КОНСОЛЬ ОПЕРАТОРА · СТАТУС</div>
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
                  background: `linear-gradient(90deg, ${color}, ${TIER_COLORS[next?.name ?? ""] ?? "#E8622A"})`,
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

        {/* XP milestone roadmap */}
        {next && (
          <div style={{ marginTop: "0.75rem", borderTop: `1px solid ${color}22`, paddingTop: "0.65rem" }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", color: "#374151", fontSize: "0.38rem", letterSpacing: "0.1em", marginBottom: "0.35rem" }}>ДОРОЖНАЯ КАРТА · РАНГИ</div>
            <div style={{ display: "flex", gap: "0.3rem", overflowX: "auto", paddingBottom: "0.15rem" }}>
              {TIERS.map((t) => {
                const tColor = TIER_COLORS[t.name] ?? "#6b7280";
                const reached = xp >= t.min;
                const isCurrent = t.min === tier.min;
                const [tIcon] = t.name.split(" ");
                return (
                  <div key={t.name} style={{
                    flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
                    minWidth: "44px",
                  }}>
                    <div style={{
                      width: "30px", height: "30px", borderRadius: "50%",
                      background: reached ? `radial-gradient(circle at 35% 35%, ${tColor}33, ${tColor}11)` : "#0d0d14",
                      border: `1.5px solid ${isCurrent ? tColor : reached ? `${tColor}66` : "#22222f"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.9rem", lineHeight: 1,
                      boxShadow: isCurrent ? `0 0 10px ${tColor}66` : "none",
                      filter: reached ? "none" : "grayscale(1) opacity(0.4)",
                      transition: "all 0.3s",
                    }}>
                      {tIcon}
                    </div>
                    <span style={{
                      fontFamily: "'JetBrains Mono',monospace",
                      fontSize: "0.36rem", color: isCurrent ? tColor : reached ? "#6b7280" : "#374151",
                      fontWeight: isCurrent ? 700 : 400, textAlign: "center", lineHeight: 1.2,
                    }}>{t.short ?? t.name.split(" ").slice(1).join(" ")}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.34rem", color: "#374151" }}>
                      {t.min === 0 ? "0" : `${t.min >= 1000 ? `${t.min/1000}к` : t.min}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Share XP button */}
        {user && (
          <div style={{ marginTop: "0.65rem", borderTop: `1px solid ${color}18`, paddingTop: "0.6rem" }}>
            <button
              onClick={() => {
                const tier = TIERS[Math.max(0, TIERS.findIndex((t) => xp >= t.min && (t.max === null || xp <= t.max)))];
                const text = encodeURIComponent(`⬡ Топливный Узел\n${tier.name} · ${xp.toLocaleString("ru")} XP\nСерия: ${user.checkin_streak ?? 0} дн 🔥\n\nПрисоединяйся: @ToplivniyUzel_bot`);
                window.open(`https://t.me/share/url?url=https://t.me/&text=${text}`, "_blank");
                impact("light");
              }}
              style={{
                width: "100%", background: `${color}12`, border: `1px solid ${color}30`,
                borderRadius: "10px", color, fontSize: "0.68rem", fontWeight: 700,
                padding: "0.42rem", cursor: "pointer", transition: "all 0.2s",
                fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.04em",
              }}
            >
              ✈️ Поделиться достижением
            </button>
          </div>
        )}

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
              <p style={{ margin: 0, color: "#E8622A", fontWeight: 700, fontSize: "0.9rem", fontFamily: "'JetBrains Mono', monospace" }}>
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

// ─── Luna Park Tab ────────────────────────────────────────────────

export function ReserveTab() {
  return (
    <div style={{ height: "100%", overflowY: "auto", paddingBottom: "5rem" }}>
      <EmpireGame />
      <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "0 16px 20px" }} />
      <OperatorConsole />
      <div style={{ height: "0.75rem" }} />
      <DailyCheckin />
      <FlipGame />
      <PriceGuessGame />
      <TapGame />
      <LeaderboardSection />
      <ReferralSection />
      <XpTiers />
    </div>
  );
}
