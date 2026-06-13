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
  userId: number,
  fuelType: string,
  volume: number,
  stationId: number,
) =>
  req<{ stars_amount: number; transaction_id: string; qr_hash: string }>(
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
