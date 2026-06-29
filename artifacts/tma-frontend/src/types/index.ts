export interface FuelStatus {
  fuel_type: string;
  status: "green" | "yellow" | "red";
  availability_pct: number;
  last_updated: string;
}

export interface GasStation {
  id: number;
  region: string;
  zone_type: "critical" | "standard" | "eastern";
  name: string;
  address: string;
  lat: number;
  lng: number;
  network: string;
  queue_cars: number;
  fuel_statuses: FuelStatus[];
}

export interface User {
  id: number;
  username: string | null;
  level: string;
  xp: number;
  neurocredits: number;
  daily_games_played: number;
  flip_attempts_today: number;
  premium_tier: string | null;
  checkin_streak?: number;
}

export interface FuelPrice {
  base: number;
  effective: number;
  multiplier: number;
  is_crisis: boolean;
  events: { reason: string; multiplier: number }[];
}

export interface NewsItem {
  id: number;
  region: string;
  headline: string;
  body: string | null;
  severity: "info" | "warning" | "critical" | "success";
  fuel_type: string | null;
  price_delta_pct: number | null;
  source: string | null;
  created_at: string;
}

export interface Purchase {
  id: number;
  fuel_type: string;
  volume: number;
  price: number;
  currency: string;
  status: "active" | "used" | "expired";
  qr_hash: string;
  station_name: string | null;
  region: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface PurchaseResult {
  ok: boolean;
  blocked: boolean;
  block_reason?: string;
  purchase?: Purchase;
  transaction_id?: string;
}

export interface FlipCard {
  name: string;
  emoji: string;
  rarity: string;
  xp: number;
}

export interface FlipResult {
  result_type: "common" | "rare" | "epic" | "legendary" | "mythic" | "cursed" | "blocked";
  message: string;
  reward?: string;
  attempts_remaining: number;
  cards: FlipCard[];
  total_xp_delta: number;
}

export const RARITY_COLORS: Record<string, string> = {
  "Обычная":     "#6b7280",
  "Необычная":   "#22c55e",
  "Редкая":      "#3b82f6",
  "Эпическая":   "#E8622A",
  "Легендарная": "#f59e0b",
  "Мифическая":  "#E8622A",
  "Проклятая":   "#ef4444",
};

export interface TapScoreResult {
  xp_earned: number;
  total_xp: number;
  level: string;
  new_level: boolean;
}

export interface FuelLimit {
  max: number;
  used: number;
  remaining: number;
  price_per_litre: number;
}

export interface LimitsMap {
  [fuel_type: string]: FuelLimit;
}

export interface RegionalSupply {
  green: number;
  yellow: number;
  red: number;
  avg_pct: number;
  count: number;
  zone_type: string;
}

export interface AnalyticsTrend {
  time: string;
  region: string;
  avg_availability: number;
  price_index: number;
}

export interface TrendPoint {
  time: string;
  availability: number;
}

export interface Analytics {
  regional_supply: Record<string, RegionalSupply>;
  availability_index: number;
  price_index: number;
  trend_data: AnalyticsTrend[];
  station_counts: {
    total: number;
    green: number;
    yellow: number;
    red: number;
  };
}

export interface Subscription {
  id: number;
  user_id: number;
  station_id: number;
  station_name: string;
  station_region: string;
  fuel_type: string | null;
  created_at: string;
}

export interface SubscriptionStatus {
  subscribed: boolean;
  subscription_id?: number;
}

export type TabId = "map" | "analytics" | "catalog" | "ai" | "games" | "news";

export interface TicketSuggestion {
  fuel_type: string;
  volume: number;
  label: string;
}

export interface AiMessage {
  role: "user" | "bot";
  text: string;
  ts: number;
  ticket_suggestion?: TicketSuggestion | null;
  vpn_fallback?: boolean;
  dismissed_ticket?: boolean;
}

export interface AiChatResponse {
  reply: string;
  suggestions?: string[];
  ticket_suggestion?: TicketSuggestion | null;
  vpn_fallback?: boolean;
}

export interface CrisisForecast {
  severity: number;
  trend: "worsening" | "stable" | "improving";
  days_until_critical: number;
  recommended_volume_liters: number;
  region: string;
}

export const FUEL_LABELS: Record<string, string> = {
  "АИ-92": "АИ-92",
  "АИ-95": "АИ-95",
  "АИ-95+": "АИ-95+",
  "АИ-100": "АИ-100",
  "ДТ": "Дизель",
  "ДТ+": "Дизель+",
  "Газ": "Газ (LPG)",
};

export const STATUS_COLORS: Record<string, string> = {
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
};

export const STATUS_LABELS: Record<string, string> = {
  green: "В наличии",
  yellow: "Ограничено",
  red: "Нет",
};

// ── VPN ──────────────────────────────────────────────────────────

export interface VpnPlan {
  id: "sprint" | "vzlet" | "session" | "bezlimit";
  emoji: string;
  name: string;
  subtitle: string;
  durationMin: number;
  priceRub: number;
  starsAmount: number;
}

export const VPN_PLANS: VpnPlan[] = [
  { id: "sprint",   emoji: "⚡️", name: "Спринт",          subtitle: "Идеально для быстрой проверки почты или авторизации",               durationMin: 5,  priceRub: 15, starsAmount: 9  },
  { id: "vzlet",    emoji: "✈️", name: "Взлёт",            subtitle: "Достаточно, чтобы прочитать заблокированные медиа и ответить в чатах", durationMin: 15, priceRub: 30, starsAmount: 17 },
  { id: "session",  emoji: "🎬", name: "Сессия",           subtitle: "Оптимально для просмотра короткого видео или скачивания документа",   durationMin: 30, priceRub: 50, starsAmount: 28 },
  { id: "bezlimit", emoji: "🪐", name: "Безлимит на час",  subtitle: "Полноценная сессия для работы или скроллинга ленты",                 durationMin: 60, priceRub: 80, starsAmount: 44 },
];

export interface VpnSession {
  id: number;
  plan_name: string;
  duration_minutes: number;
  price_rub: number;
  payment_method: string;
  config_key: string;
  is_active: boolean;
  activated_at: string;
  expires_at: string;
}

export interface VpnStatus {
  has_active: boolean;
  session?: VpnSession;
}

export interface VpnInvoice {
  stars_amount?: number;
  checkout_url?: string;
  transaction_id: string;
  plan_name: string;
  duration_minutes: number;
}

// ── Check-in ─────────────────────────────────────────────────────

export interface CheckinResult {
  ok: boolean;
  xp_awarded: number;
  total_xp: number;
  level: string;
  already_done: boolean;
  message: string;
  next_checkin_at?: string;
  checkin_streak?: number;
}

// ── Leaderboard ──────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  username: string | null;
  level: string;
  xp: number;
}

export interface Leaderboard {
  entries: LeaderboardEntry[];
  user_rank?: number;
  user_xp?: number;
  total_users?: number;
}

// ── Dynamic prices ────────────────────────────────────────────────

export type PricesMap = Record<string, Record<string, FuelPrice>>;

// ── NeuroCredits ──────────────────────────────────────────────────

export interface CreditTx {
  delta: number;
  reason: string;
  balance_after: number;
  created_at: string | null;
}

// ── Premium ───────────────────────────────────────────────────────

export interface PremiumStatus {
  tier: string | null;
  expires_at: string | null;
  is_active: boolean;
  neurocredits: number;
}

// ── Referral ─────────────────────────────────────────────────────

export interface ReferralInfo {
  code: string;
  uses: number;
  xp_per_referral: number;
}

export const XP_TIER_THRESHOLDS = [
  { min: 0,      max: 999,    level: "🚶 Пешеход" },
  { min: 1000,   max: 4999,   level: "🚲 Самокатчик" },
  { min: 5000,   max: 14999,  level: "🛵 Мопедист" },
  { min: 15000,  max: 34999,  level: "🚗 Извозчик" },
  { min: 35000,  max: 59999,  level: "🚛 Дальнобойщик" },
  { min: 60000,  max: 99999,  level: "⚡ Бензиновый Барон" },
  { min: 100000, max: null,   level: "👑 Владелец НПЗ" },
];
