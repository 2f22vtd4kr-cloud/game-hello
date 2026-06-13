from sqlalchemy import (
    Column, Integer, BigInteger, String, Float,
    DateTime, ForeignKey, Index, UniqueConstraint,
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
    daily_games_played = Column(Integer, default=0)
    last_game_timestamp = Column(DateTime(timezone=True), nullable=True)
    flip_attempts_today = Column(Integer, default=0)
    last_flip_reset = Column(DateTime(timezone=True), nullable=True)

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
    """
    A user subscribing to fuel-availability alerts for a specific station
    (optionally for a specific fuel type).

    When the station's dominant status changes to "green" (fuel appears),
    the background scheduler sends a Telegram notification to telegram_chat_id.
    """
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # TMA user id (matches the users table)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    # Telegram chat_id for sending push notifications (= user_id for private chats)
    telegram_chat_id = Column(BigInteger, nullable=False)
    station_id = Column(Integer, ForeignKey("gas_stations.id"), nullable=False)
    # None = subscribe to overall station status; a fuel type = subscribe to that fuel only
    fuel_type = Column(String, nullable=True)
    # Status we last notified the user about — prevents duplicate alerts
    last_notified_status = Column(String, nullable=True)
    last_notified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now)

    user = relationship("User", back_populates="subscriptions")
    station = relationship("GasStation", back_populates="subscriptions")

    __table_args__ = (
        # One subscription per (user, station, fuel_type) combination
        UniqueConstraint("user_id", "station_id", "fuel_type",
                         name="uq_sub_user_station_fuel"),
        Index("ix_sub_station_id", "station_id"),
    )


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
