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


class FlipResultOut(BaseModel):
    result_type: str
    message: str
    reward: Optional[str] = None
    attempts_remaining: int


class TapScoreIn(BaseModel):
    user_id: int
    score: int
    duration_seconds: int


class TapScoreOut(BaseModel):
    xp_earned: int
    total_xp: int
    level: str
    new_level: bool


class AnalyticsOut(BaseModel):
    regional_supply: dict
    availability_index: float
    price_index: float
    trend_data: List[dict]
    station_counts: dict
