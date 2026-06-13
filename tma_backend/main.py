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

import httpx

import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from tma_backend.database import SessionLocal, get_db, init_db, seed_db, _generate_snapshot
from tma_backend.models import (
    AnalyticsSnapshot, DailyLimitTracker, FuelStatus, GasStation,
    PurchaseHistory, ReferralCode, StationReport, Subscription, User,
    UserCheckin, VpnSession,
)
from tma_backend.cards import draw_cards, RARITY_COLORS
from tma_backend.payment import provider
from tma_backend.schemas import (
    AnalyticsOut, CardOut, CheckinOut, FlipResultOut, GasStationOut,
    LeaderboardEntry, LeaderboardOut, PurchaseIn, PurchaseResultOut,
    ReferralOut, ReferralUseIn, ReferralUseOut,
    StationReportIn, SubscriptionIn, SubscriptionOut,
    SubscriptionStatusOut, TapScoreIn, TapScoreOut, UserCreateIn, UserOut,
    VpnBuyIn, VpnInvoiceOut, VpnSessionOut, VpnStatusOut,
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

def _send_fuel_notification(
    telegram_chat_id: int,
    station_name: str,
    fuel_type: Optional[str],
    new_status: str,
) -> None:
    """
    Fire-and-forget Telegram push notification sent via Bot API.
    Called synchronously from the APScheduler job thread.
    Only sends when status becomes "green" (fuel appeared).
    """
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not bot_token:
        return

    emoji = {"green": "🟢", "yellow": "🟡", "red": "🔴"}.get(new_status, "⚪")
    label = {"green": "появилось", "yellow": "ограничено", "red": "закончилось"}.get(new_status, new_status)
    fuel_part = f" · {fuel_type}" if fuel_type else ""
    text = (
        f"⛽ *{station_name}*{fuel_part}\n"
        f"{emoji} Топливо {label}!\n\n"
        "Откройте Матрицу Снабжения, чтобы увидеть актуальные остатки и занять очередь."
    )

    try:
        with httpx.Client(timeout=6.0) as client:
            client.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={"chat_id": telegram_chat_id, "text": text, "parse_mode": "Markdown"},
            )
    except Exception as exc:
        logger.warning("Fuel notification failed for chat %s: %s", telegram_chat_id, exc)


def simulate_availability_shifts():
    """
    Drift fuel availability ±5–15% every 30 min.
    After updating statuses, detect state transitions and push Telegram
    notifications to all subscribed users whose station improved to 'green'.
    """
    db = SessionLocal()
    try:
        statuses = db.query(FuelStatus).all()
        rng = random.Random()

        # Track (station_id, fuel_type) → (old_status, new_status) for notification
        changed: dict[tuple[int, Optional[str]], tuple[str, str]] = {}

        for fs in statuses:
            old_status = fs.status
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

            if fs.status != old_status:
                changed[(fs.station_id, fs.fuel_type)] = (old_status, fs.status)

        # Drift queue counts
        for s in db.query(GasStation).all():
            s.queue_cars = max(0, s.queue_cars + rng.randint(-3, 5))

        db.commit()
        logger.info("Availability simulation tick complete (%d changes).", len(changed))

        # ── Push notifications ─────────────────────────────────────
        if not changed:
            return

        now = _now()
        cooldown = timedelta(minutes=30)  # max one notification per sub per 30 min

        for (station_id, fuel_type), (old_s, new_s) in changed.items():
            # Only notify when fuel *appears* (transitions to green)
            if new_s != "green":
                continue

            # Find all subscriptions for this station
            subs = (
                db.query(Subscription)
                .filter(Subscription.station_id == station_id)
                .filter(
                    (Subscription.fuel_type == fuel_type) |
                    (Subscription.fuel_type == None)  # noqa: E711
                )
                .all()
            )

            for sub in subs:
                # Respect cooldown — don't spam within 30 min
                if sub.last_notified_at and (now - sub.last_notified_at) < cooldown:
                    continue

                station_name = sub.station.name if sub.station else f"АЗС #{station_id}"
                _send_fuel_notification(
                    sub.telegram_chat_id, station_name, sub.fuel_type, new_s
                )
                sub.last_notified_status = new_s
                sub.last_notified_at = now

        db.commit()

    except Exception as e:
        logger.error("simulate_availability_shifts error: %s", e)
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

def expire_vpn_sessions():
    """Deactivate VPN sessions whose expires_at has passed; notify user via Telegram."""
    db = SessionLocal()
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    try:
        expired = (
            db.query(VpnSession)
            .filter(VpnSession.is_active == True, VpnSession.expires_at <= _now())  # noqa: E712
            .all()
        )
        for sess in expired:
            sess.is_active = False
            if bot_token:
                try:
                    with httpx.Client(timeout=5.0) as client:
                        client.post(
                            f"https://api.telegram.org/bot{bot_token}/sendMessage",
                            json={
                                "chat_id": sess.telegram_chat_id,
                                "text": (
                                    f"🔒 *VPN-сессия завершена*\n\n"
                                    f"Ваш план «{sess.plan_name}» на {sess.duration_minutes} мин истёк.\n"
                                    f"Для нового подключения откройте раздел VPN в Матрице Снабжения."
                                ),
                                "parse_mode": "Markdown",
                            },
                        )
                except Exception:
                    pass
        if expired:
            db.commit()
            logger.info("Expired %d VPN sessions.", len(expired))
    except Exception as e:
        logger.error("expire_vpn_sessions error: %s", e)
        db.rollback()
    finally:
        db.close()


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
    scheduler.add_job(expire_vpn_sessions, "interval", minutes=1)
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

    from tma_backend.payment import get_provider
    pay_provider = get_provider(body.payment_method)
    result = pay_provider.create_invoice(
        user_id=body.user_id,
        fuel_type=body.fuel_type,
        volume=body.volume,
        price_rub=total_price,
    )
    if not result.ok:
        raise HTTPException(500, detail=result.error or "Ошибка платёжного шлюза")

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


@app.post("/api/catalog/stars-invoice")
def create_stars_invoice(body: PurchaseIn, db: Session = Depends(get_db)):
    """Return Stars count needed; actual payment handled by Telegram bot."""
    station = db.query(GasStation).filter(GasStation.id == body.station_id).first()
    if not station:
        raise HTTPException(404, detail="Станция не найдена")
    price_per_l = FUEL_PRICES_RUB.get(body.fuel_type, 50)
    total_price = price_per_l * body.volume
    from tma_backend.payment import get_provider
    result = get_provider("stars").create_invoice(
        user_id=body.user_id, fuel_type=body.fuel_type,
        volume=body.volume, price_rub=total_price,
    )
    return {
        "stars_amount": result.stars_amount,
        "transaction_id": result.transaction_id,
        "qr_hash": result.qr_hash,
        "price_rub": total_price,
    }


@app.post("/api/catalog/cryptobot-invoice")
def create_cryptobot_invoice(body: PurchaseIn, db: Session = Depends(get_db)):
    """Create a real CryptoBot invoice and return the pay URL."""
    station = db.query(GasStation).filter(GasStation.id == body.station_id).first()
    if not station:
        raise HTTPException(404, detail="Станция не найдена")
    price_per_l = FUEL_PRICES_RUB.get(body.fuel_type, 50)
    total_price = price_per_l * body.volume
    from tma_backend.payment import get_provider
    result = get_provider("cryptobot").create_invoice(
        user_id=body.user_id, fuel_type=body.fuel_type,
        volume=body.volume, price_rub=total_price,
    )
    if not result.ok:
        raise HTTPException(502, detail=result.error or "CryptoBot error")

    # Pre-record purchase as "pending" until webhook confirms
    _get_or_create_user(db, body.user_id)
    purchase = PurchaseHistory(
        user_id=body.user_id,
        fuel_type=body.fuel_type,
        volume=body.volume,
        price=total_price,
        currency="USDT",
        status="pending",
        qr_hash=result.qr_hash,
        station_name=station.name,
        region=station.region,
        expires_at=_now() + timedelta(hours=1),
    )
    db.add(purchase)
    db.commit()
    return {
        "checkout_url": result.checkout_url,
        "transaction_id": result.transaction_id,
        "qr_hash": result.qr_hash,
    }


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

MAX_FLIPS_PER_DAY = 5


@app.post("/api/game/flip/{user_id}", response_model=FlipResultOut)
def flip_card(user_id: int, db: Session = Depends(get_db)):
    user = _get_or_create_user(db, user_id)

    # Reset flip counter if new day
    # SQLite strips timezone on retrieval → normalise both sides to naive UTC
    now = _now()
    last_reset = user.last_flip_reset
    if last_reset is None:
        reset_needed = True
    else:
        lr_naive = last_reset.replace(tzinfo=None) if last_reset.tzinfo else last_reset
        now_naive = now.replace(tzinfo=None)
        reset_needed = (now_naive - lr_naive).days >= 1
    if reset_needed:
        user.flip_attempts_today = 0
        user.last_flip_reset = now

    if user.flip_attempts_today >= MAX_FLIPS_PER_DAY:
        return FlipResultOut(
            result_type="blocked",
            message="Все 5 карт открыты. Возвращайтесь завтра за новым набором!",
            reward=None,
            attempts_remaining=0,
            cards=[],
            total_xp_delta=0,
        )

    # Draw 5 cards at once on first flip of the day; subsequent flips blocked
    # Actually: one session = draw all 5 cards at once (one call opens all 5)
    cards = draw_cards(5)
    total_xp = sum(c.xp for c in cards)

    user.flip_attempts_today = MAX_FLIPS_PER_DAY  # consume all attempts at once
    user.daily_games_played += 1
    user.last_game_timestamp = now

    old_xp = user.xp
    user.xp = max(0, user.xp + total_xp)
    user.level = _xp_to_level(user.xp)
    db.commit()

    best = max(cards, key=lambda c: c.xp)
    has_mythic    = any(c.rarity == "Мифическая"  for c in cards)
    has_legendary = any(c.rarity == "Легендарная" for c in cards)
    has_epic      = any(c.rarity == "Эпическая"   for c in cards)
    has_cursed    = any(c.rarity == "Проклятая"   for c in cards)
    net_sign      = "+" if total_xp >= 0 else ""

    if has_mythic:
        result_type = "mythic"
        message = f"🌐 МИФИЧЕСКАЯ КАРТА! Вы получили: {best.name}! {net_sign}{total_xp:,} XP"
    elif has_legendary:
        result_type = "legendary"
        message = f"🏆 ЛЕГЕНДАРНАЯ! {best.name} у вас в руках! {net_sign}{total_xp:,} XP"
    elif has_epic:
        result_type = "epic"
        message = f"💜 Эпический розыгрыш! {best.name} — {net_sign}{total_xp:,} XP"
    elif has_cursed and total_xp < 0:
        result_type = "cursed"
        message = f"💀 Проклятая карта! {best.name} — {total_xp:,} XP"
    elif total_xp >= 5000:
        result_type = "rare"
        message = f"💎 Редкая удача! {best.name} — {net_sign}{total_xp:,} XP"
    else:
        result_type = "common"
        message = f"🃏 Набор вскрыт. Итог: {net_sign}{total_xp:,} XP"

    attempts_remaining = 0
    return FlipResultOut(
        result_type=result_type,
        message=message,
        reward=None,
        attempts_remaining=attempts_remaining,
        cards=[CardOut(name=c.name, emoji=c.emoji, rarity=c.rarity, xp=c.xp) for c in cards],
        total_xp_delta=total_xp,
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
#  VPN
# ──────────────────────────────────────────────────────────────────

VPN_PLANS: dict[str, dict] = {
    "sprint":   {"name": "⚡️ Спринт",         "duration_minutes": 5,  "price_rub": 15},
    "vzlet":    {"name": "✈️ Взлёт",           "duration_minutes": 15, "price_rub": 30},
    "session":  {"name": "🎬 Сессия",          "duration_minutes": 30, "price_rub": 50},
    "bezlimit": {"name": "🪐 Безлимит на час", "duration_minutes": 60, "price_rub": 80},
}
_STAR_RUB_RATE = 1.84
_USDT_RUB_RATE = 92.0


def _vpn_config_key() -> str:
    import secrets
    return f"WG-{secrets.token_hex(4).upper()}-{secrets.token_hex(4).upper()}-{secrets.token_hex(4).upper()}"


def _stars_for_rub(price_rub: int) -> int:
    import math
    return max(1, math.ceil(price_rub / _STAR_RUB_RATE))


@app.get("/api/vpn/status/{user_id}", response_model=VpnStatusOut)
def vpn_status(user_id: int, db: Session = Depends(get_db)):
    sess = (
        db.query(VpnSession)
        .filter(VpnSession.user_id == user_id, VpnSession.is_active == True)  # noqa: E712
        .order_by(VpnSession.expires_at.desc())
        .first()
    )
    if not sess:
        return VpnStatusOut(has_active=False)
    if sess.expires_at.replace(tzinfo=None) < _now().replace(tzinfo=None):
        sess.is_active = False
        db.commit()
        return VpnStatusOut(has_active=False)
    return VpnStatusOut(
        has_active=True,
        session=VpnSessionOut(
            id=sess.id, plan_name=sess.plan_name,
            duration_minutes=sess.duration_minutes,
            price_rub=sess.price_rub, payment_method=sess.payment_method,
            config_key=sess.config_key, is_active=sess.is_active,
            activated_at=sess.activated_at, expires_at=sess.expires_at,
        ),
    )


@app.post("/api/vpn/buy-stars", response_model=VpnInvoiceOut)
def vpn_buy_stars(body: VpnBuyIn, db: Session = Depends(get_db)):
    plan = VPN_PLANS.get(body.plan_id)
    if not plan:
        raise HTTPException(400, detail="Неверный план")
    stars = _stars_for_rub(plan["price_rub"])
    config_key = _vpn_config_key()
    _get_or_create_user(db, body.user_id)
    sess = VpnSession(
        user_id=body.user_id,
        telegram_chat_id=body.telegram_chat_id,
        plan_id=body.plan_id,
        plan_name=plan["name"],
        duration_minutes=plan["duration_minutes"],
        price_rub=plan["price_rub"],
        payment_method="stars",
        config_key=config_key,
        is_active=True,
        expires_at=_now() + timedelta(minutes=plan["duration_minutes"]),
    )
    db.add(sess)
    db.commit()
    _notify_vpn_activated(sess)
    return VpnInvoiceOut(
        stars_amount=stars,
        transaction_id=f"VPN-STARS-{sess.id}",
        plan_name=plan["name"],
        duration_minutes=plan["duration_minutes"],
    )


@app.post("/api/vpn/buy-crypto", response_model=VpnInvoiceOut)
def vpn_buy_crypto(body: VpnBuyIn, db: Session = Depends(get_db)):
    plan = VPN_PLANS.get(body.plan_id)
    if not plan:
        raise HTTPException(400, detail="Неверный план")
    from tma_backend.payment import provider as _payment_provider, generate_qr_hash
    amount_usdt = round(plan["price_rub"] / _USDT_RUB_RATE, 2)
    result = _payment_provider.create_invoice(
        user_id=body.user_id,
        fuel_type=f"VPN {plan['name']}",
        volume=plan["duration_minutes"],
        price_rub=plan["price_rub"],
    )
    if not result.ok:
        raise HTTPException(502, detail=result.error or "Payment provider error")
    config_key = _vpn_config_key()
    _get_or_create_user(db, body.user_id)
    sess = VpnSession(
        user_id=body.user_id,
        telegram_chat_id=body.telegram_chat_id,
        plan_id=body.plan_id,
        plan_name=plan["name"],
        duration_minutes=plan["duration_minutes"],
        price_rub=plan["price_rub"],
        payment_method="cryptobot",
        transaction_id=result.transaction_id,
        config_key=config_key,
        is_active=True,
        expires_at=_now() + timedelta(minutes=plan["duration_minutes"]),
    )
    db.add(sess)
    db.commit()
    _notify_vpn_activated(sess)
    return VpnInvoiceOut(
        checkout_url=result.checkout_url,
        transaction_id=result.transaction_id,
        plan_name=plan["name"],
        duration_minutes=plan["duration_minutes"],
    )


def _notify_vpn_activated(sess: VpnSession) -> None:
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not bot_token:
        return
    expires_str = sess.expires_at.strftime("%H:%M UTC")
    text = (
        f"🔓 *VPN активирован!*\n\n"
        f"📋 План: {sess.plan_name}\n"
        f"⏱ Длительность: {sess.duration_minutes} мин\n"
        f"⏰ Истекает в: {expires_str}\n\n"
        f"🔑 *Ваш ключ доступа:*\n"
        f"`{sess.config_key}`\n\n"
        f"Используйте этот ключ в приложении *WireGuard* или *Outline*.\n"
        f"Соединение отключится автоматически по истечении времени."
    )
    try:
        with httpx.Client(timeout=5.0) as client:
            client.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={"chat_id": sess.telegram_chat_id, "text": text, "parse_mode": "Markdown"},
            )
    except Exception as exc:
        logger.warning("VPN activation notify failed: %s", exc)


# ──────────────────────────────────────────────────────────────────
#  Daily Check-in
# ──────────────────────────────────────────────────────────────────

CHECKIN_XP = 50


@app.post("/api/checkin/{user_id}", response_model=CheckinOut)
def daily_checkin(user_id: int, db: Session = Depends(get_db)):
    user = _get_or_create_user(db, user_id)
    now = _now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    last_checkin = (
        db.query(UserCheckin)
        .filter(UserCheckin.user_id == user_id)
        .order_by(UserCheckin.checked_in_at.desc())
        .first()
    )

    already_done = False
    if last_checkin:
        last_dt = last_checkin.checked_in_at
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
        last_naive = last_dt.replace(tzinfo=None)
        today_naive = today_start.replace(tzinfo=None)
        if last_naive >= today_naive:
            already_done = True

    if already_done:
        tomorrow = today_start + timedelta(days=1)
        return CheckinOut(
            ok=False, xp_awarded=0, total_xp=user.xp, level=user.level,
            already_done=True,
            message="Вы уже получили ежедневный бонус сегодня. Возвращайтесь завтра!",
            next_checkin_at=tomorrow,
        )

    checkin = UserCheckin(user_id=user_id, xp_awarded=CHECKIN_XP)
    db.add(checkin)
    user.xp += CHECKIN_XP
    user.level = _xp_to_level(user.xp)
    db.commit()

    return CheckinOut(
        ok=True, xp_awarded=CHECKIN_XP, total_xp=user.xp, level=user.level,
        already_done=False,
        message=f"✅ Ежедневный бонус получен! +{CHECKIN_XP} XP",
        next_checkin_at=today_start + timedelta(days=1),
    )


# ──────────────────────────────────────────────────────────────────
#  Leaderboard
# ──────────────────────────────────────────────────────────────────

@app.get("/api/leaderboard", response_model=LeaderboardOut)
def get_leaderboard(user_id: Optional[int] = None, db: Session = Depends(get_db)):
    top = (
        db.query(User)
        .order_by(User.xp.desc())
        .limit(20)
        .all()
    )
    entries = [
        LeaderboardEntry(
            rank=i + 1,
            user_id=u.id,
            username=u.username,
            level=u.level,
            xp=u.xp,
        )
        for i, u in enumerate(top)
    ]
    user_rank = None
    user_xp = None
    if user_id:
        for e in entries:
            if e.user_id == user_id:
                user_rank = e.rank
                user_xp = e.xp
                break
        if user_rank is None:
            count_above = db.query(User).filter(User.xp > (
                db.query(User.xp).filter(User.id == user_id).scalar() or 0
            )).count()
            user_rank = count_above + 1
            target = db.query(User).filter(User.id == user_id).first()
            user_xp = target.xp if target else 0

    return LeaderboardOut(entries=entries, user_rank=user_rank, user_xp=user_xp)


# ──────────────────────────────────────────────────────────────────
#  Referral
# ──────────────────────────────────────────────────────────────────

REFERRAL_XP = 200


@app.get("/api/referral/{user_id}", response_model=ReferralOut)
def get_or_create_referral(user_id: int, db: Session = Depends(get_db)):
    _get_or_create_user(db, user_id)
    ref = db.query(ReferralCode).filter(ReferralCode.user_id == user_id).first()
    if not ref:
        import secrets as _s
        code = f"FUEL-{_s.token_hex(3).upper()}-{user_id % 1000:03d}"
        ref = ReferralCode(user_id=user_id, code=code)
        db.add(ref)
        db.commit()
        db.refresh(ref)
    return ReferralOut(code=ref.code, uses=ref.uses, xp_per_referral=REFERRAL_XP)


@app.post("/api/referral/use", response_model=ReferralUseOut)
def use_referral(body: ReferralUseIn, db: Session = Depends(get_db)):
    ref = db.query(ReferralCode).filter(ReferralCode.code == body.code).first()
    if not ref:
        return ReferralUseOut(ok=False, message="Реферальный код не найден.", xp_awarded=0)
    if ref.user_id == body.user_id:
        return ReferralUseOut(ok=False, message="Нельзя использовать собственный код.", xp_awarded=0)
    already = db.query(UserCheckin).filter(
        UserCheckin.user_id == body.user_id,
        UserCheckin.xp_awarded == -1,
    ).first()
    if already:
        return ReferralUseOut(ok=False, message="Вы уже использовали реферальный код.", xp_awarded=0)
    _get_or_create_user(db, body.user_id)
    referee = db.query(User).filter(User.id == body.user_id).first()
    referrer = db.query(User).filter(User.id == ref.user_id).first()
    if referee:
        referee.xp += REFERRAL_XP
        referee.level = _xp_to_level(referee.xp)
    if referrer:
        referrer.xp += REFERRAL_XP
        referrer.level = _xp_to_level(referrer.xp)
    ref.uses += 1
    marker = UserCheckin(user_id=body.user_id, xp_awarded=-1)
    db.add(marker)
    db.commit()
    return ReferralUseOut(
        ok=True,
        message=f"✅ Реферальный бонус зачислен! +{REFERRAL_XP} XP вам и пригласившему.",
        xp_awarded=REFERRAL_XP,
    )


# ──────────────────────────────────────────────────────────────────
#  Analytics
# ──────────────────────────────────────────────────────────────────

# ──────────────────────────────────────────────────────────────────
#  Subscriptions (push-notification alerts)
# ──────────────────────────────────────────────────────────────────

@app.post("/api/subscribe", response_model=SubscriptionOut)
def create_subscription(body: SubscriptionIn, db: Session = Depends(get_db)):
    """Subscribe a user to fuel-availability alerts for a station."""
    # Ensure the station exists
    station = db.query(GasStation).filter(GasStation.id == body.station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Станция не найдена")

    # Ensure the user record exists (create if first-time TMA user)
    user = db.query(User).filter(User.id == body.user_id).first()
    if not user:
        user = User(id=body.user_id)
        db.add(user)
        db.flush()

    # Upsert: return existing subscription instead of raising a duplicate error
    existing = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == body.user_id,
            Subscription.station_id == body.station_id,
            Subscription.fuel_type == body.fuel_type,
        )
        .first()
    )
    if existing:
        return SubscriptionOut(
            id=existing.id,
            user_id=existing.user_id,
            station_id=existing.station_id,
            station_name=station.name,
            station_region=station.region,
            fuel_type=existing.fuel_type,
            created_at=existing.created_at,
        )

    sub = Subscription(
        user_id=body.user_id,
        telegram_chat_id=body.telegram_chat_id,
        station_id=body.station_id,
        fuel_type=body.fuel_type,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)

    return SubscriptionOut(
        id=sub.id,
        user_id=sub.user_id,
        station_id=sub.station_id,
        station_name=station.name,
        station_region=station.region,
        fuel_type=sub.fuel_type,
        created_at=sub.created_at,
    )


@app.delete("/api/subscribe/{subscription_id}")
def delete_subscription(subscription_id: int, user_id: int,
                         db: Session = Depends(get_db)):
    """Unsubscribe — only the owning user can delete their own subscription."""
    sub = db.query(Subscription).filter(
        Subscription.id == subscription_id,
        Subscription.user_id == user_id,
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Подписка не найдена")
    db.delete(sub)
    db.commit()
    return {"ok": True}


@app.get("/api/subscriptions/{user_id}")
def get_user_subscriptions(user_id: int, db: Session = Depends(get_db)):
    """List all active subscriptions for a user (used by bot /subscriptions command)."""
    subs = db.query(Subscription).filter(Subscription.user_id == user_id).all()
    result = []
    for sub in subs:
        station = db.query(GasStation).filter(GasStation.id == sub.station_id).first()
        result.append({
            "id": sub.id,
            "user_id": sub.user_id,
            "station_id": sub.station_id,
            "station_name": station.name if station else f"АЗС #{sub.station_id}",
            "station_region": station.region if station else "",
            "fuel_type": sub.fuel_type,
            "created_at": sub.created_at.isoformat(),
        })
    return {"subscriptions": result}


@app.get("/api/subscribe/status/{user_id}/{station_id}",
         response_model=SubscriptionStatusOut)
def get_subscription_status(user_id: int, station_id: int,
                              db: Session = Depends(get_db)):
    """Check whether a user is subscribed to a specific station (for the bell icon)."""
    sub = db.query(Subscription).filter(
        Subscription.user_id == user_id,
        Subscription.station_id == station_id,
    ).first()
    return SubscriptionStatusOut(
        subscribed=sub is not None,
        subscription_id=sub.id if sub else None,
    )


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
