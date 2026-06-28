import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore } from "@/stores/useUserStore";
import { useEmpireStore } from "@/stores/useEmpireStore";
import { useToast } from "@/components/Toast";

// ── Haptic feedback ───────────────────────────────────────────────────────────

type HapticStyle = "light" | "medium" | "heavy" | "soft" | "rigid";
type HapticNotification = "success" | "error" | "warning";

function hapticImpact(style: HapticStyle = "medium") {
  try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred(style); } catch { /* noop */ }
}
function hapticNotify(type: HapticNotification = "success") {
  try { (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred(type); } catch { /* noop */ }
}

// ── Coin burst particles ───────────────────────────────────────────────────────

interface Particle { id: number; x: number; y: number; vx: number; vy: number; emoji: string; }

const COIN_EMOJIS = ["💰","🪙","✨","💛","⭐"];

function CoinBurst({ origin }: { origin: { x: number; y: number } | null }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!origin) return;
    const count = 18;
    const next: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      x: origin.x,
      y: origin.y,
      vx: (Math.random() - 0.5) * 220,
      vy: -(60 + Math.random() * 260),
      emoji: COIN_EMOJIS[Math.floor(Math.random() * COIN_EMOJIS.length)],
    }));
    setParticles(next);
    const t = setTimeout(() => setParticles([]), 1100);
    return () => clearTimeout(t);
  }, [origin]);

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 900, overflow: "hidden" }}>
      <AnimatePresence>
        {particles.map((p) => (
          <motion.span
            key={p.id}
            initial={{ x: p.x, y: p.y, opacity: 1, scale: 1, rotate: 0 }}
            animate={{ x: p.x + p.vx, y: p.y + p.vy, opacity: 0, scale: 0.4, rotate: (Math.random() - 0.5) * 360 }}
            transition={{ duration: 0.95, ease: [0.2, 0, 0.8, 1] }}
            style={{ position: "absolute", fontSize: "1.4rem", lineHeight: 1, transformOrigin: "center" }}
          >
            {p.emoji}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Building catalogue ────────────────────────────────────────────────────────

interface BuildingDef {
  key: string;
  name: string;
  emojis: [string, string, string];
  baseRate: number;
  baseXp: number;
  unlock: number;
  stage: 1 | 2 | 3 | 4;
  desc: string;
}

const BUILDINGS: BuildingDef[] = [
  { key: "hut",             name: "Хижина",          emojis: ["🛖","🏡","🏠"],  baseRate: 10,  baseXp: 50,   unlock: 1,  stage: 1, desc: "Уютное жильё для рабочих" },
  { key: "farm",            name: "Ферма",            emojis: ["🌾","🌿","🌽"],  baseRate: 15,  baseXp: 80,   unlock: 1,  stage: 1, desc: "Обеспечивает продовольствием" },
  { key: "market",          name: "Рынок",            emojis: ["🏪","🛒","🏬"],  baseRate: 20,  baseXp: 120,  unlock: 1,  stage: 1, desc: "Центр торговли" },
  { key: "windmill",        name: "Мельница",         emojis: ["🌬️","🌀","⚡"],  baseRate: 12,  baseXp: 90,   unlock: 1,  stage: 1, desc: "Производит энергию" },
  { key: "bakery",          name: "Пекарня",          emojis: ["🥐","🥖","🎂"],  baseRate: 35,  baseXp: 300,  unlock: 10, stage: 2, desc: "Кормит горожан" },
  { key: "blacksmith",      name: "Кузница",          emojis: ["⚒️","🔩","⚙️"],  baseRate: 40,  baseXp: 400,  unlock: 11, stage: 2, desc: "Производит инструменты" },
  { key: "warehouse",       name: "Склад",            emojis: ["📦","🏗️","🏭"],  baseRate: 30,  baseXp: 350,  unlock: 12, stage: 2, desc: "Хранит ресурсы" },
  { key: "townhall",        name: "Ратуша",           emojis: ["🏛️","🏢","🏛️"],  baseRate: 50,  baseXp: 500,  unlock: 13, stage: 2, desc: "Сердце города" },
  { key: "apartments",      name: "Апартаменты",      emojis: ["🏢","🏢","🏙️"],  baseRate: 80,  baseXp: 1000, unlock: 25, stage: 3, desc: "Жилой комплекс" },
  { key: "mall",            name: "Торг. центр",      emojis: ["🏬","🛍️","🛍️"],  baseRate: 100, baseXp: 1200, unlock: 26, stage: 3, desc: "Коммерческий гигант" },
  { key: "factory",         name: "Завод",            emojis: ["🏗️","🏭","🏭"],  baseRate: 120, baseXp: 1500, unlock: 27, stage: 3, desc: "Промышленное сердце" },
  { key: "bank",            name: "Банк",             emojis: ["🏦","💳","💰"],  baseRate: 150, baseXp: 2000, unlock: 28, stage: 3, desc: "Финансовый якорь" },
  { key: "skyscraper",      name: "Небоскрёб",        emojis: ["🏙️","🌆","🌃"],  baseRate: 300, baseXp: 5000, unlock: 50, stage: 4, desc: "Символ могущества" },
  { key: "airport",         name: "Аэропорт",         emojis: ["✈️","🛫","🛫"],  baseRate: 350, baseXp: 6000, unlock: 51, stage: 4, desc: "Хаб мирового класса" },
  { key: "techcampus",      name: "Технокампус",      emojis: ["💻","💡","🚀"],  baseRate: 400, baseXp: 7000, unlock: 52, stage: 4, desc: "Инновационный центр" },
  { key: "financial_center",name: "Финансовый ЦТ",   emojis: ["💰","💎","💎"],  baseRate: 500, baseXp: 8000, unlock: 53, stage: 4, desc: "Капитал мира" },
];

const STAGES = [
  { stage: 1, label: "🛖 Деревня",    unlock: 1,  color: "#10b981", light: "#d1fae5" },
  { stage: 2, label: "🏛️ Город",      unlock: 10, color: "#3b82f6", light: "#dbeafe" },
  { stage: 3, label: "🏙️ Мегаполис",  unlock: 25, color: "#8b5cf6", light: "#ede9fe" },
  { stage: 4, label: "✈️ Метрополия", unlock: 50, color: "#f59e0b", light: "#fef3c7" },
];

const DAILY_COINS = [500, 1000, 2000, 1500, 3000, 2500, 10000];

// ── Achievements ──────────────────────────────────────────────────────────────

interface Achievement {
  id: string;
  label: string;
  emoji: string;
  check: (data: { buildings: Record<string, number>; empire_level: number; coins: number; income_per_hour: number; prestige_count?: number }) => boolean;
}

const ACHIEVEMENTS: Achievement[] = [
  { id: "first_build",  label: "Первое строение!",    emoji: "🏗️",  check: (d) => Object.keys(d.buildings).length >= 1 },
  { id: "stage2",       label: "Открыт Город!",       emoji: "🏛️",  check: (d) => d.empire_level >= 10 },
  { id: "stage3",       label: "Открыт Мегаполис!",   emoji: "🏙️",  check: (d) => d.empire_level >= 25 },
  { id: "stage4",       label: "Открыта Метрополия!", emoji: "✈️",  check: (d) => d.empire_level >= 50 },
  { id: "income_1k",    label: "Доход 1К/ч",          emoji: "📈",  check: (d) => d.income_per_hour >= 1000 },
  { id: "income_10k",   label: "Доход 10К/ч",         emoji: "📊",  check: (d) => d.income_per_hour >= 10000 },
  { id: "coins_100k",   label: "100K монет!",          emoji: "💰",  check: (d) => d.coins >= 100_000 },
  { id: "coins_1m",     label: "Миллионер!",           emoji: "🤑",  check: (d) => d.coins >= 1_000_000 },
  { id: "five_buildings",label:"Пять строений!",       emoji: "🏘️",  check: (d) => Object.keys(d.buildings).length >= 5 },
  { id: "prestige_1",   label: "Первый Престиж!",      emoji: "⭐",  check: (d) => (d.prestige_count ?? 0) >= 1 },
  { id: "level_20",     label: "Уровень 20!",          emoji: "🔥",  check: (d) => d.empire_level >= 20 },
];

// ── Animated number counter ───────────────────────────────────────────────────

function AnimatedNumber({ value }: { value: number }) {
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);
  const [displayed, setDisplayed] = useState(value);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = to;
    if (Math.abs(to - from) < 0.5) { setDisplayed(to); return; }
    const duration = 480;
    const start = performance.now();
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplayed(from + (to - from) * ease);
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  return <>{fmtCoins(displayed)}</>;
}

// ── Micro sparkline ───────────────────────────────────────────────────────────

function MicroSparkline({ history, color }: { history: number[]; color: string }) {
  if (history.length < 2) return null;
  const w = 72, h = 28;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;
  const pts = history.map((v, i) => {
    const x = (i / (history.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  const ptsArr = pts.split(" ");
  const lastPt = ptsArr[ptsArr.length - 1].split(",");
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
      <circle
        cx={parseFloat(lastPt[0])}
        cy={parseFloat(lastPt[1])}
        r="3"
        fill={color}
      />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildingEmoji(def: BuildingDef, level: number): string {
  if (level <= 0) return "🏗️";
  if (level >= 10) return def.emojis[2];
  if (level >= 5)  return def.emojis[1];
  return def.emojis[0];
}

function productionPerHour(def: BuildingDef, level: number, prestige: number): number {
  if (level <= 0) return 0;
  return def.baseRate * Math.pow(level, 1.5) * (1 + 0.25 * prestige);
}

function upgradeCost(def: BuildingDef, currentLevel: number): number {
  const nextLevel = currentLevel + 1;
  return Math.round(def.baseXp * Math.pow(nextLevel, 1.5));
}

function fmtCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}М`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}К`;
  return Math.floor(n).toLocaleString("ru");
}

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

// ── Card theme helper ─────────────────────────────────────────────────────────

const CARD_THEMES: Record<number, { topBg: string; banner: string; bannerText: string; border: string; parch: string }> = {
  1: {
    topBg:      "linear-gradient(160deg, #3e7a28 0%, #2a5518 60%, #1b3a0e 100%)",
    banner:     "linear-gradient(135deg, #c49a12 0%, #d4aa18 50%, #b88a0e 100%)",
    bannerText: "#3a1e00",
    border:     "#8a6c10",
    parch:      "linear-gradient(180deg, #fffbef 0%, #f7edce 100%)",
  },
  2: {
    topBg:      "linear-gradient(160deg, #1d5c9e 0%, #144480 60%, #0c2e5a 100%)",
    banner:     "linear-gradient(135deg, #1e66b8 0%, #2878d0 50%, #185298 100%)",
    bannerText: "#ffffff",
    border:     "#144a9a",
    parch:      "linear-gradient(180deg, #f0f5ff 0%, #dce8fa 100%)",
  },
  3: {
    topBg:      "linear-gradient(160deg, #5b2494 0%, #3e1570 60%, #280d4c 100%)",
    banner:     "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #6d28d9 100%)",
    bannerText: "#ffffff",
    border:     "#5b21b6",
    parch:      "linear-gradient(180deg, #f5f0ff 0%, #ede5ff 100%)",
  },
  4: {
    topBg:      "linear-gradient(160deg, #92580c 0%, #6e3f08 60%, #4a2804 100%)",
    banner:     "linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #b45309 100%)",
    bannerText: "#3a1e00",
    border:     "#a35208",
    parch:      "linear-gradient(180deg, #fffbeb 0%, #fef0cc 100%)",
  },
};

// ── Building detail sheet ─────────────────────────────────────────────────────

function BuildingDetailSheet({
  def, level, prestige, availableXp, onClose, onUpgrade, loading,
}: {
  def: BuildingDef; level: number; prestige: number; availableXp: number;
  onClose: () => void; onUpgrade: () => void; loading: boolean;
}) {
  const stage = STAGES.find((s) => s.stage === def.stage)!;
  const theme = CARD_THEMES[def.stage];
  const currentRate = productionPerHour(def, level, prestige);
  const nextRate = productionPerHour(def, level + 1, prestige);
  const cost = upgradeCost(def, level);
  const canAfford = availableXp >= cost;
  const totalXpInvested = Array.from({ length: level }, (_, i) => upgradeCost(def, i)).reduce((a, b) => a + b, 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 800,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.parch,
          borderRadius: "28px 28px 0 0",
          width: "100%",
          maxWidth: "480px",
          overflow: "hidden",
          boxShadow: "0 -8px 48px rgba(0,0,0,0.4), 0 -2px 0 rgba(255,255,255,0.08)",
          border: `2px solid ${theme.border}`,
          borderBottom: "none",
        }}
      >
        {/* Drag handle */}
        <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.35)", borderRadius: 99, margin: "10px auto 0" }} />

        {/* Card illustrated top area */}
        <div style={{
          background: theme.topBg,
          padding: "16px 20px 20px",
          position: "relative",
          display: "flex", alignItems: "center", gap: "16px",
        }}>
          {/* Terrain dot texture */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "12px 12px",
          }} />
          {/* Active glow */}
          {level > 0 && (
            <motion.div
              animate={{ opacity: [0.4, 0.1, 0.4] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: `radial-gradient(ellipse at 50% 80%, ${stage.color}55 0%, transparent 65%)`,
              }}
            />
          )}
          {/* Large emoji */}
          <div style={{
            width: 72, height: 72, flexShrink: 0,
            background: "rgba(0,0,0,0.25)",
            borderRadius: "16px",
            border: "2px solid rgba(255,255,255,0.18)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "2.6rem",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
            zIndex: 1,
          }}>
            {buildingEmoji(def, level)}
          </div>
          <div style={{ zIndex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: "1.15rem", color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
              {def.name}
            </div>
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.8)", fontWeight: 600, marginTop: "3px" }}>
              {stage.label} · {def.desc}
            </div>
            {level > 0 && (
              <div style={{
                marginTop: "6px", display: "inline-flex", alignItems: "center", gap: "4px",
                background: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "2px 10px",
                border: "1px solid rgba(255,255,255,0.15)",
              }}>
                <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>УРОВЕНЬ</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.8rem", color: "#fff", fontWeight: 900 }}>{level}</span>
              </div>
            )}
          </div>
        </div>

        {/* Name banner */}
        <div style={{
          background: theme.banner,
          padding: "7px 20px",
          textAlign: "center",
          borderTop: "1px solid rgba(255,255,255,0.15)",
          borderBottom: `2px solid ${theme.border}`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.15)",
        }}>
          <div style={{ fontSize: "0.62rem", color: theme.bannerText, fontWeight: 700, opacity: 0.8, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            {stage.label.replace(/[^ ]+ /, "")} · Строение
          </div>
        </div>

        {/* Card body — parchment */}
        <div style={{ padding: "16px 20px 32px" }}>
          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
            {[
              { label: "Производство/ч", value: level > 0 ? `${fmtCoins(currentRate)}` : "—", color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
              { label: "После улучшения", value: `+${fmtCoins(nextRate - currentRate)}/ч`, color: stage.color, bg: stage.light, border: `${stage.color}44` },
              { label: "Цена улучшения", value: `${fmtCoins(cost)} XP`, color: canAfford ? "#6d28d9" : "#dc2626", bg: canAfford ? "#f5f3ff" : "#fef2f2", border: canAfford ? "#ddd6fe" : "#fecaca" },
              { label: "Вложено XP", value: totalXpInvested > 0 ? fmtCoins(totalXpInvested) : "—", color: "#92400e", bg: "#fffbeb", border: "#fde68a" },
            ].map((item) => (
              <div key={item.label} style={{
                background: item.bg, borderRadius: "12px", padding: "10px 12px",
                border: `1.5px solid ${item.border}`,
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}>
                <div style={{ fontSize: "0.55rem", color: "#6b7280", fontWeight: 700, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {item.label}
                </div>
                <div style={{ fontWeight: 900, fontSize: "0.9rem", color: item.color, fontFamily: "'JetBrains Mono', monospace" }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Upgrade button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onUpgrade}
            disabled={!canAfford || loading}
            style={{
              width: "100%",
              padding: "14px",
              background: canAfford
                ? `linear-gradient(135deg, ${stage.color} 0%, ${stage.color}dd 100%)`
                : "linear-gradient(135deg, #9ca3af, #6b7280)",
              color: "#fff",
              border: canAfford ? `2px solid rgba(255,255,255,0.2)` : "2px solid rgba(0,0,0,0.1)",
              borderRadius: "14px",
              fontWeight: 900, fontSize: "0.92rem",
              cursor: canAfford && !loading ? "pointer" : "not-allowed",
              boxShadow: canAfford ? `0 4px 20px ${stage.color}55, inset 0 1px 0 rgba(255,255,255,0.2)` : "none",
              letterSpacing: "0.01em",
            }}
          >
            {loading ? "Строим..." : level === 0 ? `🏗️ Построить · ${fmtCoins(cost)} XP` : `⬆️ Улучшить до ур.${level + 1} · ${fmtCoins(cost)} XP`}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Level tier system ─────────────────────────────────────────────────────────
// Tier 0: unbuilt | 1: basic (1-4) | 2: improved (5-9) | 3: grand (10-19) | 4: legendary (20+)

function getLevelTier(level: number): 0 | 1 | 2 | 3 | 4 {
  if (level === 0) return 0;
  if (level < 5)   return 1;
  if (level < 10)  return 2;
  if (level < 20)  return 3;
  return 4;
}

// Emoji sizes grow per tier
const TIER_EMOJI_SIZE   = ["1.55rem", "1.85rem", "2.15rem", "2.55rem", "3.0rem"] as const;
// Top-area min-height grows per tier
const TIER_TOP_HEIGHT   = [68, 78, 90, 104, 118] as const;
// Stars shown below the emoji
const TIER_STARS        = [0, 0, 1, 2, 3] as const;
// Small corner decorations (stage-specific, tier 2+)
const TIER_CORNERS: Record<number, Record<2|3|4, [string, string]>> = {
  1: { 2: ["🌿","🌾"], 3: ["🌳","🌲"], 4: ["✨","🌟"] },
  2: { 2: ["⚒️","🪙"], 3: ["🏰","🛡️"], 4: ["✨","👑"] },
  3: { 2: ["💡","⚡"], 3: ["🏙️","💎"], 4: ["✨","💎"] },
  4: { 2: ["💰","📊"], 3: ["💎","🏆"], 4: ["✨","👑"] },
};

// ── Building card ─────────────────────────────────────────────────────────────

function BuildingCard({
  def,
  level,
  prestige,
  availableXp,
  onUpgrade,
  onInfo,
  loading,
}: {
  def: BuildingDef;
  level: number;
  prestige: number;
  availableXp: number;
  onUpgrade: () => void;
  onInfo: () => void;
  loading: boolean;
}) {
  const rate      = productionPerHour(def, level, prestige);
  const cost      = upgradeCost(def, level);
  const canAfford = availableXp >= cost;
  const stage     = STAGES.find((s) => s.stage === def.stage)!;
  const theme     = CARD_THEMES[def.stage];
  const tier      = getLevelTier(level);

  const prevTierRef = useRef(tier);
  const [tierUpFlash, setTierUpFlash] = useState<number>(0);

  useEffect(() => {
    if (prevTierRef.current < tier) {
      setTierUpFlash(tier);
      const t = setTimeout(() => setTierUpFlash(0), 1900);
      prevTierRef.current = tier;
      return () => clearTimeout(t);
    }
    prevTierRef.current = tier;
  }, [tier]);

  // Visual parameters driven by tier
  const emojiSize  = TIER_EMOJI_SIZE[tier];
  const topHeight  = TIER_TOP_HEIGHT[tier];
  const starCount  = TIER_STARS[tier];
  const corners    = tier >= 2 ? TIER_CORNERS[def.stage][tier as 2|3|4] : null;

  // Card border & shadow escalate with tier
  const tierBorderWidth = tier >= 4 ? "3px" : tier >= 3 ? "2.5px" : "2px";
  const tierBorderColor = tier >= 3 ? "#d4a820" : tier >= 2 ? theme.border + "dd" : theme.border;
  const tierShadow = tier === 4
    ? `0 0 0 1px #d4a820, 0 6px 22px rgba(0,0,0,0.38), 0 2px 6px rgba(0,0,0,0.22), 0 0 20px #d4a82044`
    : tier === 3
    ? `0 0 0 1px ${stage.color}66, 0 5px 18px rgba(0,0,0,0.32), 0 1px 5px rgba(0,0,0,0.2)`
    : tier >= 1
    ? `0 4px 14px rgba(0,0,0,0.26), 0 1px 4px rgba(0,0,0,0.16)`
    : `0 2px 8px rgba(0,0,0,0.16)`;

  // Banner gets a shimmer shimmer at tier 3+
  const bannerStyle = tier >= 3
    ? `${theme.banner}, linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)`
    : theme.banner;

  return (
    <motion.div
      whileTap={{ scale: 0.95 }}
      style={{
        borderRadius: "12px",
        border: `${tierBorderWidth} solid ${tierBorderColor}`,
        overflow: "hidden",
        boxShadow: tierShadow,
        opacity: tier === 0 && !canAfford ? 0.68 : 1,
        position: "relative",
      }}
    >
      {/* ── Active production pulse ── */}
      {tier >= 1 && (
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.9, 0.35, 0.9] }}
          transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }}
          style={{
            position: "absolute", top: 5, right: 5,
            width: 6, height: 6, borderRadius: "50%",
            background: tier >= 4 ? "#f59e0b" : tier >= 3 ? "#d4a820" : "#10b981",
            boxShadow: `0 0 6px ${tier >= 4 ? "#f59e0baa" : tier >= 3 ? "#d4a820aa" : "#10b981aa"}`,
            zIndex: 15, pointerEvents: "none",
          }}
        />
      )}

      {/* ── Legendary outer glow ring ── */}
      {tier === 4 && (
        <motion.div
          animate={{ opacity: [0.6, 0.15, 0.6] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          style={{
            position: "absolute", inset: -3, borderRadius: "14px",
            border: "2px solid #f59e0b",
            pointerEvents: "none", zIndex: 10,
          }}
        />
      )}

      {/* ── Tier-up flash overlay ── */}
      <AnimatePresence>
        {tierUpFlash > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            style={{
              position: "absolute", inset: 0, zIndex: 40,
              borderRadius: "12px",
              background: "rgba(0,0,0,0.62)",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            {/* Radial burst */}
            <motion.div
              initial={{ scale: 0.2, opacity: 0.9 }}
              animate={{ scale: 3, opacity: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              style={{
                position: "absolute",
                width: 50, height: 50, borderRadius: "50%",
                background: tierUpFlash >= 4
                  ? "radial-gradient(circle, #f59e0b 0%, transparent 70%)"
                  : `radial-gradient(circle, ${stage.color} 0%, transparent 70%)`,
              }}
            />
            {/* Stars pop in one by one */}
            <div style={{ display: "flex", gap: "1px", zIndex: 1, marginBottom: "4px" }}>
              {Array.from({ length: Math.min(TIER_STARS[tierUpFlash] || 1, 3) }).map((_, i) => (
                <motion.span
                  key={i}
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1.3, rotate: 0 }}
                  transition={{ delay: 0.1 + i * 0.12, type: "spring", stiffness: 400, damping: 14 }}
                  style={{ fontSize: "0.9rem" }}
                >
                  {tierUpFlash >= 4 ? "🌟" : "⭐"}
                </motion.span>
              ))}
            </div>
            {/* Badge text */}
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.22, type: "spring", stiffness: 320 }}
              style={{
                background: tierUpFlash >= 4
                  ? "linear-gradient(135deg,#d4a820,#f5c518)"
                  : stage.color,
                color: tierUpFlash >= 4 ? "#3a1e00" : "#fff",
                fontWeight: 900, fontSize: "0.48rem",
                letterSpacing: "0.1em",
                padding: "2px 7px", borderRadius: "5px",
                textShadow: "none",
                boxShadow: `0 2px 8px ${stage.color}88`,
                zIndex: 1,
              }}
            >
              {tierUpFlash === 4 ? "👑 ЛЕГЕНДА" : `⭐ ТИР ${tierUpFlash}`}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Illustrated top area ── */}
      <div
        onClick={onInfo}
        style={{
          background: theme.topBg,
          padding: tier >= 3 ? "14px 6px 10px" : "10px 6px 7px",
          display: "flex", flexDirection: "column", alignItems: "center",
          position: "relative",
          minHeight: `${topHeight}px`,
          cursor: "pointer",
          overflow: "hidden",
        }}
      >
        {/* Terrain dot texture — denser at higher tiers */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: tier >= 2 ? "7px 7px" : "10px 10px",
        }} />

        {/* Tier 2+: radial ground highlight */}
        {tier >= 2 && (
          <div style={{
            position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
            width: "80%", height: "40%", borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            filter: "blur(6px)",
            pointerEvents: "none",
          }} />
        )}

        {/* Active glow pulse — intensity grows with tier */}
        {tier >= 1 && (
          <motion.div
            animate={{ opacity: [tier * 0.12, 0.04, tier * 0.12] }}
            transition={{ repeat: Infinity, duration: 3 + def.stage * 0.4, ease: "easeInOut" }}
            style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: `radial-gradient(ellipse at 50% 85%, ${stage.color}70 0%, transparent 68%)`,
            }}
          />
        )}

        {/* Legendary sweep shimmer */}
        {tier === 4 && (
          <motion.div
            animate={{ x: ["-120%", "120%"] }}
            transition={{ repeat: Infinity, duration: 3.5, ease: "linear", repeatDelay: 1.5 }}
            style={{
              position: "absolute", top: 0, bottom: 0,
              width: "40%",
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Corner decorations at tier 2+ */}
        {corners && (
          <>
            <div style={{
              position: "absolute", top: 3, left: 3,
              fontSize: tier === 4 ? "0.9rem" : "0.7rem",
              lineHeight: 1, zIndex: 2, pointerEvents: "none",
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
            }}>
              {corners[0]}
            </div>
            <div style={{
              position: "absolute", bottom: tier >= 1 ? 22 : 3, right: 3,
              fontSize: tier === 4 ? "0.9rem" : "0.7rem",
              lineHeight: 1, zIndex: 2, pointerEvents: "none",
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
            }}>
              {corners[1]}
            </div>
          </>
        )}

        {/* Level badge — top right */}
        {tier >= 1 && (
          <div style={{
            position: "absolute", top: 4, right: 4,
            background: tier >= 3 ? "rgba(212,168,32,0.5)" : "rgba(0,0,0,0.42)",
            border: `1px solid ${tier >= 3 ? "rgba(255,220,80,0.5)" : "rgba(255,255,255,0.22)"}`,
            borderRadius: "5px", padding: "1px 5px",
            fontSize: "0.5rem", fontWeight: 900,
            color: tier >= 3 ? "#fff8dc" : "#fff",
            fontFamily: "'JetBrains Mono', monospace",
            zIndex: 3,
          }}>
            {level}
          </div>
        )}

        {/* ─── Main building emoji — grows with tier ─── */}
        <motion.div
          key={`emoji-tier-${tier}`}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 18 }}
          style={{
            fontSize: emojiSize,
            lineHeight: 1,
            zIndex: 2,
            filter: tier === 0
              ? "grayscale(60%) brightness(0.7)"
              : tier >= 4
              ? "drop-shadow(0 4px 8px rgba(0,0,0,0.6)) drop-shadow(0 0 12px rgba(245,158,11,0.5))"
              : tier >= 3
              ? "drop-shadow(0 3px 7px rgba(0,0,0,0.55)) drop-shadow(0 0 6px rgba(255,255,255,0.2))"
              : "drop-shadow(0 3px 5px rgba(0,0,0,0.5))",
            marginBottom: starCount > 0 ? "4px" : tier >= 1 ? "2px" : 0,
          }}
        >
          {buildingEmoji(def, level)}
        </motion.div>

        {/* Star tier indicators */}
        {starCount > 0 && (
          <div style={{ display: "flex", gap: "1px", zIndex: 2, marginBottom: "2px" }}>
            {Array.from({ length: starCount }).map((_, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.08, type: "spring", stiffness: 300 }}
                style={{
                  fontSize: tier === 4 ? "0.65rem" : "0.55rem",
                  filter: tier === 4
                    ? "drop-shadow(0 0 4px rgba(255,200,0,0.9))"
                    : "drop-shadow(0 1px 2px rgba(0,0,0,0.4))",
                }}
              >
                {tier === 4 ? "🌟" : "⭐"}
              </motion.span>
            ))}
          </div>
        )}

        {/* Income rate pill */}
        {tier >= 1 && (
          <div style={{
            fontSize: "0.46rem", fontWeight: 800,
            color: tier >= 3 ? "#fef9c3" : "#d1fae5",
            fontFamily: "'JetBrains Mono', monospace",
            background: tier >= 3 ? "rgba(180,120,0,0.45)" : "rgba(0,0,0,0.32)",
            borderRadius: "4px", padding: "1px 5px",
            border: `1px solid ${tier >= 3 ? "rgba(255,220,80,0.3)" : "rgba(255,255,255,0.12)"}`,
            zIndex: 2,
          }}>
            +{fmtCoins(rate)}/ч
          </div>
        )}
      </div>

      {/* ── Name banner — more ornate at tier 3+ ── */}
      <div style={{
        background: bannerStyle,
        padding: tier >= 3 ? "5px 4px" : "4px 4px",
        textAlign: "center",
        borderTop: `1px solid ${tier >= 3 ? "rgba(255,220,80,0.25)" : "rgba(255,255,255,0.18)"}`,
        borderBottom: `${tier >= 3 ? "2px" : "1.5px"} solid ${tier >= 3 ? "#d4a820" : theme.border}`,
        boxShadow: tier >= 3
          ? "inset 0 1px 0 rgba(255,230,100,0.25), inset 0 -1px 0 rgba(0,0,0,0.18)"
          : "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.12)",
      }}>
        <div style={{
          fontWeight: 900,
          fontSize: tier >= 3 ? "0.62rem" : "0.58rem",
          color: tier >= 3 && def.stage !== 2 && def.stage !== 3 ? theme.bannerText : theme.bannerText,
          lineHeight: 1.2,
          letterSpacing: tier >= 3 ? "0.02em" : "0.01em",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          textShadow: tier >= 4 ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
        }}>
          {tier === 4 ? `👑 ${def.name}` : def.name}
        </div>
      </div>

      {/* ── Parchment action area — richer at higher tiers ── */}
      <div style={{
        background: tier >= 3
          ? `linear-gradient(180deg, ${theme.parch.replace("linear-gradient(180deg, ", "").replace(")", "").split(", ")[0]} 0%, ${stage.color}18 100%)`
          : theme.parch,
        padding: "6px 5px 7px",
      }}>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onUpgrade}
          disabled={!canAfford || loading}
          style={{
            width: "100%",
            padding: "5px 2px",
            background: canAfford
              ? tier >= 3
                ? `linear-gradient(135deg, #d4a820 0%, #f5c518 50%, #b8860b 100%)`
                : `linear-gradient(135deg, ${stage.color} 0%, ${stage.color}cc 100%)`
              : "linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)",
            color: canAfford && tier >= 3 ? "#3a1e00" : "#fff",
            border: canAfford
              ? tier >= 3 ? "1.5px solid rgba(255,230,80,0.4)" : "1.5px solid rgba(255,255,255,0.22)"
              : "1.5px solid rgba(0,0,0,0.08)",
            borderRadius: "7px",
            fontSize: "0.5rem",
            fontWeight: 900,
            cursor: canAfford && !loading ? "pointer" : "not-allowed",
            boxShadow: canAfford
              ? tier >= 3 ? `0 2px 10px rgba(212,168,32,0.55)` : `0 2px 8px ${stage.color}55`
              : "none",
            letterSpacing: "0.01em",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "2px",
          }}
        >
          {loading ? "..." : (
            <>
              <span>{tier === 0 ? "🏗️" : tier >= 3 ? "⬆️" : "⬆️"}</span>
              <span>{fmtCoins(cost)}XP</span>
            </>
          )}
        </motion.button>

        {/* XP progress bar */}
        {!canAfford && (
          <div style={{
            marginTop: "4px", height: "3px",
            background: "rgba(0,0,0,0.1)", borderRadius: "99px", overflow: "hidden",
          }}>
            <motion.div
              animate={{ width: `${Math.min((availableXp / cost) * 100, 100)}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{
                height: "100%", borderRadius: "99px",
                background: availableXp / cost > 0.66 ? "#10b981"
                  : availableXp / cost > 0.33 ? "#f59e0b" : "#ef4444",
              }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function DailyRewards({
  day,
  available,
  nextIn,
  onClaim,
}: {
  day: number;
  available: boolean;
  nextIn: number | null;
  onClaim: () => void;
}) {
  const [timer, setTimer] = useState(nextIn ?? 0);
  useEffect(() => {
    if (!nextIn) return;
    setTimer(nextIn);
    const iv = setInterval(() => setTimer((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(iv);
  }, [nextIn]);

  return (
    <div style={{
      background: "linear-gradient(135deg,#fffbeb 0%,#fef3c7 60%,#fef9e7 100%)",
      borderRadius: "20px",
      border: "1.5px solid #fde68a",
      padding: "14px 14px 12px",
      margin: "0 16px",
      boxShadow: "0 4px 16px rgba(245,158,11,0.1)",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <span style={{ fontSize: "1.05rem" }}>🎁</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.78rem", color: "#92400e" }}>Ежедневные награды</div>
            <div style={{ fontSize: "0.56rem", color: "#a16207" }}>7-дневный цикл · заходите каждый день</div>
          </div>
        </div>
        <div style={{
          background: "#f59e0b", color: "#fff",
          borderRadius: "8px", padding: "3px 8px",
          fontSize: "0.58rem", fontWeight: 800,
        }}>
          День {((day % 7) + 1)}/7
        </div>
      </div>

      {/* Day mini-card strip */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "10px" }}>
        {DAILY_COINS.map((coinAmount, i) => {
          const dayNum = i + 1;
          const isCurrent = dayNum === ((day % 7) + 1) && available;
          const isDone = day > 0 && dayNum <= (day % 7 === 0 ? 7 : day % 7) && !available;
          const isSpecial = dayNum === 7;
          return (
            <div
              key={dayNum}
              style={{
                flex: 1, minWidth: 0, position: "relative",
                background: isDone
                  ? "linear-gradient(160deg,#059669,#047857)"
                  : isCurrent
                  ? "linear-gradient(160deg,#f59e0b,#d97706)"
                  : "linear-gradient(160deg,#f9fafb,#f3f4f6)",
                borderRadius: "9px",
                border: `${isCurrent ? "2px" : "1.5px"} solid ${
                  isDone ? "#059669" : isCurrent ? "#b45309" : "#e5e7eb"
                }`,
                padding: "5px 2px 4px",
                textAlign: "center",
                boxShadow: isCurrent ? "0 4px 14px rgba(245,158,11,0.5)" : isDone ? "0 2px 6px rgba(5,150,105,0.2)" : "none",
                transform: isCurrent ? "translateY(-3px) scale(1.07)" : "none",
                transition: "all 0.2s",
              }}
            >
              <div style={{
                fontSize: "0.44rem", fontWeight: 900, lineHeight: 1, marginBottom: "2px",
                color: isDone ? "rgba(255,255,255,0.85)" : isCurrent ? "rgba(120,53,15,0.9)" : "#9ca3af",
              }}>
                {isDone ? "✅" : isSpecial ? "👑" : `Д${dayNum}`}
              </div>
              <div style={{
                fontSize: "0.44rem", fontWeight: 900, lineHeight: 1,
                color: isDone ? "#d1fae5" : isCurrent ? "#78350f" : "#6b7280",
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {fmtCoins(coinAmount)}
              </div>
            </div>
          );
        })}
      </div>

      {available ? (
        <motion.button
          whileTap={{ scale: 0.95 }}
          animate={{ boxShadow: ["0 3px 12px #f59e0b55","0 5px 22px #f59e0b88","0 3px 12px #f59e0b55"] }}
          transition={{ repeat: Infinity, duration: 1.8 }}
          onClick={onClaim}
          style={{
            width: "100%", padding: "10px",
            background: "linear-gradient(135deg,#f59e0b,#d97706)",
            color: "#fff", border: "none", borderRadius: "12px",
            fontWeight: 800, fontSize: "0.78rem", cursor: "pointer",
          }}
        >
          🎁 Получить: +{fmtCoins(DAILY_COINS[(day % 7)])} монет
        </motion.button>
      ) : (
        <div style={{
          textAlign: "center", padding: "8px",
          color: "#a16207", fontSize: "0.7rem", fontWeight: 600,
        }}>
          ⏰ Следующая награда через {fmtTime(timer)}
        </div>
      )}
    </div>
  );
}

const PODIUM_CFG = [
  { bg: "linear-gradient(160deg,#fffbeb,#fef3c7)", border: "#f59e0b", text: "#92400e", coin: "#d97706", emoji: "🥇" },
  { bg: "linear-gradient(160deg,#f8fafc,#f1f5f9)", border: "#9ca3af", text: "#374151", coin: "#6b7280", emoji: "🥈" },
  { bg: "linear-gradient(160deg,#fff7ed,#ffedd5)", border: "#cd7c2c", text: "#7c2d12", coin: "#9a3412", emoji: "🥉" },
];

function EmpireLeaderboard({ userId }: { userId: number }) {
  const { leaderboard, fetchLeaderboard } = useEmpireStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) fetchLeaderboard();
  }, [open, fetchLeaderboard]);

  const top3 = leaderboard.slice(0, 3);
  const rest  = leaderboard.slice(3, 10);

  return (
    <div style={{ margin: "0 16px" }}>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", padding: "11px 16px",
          background: open
            ? "linear-gradient(135deg,#d4a820,#f59e0b)"
            : "linear-gradient(135deg,#f59e0b,#d97706)",
          color: "#3a1e00",
          border: "1.5px solid rgba(255,220,80,0.35)",
          borderRadius: open ? "16px 16px 0 0" : "16px",
          fontWeight: 800, fontSize: "0.82rem", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          boxShadow: "0 3px 14px rgba(245,158,11,0.3)",
        }}
      >
        <span>🏆 Рейтинг империй</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.22 }}
          style={{ opacity: 0.7, fontSize: "0.68rem" }}
        >▼</motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              background: "linear-gradient(180deg,#fffbeb 0%,#fff 50%)",
              borderRadius: "0 0 16px 16px",
              border: "1.5px solid #f59e0b55",
              borderTop: "none",
              paddingBottom: "6px",
            }}>
              {leaderboard.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#6b7280", fontSize: "0.8rem" }}>
                  Нет данных
                </div>
              ) : (
                <>
                  {/* ── Top 3 podium cards ── */}
                  {top3.length > 0 && (
                    <div style={{ display: "flex", gap: "6px", padding: "10px 10px 6px" }}>
                      {top3.map((e, i) => {
                        const cfg = PODIUM_CFG[i];
                        const isMe = e.user_id === userId;
                        return (
                          <motion.div
                            key={e.user_id}
                            initial={{ scale: 0.78, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: i * 0.07, type: "spring", stiffness: 300, damping: 20 }}
                            style={{
                              flex: 1,
                              background: cfg.bg,
                              border: `${i === 0 ? "2px" : "1.5px"} solid ${cfg.border}`,
                              borderRadius: "12px",
                              padding: i === 0 ? "10px 6px" : "8px 5px",
                              textAlign: "center",
                              boxShadow: i === 0
                                ? `0 5px 18px ${cfg.border}44`
                                : `0 2px 8px ${cfg.border}22`,
                              outline: isMe ? "2px solid #3b82f6" : "none",
                              outlineOffset: "2px",
                              position: "relative",
                            }}
                          >
                            {e.prestige_count > 0 && (
                              <div style={{ position: "absolute", top: 3, right: 5, fontSize: "0.48rem", color: "#f59e0b", fontWeight: 700 }}>
                                ⭐×{e.prestige_count}
                              </div>
                            )}
                            <div style={{ fontSize: i === 0 ? "1.6rem" : "1.25rem", lineHeight: 1 }}>{cfg.emoji}</div>
                            <div style={{
                              fontSize: "0.56rem", fontWeight: 900, color: cfg.text,
                              marginTop: "4px", lineHeight: 1.3,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              padding: "0 2px",
                            }}>
                              {e.username ? `@${e.username}` : `#${e.user_id}`}
                              {isMe && <span style={{ color: "#3b82f6" }}> ✓</span>}
                            </div>
                            <div style={{ fontSize: "0.52rem", color: cfg.text, opacity: 0.7, marginTop: "2px" }}>
                              Ур.{e.empire_level}
                            </div>
                            <div style={{
                              fontSize: "0.52rem", fontWeight: 800, color: cfg.coin,
                              fontFamily: "'JetBrains Mono', monospace", marginTop: "2px",
                            }}>
                              {fmtCoins(e.coins)}💰
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Ranks 4–10 ── */}
                  {rest.length > 0 && (
                    <div style={{ margin: "0 8px 4px", borderRadius: "10px", overflow: "hidden", border: "1px solid #f3f4f6" }}>
                      {rest.map((e, i) => (
                        <div
                          key={e.user_id}
                          style={{
                            display: "flex", alignItems: "center",
                            padding: "8px 12px",
                            borderBottom: i < rest.length - 1 ? "1px solid #f9fafb" : "none",
                            background: e.user_id === userId ? "#eff6ff" : i % 2 === 0 ? "#fff" : "#fafafa",
                          }}
                        >
                          <div style={{
                            width: "22px", height: "22px",
                            background: "#f3f4f6", borderRadius: "6px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "0.6rem", fontWeight: 800, color: "#6b7280",
                            flexShrink: 0, marginRight: "9px",
                          }}>
                            {e.rank}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: "0.74rem", color: "#1c1917", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {e.username ? `@${e.username}` : `Игрок #${e.user_id}`}
                              {e.user_id === userId && <span style={{ color: "#3b82f6", marginLeft: 3 }}>(ты)</span>}
                            </div>
                            <div style={{ fontSize: "0.6rem", color: "#9ca3af" }}>
                              Ур.{e.empire_level} · {fmtCoins(e.coins)} монет
                            </div>
                          </div>
                          {e.prestige_count > 0 && (
                            <div style={{ fontSize: "0.62rem", color: "#f59e0b", fontWeight: 700, flexShrink: 0 }}>
                              ⭐×{e.prestige_count}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Level-up celebration ──────────────────────────────────────────────────────

function LevelUpCelebration({
  level, stage, onClose,
}: { level: number; stage: typeof STAGES[0]; onClose: () => void }) {
  useEffect(() => {
    hapticImpact("heavy");
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.78)",
        zIndex: 800,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column",
      }}
    >
      <motion.div
        initial={{ scale: 0.4, y: 50, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.7, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
        style={{ textAlign: "center", padding: "0 40px" }}
      >
        <motion.div
          animate={{ scale: [1, 1.12, 0.95, 1.05, 1] }}
          transition={{ duration: 0.7, delay: 0.1 }}
          style={{
            fontSize: "6rem",
            fontWeight: 900,
            color: stage.color,
            fontFamily: "'JetBrains Mono', monospace",
            lineHeight: 1,
            textShadow: `0 0 60px ${stage.color}, 0 0 120px ${stage.color}66`,
          }}
        >
          {level}
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{ fontWeight: 900, fontSize: "1.5rem", color: "#fff", marginTop: 16, letterSpacing: "-0.02em" }}
        >
          Новый уровень!
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{ fontSize: "1rem", color: stage.color, fontWeight: 700, marginTop: 8 }}
        >
          {stage.label}
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 1.2 }}
          style={{ fontSize: "0.75rem", color: "#fff", marginTop: 24 }}
        >
          Нажмите, чтобы закрыть
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// ── Prestige modal ────────────────────────────────────────────────────────────

function PrestigeModal({
  prestigeCount, onConfirm, onCancel, loading,
}: { prestigeCount: number; onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  const nextPrestige = prestigeCount + 1;
  const bonusCoins = 10000 * nextPrestige;
  const newMultiplier = (1 + 0.25 * nextPrestige).toFixed(2);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 800,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
      }}
    >
      <motion.div
        initial={{ scale: 0.85, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85, y: 30 }}
        style={{
          background: "linear-gradient(160deg, #1c0a3b, #0f0720)",
          borderRadius: "24px",
          padding: "28px 24px",
          textAlign: "center",
          maxWidth: "320px",
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          border: "2px solid #7c3aed44",
        }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>⭐</div>
        <div style={{ fontWeight: 900, fontSize: "1.15rem", color: "#e9d5ff", marginBottom: "8px" }}>
          Престиж #{nextPrestige}
        </div>
        <div style={{ fontSize: "0.8rem", color: "#E8622A", marginBottom: "20px", lineHeight: 1.6 }}>
          Все здания сбрасываются до нуля.<br />
          Взамен вы получаете постоянный<br />
          множитель дохода <strong style={{ color: "#fbbf24" }}>×{newMultiplier}</strong>
        </div>

        <div style={{
          background: "rgba(251,191,36,0.1)",
          borderRadius: "14px",
          padding: "12px 16px",
          marginBottom: "20px",
          border: "1px solid rgba(251,191,36,0.25)",
        }}>
          <div style={{ fontSize: "0.65rem", color: "#a16207", fontWeight: 600, marginBottom: "4px" }}>Бонус монет</div>
          <div style={{ fontWeight: 900, fontSize: "1.4rem", color: "#fbbf24" }}>
            +{fmtCoins(bonusCoins)}
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: "12px",
              background: "rgba(255,255,255,0.06)",
              color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
            }}
          >
            Отмена
          </button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1, padding: "12px",
              background: loading ? "#4c1d95" : "linear-gradient(135deg, #7c3aed, #6d28d9)",
              color: "#fff", border: "none",
              borderRadius: "12px", fontWeight: 800, fontSize: "0.85rem",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 4px 20px rgba(124,58,237,0.4)",
            }}
          >
            {loading ? "..." : "⭐ Престиж!"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Offline Earnings Modal ────────────────────────────────────────────────────

function OfflineModal({ coins, onCollect }: { coins: number; onCollect: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 500,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
      }}
    >
      <motion.div
        initial={{ scale: 0.8, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, y: 40 }}
        style={{
          background: "linear-gradient(160deg, #fffbeb, #fef3c7)",
          borderRadius: "24px",
          padding: "28px 24px",
          textAlign: "center",
          maxWidth: "320px",
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          border: "2px solid #fde68a",
        }}
      >
        <div style={{ fontSize: "3rem", marginBottom: "12px" }}>💰</div>
        <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "#92400e", marginBottom: "8px" }}>
          Пока вас не было...
        </div>
        <div style={{ color: "#a16207", fontSize: "0.85rem", marginBottom: "20px" }}>
          Ваша империя заработала
        </div>
        <div style={{ fontWeight: 900, fontSize: "2rem", color: "#d97706", marginBottom: "8px" }}>
          +{fmtCoins(coins)}
        </div>
        <div style={{ fontSize: "0.75rem", color: "#a16207", marginBottom: "24px" }}>монет</div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onCollect}
          style={{
            width: "100%",
            padding: "14px",
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            color: "#fff",
            border: "none",
            borderRadius: "14px",
            fontWeight: 800,
            fontSize: "0.9rem",
            cursor: "pointer",
            boxShadow: "0 4px 16px #f59e0b66",
          }}
        >
          Забрать монеты!
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function EmpireGame() {
  const { user } = useUserStore();
  const {
    data, loading, buildingLoading, localCoins,
    fetch, collect, build, claimDailyReward, tickCoins, prestige,
  } = useEmpireStore();
  const { add: addToast } = useToast();
  const [showOffline, setShowOffline] = useState(false);
  const [offlineCoins, setOfflineCoins] = useState(0);
  const [burstOrigin, setBurstOrigin] = useState<{ x: number; y: number } | null>(null);
  const [coinFlash, setCoinFlash] = useState(false);
  const [levelUpData, setLevelUpData] = useState<{ level: number; stage: typeof STAGES[0] } | null>(null);
  const [showPrestige, setShowPrestige] = useState(false);
  const [prestigeLoading, setPrestigeLoading] = useState(false);
  const [incomeHistory, setIncomeHistory] = useState<number[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const collectBtnRef = useRef<HTMLButtonElement>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenAchievementsRef = useRef<Set<string>>(new Set());
  const achievementsInitializedRef = useRef(false);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    fetch(userId).then(() => {
      const d = useEmpireStore.getState().data;
      if (d && d.pending_coins > 5) {
        setOfflineCoins(d.pending_coins);
        setShowOffline(true);
      }
    });
  }, [userId, fetch]);

  // Seed already-earned achievements on first data load (suppress toasts for old ones)
  useEffect(() => {
    if (!data || achievementsInitializedRef.current) return;
    achievementsInitializedRef.current = true;
    ACHIEVEMENTS.forEach((ach) => {
      if (ach.check(data)) seenAchievementsRef.current.add(ach.id);
    });
  }, [data]);

  // Track income history for sparkline (up to 12 data points)
  useEffect(() => {
    if (!data || data.income_per_hour <= 0) return;
    setIncomeHistory((prev) => {
      const last = prev[prev.length - 1];
      if (last === data.income_per_hour) return prev;
      const next = [...prev, data.income_per_hour].slice(-12);
      return next;
    });
  }, [data?.income_per_hour]);

  // Client-side coin ticker
  useEffect(() => {
    if (!data) return;
    const incomePerSec = data.income_per_hour / 3600;
    if (incomePerSec <= 0) return;
    tickRef.current = setInterval(() => {
      tickCoins(incomePerSec);
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [data?.income_per_hour, tickCoins]);

  const handleCollect = useCallback(async () => {
    if (!userId) return;
    setShowOffline(false);
    hapticImpact("medium");
    if (collectBtnRef.current) {
      const r = collectBtnRef.current.getBoundingClientRect();
      setBurstOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      setTimeout(() => setBurstOrigin(null), 50);
    } else {
      setBurstOrigin({ x: window.innerWidth / 2, y: window.innerHeight * 0.4 });
      setTimeout(() => setBurstOrigin(null), 50);
    }
    try {
      const earned = await collect(userId);
      hapticNotify("success");
      setCoinFlash(true);
      setTimeout(() => setCoinFlash(false), 700);
      addToast(`+${fmtCoins(earned)} монет собрано!`, "success");
    } catch {
      hapticNotify("error");
      addToast("Ошибка сбора монет", "error");
    }
  }, [userId, collect, addToast]);

  const handleBuild = useCallback(async (buildingType: string) => {
    if (!userId) return;
    hapticImpact("light");
    const prevEmpLevel = data?.empire_level ?? 1;
    try {
      const result = await build(userId, buildingType);
      const def = BUILDINGS.find((b) => b.key === buildingType)!;
      hapticNotify("success");
      addToast(`${def.name} улучшена до ур.${result.new_level}!`, "success");
      if (result.empire_level > prevEmpLevel) {
        const newStage = STAGES.slice().reverse().find((s) => result.empire_level >= s.unlock) ?? STAGES[0];
        setLevelUpData({ level: result.empire_level, stage: newStage });
      }
      // Check for newly unlocked achievements and toast them with staggered delay
      const newData = useEmpireStore.getState().data;
      if (newData) {
        let toastDelay = 900;
        ACHIEVEMENTS.forEach((ach) => {
          if (!seenAchievementsRef.current.has(ach.id) && ach.check(newData)) {
            seenAchievementsRef.current.add(ach.id);
            const d = toastDelay;
            setTimeout(() => addToast(`${ach.emoji} ${ach.label}`, "success"), d);
            toastDelay += 550;
          }
        });
      }
    } catch (e: unknown) {
      hapticNotify("error");
      const msg = e instanceof Error ? e.message : "Ошибка улучшения";
      addToast(msg, "error");
    }
  }, [userId, build, addToast, data?.empire_level]);

  const handlePrestige = useCallback(async () => {
    if (!userId) return;
    setPrestigeLoading(true);
    try {
      const res = await prestige(userId);
      hapticNotify("success");
      setShowPrestige(false);
      addToast(`⭐ Престиж #${res.prestige_count}! +${fmtCoins(res.bonus_coins)} монет`, "success");
    } catch (e: unknown) {
      hapticNotify("error");
      const msg = e instanceof Error ? e.message : "Ошибка престижа";
      addToast(msg, "error");
    } finally {
      setPrestigeLoading(false);
    }
  }, [userId, prestige, addToast]);

  const handleDailyReward = useCallback(async () => {
    if (!userId) return;
    hapticImpact("heavy");
    try {
      const res = await claimDailyReward(userId);
      hapticNotify("success");
      addToast(`🎁 День ${res.day}: +${fmtCoins(res.coins)} монет!`, "success");
    } catch {
      hapticNotify("error");
      addToast("Награда недоступна", "error");
    }
  }, [userId, claimDailyReward, addToast]);

  if (!userId) {
    return (
      <div style={{ padding: "32px", textAlign: "center", color: "#6b7280" }}>
        Войдите, чтобы начать
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div style={{ padding: "32px", textAlign: "center" }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          style={{ fontSize: "2rem", display: "inline-block" }}
        >
          ⚙️
        </motion.div>
        <div style={{ color: "#6b7280", marginTop: "12px", fontSize: "0.85rem" }}>
          Загрузка империи...
        </div>
      </div>
    );
  }

  const buildings = data?.buildings ?? {};
  const empireLevel = data?.empire_level ?? 1;
  const coins = (data?.coins ?? 0) + localCoins;
  const availableXp = data?.available_xp ?? 0;
  const incomePerHour = data?.income_per_hour ?? 0;
  const prestigeCount = data?.prestige_count ?? 0;
  const currentStage = STAGES.slice().reverse().find((s) => empireLevel >= s.unlock) ?? STAGES[0];
  const pendingCoins = (data?.pending_coins ?? 0) + localCoins;

  const totalBuildingLevels = Object.values(buildings).reduce((a: number, b) => a + (b as number), 0);
  const levelProgress = (totalBuildingLevels % 5) / 5;

  return (
    <div style={{ paddingBottom: "2rem" }}>
      {/* Coin burst */}
      <CoinBurst origin={burstOrigin} />

      {/* Offline earnings modal */}
      <AnimatePresence>
        {showOffline && offlineCoins > 5 && (
          <OfflineModal coins={offlineCoins} onCollect={handleCollect} />
        )}
      </AnimatePresence>

      {/* Level-up celebration */}
      <AnimatePresence>
        {levelUpData && (
          <LevelUpCelebration
            level={levelUpData.level}
            stage={levelUpData.stage}
            onClose={() => setLevelUpData(null)}
          />
        )}
      </AnimatePresence>

      {/* Prestige modal */}
      <AnimatePresence>
        {showPrestige && (
          <PrestigeModal
            prestigeCount={prestigeCount}
            onConfirm={handlePrestige}
            onCancel={() => setShowPrestige(false)}
            loading={prestigeLoading}
          />
        )}
      </AnimatePresence>

      {/* Building detail sheet */}
      <AnimatePresence>
        {selectedBuilding && (() => {
          const def = BUILDINGS.find((b) => b.key === selectedBuilding);
          if (!def) return null;
          return (
            <BuildingDetailSheet
              def={def}
              level={buildings[selectedBuilding] ?? 0}
              prestige={prestigeCount}
              availableXp={availableXp}
              onClose={() => setSelectedBuilding(null)}
              onUpgrade={() => { handleBuild(selectedBuilding); setSelectedBuilding(null); }}
              loading={buildingLoading === selectedBuilding}
            />
          );
        })()}
      </AnimatePresence>

      {/* Header */}
      <div style={{
        background: `linear-gradient(160deg, #fffbeb 0%, #fef3c7 60%, ${currentStage.light} 100%)`,
        borderRadius: "0 0 24px 24px",
        padding: "20px 16px 16px",
        marginBottom: "16px",
        borderBottom: `2px solid ${currentStage.color}33`,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: "1.1rem", color: "#1c1917" }}>
              🏰 Моя Империя
            </div>
            <div style={{ fontSize: "0.7rem", color: currentStage.color, fontWeight: 700, marginTop: "2px" }}>
              {currentStage.label} · Ур. {empireLevel}
              {prestigeCount > 0 && (
                <span style={{ marginLeft: "6px", color: "#7c3aed" }}>⭐×{prestigeCount}</span>
              )}
            </div>
            {/* Prestige button — visible when empire_level >= 20 */}
            {empireLevel >= 20 && (
              <motion.button
                whileTap={{ scale: 0.94 }}
                animate={{
                  boxShadow: [
                    "0 3px 12px rgba(124,58,237,0.4), 0 0 0 0 rgba(124,58,237,0)",
                    "0 3px 22px rgba(124,58,237,0.75), 0 0 0 4px rgba(124,58,237,0.15)",
                    "0 3px 12px rgba(124,58,237,0.4), 0 0 0 0 rgba(124,58,237,0)",
                  ],
                }}
                transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
                onClick={() => { hapticImpact("light"); setShowPrestige(true); }}
                style={{
                  marginTop: "6px",
                  background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                  color: "#fff",
                  border: "1px solid rgba(232,98,42,0.5)",
                  borderRadius: "10px",
                  padding: "4px 14px",
                  fontWeight: 800,
                  fontSize: "0.68rem",
                  cursor: "pointer",
                  letterSpacing: "0.01em",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <motion.span
                  animate={{ rotate: [0, 18, -18, 0] }}
                  transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
                  style={{ display: "inline-block" }}
                >⭐</motion.span>
                Престиж
              </motion.button>
            )}
          </div>
          {/* SVG arc level badge */}
          <div style={{ position: "relative", width: 60, height: 60 }}>
            <svg width="60" height="60" style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}>
              <circle cx="30" cy="30" r="26" fill="none" stroke={`${currentStage.color}22`} strokeWidth="4" />
              <motion.circle
                cx="30" cy="30" r="26"
                fill="none"
                stroke={currentStage.color}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 26}`}
                animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - levelProgress) }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </svg>
            <div style={{
              position: "absolute", inset: 4,
              background: currentStage.color,
              borderRadius: "50%",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              boxShadow: `0 2px 12px ${currentStage.color}55`,
            }}>
              <div style={{ color: "#fff", fontWeight: 900, fontSize: "1rem", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
                {empireLevel}
              </div>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.42rem", fontWeight: 700, letterSpacing: "0.04em" }}>УР.</div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: "8px" }}>
          <motion.div
            animate={coinFlash ? { scale: [1, 1.06, 1], borderColor: ["#fde68a", "#f59e0b", "#fde68a"] } : {}}
            transition={{ duration: 0.55, ease: "easeOut" }}
            style={{
              flex: 1,
              background: coinFlash ? "linear-gradient(135deg, #fffbeb, #fef9c3)" : "#fff",
              borderRadius: "14px",
              padding: "10px 12px",
              border: "1.5px solid #fde68a",
              boxShadow: coinFlash ? "0 0 20px rgba(245,158,11,0.4)" : "0 2px 8px rgba(245,158,11,0.12)",
              transition: "background 0.4s, box-shadow 0.4s",
            }}
          >
            <div style={{ fontSize: "0.6rem", color: "#a16207", fontWeight: 600, marginBottom: "2px" }}>💰 Монеты</div>
            <div style={{ fontWeight: 900, fontSize: "1rem", color: "#d97706", fontFamily: "'JetBrains Mono', monospace" }}>
              <AnimatedNumber value={coins} />
            </div>
            <div style={{ fontSize: "0.58rem", color: "#a16207", opacity: 0.8 }}>
              +{fmtCoins(incomePerHour)}/ч
            </div>
          </motion.div>
          <div style={{
            flex: 1,
            background: "#fff",
            borderRadius: "14px",
            padding: "10px 12px",
            border: "1.5px solid #dbeafe",
            boxShadow: "0 2px 8px rgba(59,130,246,0.1)",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: "0.6rem", color: "#1d4ed8", fontWeight: 600, marginBottom: "2px" }}>📈 Доход/ч</div>
                <div style={{ fontWeight: 900, fontSize: "1rem", color: "#2563eb", fontFamily: "'JetBrains Mono', monospace" }}>
                  <AnimatedNumber value={incomePerHour} />
                </div>
                <div style={{ fontSize: "0.58rem", color: "#6b7280" }}>
                  XP: {fmtCoins(availableXp)}
                </div>
              </div>
              <MicroSparkline history={incomeHistory} color="#3b82f6" />
            </div>
          </div>
          {pendingCoins > 1 && (
            <motion.button
              ref={collectBtnRef}
              whileTap={{ scale: 0.94 }}
              onClick={handleCollect}
              animate={{ boxShadow: ["0 2px 12px rgba(16,185,129,0.3)", "0 4px 24px rgba(16,185,129,0.6)", "0 2px 12px rgba(16,185,129,0.3)"] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              style={{
                flex: 1,
                background: "linear-gradient(135deg, #10b981, #059669)",
                borderRadius: "14px",
                padding: "10px 8px",
                border: "none",
                cursor: "pointer",
                color: "#fff",
                textAlign: "center" as const,
              }}
            >
              <div style={{ fontSize: "0.6rem", fontWeight: 600, opacity: 0.9, marginBottom: "2px" }}>Собрать</div>
              <div style={{ fontWeight: 900, fontSize: "0.85rem", fontFamily: "'JetBrains Mono', monospace" }}>
                +{fmtCoins(pendingCoins)}
              </div>
              <div style={{ fontSize: "0.55rem", opacity: 0.8 }}>монет</div>
            </motion.button>
          )}
        </div>

        {/* Achievement badges strip */}
        {data && (() => {
          const earned = ACHIEVEMENTS.filter((a) => a.check(data));
          if (earned.length === 0) return null;
          return (
            <div style={{
              display: "flex", gap: "5px", overflowX: "auto",
              marginTop: "10px",
              paddingBottom: "2px",
              msOverflowStyle: "none" as const,
            }}>
              {earned.map((ach) => (
                <div
                  key={ach.id}
                  style={{
                    flexShrink: 0,
                    background: "rgba(255,255,255,0.72)",
                    border: `1px solid ${currentStage.color}55`,
                    borderRadius: "20px",
                    padding: "3px 9px",
                    fontSize: "0.56rem",
                    fontWeight: 700,
                    color: "#92400e",
                    display: "flex", alignItems: "center", gap: "3px",
                    whiteSpace: "nowrap",
                    boxShadow: `0 1px 4px ${currentStage.color}22`,
                  }}
                >
                  <span>{ach.emoji}</span>
                  <span>{ach.label}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Daily rewards */}
      {data && (
        <div style={{ marginBottom: "16px" }}>
          <DailyRewards
            day={data.daily_reward_day}
            available={data.daily_reward_available}
            nextIn={data.next_daily_reward_in}
            onClaim={handleDailyReward}
          />
        </div>
      )}

      {/* Buildings by stage */}
      {STAGES.map((stage) => {
        const stageDefs = BUILDINGS.filter((b) => b.stage === stage.stage);
        const isUnlocked = empireLevel >= stage.unlock;
        const nextUnlockNeeded = stage.unlock - empireLevel;

        return (
          <div key={stage.stage} style={{ marginBottom: "20px" }}>
            {/* Stage header — parchment scroll banner */}
            <div style={{ padding: "0 16px", marginBottom: "10px" }}>
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                  position: "relative",
                  display: "flex", alignItems: "center",
                  background: isUnlocked ? CARD_THEMES[stage.stage].banner : "linear-gradient(135deg, #d1d5db, #9ca3af)",
                  borderRadius: "10px",
                  padding: "7px 12px",
                  border: `1.5px solid ${isUnlocked ? CARD_THEMES[stage.stage].border : "#d1d5db"}`,
                  boxShadow: isUnlocked ? `0 3px 14px ${stage.color}30, inset 0 1px 0 rgba(255,255,255,0.18)` : "none",
                  overflow: "hidden",
                }}
              >
                {isUnlocked && (
                  <div style={{
                    position: "absolute", inset: 0, borderRadius: "10px",
                    background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.14) 50%, transparent 65%)",
                    pointerEvents: "none",
                  }} />
                )}
                <div style={{ fontSize: "1rem", marginRight: "8px", opacity: isUnlocked ? 1 : 0.5, flexShrink: 0 }}>
                  {["🏰","🏛️","🏙️","✈️"][stage.stage - 1]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontWeight: 900, fontSize: "0.68rem",
                    color: isUnlocked ? CARD_THEMES[stage.stage].bannerText : "#6b7280",
                    letterSpacing: "0.05em",
                  }}>
                    {stage.label.toUpperCase()}
                  </div>
                  <div style={{
                    fontSize: "0.54rem", fontWeight: 600,
                    color: isUnlocked
                      ? (CARD_THEMES[stage.stage].bannerText === "#ffffff" ? "rgba(255,255,255,0.7)" : "rgba(58,30,0,0.55)")
                      : "#9ca3af",
                  }}>
                    {isUnlocked
                      ? `${stageDefs.length} зданий · Этап ${stage.stage}`
                      : `🔒 Откроется через +${nextUnlockNeeded} ур.`}
                  </div>
                </div>
                {isUnlocked && (() => {
                  const totalTiers = stageDefs.reduce((acc, d) => acc + getLevelTier(buildings[d.key] ?? 0), 0);
                  return totalTiers > 0 ? (
                    <div style={{
                      fontSize: "0.62rem", fontWeight: 800, flexShrink: 0, marginLeft: "6px",
                      color: CARD_THEMES[stage.stage].bannerText === "#ffffff" ? "rgba(255,255,255,0.88)" : "rgba(58,30,0,0.72)",
                    }}>
                      ⭐ {totalTiers}
                    </div>
                  ) : null;
                })()}
              </motion.div>
            </div>

            {/* Building grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "8px",
              padding: "0 16px",
              opacity: isUnlocked ? 1 : 0.4,
              pointerEvents: isUnlocked ? "auto" : "none",
            }}>
              {stageDefs.map((def) => (
                <BuildingCard
                  key={def.key}
                  def={def}
                  level={buildings[def.key] ?? 0}
                  prestige={prestigeCount}
                  availableXp={availableXp}
                  onUpgrade={() => handleBuild(def.key)}
                  onInfo={() => { hapticImpact("light"); setSelectedBuilding(def.key); }}
                  loading={buildingLoading === def.key}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Leaderboard */}
      <div style={{ marginTop: "8px" }}>
        <EmpireLeaderboard userId={userId} />
      </div>

      {/* Progression & XP overview card */}
      <div style={{
        margin: "12px 16px 0",
        background: "linear-gradient(135deg,#fffbeb,#fef3c7)",
        borderRadius: "16px",
        padding: "12px 14px",
        border: "1.5px solid #fde68a",
        boxShadow: "0 2px 8px rgba(245,158,11,0.08)",
      }}>
        {/* Next stage progress bar */}
        {(() => {
          const nextSt = STAGES.find((s) => s.stage === currentStage.stage + 1);
          if (!nextSt) return null;
          const progress = Math.min((empireLevel / nextSt.unlock) * 100, 100);
          return (
            <div style={{ marginBottom: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#92400e" }}>
                  🔓 До этапа «{nextSt.label}»
                </div>
                <div style={{ fontSize: "0.58rem", color: "#a16207", fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>
                  {empireLevel}/{nextSt.unlock} ур.
                </div>
              </div>
              <div style={{ height: "5px", background: "rgba(0,0,0,0.08)", borderRadius: "99px", overflow: "hidden" }}>
                <motion.div
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  style={{
                    height: "100%", borderRadius: "99px",
                    background: progress > 75
                      ? "linear-gradient(90deg,#10b981,#059669)"
                      : progress > 40
                      ? "linear-gradient(90deg,#f59e0b,#d97706)"
                      : "linear-gradient(90deg,#ef4444,#dc2626)",
                  }}
                />
              </div>
            </div>
          );
        })()}

        {/* Stats row */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
          {[
            { value: String(Object.values(buildings).filter((v) => (v as number) > 0).length), label: "зданий" },
            { value: String(totalBuildingLevels), label: "уровней" },
            { value: fmtCoins(availableXp), label: "своб. XP" },
          ].map((s, i, arr) => (
            <div key={s.label} style={{ flex: 1, textAlign: "center", display: "flex", alignItems: "center" }}>
              {i > 0 && <div style={{ width: "1px", height: "24px", background: "#fde68a", marginRight: "6px" }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 900, color: "#d97706", fontFamily: "'JetBrains Mono',monospace" }}>{s.value}</div>
                <div style={{ fontSize: "0.52rem", color: "#a16207" }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* XP explanation */}
        <div style={{ fontSize: "0.57rem", color: "#a16207", lineHeight: 1.5, paddingTop: "6px", borderTop: "1px solid #fde68a" }}>
          💡 Свободный XP = ваш общий XP минус потраченный в Империи. Уровень аккаунта <strong>никогда не снижается</strong>.
        </div>
      </div>
    </div>
  );
}
