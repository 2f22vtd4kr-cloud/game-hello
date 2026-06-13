from sqlalchemy import (
    Boolean, Column, Integer, BigInteger, String, Float,
    DateTime, ForeignKey, Index, UniqueConstraint, Text,
)
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime, timezone

Base = declarative_base()


def _now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True)
    username = Column(String, nullable=True)
    level = Column(String, default="Новичок")
    xp = Column(Integer, default=0)
    neurocredits = Column(Integer, default=100)
    daily_games_played = Column(Integer, default=0)
    last_game_timestamp = Column(DateTime(timezone=True), nullable=True)
    flip_attempts_today = Column(Integer, default=0)
    last_flip_reset = Column(DateTime(timezone=True), nullable=True)
    referral_code_used = Column(String, nullable=True)
    premium_tier = Column(String, nullable=True)
    premium_expires_at = Column(DateTime(timezone=True), nullable=True)

    purchases = relationship("PurchaseHistory", back_populates="user", lazy="dynamic")
    limits = relationship("DailyLimitTracker", back_populates="user", lazy="dynamic")
    reports = relationship("StationReport", back_populates="user", lazy="dynamic")
    subscriptions = relationship("Subscription", back_populates="user",
                                 cascade="all, delete-orphan", lazy="dynamic")


class GasStation(Base):
    __tablename__ = "gas_stations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    region = Column(String, nullable=False, index=True)
    zone_type = Column(String, default="standard")
    name = Column(String, nullable=False)
    address = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    network = Column(String, nullable=False)
    queue_cars = Column(Integer, default=0)

    fuel_statuses = relationship("FuelStatus", back_populates="station",
                                 cascade="all, delete-orphan")
    reports = relationship("StationReport", back_populates="station",
                           cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="station",
                                 cascade="all, delete-orphan")

    __table_args__ = (Index("ix_station_lat_lng", "lat", "lng"),)


class FuelStatus(Base):
    __tablename__ = "fuel_statuses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    station_id = Column(Integer, ForeignKey("gas_stations.id"), nullable=False)
    fuel_type = Column(String, nullable=False)
    status = Column(String, default="green")
    availability_pct = Column(Integer, default=80)
    last_updated = Column(DateTime(timezone=True), default=_now)

    station = relationship("GasStation", back_populates="fuel_statuses")

    __table_args__ = (Index("ix_fuel_station_type", "station_id", "fuel_type"),)


class PurchaseHistory(Base):
    __tablename__ = "purchase_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    fuel_type = Column(String, nullable=False)
    volume = Column(Integer, nullable=False)
    price = Column(Integer, nullable=False)
    currency = Column(String, default="RUB")
    status = Column(String, default="active")
    qr_hash = Column(String, unique=True, nullable=False)
    station_name = Column(String, nullable=True)
    region = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now)
    expires_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="purchases")


class DailyLimitTracker(Base):
    __tablename__ = "daily_limit_trackers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    fuel_type = Column(String, nullable=False)
    total_volume_bought = Column(Integer, default=0)
    reset_at = Column(DateTime(timezone=True), nullable=False)

    user = relationship("User", back_populates="limits")

    __table_args__ = (Index("ix_limit_user_fuel", "user_id", "fuel_type"),)


class StationReport(Base):
    __tablename__ = "station_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    station_id = Column(Integer, ForeignKey("gas_stations.id"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    vote_type = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    station = relationship("GasStation", back_populates="reports")
    user = relationship("User", back_populates="reports")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    telegram_chat_id = Column(BigInteger, nullable=False)
    station_id = Column(Integer, ForeignKey("gas_stations.id"), nullable=False)
    fuel_type = Column(String, nullable=True)
    last_notified_status = Column(String, nullable=True)
    last_notified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now)

    user = relationship("User", back_populates="subscriptions")
    station = relationship("GasStation", back_populates="subscriptions")

    __table_args__ = (
        UniqueConstraint("user_id", "station_id", "fuel_type",
                         name="uq_sub_user_station_fuel"),
        Index("ix_sub_station_id", "station_id"),
    )


class VpnSession(Base):
    __tablename__ = "vpn_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, nullable=False, index=True)
    telegram_chat_id = Column(BigInteger, nullable=False)
    plan_id = Column(String, nullable=False)
    plan_name = Column(String, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    price_rub = Column(Integer, nullable=False)
    payment_method = Column(String, nullable=False)
    transaction_id = Column(String, nullable=True)
    config_key = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    activated_at = Column(DateTime(timezone=True), default=_now)
    expires_at = Column(DateTime(timezone=True), nullable=False)


class UserCheckin(Base):
    __tablename__ = "user_checkins"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    checked_in_at = Column(DateTime(timezone=True), default=_now)
    xp_awarded = Column(Integer, default=50)

    user = relationship("User")
    __table_args__ = (Index("ix_checkin_user_date", "user_id", "checked_in_at"),)


class ReferralCode(Base):
    __tablename__ = "referral_codes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False, unique=True)
    code = Column(String, unique=True, nullable=False, index=True)
    uses = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=_now)

    user = relationship("User")


class AnalyticsSnapshot(Base):
    __tablename__ = "analytics_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    region = Column(String, nullable=False)
    avg_availability = Column(Float, default=0.0)
    green_count = Column(Integer, default=0)
    yellow_count = Column(Integer, default=0)
    red_count = Column(Integer, default=0)
    price_index = Column(Float, default=100.0)
    created_at = Column(DateTime(timezone=True), default=_now)


class FuelPriceEvent(Base):
    """Dynamic price multiplier per region+fuel — drives the crisis engine."""
    __tablename__ = "fuel_price_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    region = Column(String, nullable=False, index=True)
    fuel_type = Column(String, nullable=False)
    multiplier = Column(Float, default=1.0)
    reason = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_now)
    expires_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (Index("ix_price_event_region", "region", "fuel_type"),)


class NewsEvent(Base):
    """Crisis/market news entries shown in the Matrix feed."""
    __tablename__ = "news_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    region = Column(String, nullable=False)
    headline = Column(String, nullable=False)
    body = Column(Text, nullable=True)
    severity = Column(String, default="warning")
    fuel_type = Column(String, nullable=True)
    price_delta_pct = Column(Float, nullable=True)
    source = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now)

    __table_args__ = (Index("ix_news_region", "region"),)


class CreditTransaction(Base):
    """NeuroCredits ledger."""
    __tablename__ = "credit_transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False, index=True)
    delta = Column(Integer, nullable=False)
    reason = Column(String, nullable=False)
    balance_after = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now)


class PremiumSubscription(Base):
    """Premium tier purchases (Оператор / Легенда)."""
    __tablename__ = "premium_subscriptions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False, index=True)
    tier = Column(String, nullable=False)
    payment_method = Column(String, nullable=False)
    transaction_id = Column(String, nullable=True)
    price_usdt = Column(Float, nullable=True)
    starts_at = Column(DateTime(timezone=True), default=_now)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_now)


class RssCacheEntry(Base):
    """Rate-limits RSS feed fetches (4-hour cache)."""
    __tablename__ = "rss_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    feed_url = Column(String, unique=True, nullable=False)
    last_fetched_at = Column(DateTime(timezone=True), nullable=True)
    last_item_count = Column(Integer, default=0)


class RegionFavorite(Base):
    """User-starred region for monitoring in Мой Сейф."""
    __tablename__ = "region_favorites"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, nullable=False, index=True)
    region_name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now)

    __table_args__ = (
        UniqueConstraint("user_id", "region_name", name="uq_fav_user_region"),
    )
