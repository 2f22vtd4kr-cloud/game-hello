import type {
  Analytics, FlipResult, GasStation, LimitsMap,
  Purchase, PurchaseResult, Subscription, SubscriptionStatus,
  TapScoreResult, User,
} from "@/types";

const BASE = "/api";

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `Ошибка сервера: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// Stations
export const fetchStations = () => req<GasStation[]>("/stations");
export const fetchStation = (id: number) => req<GasStation>(`/stations/${id}`);
export const reportStation = (
  stationId: number,
  userId: number,
  voteType: "available" | "unavailable",
) =>
  req(`/stations/${stationId}/report`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, vote_type: voteType }),
  });

// User
export const fetchUser = (userId: number, username?: string) =>
  req<User>(`/user/${userId}${username ? `?username=${encodeURIComponent(username)}` : ""}`);

// Catalog
export const fetchLimits = (userId: number, zoneType = "standard") =>
  req<LimitsMap>(`/catalog/limits/${userId}?zone_type=${zoneType}`);

export const purchaseVoucher = (
  userId: number,
  fuelType: string,
  volume: number,
  stationId: number,
) =>
  req<PurchaseResult>("/catalog/purchase", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      fuel_type: fuelType,
      volume,
      station_id: stationId,
      payment_method: "mock",
    }),
  });

// Vault
export const fetchVault = (userId: number) =>
  req<Purchase[]>(`/vault/${userId}`);

// Analytics
export const fetchAnalytics = () => req<Analytics>("/analytics");
export const fetchTrend = (region?: string, days = 7) => {
  const p = new URLSearchParams({ days: String(days) });
  if (region) p.set("region", region);
  return req<import("@/types").TrendPoint[]>(`/analytics/trend?${p}`);
};

// Subscriptions (push-notification alerts)
export const checkSubscriptionStatus = (userId: number, stationId: number) =>
  req<SubscriptionStatus>(`/subscribe/status/${userId}/${stationId}`);

export const subscribeToStation = (
  userId: number,
  telegramChatId: number,
  stationId: number,
  fuelType?: string,
) =>
  req<Subscription>("/subscribe", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      telegram_chat_id: telegramChatId,
      station_id: stationId,
      fuel_type: fuelType ?? null,
    }),
  });

export const unsubscribeFromStation = (subscriptionId: number, userId: number) =>
  req(`/subscribe/${subscriptionId}?user_id=${userId}`, { method: "DELETE" });

export const fetchUserSubscriptions = (userId: number) =>
  req<{ subscriptions: Subscription[] }>(`/subscriptions/${userId}`);

// Games
export const flipCard = (userId: number) =>
  req<FlipResult>(`/game/flip/${userId}`, { method: "POST" });

export const createStarsInvoice = (
  // Returns invoice_link (Telegram invoice URL) when TELEGRAM_BOT_TOKEN is set.
  // Frontend must call Telegram.WebApp.openInvoice(invoice_link, callback).
  userId: number,
  fuelType: string,
  volume: number,
  stationId: number,
) =>
  req<{ stars_amount: number; transaction_id: string; qr_hash: string; invoice_link: string | null }>(
    "/catalog/stars-invoice",
    {
      method: "POST",
      body: JSON.stringify({ user_id: userId, fuel_type: fuelType, volume, station_id: stationId }),
    },
  );

export const createCryptoBotInvoice = (
  userId: number,
  fuelType: string,
  volume: number,
  stationId: number,
) =>
  req<{ checkout_url: string; transaction_id: string; qr_hash: string }>(
    "/catalog/cryptobot-invoice",
    {
      method: "POST",
      body: JSON.stringify({ user_id: userId, fuel_type: fuelType, volume, station_id: stationId }),
    },
  );

export const createNetworkStarsInvoice = (
  userId: number,
  network: string,
  fuelType: string,
  volume: number,
) =>
  req<{ stars_amount: number; invoice_link: string | null; transaction_id: string; price_rub: number }>(
    "/catalog/network-stars-invoice",
    {
      method: "POST",
      body: JSON.stringify({ user_id: userId, network, fuel_type: fuelType, volume }),
    },
  );

export const createNetworkCryptoBotInvoice = (
  userId: number,
  network: string,
  fuelType: string,
  volume: number,
) =>
  req<{ checkout_url: string; transaction_id: string; qr_hash: string }>(
    "/catalog/network-cryptobot-invoice",
    {
      method: "POST",
      body: JSON.stringify({ user_id: userId, network, fuel_type: fuelType, volume }),
    },
  );

export const purchaseNetworkVoucher = (
  userId: number,
  network: string,
  fuelType: string,
  volume: number,
) =>
  req<import("@/types").PurchaseResult>("/catalog/network-voucher", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, network, fuel_type: fuelType, volume, payment_method: "mock" }),
  });

export const submitTapScore = (
  userId: number,
  score: number,
  duration: number,
) =>
  req<TapScoreResult>(`/game/tap/${userId}`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, score, duration_seconds: duration }),
  });

// VPN
export const fetchVpnStatus = (userId: number) =>
  req<import("@/types").VpnStatus>(`/vpn/status/${userId}`);

export const buyVpnStars = (userId: number, chatId: number, planId: string) =>
  req<import("@/types").VpnInvoice>("/vpn/buy-stars", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, telegram_chat_id: chatId, plan_id: planId, payment_method: "stars" }),
  });

export const buyVpnCrypto = (userId: number, chatId: number, planId: string) =>
  req<import("@/types").VpnInvoice>("/vpn/buy-crypto", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, telegram_chat_id: chatId, plan_id: planId, payment_method: "cryptobot" }),
  });

// Dynamic prices
export const fetchPriceHistory = (hours = 24) =>
  req<{ history: Record<string, Array<{ t: string; avg: number; min: number; max: number }>> }>(`/prices/history?hours=${hours}`);

export const fetchPrices = (region?: string) =>
  req<import("@/types").PricesMap>(region ? `/prices/${encodeURIComponent(region)}` : "/prices");

// News / crisis feed
export const fetchNews = (region?: string, limit = 20) =>
  req<import("@/types").NewsItem[]>(`/news?limit=${limit}${region ? `&region=${encodeURIComponent(region)}` : ""}`);

// NeuroCredits
export const fetchCreditsBalance = (userId: number) =>
  req<{ balance: number; history: import("@/types").CreditTx[] }>(`/credits/balance/${userId}`);

export const earnCredits = (userId: number, action: string) =>
  req<{ ok: boolean; delta: number; balance: number }>(`/credits/earn/${userId}`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });

// Premium
export const fetchPremiumStatus = (userId: number) =>
  req<import("@/types").PremiumStatus>(`/premium/status/${userId}`);

// Daily check-in
export const dailyCheckin = (userId: number) =>
  req<import("@/types").CheckinResult>(`/checkin/${userId}`, { method: "POST" });

// Leaderboard
export const fetchLeaderboard = (userId?: number) =>
  req<import("@/types").Leaderboard>(`/leaderboard${userId ? `?user_id=${userId}` : ""}`);

// Referral
export const fetchReferral = (userId: number) =>
  req<import("@/types").ReferralInfo>(`/referral/${userId}`);

export const useReferralCode = (userId: number, code: string) =>
  req<{ ok: boolean; message: string; xp_awarded: number }>("/referral/use", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, code }),
  });

// System stats
export interface SystemStats {
  total_stations: number;
  total_users: number;
  total_purchases: number;
  active_purchases: number;
  total_news: number;
  total_reports: number;
  avg_availability_pct: number;
  station_breakdown: { green: number; yellow: number; red: number };
  generated_at: string;
}
export const fetchSystemStats = () => req<SystemStats>("/stats");

// Admin stats (extended)
export interface AdminStats {
  stations_total: number;
  users_total: number;
  vouchers_total: number;
  reports_24h: number;
  crisis_zones: string[];
  scheduler_running: boolean;
  db_size_mb: number;
  generated_at: string;
}
export const fetchAdminStats = () => req<AdminStats>("/admin/stats");
export const adminTriggerJob = (job: string) =>
  req<{ ok: boolean; job: string }>(`/admin/trigger/${job}`, { method: "POST" });
export const adminResetCrisis = (region?: string) =>
  req<{ ok: boolean; affected: number }>("/admin/crisis/reset", {
    method: "POST",
    body: JSON.stringify({ region }),
  });
export const adminReseedDb = () =>
  req<{ ok: boolean; message: string }>("/admin/db/reseed", { method: "POST" });

// Top stations
export interface TopStation {
  id: number;
  name: string;
  region: string;
  network: string;
  queue_cars: number;
  avg_availability_pct: number;
}
export const fetchTopStations = (limit = 5, fuelType?: string) =>
  req<TopStation[]>(`/top-stations?limit=${limit}${fuelType ? `&fuel_type=${fuelType}` : ""}`);

// Achievements
export interface Achievement {
  code: string;
  icon: string;
  label: string;
  desc: string;
  xp_bonus: number;
  unlocked: boolean;
  unlocked_at: string | null;
}
export const fetchAchievements = (userId: number) =>
  req<{ achievements: Achievement[] }>(`/achievements/${userId}`);

// Empire idle game
export interface EmpireState {
  empire_level: number;
  coins: number;
  available_xp: number;
  xp_spent: number;
  buildings: Record<string, number>;
  prestige_count: number;
  pending_coins: number;
  income_per_hour: number;
  daily_reward_day: number;
  daily_reward_available: boolean;
  next_daily_reward_in: number | null;
}
export interface EmpireCollectResult {
  ok: boolean;
  collected: number;
  new_balance: number;
}
export interface EmpireBuildResult {
  ok: boolean;
  new_level: number;
  xp_cost: number;
  available_xp: number;
  empire_level: number;
}
export interface EmpireDailyResult {
  ok: boolean;
  day: number;
  coins: number;
  message: string;
}
export interface EmpireLeaderboardEntry {
  rank: number;
  user_id: number;
  username: string | null;
  empire_level: number;
  coins: number;
  prestige_count: number;
}
export const fetchEmpire = (userId: number) =>
  req<EmpireState>(`/empire/${userId}`);
export const collectEmpireCoins = (userId: number) =>
  req<EmpireCollectResult>(`/empire/${userId}/collect`, { method: "POST" });
export const buildEmpireBuilding = (userId: number, buildingType: string) =>
  req<EmpireBuildResult>(`/empire/${userId}/build`, {
    method: "POST",
    body: JSON.stringify({ building_type: buildingType }),
  });
export const claimEmpireDailyReward = (userId: number) =>
  req<EmpireDailyResult>(`/empire/${userId}/daily-reward`, { method: "POST" });
export const fetchEmpireLeaderboard = () =>
  req<{ entries: EmpireLeaderboardEntry[] }>("/empire/leaderboard");
export interface EmpirePrestigeResult {
  ok: boolean;
  prestige_count: number;
  bonus_coins: number;
  new_balance: number;
  multiplier: number;
}
export const prestigeEmpire = (userId: number) =>
  req<EmpirePrestigeResult>(`/empire/${userId}/prestige`, { method: "POST" });

// Empire full-state sync (client-side game → backend persistence)
export const loadEmpireFullState = (userId: number) =>
  req<{ state: Record<string, unknown> | null }>(`/empire/${userId}/state`);

export const syncEmpireFullState = (userId: number, state: Record<string, unknown>) =>
  req<{ ok: boolean; synced_at: string }>(`/empire/${userId}/sync`, {
    method: "POST",
    body: JSON.stringify({ state }),
  });

// Station notes (personal user annotations)
export const fetchUserNotes = (userId: number) =>
  req<{ notes: Array<{ id: number; station_id: number; station_name: string; station_region: string; body: string; updated_at: string | null }> }>(`/users/${userId}/notes`);

export const fetchStationNote = (stationId: number, userId: number) =>
  req<{ body: string; updated_at: string | null }>(`/stations/${stationId}/notes/${userId}`);

export const upsertStationNote = (stationId: number, userId: number, body: string) =>
  req<{ ok: boolean; body: string }>(`/stations/${stationId}/notes`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, body }),
  });

export const deleteStationNote = (stationId: number, userId: number) =>
  req(`/stations/${stationId}/notes/${userId}`, { method: "DELETE" });

// AI Chat
export const sendAiMessage = (
  message: string,
  context?: {
    crisis_stations?: number;
    user_id?: number;
    total_stations?: number;
    region?: string;
    daily_used?: number;
    daily_max?: number;
    empire_coins?: number;
    empire_level?: number;
  },
  history?: Array<{ role: string; content: string }>,
) =>
  req<import("@/types").AiChatResponse>("/ai/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      context: context ?? {},
      history: history ?? [],
      user_id: context?.user_id ?? 0,
      region: context?.region ?? "",
    }),
  });

export const fetchCrisisForecast = () =>
  req<import("@/types").CrisisForecast[]>("/ai/crisis-forecast");

export const fetchRegionalPrices = () =>
  req<{ prices: Record<string, Record<string, number>>; source: string; updated: string }>(
    "/prices/regional"
  );

export const fetchNetworkPrices = () =>
  req<{ networks: Record<string, Record<string, number>>; updated: string }>(
    "/prices/networks"
  );

export const fetchStatsSummary = () =>
  req<{
    stations: { total: number; green: number; yellow: number; red: number };
    overall_pct: number;
    total_users: number;
    active_vouchers: number;
    reports_today: number;
    status: string;
  }>("/stats/summary");

// Market price threshold alerts
export interface PriceAlertOut {
  id: number;
  fuel_type: string;
  threshold_rub: number;
  direction: "above" | "below";
  active: boolean;
}

export const setPriceAlert = (
  userId: number,
  telegramChatId: number,
  fuelType: string,
  thresholdRub: number,
  direction: "above" | "below" = "above",
) =>
  req<PriceAlertOut>("/price-alerts", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      telegram_chat_id: telegramChatId,
      fuel_type: fuelType,
      threshold_rub: thresholdRub,
      direction,
    }),
  });

export const fetchPriceAlerts = (userId: number) =>
  req<PriceAlertOut[]>(`/price-alerts/${userId}`);

export const deletePriceAlert = (alertId: number, userId: number) =>
  req<{ ok: boolean }>(`/price-alerts/${alertId}?user_id=${userId}`, {
    method: "DELETE",
  });
