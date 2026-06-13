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
  daily_games_played: number;
  flip_attempts_today: number;
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
}

export interface PurchaseResult {
  ok: boolean;
  blocked: boolean;
  block_reason?: string;
  purchase?: Purchase;
  transaction_id?: string;
}

export interface FlipResult {
  result_type: "empty" | "discount" | "voucher" | "blocked";
  message: string;
  reward?: string;
  attempts_remaining: number;
}

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

export type TabId = "map" | "analytics" | "catalog" | "vault" | "reserve";

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

export const XP_TIER_THRESHOLDS = [
  { min: 0,    max: 99,   level: "Новичок" },
  { min: 100,  max: 499,  level: "Караванщик" },
  { min: 500,  max: 1499, level: "Хранитель Карты" },
  { min: 1500, max: null, level: "Легенда Тавриды" },
];
