from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime


class FuelStatusOut(BaseModel):
    fuel_type: str
    status: str
    availability_pct: int
    last_updated: datetime
    model_config = {"from_attributes": True}


class GasStationOut(BaseModel):
    id: int
    region: str
    zone_type: str
    name: str
    address: str
    lat: float
    lng: float
    network: str
    queue_cars: int
    fuel_statuses: List[FuelStatusOut] = []
    model_config = {"from_attributes": True}


class StationReportIn(BaseModel):
    user_id: int
    vote_type: str

    @field_validator("vote_type")
    @classmethod
    def validate_vote(cls, v: str) -> str:
        if v not in ("available", "unavailable"):
            raise ValueError("vote_type must be 'available' or 'unavailable'")
        return v


class UserOut(BaseModel):
    id: int
    username: Optional[str]
    level: str
    xp: int
    daily_games_played: int
    flip_attempts_today: int
    model_config = {"from_attributes": True}


class UserCreateIn(BaseModel):
    user_id: int
    username: Optional[str] = None


class PurchaseOut(BaseModel):
    id: int
    fuel_type: str
    volume: int
    price: int
    currency: str
    status: str
    qr_hash: str
    station_name: Optional[str]
    region: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


class PurchaseIn(BaseModel):
    user_id: int
    fuel_type: str
    volume: int
    station_id: int
    payment_method: str = "mock"

    @field_validator("fuel_type")
    @classmethod
    def validate_fuel(cls, v: str) -> str:
        allowed = {"АИ-92", "АИ-95", "АИ-95+", "АИ-100", "ДТ", "ДТ+", "Газ"}
        if v not in allowed:
            raise ValueError(f"Тип топлива должен быть одним из {allowed}")
        return v

    @field_validator("volume")
    @classmethod
    def validate_volume(cls, v: int) -> int:
        if v not in (20, 40, 60):
            raise ValueError("Объём должен быть 20, 40 или 60 литров")
        return v


class PurchaseResultOut(BaseModel):
    ok: bool
    blocked: bool = False
    block_reason: Optional[str] = None
    purchase: Optional[PurchaseOut] = None
    transaction_id: Optional[str] = None


class CardOut(BaseModel):
    name: str
    emoji: str
    rarity: str
    xp: int


class FlipResultOut(BaseModel):
    result_type: str
    message: str
    reward: Optional[str] = None
    attempts_remaining: int
    cards: List[CardOut] = []
    total_xp_delta: int = 0


class TapScoreIn(BaseModel):
    user_id: int
    score: int
    duration_seconds: int


class TapScoreOut(BaseModel):
    xp_earned: int
    total_xp: int
    level: str
    new_level: bool


class SubscriptionIn(BaseModel):
    """Payload for creating a new fuel-alert subscription."""
    user_id: int
    telegram_chat_id: int
    station_id: int
    # If None, subscribe to overall station status (any fuel change)
    fuel_type: Optional[str] = None

    @field_validator("fuel_type")
    @classmethod
    def validate_fuel(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = {"АИ-92", "АИ-95", "АИ-95+", "АИ-100", "ДТ", "ДТ+", "Газ"}
        if v not in allowed:
            raise ValueError(f"Тип топлива должен быть одним из {allowed}")
        return v


class SubscriptionOut(BaseModel):
    """Subscription returned to the client or bot."""
    id: int
    user_id: int
    station_id: int
    station_name: str
    station_region: str
    fuel_type: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


class SubscriptionStatusOut(BaseModel):
    """Whether the user is subscribed to a station (for the bell icon)."""
    subscribed: bool
    subscription_id: Optional[int] = None


class AnalyticsOut(BaseModel):
    regional_supply: dict
    availability_index: float
    price_index: float
    trend_data: List[dict]
    station_counts: dict


# ── VPN ───────────────────────────────────────────────────────────

class VpnPlanId(str):
    pass


class VpnBuyIn(BaseModel):
    user_id: int
    telegram_chat_id: int
    plan_id: str            # "sprint" | "vzlet" | "session" | "bezlimit"
    payment_method: str     # "stars" | "cryptobot"

    @field_validator("plan_id")
    @classmethod
    def validate_plan(cls, v: str) -> str:
        if v not in ("sprint", "vzlet", "session", "bezlimit"):
            raise ValueError("Неверный план VPN")
        return v

    @field_validator("payment_method")
    @classmethod
    def validate_method(cls, v: str) -> str:
        if v not in ("stars", "cryptobot"):
            raise ValueError("Метод оплаты: stars или cryptobot")
        return v


class VpnSessionOut(BaseModel):
    id: int
    plan_name: str
    duration_minutes: int
    price_rub: int
    payment_method: str
    config_key: str
    is_active: bool
    activated_at: datetime
    expires_at: datetime
    model_config = {"from_attributes": True}


class VpnStatusOut(BaseModel):
    has_active: bool
    session: Optional[VpnSessionOut] = None


class VpnInvoiceOut(BaseModel):
    stars_amount: Optional[int] = None
    checkout_url: Optional[str] = None
    transaction_id: str
    plan_name: str
    duration_minutes: int


# ── Daily check-in ────────────────────────────────────────────────

class CheckinOut(BaseModel):
    ok: bool
    xp_awarded: int
    total_xp: int
    level: str
    already_done: bool
    message: str
    next_checkin_at: Optional[datetime] = None


# ── Leaderboard ───────────────────────────────────────────────────

class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    username: Optional[str]
    level: str
    xp: int


class LeaderboardOut(BaseModel):
    entries: List[LeaderboardEntry]
    user_rank: Optional[int] = None
    user_xp: Optional[int] = None


# ── Referral ──────────────────────────────────────────────────────

class ReferralOut(BaseModel):
    code: str
    uses: int
    xp_per_referral: int = 200


class ReferralUseIn(BaseModel):
    user_id: int
    code: str


class ReferralUseOut(BaseModel):
    ok: bool
    message: str
    xp_awarded: int = 0
