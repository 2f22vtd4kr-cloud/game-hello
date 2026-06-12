"""
Топливный Узел — FastAPI backend
All routes, background scheduler, analytics, payment, gamification.
"""

import logging
import os
import random
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from tma_backend.database import SessionLocal, get_db, init_db, seed_db, _generate_snapshot
from tma_backend.models import (
    AnalyticsSnapshot, DailyLimitTracker, FuelStatus, GasStation,
    PurchaseHistory, StationReport, User,
)
from tma_backend.payment import provider
from tma_backend.schemas import (
    AnalyticsOut, FlipResultOut, GasStationOut, PurchaseIn,
    PurchaseResultOut, StationReportIn, TapScoreIn, TapScoreOut,
    UserCreateIn, UserOut,
)
from tma_backend.seed_regions import DAILY_LIMITS, FUEL_PRICES_RUB, XP_TIERS

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Топливный Узел API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

scheduler = AsyncIOScheduler(timezone="UTC")

# ──────────────────────────────────────────────────────────────────
#  Helpers
# ──────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _xp_to_level(xp: int) -> str:
    for tier in reversed(XP_TIERS):
        if xp >= tier["min"]:
            return tier["level"]
    return "Новичок"


def _get_or_create_user(db: Session, user_id: int,
                         username: Optional[str] = None) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = User(id=user_id, username=username,
                    level="Новичок", xp=0,
                    daily_games_played=0, flip_attempts_today=0)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def _check_daily_limit(db: Session, user_id: int, zone_type: str,
                        fuel_type: str, volume: int) -> tuple[bool, int]:
    """Returns (within_limit, used_so_far)."""
    limits = DAILY_LIMITS.get(zone_type, DAILY_LIMITS["standard"])
    max_vol = limits.get(fuel_type, 40)
    now = _now()

    tracker = (
        db.query(DailyLimitTracker)
        .filter(
            DailyLimitTracker.user_id == user_id,
            DailyLimitTracker.fuel_type == fuel_type,
            DailyLimitTracker.reset_at > now,
        )
        .first()
    )
    used = tracker.total_volume_bought if tracker else 0
    return (used + volume) <= max_vol, used


def _effective_availability(db: Session, station_id: int,
                              fuel_type: str, base_pct: int) -> int:
    """Blend base_pct with recent user reports (1.5 h window)."""
    cutoff = _now() - timedelta(hours=1, minutes=30)
    reports = (
        db.query(StationReport)
        .filter(
            StationReport.station_id == station_id,
            StationReport.expires_at > _now(),
            StationReport.created_at > cutoff,
        )
        .all()
    )
    if not reports:
        return base_pct
    pos = sum(1 for r in reports if r.vote_type == "available")
    neg = sum(1 for r in reports if r.vote_type == "unavailable")
    delta = (pos - neg) * 10
    return max(0, min(100, base_pct + delta))


# ──────────────────────────────────────────────────────────────────
#  Scheduler jobs
# ──────────────────────────────────────────────────────────────────

def simulate_availability_shifts():
    """Drift fuel availability ±5–15% every 30 min."""
    db = SessionLocal()
    try:
        statuses = db.query(FuelStatus).all()
        rng = random.Random()
        for fs in statuses:
            delta = rng.randint(-15, 15)
            new_pct = max(0, min(100, fs.availability_pct + delta))
            if new_pct >= 60:
                fs.status = "green"
            elif new_pct >= 25:
                fs.status = "yellow"
            else:
                fs.status = "red"
            fs.availability_pct = new_pct
            fs.last_updated = _now()

        # Drift queue counts
        stations = db.query(GasStation).all()
        for s in stations:
            s.queue_cars = max(0, s.queue_cars + rng.randint(-3, 5))

        db.commit()
        logger.info("Availability simulation tick complete.")
    except Exception as e:
        logger.error(f"simulate_availability_shifts error: {e}")
        db.rollback()
    finally:
        db.close()


def remove_expired_reports():
    """Delete reports older than 1.5 hours."""
    db = SessionLocal()
    try:
        expired = db.query(StationReport).filter(
            StationReport.expires_at <= _now()
        ).all()
        count = len(expired)
        for r in expired:
            db.delete(r)
        db.commit()
        if count:
            logger.info(f"Purged {count} expired station reports.")
    except Exception as e:
        logger.error(f"remove_expired_reports error: {e}")
        db.rollback()
    finally:
        db.close()


def generate_analytics_snapshots():
    db = SessionLocal()
    try:
        _generate_snapshot(db)
        logger.info("Analytics snapshot generated.")
    except Exception as e:
        logger.error(f"generate_analytics_snapshots error: {e}")
        db.rollback()
    finally:
        db.close()


def reset_daily_limits():
    """Midnight reset of all daily limit trackers."""
    db = SessionLocal()
    try:
        expired = db.query(DailyLimitTracker).filter(
            DailyLimitTracker.reset_at <= _now()
        ).all()
        for t in expired:
            db.delete(t)
        # Reset flip counters
        users = db.query(User).all()
        for u in users:
            u.daily_games_played = 0
            u.flip_attempts_today = 0
        db.commit()
        logger.info("Daily limits reset.")
    except Exception as e:
        logger.error(f"reset_daily_limits error: {e}")
        db.rollback()
    finally:
        db.close()


# ──────────────────────────────────────────────────────────────────
#  Lifecycle
# ──────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    init_db()
    db = SessionLocal()
    try:
        seed_db(db)
    finally:
        db.close()

    scheduler.add_job(simulate_availability_shifts, "interval", minutes=30)
    scheduler.add_job(remove_expired_reports, "interval", minutes=10)
    scheduler.add_job(generate_analytics_snapshots, "interval", hours=1)
    scheduler.add_job(reset_daily_limits, "cron", hour=0, minute=0)
    scheduler.start()
    logger.info("Топливный Узел API запущен.")


@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()


# ──────────────────────────────────────────────────────────────────
#  Health
# ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "time": _now().isoformat()}


# ──────────────────────────────────────────────────────────────────
#  Stations
# ──────────────────────────────────────────────────────────────────

@app.get("/api/stations", response_model=list[GasStationOut])
def list_stations(
    region: Optional[str] = None,
    zone_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(GasStation)
    if region:
        q = q.filter(GasStation.region == region)
    if zone_type:
        q = q.filter(GasStation.zone_type == zone_type)
    stations = q.all()

    result = []
    for s in stations:
        s_dict = {
            "id": s.id, "region": s.region, "zone_type": s.zone_type,
            "name": s.name, "address": s.address,
            "lat": s.lat, "lng": s.lng,
            "network": s.network, "queue_cars": s.queue_cars,
            "fuel_statuses": [
                {
                    "fuel_type": fs.fuel_type,
                    "status": fs.status,
                    "availability_pct": _effective_availability(
                        db, s.id, fs.fuel_type, fs.availability_pct
                    ),
                    "last_updated": fs.last_updated,
                }
                for fs in s.fuel_statuses
            ],
        }
        result.append(s_dict)
    return result


@app.get("/api/stations/{station_id}", response_model=GasStationOut)
def get_station(station_id: int, db: Session = Depends(get_db)):
    s = db.query(GasStation).filter(GasStation.id == station_id).first()
    if not s:
        raise HTTPException(404, detail="Станция не найдена")
    return {
        "id": s.id, "region": s.region, "zone_type": s.zone_type,
        "name": s.name, "address": s.address,
        "lat": s.lat, "lng": s.lng,
        "network": s.network, "queue_cars": s.queue_cars,
        "fuel_statuses": [
            {
                "fuel_type": fs.fuel_type,
                "status": fs.status,
                "availability_pct": _effective_availability(
                    db, s.id, fs.fuel_type, fs.availability_pct
                ),
                "last_updated": fs.last_updated,
            }
            for fs in s.fuel_statuses
        ],
    }


@app.post("/api/stations/{station_id}/report")
def report_station(
    station_id: int,
    body: StationReportIn,
    db: Session = Depends(get_db),
):
    s = db.query(GasStation).filter(GasStation.id == station_id).first()
    if not s:
        raise HTTPException(404, detail="Станция не найдена")

    _get_or_create_user(db, body.user_id)

    report = StationReport(
        station_id=station_id,
        user_id=body.user_id,
        vote_type=body.vote_type,
        expires_at=_now() + timedelta(hours=1, minutes=30),
    )
    db.add(report)

    # XP for reporting
    user = db.query(User).filter(User.id == body.user_id).first()
    if user:
        user.xp += 5
        user.level = _xp_to_level(user.xp)

    db.commit()
    return {"ok": True, "message": "Отчёт принят. Спасибо за помощь сообществу!"}


# ──────────────────────────────────────────────────────────────────
#  User
# ──────────────────────────────────────────────────────────────────

@app.get("/api/user/{user_id}", response_model=UserOut)
def get_user(user_id: int, username: Optional[str] = None,
             db: Session = Depends(get_db)):
    user = _get_or_create_user(db, user_id, username)
    return user


@app.post("/api/user", response_model=UserOut)
def create_user(body: UserCreateIn, db: Session = Depends(get_db)):
    user = _get_or_create_user(db, body.user_id, body.username)
    return user


# ──────────────────────────────────────────────────────────────────
#  Catalog / Purchase
# ──────────────────────────────────────────────────────────────────

@app.post("/api/catalog/purchase", response_model=PurchaseResultOut)
def purchase_voucher(body: PurchaseIn, db: Session = Depends(get_db)):
    # 38% gateway block
    if random.random() < 0.38:
        return PurchaseResultOut(
            ok=False,
            blocked=True,
            block_reason=(
                "Внимание! В связи с временной недоступностью серверов "
                "авторизации процессинга на выбранной нефтебазе, свободные "
                "объемы временно заблокированы. Пожалуйста, попробуйте позже "
                "через 15 минут."
            ),
        )

    station = db.query(GasStation).filter(GasStation.id == body.station_id).first()
    if not station:
        raise HTTPException(404, detail="Станция не найдена")

    user = _get_or_create_user(db, body.user_id)

    within_limit, used = _check_daily_limit(
        db, body.user_id, station.zone_type, body.fuel_type, body.volume
    )
    if not within_limit:
        raise HTTPException(
            400,
            detail="⚠️ Превышен суточный лимит отпуска для данного региона.",
        )

    price_per_l = FUEL_PRICES_RUB.get(body.fuel_type, 50)
    total_price = price_per_l * body.volume

    result = provider.create_invoice(
        user_id=body.user_id,
        fuel_type=body.fuel_type,
        volume=body.volume,
        price_rub=total_price,
    )
    if not result.ok:
        raise HTTPException(500, detail="Ошибка платёжного шлюза")

    purchase = PurchaseHistory(
        user_id=body.user_id,
        fuel_type=body.fuel_type,
        volume=body.volume,
        price=total_price,
        currency="RUB",
        status="active",
        qr_hash=result.qr_hash,
        station_name=station.name,
        region=station.region,
        expires_at=_now() + timedelta(days=3),
    )
    db.add(purchase)

    # Update daily limit tracker
    tomorrow = _now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    tracker = (
        db.query(DailyLimitTracker)
        .filter(
            DailyLimitTracker.user_id == body.user_id,
            DailyLimitTracker.fuel_type == body.fuel_type,
            DailyLimitTracker.reset_at > _now(),
        )
        .first()
    )
    if tracker:
        tracker.total_volume_bought += body.volume
    else:
        tracker = DailyLimitTracker(
            user_id=body.user_id,
            fuel_type=body.fuel_type,
            total_volume_bought=body.volume,
            reset_at=tomorrow,
        )
        db.add(tracker)

    user.xp += 20
    user.level = _xp_to_level(user.xp)
    db.commit()
    db.refresh(purchase)

    return PurchaseResultOut(
        ok=True,
        blocked=False,
        transaction_id=result.transaction_id,
        purchase={
            "id": purchase.id,
            "fuel_type": purchase.fuel_type,
            "volume": purchase.volume,
            "price": purchase.price,
            "currency": purchase.currency,
            "status": purchase.status,
            "qr_hash": purchase.qr_hash,
            "station_name": purchase.station_name,
            "region": purchase.region,
            "created_at": purchase.created_at,
        },
    )


@app.get("/api/catalog/limits/{user_id}")
def get_limits(user_id: int, zone_type: str = "standard",
               db: Session = Depends(get_db)):
    _get_or_create_user(db, user_id)
    limits = DAILY_LIMITS.get(zone_type, DAILY_LIMITS["standard"])
    result = {}
    for fuel_type, max_vol in limits.items():
        tracker = (
            db.query(DailyLimitTracker)
            .filter(
                DailyLimitTracker.user_id == user_id,
                DailyLimitTracker.fuel_type == fuel_type,
                DailyLimitTracker.reset_at > _now(),
            )
            .first()
        )
        used = tracker.total_volume_bought if tracker else 0
        result[fuel_type] = {
            "max": max_vol,
            "used": used,
            "remaining": max(0, max_vol - used),
            "price_per_litre": FUEL_PRICES_RUB.get(fuel_type, 50),
        }
    return result


# ──────────────────────────────────────────────────────────────────
#  Vault
# ──────────────────────────────────────────────────────────────────

@app.get("/api/vault/{user_id}")
def get_vault(user_id: int, db: Session = Depends(get_db)):
    _get_or_create_user(db, user_id)
    purchases = (
        db.query(PurchaseHistory)
        .filter(PurchaseHistory.user_id == user_id)
        .order_by(PurchaseHistory.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": p.id,
            "fuel_type": p.fuel_type,
            "volume": p.volume,
            "price": p.price,
            "currency": p.currency,
            "status": p.status,
            "qr_hash": p.qr_hash,
            "station_name": p.station_name,
            "region": p.region,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in purchases
    ]


# ──────────────────────────────────────────────────────────────────
#  Games
# ──────────────────────────────────────────────────────────────────

MAX_FLIPS_PER_DAY = 3

@app.post("/api/game/flip/{user_id}", response_model=FlipResultOut)
def flip_card(user_id: int, db: Session = Depends(get_db)):
    user = _get_or_create_user(db, user_id)

    # Reset flip counter if new day
    now = _now()
    last_reset = user.last_flip_reset
    if last_reset is None or (now - last_reset).days >= 1:
        user.flip_attempts_today = 0
        user.last_flip_reset = now

    if user.flip_attempts_today >= MAX_FLIPS_PER_DAY:
        return FlipResultOut(
            result_type="blocked",
            message="Попытки исчерпаны. Возвращайтесь завтра за новым шансом!",
            reward=None,
            attempts_remaining=0,
        )

    user.flip_attempts_today += 1
    user.daily_games_played += 1
    user.last_game_timestamp = now

    # 65% empty / 25% discount / 10% free voucher
    roll = random.random()
    if roll < 0.65:
        result_type = "empty"
        message = "🛢️ Пустая цистерна. Попробуйте завтра — удача переменчива!"
        reward = None
        user.xp += 2
    elif roll < 0.90:
        result_type = "discount"
        discount_code = f"DISC-{secrets.token_hex(4).upper()}"
        message = f"🎖️ Приоритетный ордер! Скидка 5% на следующую покупку."
        reward = discount_code
        user.xp += 15
    else:
        result_type = "voucher"
        qr = f"FREE-{secrets.token_hex(6).upper()}"
        # Issue a free 20L voucher bypassing daily limits
        free_purchase = PurchaseHistory(
            user_id=user_id,
            fuel_type="АИ-92",
            volume=20,
            price=0,
            currency="RUB",
            status="active",
            qr_hash=qr,
            station_name="Любая АЗС сети",
            region="Любой регион",
            expires_at=now + timedelta(days=7),
        )
        db.add(free_purchase)
        message = "🏆 Внеочередной Талон! Бесплатные 20 литров топлива без лимитов!"
        reward = qr
        user.xp += 50

    user.level = _xp_to_level(user.xp)
    db.commit()

    attempts_remaining = max(0, MAX_FLIPS_PER_DAY - user.flip_attempts_today)
    return FlipResultOut(
        result_type=result_type,
        message=message,
        reward=reward,
        attempts_remaining=attempts_remaining,
    )


@app.post("/api/game/tap/{user_id}", response_model=TapScoreOut)
def submit_tap_score(user_id: int, body: TapScoreIn,
                     db: Session = Depends(get_db)):
    user = _get_or_create_user(db, user_id)
    old_level = user.level

    # Cap score to prevent cheating (max 3 taps/sec × 30 sec = 90)
    capped_score = min(body.score, 150)
    xp_earned = max(0, capped_score // 5)

    user.xp += xp_earned
    user.daily_games_played += 1
    user.last_game_timestamp = _now()
    user.level = _xp_to_level(user.xp)
    db.commit()

    return TapScoreOut(
        xp_earned=xp_earned,
        total_xp=user.xp,
        level=user.level,
        new_level=user.level != old_level,
    )


# ──────────────────────────────────────────────────────────────────
#  Analytics
# ──────────────────────────────────────────────────────────────────

@app.get("/api/analytics", response_model=AnalyticsOut)
def get_analytics(db: Session = Depends(get_db)):
    statuses = db.query(FuelStatus).all()
    stations = db.query(GasStation).all()

    # Regional supply
    regional_supply: dict = {}
    for s in stations:
        if s.region not in regional_supply:
            regional_supply[s.region] = {"green": 0, "yellow": 0, "red": 0,
                                          "avg_pct": 0, "count": 0, "zone_type": s.zone_type}
        regional_supply[s.region]["count"] += 1

    for fs in statuses:
        st = db.query(GasStation).filter(GasStation.id == fs.station_id).first()
        if st and st.region in regional_supply:
            regional_supply[st.region][fs.status] += 1
            regional_supply[st.region]["avg_pct"] += fs.availability_pct

    for region, data in regional_supply.items():
        total = data["green"] + data["yellow"] + data["red"]
        if total:
            data["avg_pct"] = round(data["avg_pct"] / total, 1)

    # Overall availability index
    all_pcts = [fs.availability_pct for fs in statuses]
    availability_index = round(sum(all_pcts) / len(all_pcts), 1) if all_pcts else 0.0

    # Price index (mock fluctuation based on availability)
    price_index = round(100 + (1 - availability_index / 100) * 30, 1)

    # Trend: last 24 snapshots
    snapshots = (
        db.query(AnalyticsSnapshot)
        .order_by(AnalyticsSnapshot.created_at.desc())
        .limit(24)
        .all()
    )
    trend_data = [
        {
            "time": s.created_at.isoformat(),
            "region": s.region,
            "avg_availability": s.avg_availability,
            "price_index": s.price_index,
        }
        for s in reversed(snapshots)
    ]

    # Station counts by status
    green_c = sum(1 for fs in statuses if fs.status == "green")
    yellow_c = sum(1 for fs in statuses if fs.status == "yellow")
    red_c = sum(1 for fs in statuses if fs.status == "red")

    station_counts = {
        "total": len(stations),
        "green": green_c,
        "yellow": yellow_c,
        "red": red_c,
    }

    return AnalyticsOut(
        regional_supply=regional_supply,
        availability_index=availability_index,
        price_index=price_index,
        trend_data=trend_data,
        station_counts=station_counts,
    )


# ──────────────────────────────────────────────────────────────────
#  Serve built frontend (production)
# ──────────────────────────────────────────────────────────────────

FRONTEND_DIST = os.path.join(
    os.path.dirname(__file__), "..", "artifacts", "tma-frontend", "dist"
)
if os.path.isdir(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")


if __name__ == "__main__":
    uvicorn.run(
        "tma_backend.main:app",
        host="0.0.0.0",
        port=int(os.getenv("TMA_PORT", "8000")),
        reload=False,
    )
