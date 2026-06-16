"""
Топливо ⛽️ — FastAPI backend
All routes, background scheduler, analytics, payment, gamification.
"""

import asyncio
import json
import logging
import os
import random
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import Response
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from tma_backend.database import SessionLocal, get_db, init_db, seed_db, _generate_snapshot
from tma_backend.models import (
    Empire, RegionFavorite, StationNote, PriceSnapshot,
    AnalyticsSnapshot, DailyLimitTracker, FuelStatus, GasStation,
    PurchaseHistory, ReferralCode, StationReport, Subscription, User,
    UserAchievement, UserCheckin, VpnSession,
    FuelPriceEvent, NewsEvent, CreditTransaction, PremiumSubscription, RssCacheEntry,
)
from tma_backend.cards import draw_cards, RARITY_COLORS
from tma_backend.payment import provider
from tma_backend.schemas import (
    AnalyticsOut, CardOut, CheckinOut, FlipResultOut, GasStationOut,
    LeaderboardEntry, LeaderboardOut, PurchaseIn, PurchaseResultOut,
    ReferralOut, ReferralUseIn, ReferralUseOut, StarsPurchaseIn,
    StationReportIn, SubscriptionIn, SubscriptionOut,
    SubscriptionStatusOut, TapScoreIn, TapScoreOut, UserCreateIn, UserOut,
    VpnBuyIn, VpnInvoiceOut, VpnSessionOut, VpnStatusOut,
)

INTERNAL_API_SECRET = os.getenv("INTERNAL_API_SECRET", "tma_internal_dev_2026")
from tma_backend.seed_regions import DAILY_LIMITS, FUEL_PRICES_RUB, XP_TIERS

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ── WebSocket price-broadcast state ──────────────────────────────────────────
_price_ws_clients: set[WebSocket] = set()


async def _broadcast_prices(data: dict) -> None:
    """Send a price-update frame to every connected WebSocket client."""
    if not _price_ws_clients:
        return
    msg = json.dumps({"type": "prices", "data": data})
    dead: set[WebSocket] = set()
    for ws in list(_price_ws_clients):
        try:
            await ws.send_text(msg)
        except Exception:
            dead.add(ws)
    _price_ws_clients.difference_update(dead)


scheduler = AsyncIOScheduler(timezone="UTC")


def _seed_news_events(db: Session) -> None:
    """Populate the news_events table with initial crisis events if it is empty."""
    if db.query(NewsEvent).count() > 0:
        return  # already seeded

    from datetime import timedelta
    import random as _rng

    INITIAL_NEWS = [
        {"region": "АР Крым и г. Севастополь", "headline": "Дефицит АИ-95 в Симферополе: очереди от 40 машин", "body": "Несколько крупных АЗС в центре Симферополя вывесили таблички «Нет бензина АИ-95». Очереди достигают 40 автомобилей.", "severity": "critical", "fuel_type": "АИ-95", "price_delta_pct": 8.2},
        {"region": "Донецкая область", "headline": "Поставки топлива задержаны из-за ремонта трассы М04", "body": "Плановый ремонт трассы М04 задержал колонны бензовозов на 12–18 часов. Дефицит ожидается до 3 суток.", "severity": "warning", "fuel_type": None, "price_delta_pct": None},
        {"region": "Запорожская область", "headline": "АЗС «Восток-Ресурс» в Мелитополе возобновили отпуск дизеля", "body": "После 4-дневного перерыва топливные запасы пополнены. Дизельное топливо доступно в пределах нормы.", "severity": "success", "fuel_type": "ДТ", "price_delta_pct": -3.1},
        {"region": "Херсонская область", "headline": "Критический уровень запасов АИ-92 в Геническе", "body": "По данным регионального мониторинга, запасы АИ-92 на 3 из 5 городских АЗС ниже 10%. Ожидается поставка в течение 48 часов.", "severity": "critical", "fuel_type": "АИ-92", "price_delta_pct": 12.5},
        {"region": "Луганская область", "headline": "Введено ограничение: не более 30 л на одно ТС", "body": "В связи с напряжённостью топливного баланса временно введена норма выдачи — не более 30 литров одного вида топлива на автомобиль.", "severity": "warning", "fuel_type": None, "price_delta_pct": None},
        {"region": "Белгородская область", "headline": "Роснефть сообщила о нормализации поставок", "body": "Региональный оператор Роснефть подтвердил восстановление цепочки поставок. АЗС сети ожидают пополнения в течение суток.", "severity": "info", "fuel_type": None, "price_delta_pct": -1.5},
        {"region": "Курская область", "headline": "Скачок цен на дизель: +9.3% за неделю", "body": "Средняя розничная цена дизельного топлива в регионе выросла на 9.3% за 7 дней. Эксперты связывают это с перебоями в нефтепереработке.", "severity": "warning", "fuel_type": "ДТ", "price_delta_pct": 9.3},
        {"region": "Брянская область", "headline": "Топливо в норме — мониторинг не выявил отклонений", "body": "Плановая проверка АЗС региона не выявила нарушений. Доступность топлива всех видов — 90–100%.", "severity": "success", "fuel_type": None, "price_delta_pct": 0.2},
        {"region": "АР Крым и г. Севастополь", "headline": "Газпромнефть подтвердила внеплановую поставку 200 тонн АИ-92", "body": "Внеплановая партия в 200 тонн АИ-92 ожидается в Симферополе к концу дня. Запасы стабилизируются.", "severity": "info", "fuel_type": "АИ-92", "price_delta_pct": -4.8},
        {"region": "Ростовская область", "headline": "Лукойл: плановое техобслуживание нефтебазы, поставки ограничены", "body": "В ходе планового ТО нефтебазы в Ростове-на-Дону поставки нескольким АЗС будут ограничены на 72 часа.", "severity": "warning", "fuel_type": None, "price_delta_pct": None},
        {"region": "Краснодарский край", "headline": "Стабильность в сети АТАН: очередей не зафиксировано", "body": "Топливная сеть АТАН в Краснодарском крае работает в штатном режиме. Цены не изменились.", "severity": "success", "fuel_type": None, "price_delta_pct": 0.0},
        {"region": "Донецкая область", "headline": "ДНР-Нефть: поступление АИ-98 задержано на 3 суток", "body": "Из-за логистических сложностей поставка АИ-98 на АЗС сети ДНР-Нефть задержана. Запасы критические.", "severity": "critical", "fuel_type": "АИ-98", "price_delta_pct": 15.0},
        {"region": "Запорожская область", "headline": "Временное закрытие АЗС на ул. Ленина для ТО цистерн", "body": "АЗС «АЗС Юг» №14 закрыта на плановую замену топливных цистерн. Ближайшая альтернатива в 2 км.", "severity": "info", "fuel_type": None, "price_delta_pct": None},
        {"region": "Херсонская область", "headline": "Гибридное топливо AdBlue вновь доступно в Херсоне", "body": "После двухнедельного дефицита AdBlue (мочевина для дизелей) снова поступил в продажу в трёх точках Херсона.", "severity": "success", "fuel_type": "AdBlue", "price_delta_pct": -6.0},
        {"region": "АР Крым и г. Севастополь", "headline": "Экстренное оповещение: сбой EPS на терминале Грифон", "body": "Технический сбой платёжной системы на АЗС «Грифон» в Севастополе: расчёт только наличными до устранения неполадки.", "severity": "warning", "fuel_type": None, "price_delta_pct": None},
    ]

    now = _now()
    for i, ev in enumerate(INITIAL_NEWS):
        hours_ago = _rng.randint(i * 2, i * 2 + 10)
        db.add(NewsEvent(
            region=ev["region"],
            headline=ev["headline"],
            body=ev.get("body"),
            severity=ev["severity"],
            fuel_type=ev.get("fuel_type"),
            price_delta_pct=ev.get("price_delta_pct"),
            source="Топливо ⛽️",
            created_at=now - timedelta(hours=hours_ago),
        ))
    db.commit()
    logger.info("Seeded %d initial news events.", len(INITIAL_NEWS))


def _run_migrations() -> None:
    """Add any missing columns that create_all won't auto-add to existing tables."""
    from tma_backend.database import engine
    # Use AUTOCOMMIT so DDL statements are not wrapped in a transaction.
    # Required for PostgreSQL ALTER TABLE; SQLite ignores this option gracefully.
    ddl_statements = [
        "ALTER TABLE vpn_sessions ADD COLUMN IF NOT EXISTS warned_expiry BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS checkin_streak INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_checkin_date TIMESTAMPTZ",
        # Empire full client-side game state sync
        "ALTER TABLE empires ADD COLUMN IF NOT EXISTS full_state_json TEXT",
        # Indices for bulk StationReport lookup in /api/stations
        "CREATE INDEX IF NOT EXISTS ix_station_report_station_id ON station_reports (station_id)",
        "CREATE INDEX IF NOT EXISTS ix_station_report_expires_at ON station_reports (expires_at)",
        "CREATE INDEX IF NOT EXISTS ix_station_report_created_at ON station_reports (created_at)",
    ]
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        for stmt in ddl_statements:
            try:
                conn.execute(text(stmt))
            except Exception as _e:
                logger.debug("Migration skipped (column likely exists): %s", _e)


def _blocking_startup() -> None:
    """Run all blocking DB init work in a thread so uvicorn binds immediately."""
    init_db()
    _run_migrations()
    db = SessionLocal()
    try:
        seed_db(db)
        _fix_water_stations(db)
        _seed_news_events(db)
    finally:
        db.close()
    logger.info("Blocking startup complete.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_event_loop()
    startup_task = loop.run_in_executor(None, _blocking_startup)

    scheduler.add_job(simulate_availability_shifts, "interval", minutes=30, jitter=60)
    scheduler.add_job(remove_expired_reports, "interval", minutes=10, jitter=30)
    scheduler.add_job(generate_analytics_snapshots, "interval", hours=1, jitter=60)
    scheduler.add_job(reset_daily_limits, "cron", hour=0, minute=0)
    scheduler.add_job(send_morning_digest, "cron", hour=7, minute=0)
    scheduler.add_job(send_weekly_report, "cron", day_of_week="mon", hour=8, minute=0)
    scheduler.add_job(detect_price_spikes, "interval", minutes=30, jitter=60)
    scheduler.add_job(warn_vpn_expiry, "interval", minutes=5, jitter=20)
    scheduler.add_job(warn_low_stock, "interval", minutes=20, jitter=60)
    scheduler.add_job(expire_vpn_sessions, "interval", minutes=1, jitter=15)
    scheduler.add_job(fluctuate_prices, "interval", minutes=15, jitter=60)
    scheduler.add_job(snapshot_price_history, "interval", hours=1, jitter=120)
    scheduler.add_job(generate_news_from_availability, "interval", hours=2, jitter=60)
    scheduler.start()
    logger.info("Топливо ⛽️ API запущен (DB init running in background).")

    yield

    await startup_task
    scheduler.shutdown()


app = FastAPI(
    title="Топливо ⛽️ API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


# ──────────────────────────────────────────────────────────────────
#  Achievement system
# ──────────────────────────────────────────────────────────────────

ACHIEVEMENTS: dict[str, dict] = {
    # Check-in milestones
    "first_checkin":    {"icon": "📡", "label": "Первый сигнал",        "desc": "Первый выход на связь с системой", "xp": 20},
    "checkin_7":        {"icon": "🔥", "label": "Семь дней в поле",     "desc": "7 выходов на связь подряд",        "xp": 50},
    "checkin_30":       {"icon": "🏴", "label": "Марш-бросок",          "desc": "30 подключений к системе",         "xp": 100},
    "checkin_100":      {"icon": "💎", "label": "Резидент системы",     "desc": "100 подключений — ветеран сети",   "xp": 200},
    # XP / level milestones
    "xp_500":           {"icon": "⚡", "label": "Кодировщик",           "desc": "Накоплено 500 единиц доступа",     "xp": 30},
    "xp_1500":          {"icon": "🎖", "label": "Оперативник",          "desc": "Достигнут уровень — Командир",     "xp": 75},
    "xp_legend":        {"icon": "🌟", "label": "Страж Тавриды",        "desc": "Высший уровень — Легенда сети",    "xp": 150},
    # Social / subscription
    "first_sub":        {"icon": "👁", "label": "Точка наблюдения",     "desc": "Первая АЗС под наблюдением",       "xp": 25},
    "sub_5":            {"icon": "🛰", "label": "Разведчик сети",        "desc": "Пять объектов под контролем",      "xp": 60},
    # Crowd-reporting
    "first_report":     {"icon": "📸", "label": "Полевой наблюдатель",  "desc": "Первый сигнал с места событий",    "xp": 15},
    "report_10":        {"icon": "🔭", "label": "Аналитик данных",      "desc": "10 докладов с мест дислокации",    "xp": 50},
    # Purchase
    "first_purchase":   {"icon": "🛒", "label": "Первый ордер",         "desc": "Первое получение ресурсов",        "xp": 30},
    "purchase_5":       {"icon": "⛽", "label": "Топливный посредник",  "desc": "Пять успешных ордеров",            "xp": 75},
    # VPN
    "first_vpn":        {"icon": "🔒", "label": "Призрак сети",         "desc": "Первый анонимный канал связи",     "xp": 40},
    # Referral
    "first_refer":      {"icon": "🤝", "label": "Агент влияния",        "desc": "Первый завербованный агент",       "xp": 50},
    "refer_5":          {"icon": "🌐", "label": "Командир ячейки",      "desc": "Пять агентов в подчинении",        "xp": 100},
    # Games
    "first_flip_win":   {"icon": "🃏", "label": "Первый расклад",       "desc": "Угадан первый расклад карт",       "xp": 20},
    "tap_champion":     {"icon": "👆", "label": "Стальные пальцы",      "desc": "150+ нажатий за одну сессию",      "xp": 30},
}


def _notify_achievement(user: "User", code: str) -> None:
    """Send a Telegram push when the user unlocks an achievement."""
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not bot_token or not user.id:
        return
    ach = ACHIEVEMENTS.get(code, {})
    icon = ach.get("icon", "🏆")
    label = ach.get("label", code)
    desc = ach.get("desc", "")
    xp = ach.get("xp", 0)
    text = (
        f"{icon} *Достижение разблокировано!*\n\n"
        f"*{label}*\n"
        f"_{desc}_\n\n"
        f"Бонус: *+{xp} XP*"
    )
    try:
        with httpx.Client(timeout=5.0) as client:
            client.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={"chat_id": user.id, "text": text, "parse_mode": "Markdown"},
            )
    except Exception as exc:
        logger.warning("Achievement notify failed for user %s: %s", user.id, exc)


def _check_achievements(user: "User", db: Session, context: dict | None = None) -> None:
    """
    Evaluate all achievement conditions for a user and unlock any newly earned ones.
    Grants the achievement XP bonus and fires a Telegram push.
    context: optional dict with extra signals (e.g. tap_score, flip_win).
    """
    if context is None:
        context = {}

    already = {
        row.code
        for row in db.query(UserAchievement.code)
        .filter(UserAchievement.user_id == user.id)
        .all()
    }

    checkin_count = db.query(UserCheckin).filter(UserCheckin.user_id == user.id).count()
    sub_count = db.query(Subscription).filter(Subscription.user_id == user.id).count()
    report_count = db.query(StationReport).filter(StationReport.user_id == user.id).count()
    purchase_count = db.query(PurchaseHistory).filter(PurchaseHistory.user_id == user.id).count()
    vpn_count = db.query(VpnSession).filter(VpnSession.user_id == user.id).count()
    referral = db.query(ReferralCode).filter(ReferralCode.user_id == user.id).first()
    ref_uses = referral.uses if referral else 0

    to_unlock: list[str] = []

    def _maybe(code: str, condition: bool) -> None:
        if condition and code not in already:
            to_unlock.append(code)

    streak = user.checkin_streak or 0
    _maybe("first_checkin",  checkin_count >= 1)
    _maybe("checkin_7",      streak >= 7)        # 7-day CONSECUTIVE streak
    _maybe("checkin_30",     checkin_count >= 30)
    _maybe("checkin_100",    checkin_count >= 100)
    _maybe("xp_500",         user.xp >= 500)
    _maybe("xp_1500",        user.xp >= 1500)
    _maybe("xp_legend",      user.level == "Легенда Тавриды")
    _maybe("first_sub",      sub_count >= 1)
    _maybe("sub_5",          sub_count >= 5)
    _maybe("first_report",   report_count >= 1)
    _maybe("report_10",      report_count >= 10)
    _maybe("first_purchase", purchase_count >= 1)
    _maybe("purchase_5",     purchase_count >= 5)
    _maybe("first_vpn",      vpn_count >= 1)
    _maybe("first_refer",    ref_uses >= 1)
    _maybe("refer_5",        ref_uses >= 5)
    _maybe("first_flip_win", context.get("flip_win", False))
    _maybe("tap_champion",   context.get("tap_score", 0) >= 150)

    for code in to_unlock:
        ach = ACHIEVEMENTS[code]
        db.add(UserAchievement(user_id=user.id, code=code))
        user.xp += ach["xp"]
        user.level = _xp_to_level(user.xp)
        db.flush()
        _notify_achievement(user, code)
        logger.info("Achievement unlocked: user=%s code=%s", user.id, code)


def _notify_levelup(user: "User", old_level: str) -> None:
    """
    Fire a Telegram push if the user just crossed a level boundary.
    Called synchronously — uses httpx. Safe to call from any thread.
    """
    if user.level == old_level:
        return
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not bot_token or not user.id:
        return
    level_emoji = {
        "Новичок": "🌱",
        "Разведчик": "🔦",
        "Оперативник": "⚡",
        "Командир": "🎖",
        "Легенда Тавриды": "👑",
    }
    icon = level_emoji.get(user.level, "🏆")
    text = (
        f"{icon} *Новый уровень!*\n\n"
        f"Вы достигли звания *{user.level}*!\n"
        f"Суммарный XP: *{user.xp:,}*\n\n"
        "Открывайте Матрицу Снабжения, чтобы заработать ещё больше XP."
    ).replace(",", "\u202f")
    try:
        with httpx.Client(timeout=5.0) as client:
            client.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={"chat_id": user.id, "text": text, "parse_mode": "Markdown"},
            )
    except Exception as exc:
        logger.warning("Level-up notify failed for user %s: %s", user.id, exc)


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


def _fix_water_stations(db: Session) -> None:
    """Move gas stations with coordinates inside known water zones to their region's land center."""
    from tma_backend.seed_regions import REGIONS as _REGIONS
    import random as _rng

    WATER_ZONES = [
        (41.5, 29.0, 44.5, 33.5),
        (41.5, 33.5, 44.5, 36.5),
        (44.0, 36.0, 46.2, 38.5),
        (45.4, 34.5, 47.5, 39.5),
        (46.0, 31.0, 47.3, 33.5),
    ]

    def in_water(lat: float, lng: float) -> bool:
        return any(lat1 <= lat <= lat2 and lng1 <= lng <= lng2 for lat1, lng1, lat2, lng2 in WATER_ZONES)

    centers = {
        r["name"]: (
            (r["lat_range"][0] + r["lat_range"][1]) / 2,
            (r["lng_range"][0] + r["lng_range"][1]) / 2,
        )
        for r in _REGIONS
    }

    fixed = 0
    for s in db.query(GasStation).all():
        if in_water(s.lat, s.lng):
            center = centers.get(s.region)
            if center:
                s.lat = center[0] + _rng.uniform(-0.07, 0.07)
                s.lng = center[1] + _rng.uniform(-0.07, 0.07)
                fixed += 1

    if fixed:
        db.commit()
        logger.info("Fixed %d stations displaced into water zones.", fixed)


def simulate_availability_shifts():
    """
    Drift fuel availability ±5–15% every 30 min.
    After updating statuses, detect state transitions and push Telegram
    notifications to all subscribed users whose station improved to 'green'
    or critically dropped to 'red'.
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

        # Pre-load station names for all changed station_ids in one query.
        changed_station_ids = {sid for (sid, _) in changed.keys()}
        station_names: dict[int, str] = {
            st.id: st.name
            for st in db.query(GasStation.id, GasStation.name)
            .filter(GasStation.id.in_(changed_station_ids))
            .all()
        } if changed_station_ids else {}

        for (station_id, fuel_type), (old_s, new_s) in changed.items():
            # Notify when fuel *appears* (green) or critically *runs out* (red)
            if new_s not in ("green", "red"):
                continue
            if new_s == "red" and old_s == "red":
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

                station_name = station_names.get(station_id, f"АЗС #{station_id}")
                _send_fuel_notification(
                    sub.telegram_chat_id, station_name, sub.fuel_type, new_s
                )
                sub.last_notified_status = new_s
                sub.last_notified_at = now

        db.commit()

        # ── Regional crisis detection ───────────────────────────────
        _detect_regional_crisis(db)

    except Exception as e:
        logger.error("simulate_availability_shifts error: %s", e)
        db.rollback()
    finally:
        db.close()


# Cooldown: don't re-alert the same region within 2 hours
_crisis_last_alerted: dict[str, datetime] = {}
_low_stock_last_alerted: dict[str, datetime] = {}


def _detect_regional_crisis(db: Session) -> None:
    """
    If >50% of FuelStatus rows in a region are 'red', fire an emergency
    Telegram alert to every subscriber who has a station in that region.
    Respects a 2-hour per-region cooldown.
    """
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not bot_token:
        return

    now = _now()
    cooldown = timedelta(hours=2)

    # Aggregate red % per region
    from sqlalchemy import func as sqlfunc, case as sqlcase
    region_totals = (
        db.query(
            GasStation.region,
            sqlfunc.count(FuelStatus.id).label("total"),
            sqlfunc.sum(
                sqlcase((FuelStatus.status == "red", 1), else_=0)
            ).label("red_count"),
        )
        .join(FuelStatus, FuelStatus.station_id == GasStation.id)
        .group_by(GasStation.region)
        .all()
    )

    crisis_regions: list[str] = []
    for row in region_totals:
        if row.total and (row.red_count / row.total) >= 0.5:
            last = _crisis_last_alerted.get(row.region)
            if last and (now - last) < cooldown:
                continue
            crisis_regions.append(row.region)
            _crisis_last_alerted[row.region] = now

    if not crisis_regions:
        return

    for region in crisis_regions:
        # Collect unique chat IDs subscribed to any station in this region
        subs = (
            db.query(Subscription.telegram_chat_id)
            .join(GasStation, GasStation.id == Subscription.station_id)
            .filter(GasStation.region == region)
            .distinct()
            .all()
        )
        chat_ids = [s.telegram_chat_id for s in subs]

        if not chat_ids:
            continue

        text = (
            f"🚨 *КРИЗИС СНАБЖЕНИЯ — {region}*\n\n"
            "Более 50% АЗС в регионе показывают КРАСНЫЙ статус.\n"
            "Топливный резерв критически истощён.\n\n"
            "Откройте Матрицу Снабжения, чтобы найти работающие станции."
        )
        logger.warning("Regional crisis detected: %s (%d subscribers notified)", region, len(chat_ids))

        for chat_id in chat_ids:
            try:
                with httpx.Client(timeout=6.0) as client:
                    client.post(
                        f"https://api.telegram.org/bot{bot_token}/sendMessage",
                        json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
                    )
            except Exception as exc:
                logger.warning("Crisis alert failed for chat %s: %s", chat_id, exc)


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


def send_morning_digest():
    """
    Daily 7 AM UTC digest: send each user with active subscriptions a
    summary of their tracked stations' current fuel status.
    """
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not bot_token:
        return

    db = SessionLocal()
    try:
        # Group subscriptions by telegram_chat_id
        subs = db.query(Subscription).all()
        by_chat: dict[int, list] = {}
        for s in subs:
            by_chat.setdefault(s.telegram_chat_id, []).append(s)

        if not by_chat:
            return

        # Pre-load all needed stations in one query
        all_sub_station_ids = {s.station_id for s in subs}
        station_map: dict[int, GasStation] = {
            st.id: st
            for st in db.query(GasStation).filter(GasStation.id.in_(all_sub_station_ids)).all()
        }
        # Pre-load all fuel statuses for those stations in one query
        all_fuel: list[FuelStatus] = (
            db.query(FuelStatus)
            .filter(FuelStatus.station_id.in_(all_sub_station_ids))
            .all()
        )
        fuel_by_station: dict[int, list[FuelStatus]] = {}
        for fs in all_fuel:
            fuel_by_station.setdefault(fs.station_id, []).append(fs)

        for chat_id, user_subs in by_chat.items():
            lines = ["☀️ *Утренний дайджест — Топливо ⛽️*\n"]
            for sub in user_subs[:8]:  # cap at 8 stations per digest
                station = station_map.get(sub.station_id)
                if not station:
                    continue
                statuses = [
                    fs for fs in fuel_by_station.get(sub.station_id, [])
                    if not sub.fuel_type or fs.fuel_type == sub.fuel_type
                ]
                if not statuses:
                    continue

                status_parts = []
                for fs in statuses:
                    emoji = {"green": "🟢", "yellow": "🟡", "red": "🔴"}.get(fs.status, "⚪")
                    status_parts.append(f"{emoji} {fs.fuel_type} {fs.availability_pct}%")

                lines.append(f"⛽ *{station.name}*\n   {' · '.join(status_parts)}")

            if len(lines) <= 1:
                continue

            lines.append("\n_Открыть карту: /tma_")
            text = "\n".join(lines)
            try:
                with httpx.Client(timeout=8.0) as client:
                    client.post(
                        f"https://api.telegram.org/bot{bot_token}/sendMessage",
                        json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
                    )
            except Exception as exc:
                logger.warning("Morning digest failed for chat %s: %s", chat_id, exc)

        logger.info("Morning digest sent to %d chats.", len(by_chat))
    except Exception as e:
        logger.error("send_morning_digest error: %s", e)
    finally:
        db.close()


def send_weekly_report():
    """
    Monday 8 AM UTC: send all subscribed users a weekly fuel supply summary
    showing the top 3 best-supplied regions and top 3 worst regions.
    """
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not bot_token:
        return

    db = SessionLocal()
    try:
        # Collect unique chat_ids from subscriptions
        chat_ids = [
            row[0]
            for row in db.query(Subscription.telegram_chat_id).distinct().all()
        ]
        if not chat_ids:
            return

        # Aggregate green% per region
        from sqlalchemy import func as sqlfunc, case as sqlcase
        region_rows = (
            db.query(
                GasStation.region,
                sqlfunc.count(FuelStatus.id).label("total"),
                sqlfunc.sum(sqlcase((FuelStatus.status == "green", 1), else_=0)).label("green"),
                sqlfunc.sum(sqlcase((FuelStatus.status == "red", 1), else_=0)).label("red"),
            )
            .join(FuelStatus, FuelStatus.station_id == GasStation.id)
            .group_by(GasStation.region)
            .all()
        )

        if not region_rows:
            return

        scored = [
            {
                "name": r.region,
                "green_pct": round(100 * r.green / r.total) if r.total else 0,
                "red_pct": round(100 * r.red / r.total) if r.total else 0,
            }
            for r in region_rows
        ]
        scored.sort(key=lambda x: x["green_pct"], reverse=True)
        best3 = scored[:3]
        worst3 = sorted(scored, key=lambda x: x["green_pct"])[:3]

        lines = ["📊 *Еженедельный отчёт — Топливо ⛽️*\n"]
        lines.append("🟢 *Лучшее снабжение на этой неделе:*")
        for r in best3:
            lines.append(f"  • {r['name']} — {r['green_pct']}% в норме")
        lines.append("\n🔴 *Критические зоны:*")
        for r in worst3:
            lines.append(f"  • {r['name']} — {r['red_pct']}% без топлива")
        lines.append("\n_Откройте Матрицу, чтобы найти ближайшую заправку_ /tma")

        text = "\n".join(lines)
        sent = 0
        for chat_id in chat_ids:
            try:
                with httpx.Client(timeout=8.0) as client:
                    client.post(
                        f"https://api.telegram.org/bot{bot_token}/sendMessage",
                        json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
                    )
                sent += 1
            except Exception as exc:
                logger.warning("Weekly report failed for chat %s: %s", chat_id, exc)

        logger.info("Weekly report sent to %d/%d chats.", sent, len(chat_ids))
    except Exception as e:
        logger.error("send_weekly_report error: %s", e)
    finally:
        db.close()


# Track previous multipliers to detect spikes
_prev_multipliers: dict[tuple[str, str], float] = {}


def detect_price_spikes():
    """
    Every 30 min: compare current FuelPriceEvent multipliers against the
    last-seen values. If a region+fuel type jumped ≥15%, alert all subscribers
    in that region via Telegram.
    """
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not bot_token:
        return

    db = SessionLocal()
    try:
        events = db.query(FuelPriceEvent).all()
        spikes: list[tuple[str, str, float, float]] = []  # region, fuel, old, new

        for ev in events:
            key = (ev.region, ev.fuel_type)
            prev = _prev_multipliers.get(key)
            if prev is not None and prev > 0:
                change_pct = (ev.multiplier - prev) / prev * 100
                if change_pct >= 15:
                    spikes.append((ev.region, ev.fuel_type, prev, ev.multiplier))
            _prev_multipliers[key] = ev.multiplier

        if not spikes:
            return

        for region, fuel_type, old_mult, new_mult in spikes:
            # Find all subscribers in this region
            chat_ids = [
                row[0]
                for row in (
                    db.query(Subscription.telegram_chat_id)
                    .join(GasStation, GasStation.id == Subscription.station_id)
                    .filter(GasStation.region == region)
                    .distinct()
                    .all()
                )
            ]
            if not chat_ids:
                continue

            change_str = f"+{(new_mult - old_mult) / old_mult * 100:.0f}%"
            text = (
                f"📈 *Скачок цен — {region}*\n\n"
                f"Топливо: *{fuel_type}*\n"
                f"Цена выросла на *{change_str}* относительно предыдущего уровня.\n\n"
                "Рассмотрите возможность заправиться сейчас, пока цены не выросли ещё больше."
            )
            logger.warning("Price spike alert: %s / %s %s → sent to %d chats", region, fuel_type, change_str, len(chat_ids))
            for chat_id in chat_ids:
                try:
                    with httpx.Client(timeout=6.0) as client:
                        client.post(
                            f"https://api.telegram.org/bot{bot_token}/sendMessage",
                            json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
                        )
                except Exception as exc:
                    logger.warning("Price spike notify failed for chat %s: %s", chat_id, exc)

    except Exception as e:
        logger.error("detect_price_spikes error: %s", e)
    finally:
        db.close()


# ──────────────────────────────────────────────────────────────────
#  Lifecycle
# ──────────────────────────────────────────────────────────────────

def warn_low_stock():
    """
    Every 20 min: if 30–50% of FuelStatus rows in a region are red
    (below crisis threshold), send a warning to subscribers in that region.
    Uses a 4-hour per-region cooldown to avoid alert fatigue.
    """
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not bot_token:
        return

    db = SessionLocal()
    try:
        now = _now()
        cooldown = timedelta(hours=4)

        from sqlalchemy import func as sqlfunc, case as sqlcase
        region_totals = (
            db.query(
                GasStation.region,
                sqlfunc.count(FuelStatus.id).label("total"),
                sqlfunc.sum(
                    sqlcase((FuelStatus.status == "red", 1), else_=0)
                ).label("red_count"),
            )
            .join(FuelStatus, FuelStatus.station_id == GasStation.id)
            .group_by(GasStation.region)
            .all()
        )

        warn_regions: list[tuple[str, int]] = []
        for row in region_totals:
            if not row.total:
                continue
            pct = row.red_count / row.total
            if 0.30 <= pct < 0.50:
                last = _low_stock_last_alerted.get(row.region)
                if last and (now - last) < cooldown:
                    continue
                warn_regions.append((row.region, int(pct * 100)))
                _low_stock_last_alerted[row.region] = now

        for region, pct in warn_regions:
            subs = (
                db.query(Subscription.telegram_chat_id)
                .join(GasStation, GasStation.id == Subscription.station_id)
                .filter(GasStation.region == region)
                .distinct()
                .all()
            )
            chat_ids = [s.telegram_chat_id for s in subs]
            if not chat_ids:
                continue
            text = (
                f"⚠️ *Внимание — нехватка топлива в регионе {region}*\n\n"
                f"*{pct}%* АЗС в регионе показывают красный статус.\n"
                "Рекомендуем заправиться заранее, ситуация может ухудшиться."
            )
            logger.info("Low-stock warning: %s (%d%%) → %d chats", region, pct, len(chat_ids))
            for chat_id in chat_ids:
                try:
                    with httpx.Client(timeout=5.0) as client:
                        client.post(
                            f"https://api.telegram.org/bot{bot_token}/sendMessage",
                            json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
                        )
                except Exception:
                    pass
    except Exception as e:
        logger.error("warn_low_stock error: %s", e)
    finally:
        db.close()


def warn_vpn_expiry():
    """
    Every 5 min: send a 1-hour advance warning to users whose VPN session
    expires in the next 60 minutes (only once per session via a flag).
    """
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not bot_token:
        return

    db = SessionLocal()
    try:
        now = _now()
        soon = now + timedelta(hours=1)
        expiring = (
            db.query(VpnSession)
            .filter(
                VpnSession.is_active == True,  # noqa: E712
                VpnSession.expires_at > now,
                VpnSession.expires_at <= soon,
                VpnSession.warned_expiry == False,  # noqa: E712
            )
            .all()
        )
        for sess in expiring:
            sess.warned_expiry = True
            mins_left = max(0, int((sess.expires_at - now).total_seconds() // 60))
            try:
                with httpx.Client(timeout=5.0) as client:
                    client.post(
                        f"https://api.telegram.org/bot{bot_token}/sendMessage",
                        json={
                            "chat_id": sess.telegram_chat_id,
                            "text": (
                                f"⏰ *VPN истекает через {mins_left} мин*\n\n"
                                f"Ваш план «{sess.plan_name}» завершится через *{mins_left} минут*.\n"
                                "Продлите доступ в разделе VPN, чтобы не терять соединение."
                            ),
                            "parse_mode": "Markdown",
                        },
                    )
            except Exception:
                pass
        if expiring:
            db.commit()
            logger.info("Sent VPN expiry warnings to %d sessions.", len(expiring))
    except Exception as e:
        logger.error("warn_vpn_expiry error: %s", e)
        db.rollback()
    finally:
        db.close()


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




# ──────────────────────────────────────────────────────────────────
#  Health
# ──────────────────────────────────────────────────────────────────

@app.get("/health")
@app.get("/api/healthz")
def health():
    return {"status": "ok", "time": _now().isoformat()}


@app.get("/api/stats")
def get_system_stats(db: Session = Depends(get_db)):
    """Public system stats for the TMA dashboard header."""
    from sqlalchemy import text as _text
    def _count(q: str) -> int:
        return db.execute(_text(q)).scalar() or 0

    total_stations  = _count("SELECT count(*) FROM gas_stations")
    total_users     = _count("SELECT count(*) FROM users")
    total_purchases = _count("SELECT count(*) FROM purchase_history")
    active_purchases= _count("SELECT count(*) FROM purchase_history WHERE status='active'")
    total_news      = _count("SELECT count(*) FROM news_events")
    total_reports   = _count("SELECT count(*) FROM station_reports")
    avg_avail       = db.execute(_text("SELECT avg(availability_pct) FROM fuel_statuses")).scalar() or 0.0

    # Station breakdown via SQL — cheap single-pass
    rows = db.execute(_text("""
        SELECT gs.id,
               avg(fs.availability_pct) AS avg_pct
        FROM gas_stations gs
        LEFT JOIN fuel_statuses fs ON fs.station_id = gs.id
        GROUP BY gs.id
    """)).fetchall()

    green_count = yellow_count = red_count = 0
    for row in rows:
        avg = row[1] or 0
        if avg >= 60:
            green_count += 1
        elif avg >= 25:
            yellow_count += 1
        else:
            red_count += 1

    return {
        "total_stations":      total_stations,
        "total_users":         total_users,
        "total_purchases":     total_purchases,
        "active_purchases":    active_purchases,
        "total_news":          total_news,
        "total_reports":       total_reports,
        "avg_availability_pct": round(float(avg_avail), 1),
        "station_breakdown": {
            "green":  green_count,
            "yellow": yellow_count,
            "red":    red_count,
        },
        "generated_at": _now().isoformat(),
    }


# ──────────────────────────────────────────────────────────────────
#  Stations
# ──────────────────────────────────────────────────────────────────

@app.get("/api/stations", response_model=list[GasStationOut])
def list_stations(
    region: Optional[str] = None,
    zone_type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(GasStation)
    if region:
        q = q.filter(GasStation.region == region)
    if zone_type:
        q = q.filter(GasStation.zone_type == zone_type)
    if search:
        like = f"%{search}%"
        q = q.filter(
            GasStation.name.ilike(like) |
            GasStation.address.ilike(like) |
            GasStation.region.ilike(like) |
            GasStation.network.ilike(like)
        )
    stations = q.all()

    # Bulk-load all relevant crowd reports in ONE query instead of N×M queries.
    now = _now()
    cutoff = now - timedelta(hours=1, minutes=30)
    station_ids = [s.id for s in stations]
    if station_ids:
        raw_reports = (
            db.query(StationReport)
            .filter(
                StationReport.station_id.in_(station_ids),
                StationReport.expires_at > now,
                StationReport.created_at > cutoff,
            )
            .all()
        )
    else:
        raw_reports = []

    # Group reports by station_id for O(1) lookup.
    from collections import defaultdict
    reports_by_station: dict[int, list] = defaultdict(list)
    for r in raw_reports:
        reports_by_station[r.station_id].append(r)

    def _avail_fast(station_id: int, base_pct: int) -> int:
        reps = reports_by_station.get(station_id, [])
        if not reps:
            return base_pct
        pos = sum(1 for r in reps if r.vote_type == "available")
        neg = sum(1 for r in reps if r.vote_type == "unavailable")
        return max(0, min(100, base_pct + (pos - neg) * 10))

    result = []
    for s in stations:
        result.append({
            "id": s.id, "region": s.region, "zone_type": s.zone_type,
            "name": s.name, "address": s.address,
            "lat": s.lat, "lng": s.lng,
            "network": s.network, "queue_cars": s.queue_cars,
            "fuel_statuses": [
                {
                    "fuel_type": fs.fuel_type,
                    "status": fs.status,
                    "availability_pct": _avail_fast(s.id, fs.availability_pct),
                    "last_updated": fs.last_updated,
                }
                for fs in s.fuel_statuses
            ],
        })
    return result


@app.get("/api/top-stations")
def get_top_stations(limit: int = 5, fuel_type: Optional[str] = None, db: Session = Depends(get_db)):
    """Return top stations by average fuel availability percentage."""
    from tma_backend.models import FuelStatus as FS
    from sqlalchemy import func as sqlfunc, desc as sqldesc
    q = (
        db.query(
            GasStation.id,
            GasStation.name,
            GasStation.region,
            GasStation.network,
            GasStation.queue_cars,
            sqlfunc.avg(FS.availability_pct).label("avg_pct"),
        )
        .join(FS, FS.station_id == GasStation.id)
    )
    if fuel_type:
        q = q.filter(FS.fuel_type == fuel_type)
    rows = (
        q.group_by(GasStation.id, GasStation.name, GasStation.region, GasStation.network, GasStation.queue_cars)
        .order_by(sqldesc("avg_pct"))
        .limit(max(1, min(limit, 20)))
        .all()
    )
    return [
        {
            "id": r.id,
            "name": r.name,
            "region": r.region,
            "network": r.network or "",
            "queue_cars": r.queue_cars or 0,
            "avg_availability_pct": round(float(r.avg_pct or 0), 1),
        }
        for r in rows
    ]


@app.get("/api/stations/{station_id}/notes/{user_id}")
def get_station_note(station_id: int, user_id: int, db: Session = Depends(get_db)):
    note = db.query(StationNote).filter(
        StationNote.station_id == station_id,
        StationNote.user_id == user_id,
    ).first()
    return {"body": note.body if note else "", "updated_at": note.updated_at.isoformat() if note else None}


@app.post("/api/stations/{station_id}/notes")
def upsert_station_note(
    station_id: int,
    body: dict,
    db: Session = Depends(get_db),
):
    user_id = body.get("user_id")
    text = (body.get("body") or "").strip()[:500]
    if not user_id:
        raise HTTPException(400, detail="user_id required")
    note = db.query(StationNote).filter(
        StationNote.station_id == station_id,
        StationNote.user_id == user_id,
    ).first()
    if not note:
        note = StationNote(station_id=station_id, user_id=user_id, body=text)
        db.add(note)
    else:
        note.body = text
        note.updated_at = _now()
    db.commit()
    return {"ok": True, "body": note.body}


@app.delete("/api/stations/{station_id}/notes/{user_id}")
def delete_station_note(station_id: int, user_id: int, db: Session = Depends(get_db)):
    db.query(StationNote).filter(
        StationNote.station_id == station_id,
        StationNote.user_id == user_id,
    ).delete()
    db.commit()
    return {"ok": True}


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
        old_level = user.level
        user.xp += 5
        user.level = _xp_to_level(user.xp)
        _notify_levelup(user, old_level)
        _check_achievements(user, db)

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

    old_level = user.level
    user.xp += 20
    user.level = _xp_to_level(user.xp)
    _notify_levelup(user, old_level)
    _check_achievements(user, db)
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
    """
    Create a real Telegram Stars invoice link via createInvoiceLink Bot API.
    Returns invoice_link — the frontend passes it to Telegram.WebApp.openInvoice().
    After the user pays, Telegram fires successful_payment to the bot, which
    then calls /internal/record-stars-purchase to persist the purchase.
    """
    station = db.query(GasStation).filter(GasStation.id == body.station_id).first()
    if not station:
        raise HTTPException(404, detail="Станция не найдена")
    price_per_l = FUEL_PRICES_RUB.get(body.fuel_type, 50)
    total_price = price_per_l * body.volume
    from tma_backend.payment import get_provider
    result = get_provider("stars").create_invoice(
        user_id=body.user_id, fuel_type=body.fuel_type,
        volume=body.volume, price_rub=total_price, station_id=body.station_id,
    )
    if not result.ok:
        raise HTTPException(500, detail=result.error or "Ошибка создания инвойса Stars")
    return {
        "stars_amount": result.stars_amount,
        "invoice_link": result.checkout_url,
        "transaction_id": result.transaction_id,
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


@app.post("/internal/record-stars-purchase")
def record_stars_purchase(body: StarsPurchaseIn, db: Session = Depends(get_db)):
    """
    Called by Telegram bot after a successful Stars payment (successful_payment update).
    Persists the purchase to TMA DB so it appears in the user's Vault.
    Protected by a shared INTERNAL_API_SECRET known only to bot.py and this backend.
    """
    if body.internal_secret != INTERNAL_API_SECRET:
        raise HTTPException(403, detail="Forbidden")

    from tma_backend.payment import generate_qr_hash

    station = db.query(GasStation).filter(GasStation.id == body.station_id).first()
    station_name = station.name if station else "АЗС"
    region = station.region if station else "Севастополь"

    user = _get_or_create_user(db, body.user_id)

    qr = generate_qr_hash(body.user_id, body.fuel_type, body.volume)
    purchase = PurchaseHistory(
        user_id=body.user_id,
        fuel_type=body.fuel_type,
        volume=body.volume,
        price=body.price_rub,
        currency="XTR",
        status="active",
        qr_hash=qr,
        station_name=station_name,
        region=region,
        expires_at=_now() + timedelta(days=3),
    )
    db.add(purchase)

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
        db.add(DailyLimitTracker(
            user_id=body.user_id,
            fuel_type=body.fuel_type,
            total_volume_bought=body.volume,
            reset_at=tomorrow,
        ))

    old_level = user.level
    user.xp += 20
    user.level = _xp_to_level(user.xp)
    _notify_levelup(user, old_level)

    db.commit()
    logger.info(
        "Stars purchase recorded: user=%d, %dл %s, station=%s, qr=%s",
        body.user_id, body.volume, body.fuel_type, station_name, qr,
    )
    return {"ok": True, "qr_hash": qr}


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
    old_level = user.level
    user.xp = max(0, user.xp + total_xp)
    user.level = _xp_to_level(user.xp)
    _notify_levelup(user, old_level)
    _check_achievements(user, db, {"flip_win": total_xp > 0})
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
    _notify_levelup(user, old_level)
    _check_achievements(user, db, {"tap_score": capped_score})
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
    """
    Returns a real Telegram Stars invoice link.
    VPN session is NOT created here — it is created by /internal/activate-vpn-stars
    after the bot receives the successful_payment callback from Telegram.
    """
    plan = VPN_PLANS.get(body.plan_id)
    if not plan:
        raise HTTPException(400, detail="Неверный план")

    stars = _stars_for_rub(plan["price_rub"])
    import secrets as _sec
    tx_id = f"VPN-STARS-PENDING-{_sec.token_hex(6).upper()}"

    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not bot_token:
        raise HTTPException(503, detail="Бот не настроен — TELEGRAM_BOT_TOKEN отсутствует")

    # Payload parsed by bot's successful_payment_handler: vpn_{plan_id}_{user_id}
    payload = f"vpn_{body.plan_id}_{body.user_id}"
    try:
        resp = httpx.post(
            f"https://api.telegram.org/bot{bot_token}/createInvoiceLink",
            json={
                "title": f"VPN {plan['name']}",
                "description": (
                    f"Защищённый VPN-канал на {plan['duration_minutes']} минут. "
                    f"WireGuard-ключ выдаётся мгновенно после оплаты."
                ),
                "payload": payload,
                "currency": "XTR",
                "prices": [{"label": f"VPN {plan['duration_minutes']} мин", "amount": stars}],
            },
            timeout=10,
        )
        data = resp.json()
        if not data.get("ok"):
            desc = data.get("description", "Telegram API error")
            logger.error("createInvoiceLink failed for VPN: %s", data)
            raise HTTPException(502, detail=desc)
        checkout_url: str = data["result"]
        logger.info("VPN Stars invoice created: plan=%s user=%d stars=%d", body.plan_id, body.user_id, stars)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("VPN Stars invoice creation failed: %s", exc)
        raise HTTPException(502, detail=str(exc))

    return VpnInvoiceOut(
        stars_amount=stars,
        checkout_url=checkout_url,
        transaction_id=tx_id,
        plan_name=plan["name"],
        duration_minutes=plan["duration_minutes"],
    )


@app.post("/internal/activate-vpn-stars")
def activate_vpn_stars(body: dict, db: Session = Depends(get_db)):
    """
    Called by the Telegram bot after a successful Stars payment with vpn_ payload.
    Creates the VPN session and triggers the activation notification.
    Protected by INTERNAL_API_SECRET.
    """
    if body.get("internal_secret") != INTERNAL_API_SECRET:
        raise HTTPException(403, detail="Forbidden")

    plan_id = body.get("plan_id", "sprint")
    user_id = int(body.get("user_id", 0))
    telegram_chat_id = int(body.get("telegram_chat_id", user_id))
    stars = int(body.get("stars_amount", 0))

    plan = VPN_PLANS.get(plan_id)
    if not plan:
        raise HTTPException(400, detail="Неверный план")

    config_key = _vpn_config_key()
    _get_or_create_user(db, user_id)

    sess = VpnSession(
        user_id=user_id,
        telegram_chat_id=telegram_chat_id,
        plan_id=plan_id,
        plan_name=plan["name"],
        duration_minutes=plan["duration_minutes"],
        price_rub=plan["price_rub"],
        payment_method="stars",
        transaction_id=f"VPN-STARS-{stars}",
        config_key=config_key,
        is_active=True,
        expires_at=_now() + timedelta(minutes=plan["duration_minutes"]),
    )
    db.add(sess)
    db.commit()
    db.refresh(sess)
    _notify_vpn_activated(sess)

    user = db.query(User).filter(User.id == user_id).first()
    if user:
        _check_achievements(user, db)
        db.commit()

    logger.info("VPN activated via Stars: plan=%s user=%d stars=%d key=%s", plan_id, user_id, stars, config_key)
    return {
        "ok": True,
        "config_key": config_key,
        "plan_name": plan["name"],
        "duration_minutes": plan["duration_minutes"],
        "expires_at": sess.expires_at.isoformat(),
    }


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
    vpn_user = db.query(User).filter(User.id == body.user_id).first()
    if vpn_user:
        _check_achievements(vpn_user, db)
        db.commit()
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

    # Streak tracking
    now_date = now.date()
    if user.last_checkin_date is not None:
        last_d = user.last_checkin_date
        if last_d.tzinfo is None:
            last_d = last_d.replace(tzinfo=timezone.utc)
        days_since = (now.replace(tzinfo=timezone.utc) - last_d).days
        if days_since == 1:
            user.checkin_streak = (user.checkin_streak or 0) + 1
        elif days_since > 1:
            user.checkin_streak = 1
        # days_since == 0 shouldn't happen (already_done guard above)
    else:
        user.checkin_streak = 1
    user.last_checkin_date = now

    streak_bonus = 0
    if user.checkin_streak >= 7:
        streak_bonus = 25   # bonus XP for 7-day streak
    elif user.checkin_streak >= 3:
        streak_bonus = 10   # 3-day streak bonus

    checkin_total = CHECKIN_XP + streak_bonus
    checkin = UserCheckin(user_id=user_id, xp_awarded=checkin_total)
    db.add(checkin)
    old_level = user.level
    user.xp += checkin_total
    user.level = _xp_to_level(user.xp)
    _notify_levelup(user, old_level)
    _check_achievements(user, db)
    db.commit()

    streak_msg = ""
    if user.checkin_streak >= 7:
        streak_msg = f" 🔥 Серия {user.checkin_streak} дней! +{streak_bonus} бонус XP"
    elif user.checkin_streak >= 3:
        streak_msg = f" 🔥 Серия {user.checkin_streak} дней! +{streak_bonus} XP"
    return CheckinOut(
        ok=True, xp_awarded=checkin_total, total_xp=user.xp, level=user.level,
        already_done=False,
        message=f"✅ Ежедневный бонус получен! +{checkin_total} XP{streak_msg}",
        next_checkin_at=today_start + timedelta(days=1),
        checkin_streak=user.checkin_streak or 0,
    )


# ──────────────────────────────────────────────────────────────────
#  Leaderboard
# ──────────────────────────────────────────────────────────────────

@app.get("/api/achievements/{user_id}")
def get_achievements(user_id: int, db: Session = Depends(get_db)):
    """Return all unlocked achievements and locked achievement definitions for a user."""
    unlocked_rows = (
        db.query(UserAchievement)
        .filter(UserAchievement.user_id == user_id)
        .all()
    )
    unlocked_codes = {r.code: r.unlocked_at for r in unlocked_rows}

    result = []
    for code, meta in ACHIEVEMENTS.items():
        result.append({
            "code": code,
            "icon": meta["icon"],
            "label": meta["label"],
            "desc": meta["desc"],
            "xp_bonus": meta["xp"],
            "unlocked": code in unlocked_codes,
            "unlocked_at": unlocked_codes.get(code),
        })
    # Sort: unlocked first (newest first), then locked
    result.sort(key=lambda x: (not x["unlocked"], -(x["unlocked_at"].timestamp() if x["unlocked_at"] else 0)))
    return {"achievements": result}


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

    from sqlalchemy import text as _txt
    total_users = db.execute(_txt("SELECT count(*) FROM users")).scalar() or 0
    return LeaderboardOut(entries=entries, user_rank=user_rank, user_xp=user_xp, total_users=total_users)


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
        old_level_ref = referee.level
        referee.xp += REFERRAL_XP
        referee.level = _xp_to_level(referee.xp)
        _notify_levelup(referee, old_level_ref)
        _check_achievements(referee, db)
    if referrer:
        old_level_rr = referrer.level
        referrer.xp += REFERRAL_XP
        referrer.level = _xp_to_level(referrer.xp)
        _notify_levelup(referrer, old_level_rr)
        _check_achievements(referrer, db)
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
    sub_user = db.query(User).filter(User.id == body.user_id).first()
    if sub_user:
        _check_achievements(sub_user, db)
        db.commit()

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
    if subs:
        sub_station_ids = {s.station_id for s in subs}
        station_map = {
            st.id: st
            for st in db.query(GasStation).filter(GasStation.id.in_(sub_station_ids)).all()
        }
    else:
        station_map = {}
    result = []
    for sub in subs:
        station = station_map.get(sub.station_id)
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

    # Build a lookup dict so we never query GasStation per FuelStatus.
    station_by_id = {s.id: s for s in stations}

    # Regional supply
    regional_supply: dict = {}
    for s in stations:
        if s.region not in regional_supply:
            regional_supply[s.region] = {"green": 0, "yellow": 0, "red": 0,
                                          "avg_pct": 0, "count": 0, "zone_type": s.zone_type}
        regional_supply[s.region]["count"] += 1

    for fs in statuses:
        st = station_by_id.get(fs.station_id)
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


@app.get("/api/users/{user_id}/notes")
def get_user_notes(user_id: int, db: Session = Depends(get_db)):
    """Return all station notes written by a user, joined with station name."""
    notes = (
        db.query(StationNote, GasStation)
        .join(GasStation, GasStation.id == StationNote.station_id)
        .filter(StationNote.user_id == user_id)
        .order_by(StationNote.updated_at.desc())
        .all()
    )
    return {
        "notes": [
            {
                "id": n.id,
                "station_id": n.station_id,
                "station_name": s.name,
                "station_region": s.region,
                "body": n.body,
                "updated_at": n.updated_at.isoformat() if n.updated_at else None,
            }
            for n, s in notes
        ]
    }


@app.get("/api/analytics/trend")
def get_analytics_trend(region: Optional[str] = None, days: int = 7, db: Session = Depends(get_db)):
    """Hourly-averaged availability trend for a given region and time window."""
    cutoff = _now() - timedelta(days=days)
    query = db.query(AnalyticsSnapshot).filter(AnalyticsSnapshot.created_at >= cutoff)
    if region:
        query = query.filter(AnalyticsSnapshot.region == region)
    snapshots = query.order_by(AnalyticsSnapshot.created_at.asc()).all()

    hourly: dict = {}
    for s in snapshots:
        key = s.created_at.strftime("%Y-%m-%d %H:00")
        if key not in hourly:
            hourly[key] = {"sum": 0.0, "count": 0}
        hourly[key]["sum"] += s.avg_availability
        hourly[key]["count"] += 1

    return [
        {"time": k, "availability": round(v["sum"] / v["count"], 1)}
        for k, v in sorted(hourly.items())
    ]


# ──────────────────────────────────────────────────────────────────
#  Dynamic Pricing Engine
# ──────────────────────────────────────────────────────────────────

def _compute_dynamic_price(db: Session, region: str, fuel_type: str, base_rub: int) -> dict:
    """
    Return current effective price for a fuel type in a region.
    Applies active FuelPriceEvent multipliers on top of the base price.
    """
    now = _now()
    events = (
        db.query(FuelPriceEvent)
        .filter(
            FuelPriceEvent.region == region,
            FuelPriceEvent.fuel_type == fuel_type,
            FuelPriceEvent.is_active == True,  # noqa: E712
        )
        .filter(
            (FuelPriceEvent.expires_at == None) | (FuelPriceEvent.expires_at > now)  # noqa: E711
        )
        .all()
    )
    combined = 1.0
    for ev in events:
        combined *= ev.multiplier
    effective = round(base_rub * combined)
    return {
        "base": base_rub,
        "effective": effective,
        "multiplier": round(combined, 4),
        "is_crisis": combined > 1.15,
        "events": [{"reason": e.reason, "multiplier": e.multiplier} for e in events],
    }


async def snapshot_price_history():
    """APScheduler job: every hour, snapshot avg/min/max price per fuel type."""
    db = SessionLocal()
    try:
        from tma_backend.seed_regions import REGIONS, FUEL_PRICES_RUB, FUEL_TYPES
        for ft in FUEL_TYPES:
            base = FUEL_PRICES_RUB.get(ft, 55)
            vals = [_compute_dynamic_price(db, r["name"], ft, base).get("effective", base) for r in REGIONS]
            vals = [v for v in vals if v and v > 0]
            if not vals:
                continue
            snap = PriceSnapshot(
                fuel_type=ft,
                avg_price=sum(vals) / len(vals),
                min_price=min(vals),
                max_price=max(vals),
                region_count=len(vals),
            )
            db.add(snap)
        db.commit()
    except Exception as exc:
        logger.error("snapshot_price_history error: %s", exc)
        db.rollback()
    finally:
        db.close()


async def fluctuate_prices():
    """
    APScheduler job: every 15 min, randomly generate or expire price events
    to create realistic market volatility. Logs significant shifts as NewsEvents.
    Broadcasts updated prices to all connected WebSocket clients.
    """
    db = SessionLocal()
    try:
        rng = random.Random()
        now = _now()

        # Expire old events
        old = (
            db.query(FuelPriceEvent)
            .filter(FuelPriceEvent.expires_at < now)
            .all()
        )
        for ev in old:
            ev.is_active = False

        # Generate new events with ~20% chance per iteration
        from tma_backend.seed_regions import REGIONS, FUEL_PRICES_RUB
        crisis_regions = [r for r in REGIONS if r["zone_type"] == "critical"]
        for region in rng.sample(crisis_regions, min(3, len(crisis_regions))):
            if rng.random() < 0.20:
                fuel = rng.choice(["АИ-92", "АИ-95", "ДТ"])
                shock = rng.choice([
                    (1.08, "Увеличение спроса в зоне"),
                    (1.15, "Ограничение поставок с нефтебазы"),
                    (1.22, "Дефицит — приоритет государственным объектам"),
                    (0.95, "Поступление новой партии, цена скорректирована"),
                ])
                mult, reason = shock
                ev = FuelPriceEvent(
                    region=region["name"],
                    fuel_type=fuel,
                    multiplier=mult,
                    reason=reason,
                    is_active=True,
                    expires_at=now + timedelta(hours=rng.randint(2, 8)),
                )
                db.add(ev)

                if mult >= 1.15:
                    base = FUEL_PRICES_RUB.get(fuel, 55)
                    new_price = round(base * mult)
                    delta_pct = round((mult - 1.0) * 100, 1)
                    news = NewsEvent(
                        region=region["name"],
                        headline=f"⚠ Корректировка цены: {fuel} +{delta_pct}% → {new_price} ₽/л",
                        body=reason,
                        severity="warning" if mult < 1.20 else "critical",
                        fuel_type=fuel,
                        price_delta_pct=delta_pct,
                        source="РыночныйМонитор",
                    )
                    db.add(news)

        db.commit()
        logger.info("Price fluctuation tick complete.")

        # Broadcast updated prices to all WS clients
        if _price_ws_clients:
            try:
                from tma_backend.seed_regions import REGIONS as _R, FUEL_PRICES_RUB as _FP
                prices_data: dict = {}
                with SessionLocal() as bdb:
                    for r in _R:
                        rname = r["name"]
                        prices_data[rname] = {
                            ft: _compute_dynamic_price(bdb, rname, ft, base)
                            for ft, base in _FP.items()
                        }
                await _broadcast_prices(prices_data)
            except Exception as be:
                logger.error("WS broadcast error: %s", be)

    except Exception as e:
        logger.error("fluctuate_prices error: %s", e)
        db.rollback()
    finally:
        db.close()


def generate_news_from_availability():
    """
    Every 2 hours: scan gas stations with critically low availability and
    auto-generate news events so the crisis feed stays current.
    """
    import random as _rng
    db = SessionLocal()
    try:
        now = _now()
        CRITICAL_THRESHOLD = 20.0  # % below which a region triggers a news event
        GOOD_THRESHOLD = 75.0      # % above which a positive news event is generated

        # Aggregate avg availability per region — use one bulk FuelStatus query
        # instead of lazy-loading st.fuel_statuses per station (N+1).
        region_stats: dict[str, list[float]] = {}
        station_region: dict[int, str] = {
            st.id: st.region
            for st in db.query(GasStation.id, GasStation.region).all()
        }
        fs_by_station: dict[int, list[float]] = {}
        for fs in db.query(FuelStatus.station_id, FuelStatus.availability_pct).all():
            fs_by_station.setdefault(fs.station_id, []).append(fs.availability_pct)
        for st_id, region in station_region.items():
            avail_vals = fs_by_station.get(st_id, [])
            if avail_vals:
                region_stats.setdefault(region, []).append(
                    sum(avail_vals) / len(avail_vals)
                )

        generated = 0
        for region, vals in region_stats.items():
            if not vals:
                continue
            avg = sum(vals) / len(vals)

            # Check if we recently added a news event for this region (avoid spam)
            recent_cutoff = now - timedelta(hours=4)
            recent_count = (
                db.query(NewsEvent)
                .filter(NewsEvent.region == region, NewsEvent.created_at >= recent_cutoff)
                .count()
            )
            if recent_count >= 2:
                continue

            if avg < CRITICAL_THRESHOLD and _rng.random() < 0.75:
                fuel = _rng.choice(["АИ-92", "АИ-95", "ДТ", "АИ-95+"])
                queue_est = _rng.randint(15, 65)
                price_spike = round(_rng.uniform(8.5, 22.0), 1)
                headlines = [
                    f"ЭКСТРЕННО: {region} — запасы {fuel} на критическом уровне ({avg:.0f}%)",
                    f"⚠ Дефицит {fuel} в {region}: очереди до {queue_est} авто на АЗС",
                    f"Матрица фиксирует ЧС в {region}: {avg:.0f}% наличия {fuel}",
                    f"АЗС {region} массово отключают {fuel} — лимиты введены",
                    f"СРОЧНО: нехватка {fuel} в {region}, цены выросли на {price_spike}%",
                ]
                bodies = [
                    f"Региональный мониторинг зафиксировал критическое снижение запасов {fuel} до {avg:.1f}%. На большинстве АЗС введены ограничения по объёму отпуска. Ожидайте нормализацию в течение 24–72 часов.",
                    f"Среднее по {region}: {avg:.1f}% доступности {fuel}. Очереди на ведущих станциях сети составляют от 20 до {queue_est} автомобилей. Рекомендуем обращаться на АЗС зелёного статуса.",
                    f"Ситуация классифицирована как топливный дефицит. Введён режим нормирования. Лимит — не более 30 л {fuel} на ТС. Ориентировочные сроки пополнения запасов — 48 часов.",
                ]
                db.add(NewsEvent(
                    region=region, headline=_rng.choice(headlines),
                    body=_rng.choice(bodies),
                    severity="critical", fuel_type=fuel,
                    price_delta_pct=round(_rng.uniform(5.0, price_spike), 1),
                    source="АвтоМатрица · ИИ-мониторинг", created_at=now,
                ))
                generated += 1
            elif avg < 40.0 and avg >= CRITICAL_THRESHOLD and _rng.random() < 0.5:
                fuel = _rng.choice(["АИ-92", "АИ-95", "ДТ"])
                price_d = round(_rng.uniform(2.5, 8.0), 1)
                db.add(NewsEvent(
                    region=region,
                    headline=f"Напряжённость в {region}: {fuel} заканчивается ({avg:.0f}%)",
                    body=f"Запасы {fuel} в {region} снизились до {avg:.1f}%. Часть АЗС перешла в режим ограниченного отпуска. Рост цен: +{price_d}% к уровню прошлой недели.",
                    severity="warning", fuel_type=fuel,
                    price_delta_pct=price_d,
                    source="АвтоМатрица · Предупреждение", created_at=now,
                ))
                generated += 1
            elif avg > GOOD_THRESHOLD and _rng.random() < 0.4:
                price_drop = round(_rng.uniform(1.0, 5.5), 1)
                db.add(NewsEvent(
                    region=region,
                    headline=f"Нормализация в {region}: доступность {avg:.0f}%",
                    body=f"Ситуация с топливом в {region} стабилизировалась. Доступность по всем видам: {avg:.1f}%. Поставки прибыли в полном объёме. Цены скорректировались на -{price_drop}%.",
                    severity="success", fuel_type=None,
                    price_delta_pct=-price_drop,
                    source="АвтоМатрица · Мониторинг", created_at=now,
                ))
                generated += 1

        if generated > 0:
            db.commit()
            logger.info("Auto-generated %d news events from availability data.", generated)
    except Exception as e:
        logger.error("generate_news_from_availability error: %s", e)
        db.rollback()
    finally:
        db.close()


# ──────────────────────────────────────────────────────────────────
#  NeuroCredits helpers
# ──────────────────────────────────────────────────────────────────

def _award_credits(db: Session, user: User, delta: int, reason: str) -> int:
    """Apply delta to user.neurocredits, log a CreditTransaction, return new balance."""
    user.neurocredits = max(0, (user.neurocredits or 0) + delta)
    tx = CreditTransaction(
        user_id=user.id,
        delta=delta,
        reason=reason,
        balance_after=user.neurocredits,
    )
    db.add(tx)
    return user.neurocredits


# ──────────────────────────────────────────────────────────────────
#  Prices API
# ──────────────────────────────────────────────────────────────────

@app.get("/api/prices")
def get_prices(region: Optional[str] = None, db: Session = Depends(get_db)):
    """Return current effective prices per fuel type, with crisis multipliers."""
    from tma_backend.seed_regions import REGIONS, FUEL_PRICES_RUB, FUEL_TYPES
    result: dict = {}
    target_regions = (
        [r for r in REGIONS if r["name"] == region]
        if region else REGIONS
    )
    for reg in target_regions:
        rname = reg["name"]
        result[rname] = {}
        for ft in FUEL_TYPES:
            base = FUEL_PRICES_RUB.get(ft, 55)
            result[rname][ft] = _compute_dynamic_price(db, rname, ft, base)
    return result


@app.get("/api/prices/history")
def get_price_history(hours: int = 24, db: Session = Depends(get_db)):
    """Return per-fuel-type price snapshots for the last N hours (default 24)."""
    cutoff = _now() - timedelta(hours=max(1, min(hours, 168)))
    rows = (
        db.query(PriceSnapshot)
        .filter(PriceSnapshot.snapped_at >= cutoff)
        .order_by(PriceSnapshot.snapped_at.asc())
        .all()
    )
    result: dict = {}
    for r in rows:
        if r.fuel_type not in result:
            result[r.fuel_type] = []
        result[r.fuel_type].append({
            "t": r.snapped_at.isoformat(),
            "avg": round(r.avg_price, 2),
            "min": round(r.min_price, 2),
            "max": round(r.max_price, 2),
        })
    return {"history": result}


@app.get("/api/prices/{region_name}")
def get_prices_for_region(region_name: str, db: Session = Depends(get_db)):
    from tma_backend.seed_regions import FUEL_PRICES_RUB, FUEL_TYPES
    result: dict = {}
    for ft in FUEL_TYPES:
        base = FUEL_PRICES_RUB.get(ft, 55)
        result[ft] = _compute_dynamic_price(db, region_name, ft, base)
    return result


# ──────────────────────────────────────────────────────────────────
#  News / Crisis Feed
# ──────────────────────────────────────────────────────────────────

@app.get("/api/news")
def get_news(region: Optional[str] = None, limit: int = 30,
             db: Session = Depends(get_db)):
    """Return recent crisis/market news events, newest first."""
    q = db.query(NewsEvent).order_by(NewsEvent.created_at.desc())
    if region:
        q = q.filter(NewsEvent.region == region)
    items = q.limit(min(limit, 100)).all()
    return [
        {
            "id": n.id,
            "region": n.region,
            "headline": n.headline,
            "body": n.body,
            "severity": n.severity,
            "fuel_type": n.fuel_type,
            "price_delta_pct": n.price_delta_pct,
            "source": n.source,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in items
    ]


# ──────────────────────────────────────────────────────────────────
#  NeuroCredits API
# ──────────────────────────────────────────────────────────────────

@app.get("/api/credits/balance/{user_id}")
def credits_balance(user_id: int, db: Session = Depends(get_db)):
    user = _get_or_create_user(db, user_id)
    txs = (
        db.query(CreditTransaction)
        .filter(CreditTransaction.user_id == user_id)
        .order_by(CreditTransaction.created_at.desc())
        .limit(20)
        .all()
    )
    return {
        "balance": user.neurocredits or 0,
        "history": [
            {
                "delta": t.delta,
                "reason": t.reason,
                "balance_after": t.balance_after,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in txs
        ],
    }


class CreditsEarnIn(BaseModel):
    action: str


CREDIT_ACTIONS = {
    "checkin":  50,
    "tap_game": 10,
    "report":   15,
    "referral": 100,
    "purchase": 25,
}


@app.post("/api/credits/earn/{user_id}")
def credits_earn(user_id: int, body: CreditsEarnIn, db: Session = Depends(get_db)):
    user = _get_or_create_user(db, user_id)
    delta = CREDIT_ACTIONS.get(body.action, 0)
    if delta <= 0:
        raise HTTPException(400, detail="Неизвестное действие")
    new_bal = _award_credits(db, user, delta, body.action)
    db.commit()
    return {"ok": True, "delta": delta, "balance": new_bal}


# ──────────────────────────────────────────────────────────────────
#  Premium Subscriptions
# ──────────────────────────────────────────────────────────────────

PREMIUM_TIERS = {
    "operator": {"name": "Оператор", "days": 30, "price_usdt": 4.99},
    "legend":   {"name": "Легенда",  "days": 365, "price_usdt": 29.99},
}


class PremiumBuyIn(BaseModel):
    user_id: int
    tier: str
    payment_method: str = "cryptobot"


@app.post("/api/premium/buy")
def premium_buy(body: PremiumBuyIn, db: Session = Depends(get_db)):
    tier = PREMIUM_TIERS.get(body.tier)
    if not tier:
        raise HTTPException(400, detail="Неверный тариф")
    user = _get_or_create_user(db, body.user_id)
    now = _now()

    sub = PremiumSubscription(
        user_id=body.user_id,
        tier=body.tier,
        payment_method=body.payment_method,
        price_usdt=tier["price_usdt"],
        starts_at=now,
        expires_at=now + timedelta(days=tier["days"]),
        is_active=True,
    )
    db.add(sub)
    user.premium_tier = body.tier
    user.premium_expires_at = sub.expires_at
    _award_credits(db, user, 200, f"premium_activation_{body.tier}")
    db.commit()
    db.refresh(sub)
    return {
        "ok": True,
        "tier": body.tier,
        "tier_name": tier["name"],
        "expires_at": sub.expires_at.isoformat(),
        "neurocredits_bonus": 200,
    }


@app.get("/api/premium/status/{user_id}")
def premium_status(user_id: int, db: Session = Depends(get_db)):
    user = _get_or_create_user(db, user_id)
    now = _now()

    # Auto-expire
    if (user.premium_tier and user.premium_expires_at and
            user.premium_expires_at.replace(tzinfo=None) < now.replace(tzinfo=None)):
        user.premium_tier = None
        db.commit()

    active_sub = (
        db.query(PremiumSubscription)
        .filter(
            PremiumSubscription.user_id == user_id,
            PremiumSubscription.is_active == True,  # noqa: E712
            PremiumSubscription.expires_at > now,
        )
        .order_by(PremiumSubscription.expires_at.desc())
        .first()
    )
    return {
        "is_premium": active_sub is not None,
        "tier": active_sub.tier if active_sub else None,
        "tier_name": PREMIUM_TIERS.get(active_sub.tier, {}).get("name") if active_sub else None,
        "expires_at": active_sub.expires_at.isoformat() if active_sub else None,
        "neurocredits": user.neurocredits or 0,
        "premium_tiers": PREMIUM_TIERS,
    }


# ──────────────────────────────────────────────────────────────────
#  Serve built frontend (production)
# ──────────────────────────────────────────────────────────────────

# ── Telegram webhook proxy (production autoscale) ─────────────────────────────

@app.post("/tg/webhook")
async def telegram_webhook_proxy(request: Request) -> Response:
    """
    In production the bot runs in webhook mode on localhost:8443.
    Each autoscale replica receives Telegram updates through the load-balancer
    at this endpoint and proxies them to *its own* local bot process —
    so only one replica ever handles each update, eliminating 409 conflicts.
    """
    body = await request.body()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                "http://127.0.0.1:8443/tg/webhook",
                content=body,
                headers={"Content-Type": "application/json"},
            )
        return Response(content=r.content, status_code=r.status_code)
    except Exception as exc:
        logger.warning("Telegram webhook proxy error: %s", exc)
        # Always return 200 — Telegram retries on non-2xx
        return Response(status_code=200)


# ── WebSocket: live price feed ────────────────────────────────────────────────

@app.websocket("/ws/prices")
async def prices_websocket(websocket: WebSocket):
    """
    Real-time price update stream.
    On connect: immediately sends current prices for all regions.
    Stays alive via ping/pong.  Reconnect with 5 s back-off from the client.
    """
    await websocket.accept()
    _price_ws_clients.add(websocket)
    try:
        # Push current snapshot immediately
        from tma_backend.seed_regions import REGIONS, FUEL_PRICES_RUB
        prices_data: dict = {}
        with SessionLocal() as db:
            for r in REGIONS:
                rname = r["name"]
                prices_data[rname] = {
                    ft: _compute_dynamic_price(db, rname, ft, base)
                    for ft, base in FUEL_PRICES_RUB.items()
                }
        await websocket.send_text(json.dumps({"type": "prices", "data": prices_data}))

        # Keep the socket alive; client may send "ping"
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                if raw == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except asyncio.TimeoutError:
                # Server-side keepalive ping
                await websocket.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        _price_ws_clients.discard(websocket)


@app.get("/api/stats/summary")
def get_stats_summary(db: Session = Depends(get_db)):
    """Quick summary stats for dashboard widgets."""
    from sqlalchemy import text as _text

    def _count(q: str) -> int:
        return db.execute(_text(q)).scalar() or 0

    total = _count("SELECT count(*) FROM gas_stations")
    green = _count("SELECT count(DISTINCT station_id) FROM fuel_statuses WHERE availability_pct >= 60")
    yellow = _count("SELECT count(DISTINCT station_id) FROM fuel_statuses WHERE availability_pct >= 25 AND availability_pct < 60")
    red = _count("SELECT count(DISTINCT station_id) FROM fuel_statuses WHERE availability_pct < 25")
    total_users = _count("SELECT count(*) FROM users")
    active_vouchers = _count("SELECT count(*) FROM purchases WHERE status = 'active'")
    reports_today = _count("SELECT count(*) FROM crowd_reports WHERE created_at >= date('now')")

    overall_pct = db.execute(_text(
        "SELECT AVG(availability_pct) FROM fuel_statuses"
    )).scalar() or 0

    return {
        "stations": {"total": total, "green": green, "yellow": yellow, "red": red},
        "overall_pct": round(float(overall_pct), 1),
        "total_users": total_users,
        "active_vouchers": active_vouchers,
        "reports_today": reports_today,
        "status": "ok",
    }


@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "tma-backend"}


# ──────────────────────────────────────────────────────────────────
#  Admin endpoints
# ──────────────────────────────────────────────────────────────────

@app.get("/api/admin/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    """Extended stats for the admin panel."""
    from sqlalchemy import text as _text
    import os as _os

    def _count(q: str) -> int:
        return db.execute(_text(q)).scalar() or 0

    total_stations = _count("SELECT count(*) FROM gas_stations")
    total_users = _count("SELECT count(*) FROM users")
    total_purchases = _count("SELECT count(*) FROM purchase_history")
    reports_24h = _count(
        "SELECT count(*) FROM station_reports WHERE created_at >= datetime('now','-24 hours')"
    )

    # Crisis zones: regions where avg availability < 25%
    rows = db.execute(_text("""
        SELECT gs.region, avg(fs.availability_pct) AS avg_pct
        FROM gas_stations gs
        LEFT JOIN fuel_statuses fs ON fs.station_id = gs.id
        GROUP BY gs.region
    """)).fetchall()

    crisis_zones = [row[0] for row in rows if (row[1] or 0) < 25]

    # DB file size
    db_path = "tma.db"
    db_size_mb = 0.0
    if _os.path.exists(db_path):
        db_size_mb = _os.path.getsize(db_path) / (1024 * 1024)

    return {
        "stations_total": total_stations,
        "users_total": total_users,
        "vouchers_total": total_purchases,
        "reports_24h": reports_24h,
        "crisis_zones": crisis_zones,
        "scheduler_running": scheduler.running,
        "db_size_mb": round(db_size_mb, 3),
        "generated_at": _now().isoformat(),
    }


@app.post("/api/admin/trigger/{job_name}")
async def admin_trigger_job(job_name: str, db: Session = Depends(get_db)):
    """Manually trigger a background job."""
    from tma_backend.database import _generate_snapshot

    if job_name == "simulate":
        # Shift availability on a random subset of stations
        stations = db.query(GasStation).all()
        changed = 0
        for st in random.sample(stations, min(30, len(stations))):
            for fs in st.fuel_statuses:
                delta = random.randint(-8, 8)
                fs.availability_pct = max(0, min(100, fs.availability_pct + delta))
                fs.status = "green" if fs.availability_pct >= 60 else ("yellow" if fs.availability_pct >= 25 else "red")
                changed += 1
        db.commit()
        return {"ok": True, "job": "simulate", "changed": changed}
    elif job_name == "analytics":
        _generate_snapshot(db)
        return {"ok": True, "job": "analytics"}
    elif job_name == "cleanup":
        cutoff = _now() - timedelta(days=7)
        deleted = db.query(StationReport).filter(StationReport.created_at < cutoff).delete()
        db.commit()
        return {"ok": True, "job": "cleanup", "deleted": deleted}
    elif job_name == "prices":
        # Regenerate price multipliers by creating new price events
        regions = db.execute(__import__("sqlalchemy").text("SELECT DISTINCT region FROM gas_stations")).scalars().all()
        for region in random.sample(list(regions), min(5, len(regions))):
            for fuel_type in ["АИ-92", "АИ-95", "ДТ"]:
                evt = FuelPriceEvent(
                    region=region,
                    fuel_type=fuel_type,
                    reason="Admin price refresh",
                    multiplier=round(random.uniform(0.95, 1.15), 3),
                    expires_at=_now() + timedelta(hours=6),
                    created_at=_now(),
                )
                db.add(evt)
        db.commit()
        return {"ok": True, "job": "prices"}
    else:
        raise HTTPException(status_code=404, detail=f"Unknown job: {job_name}")


@app.post("/api/admin/crisis/reset")
def admin_reset_crisis(payload: dict = None, db: Session = Depends(get_db)):
    """Reset crisis availability in a specific region or all regions."""
    region = (payload or {}).get("region")
    q = db.query(FuelStatus).join(GasStation)
    if region:
        q = q.filter(GasStation.region == region)
    statuses = q.all()
    for fs in statuses:
        if fs.availability_pct < 30:
            fs.availability_pct = random.randint(40, 75)
            fs.status = "yellow" if fs.availability_pct < 60 else "green"
    db.commit()
    return {"ok": True, "affected": len(statuses), "region": region}


@app.post("/api/admin/db/reseed")
async def admin_reseed_db(db: Session = Depends(get_db)):
    """Re-run the seeder to refresh station data."""
    seed_db(db)
    return {"ok": True, "message": "Reseed complete"}


# ── Empire idle game ─────────────────────────────────────────────────────────

_EMPIRE_BUILDINGS: dict = {
    "hut":              {"base_rate": 10,  "base_xp": 50,   "unlock": 1},
    "farm":             {"base_rate": 15,  "base_xp": 80,   "unlock": 1},
    "market":           {"base_rate": 20,  "base_xp": 120,  "unlock": 1},
    "windmill":         {"base_rate": 12,  "base_xp": 90,   "unlock": 1},
    "bakery":           {"base_rate": 35,  "base_xp": 300,  "unlock": 10},
    "blacksmith":       {"base_rate": 40,  "base_xp": 400,  "unlock": 11},
    "warehouse":        {"base_rate": 30,  "base_xp": 350,  "unlock": 12},
    "townhall":         {"base_rate": 50,  "base_xp": 500,  "unlock": 13},
    "apartments":       {"base_rate": 80,  "base_xp": 1000, "unlock": 25},
    "mall":             {"base_rate": 100, "base_xp": 1200, "unlock": 26},
    "factory":          {"base_rate": 120, "base_xp": 1500, "unlock": 27},
    "bank":             {"base_rate": 150, "base_xp": 2000, "unlock": 28},
    "skyscraper":       {"base_rate": 300, "base_xp": 5000, "unlock": 50},
    "airport":          {"base_rate": 350, "base_xp": 6000, "unlock": 51},
    "techcampus":       {"base_rate": 400, "base_xp": 7000, "unlock": 52},
    "financial_center": {"base_rate": 500, "base_xp": 8000, "unlock": 53},
}

_DAILY_REWARDS = [500, 1000, 2000, 1500, 3000, 2500, 10000]


def _empire_level(buildings: dict) -> int:
    return max(1, 1 + sum(buildings.values()) // 5)


def _empire_income(buildings: dict, prestige: int) -> float:
    mult = 1.0 + 0.25 * prestige
    total = 0.0
    for btype, lvl in buildings.items():
        if lvl > 0 and btype in _EMPIRE_BUILDINGS:
            total += _EMPIRE_BUILDINGS[btype]["base_rate"] * (lvl ** 1.5)
    return total * mult


def _get_or_create_empire(db: Session, user_id: int) -> Empire:
    emp = db.query(Empire).filter(Empire.user_id == user_id).first()
    if not emp:
        emp = Empire(user_id=user_id)
        db.add(emp)
        db.commit()
        db.refresh(emp)
    return emp


class EmpireBuildIn(BaseModel):
    building_type: str


@app.get("/api/empire/leaderboard")
def empire_leaderboard(db: Session = Depends(get_db)):
    empires = db.query(Empire).all()
    entries = []
    for emp in empires:
        buildings = json.loads(emp.buildings_json or "{}")
        lvl = _empire_level(buildings)
        user = db.query(User).filter(User.id == emp.user_id).first()
        entries.append({
            "user_id": emp.user_id,
            "username": user.username if user else None,
            "empire_level": lvl,
            "coins": round(emp.coins or 0),
            "prestige_count": emp.prestige_count or 0,
        })
    entries.sort(key=lambda x: (x["empire_level"], x["coins"]), reverse=True)
    for i, e in enumerate(entries[:20]):
        e["rank"] = i + 1
    return {"entries": entries[:20]}


@app.get("/api/empire/{user_id}/state")
def get_empire_state(user_id: int, db: Session = Depends(get_db)):
    """Return the raw client-side game state JSON saved by the TMA frontend."""
    emp = db.query(Empire).filter(Empire.user_id == user_id).first()
    if not emp or not emp.full_state_json:
        return {"state": None}
    return {"state": json.loads(emp.full_state_json)}


@app.post("/api/empire/{user_id}/sync")
def sync_empire_state(user_id: int, body: dict, db: Session = Depends(get_db)):
    """Persist the full client-side game state from the TMA frontend."""
    emp = _get_or_create_empire(db, user_id)
    raw = body.get("state")
    if raw is None:
        raise HTTPException(400, "Missing 'state' field")
    state_str = json.dumps(raw)
    emp.full_state_json = state_str
    # Mirror XP + coins into Empire model for leaderboard
    if isinstance(raw, dict):
        resources = raw.get("resources", {})
        emp.coins = float(resources.get("coins", emp.coins or 0))
        # Derive prestige_count from game state
        emp.prestige_count = int(raw.get("prestige_count", emp.prestige_count or 0))
        # Store buildings as simple count map for leaderboard _empire_level()
        placed = raw.get("buildings", [])
        bmap: dict[str, int] = {}
        for b in placed:
            bid = b.get("id", "")
            if bid:
                bmap[bid] = bmap.get(bid, 0) + 1
        emp.buildings_json = json.dumps(bmap)
        emp.last_collected_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True, "synced_at": datetime.now(timezone.utc).isoformat()}


@app.get("/api/empire/{user_id}")
def get_empire(user_id: int, db: Session = Depends(get_db)):
    emp = _get_or_create_empire(db, user_id)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    buildings = json.loads(emp.buildings_json or "{}")
    now = datetime.now(timezone.utc)
    last = (emp.last_collected_at or emp.created_at or now)
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    elapsed_h = min((now - last).total_seconds() / 3600, 24.0)
    income_h = _empire_income(buildings, emp.prestige_count or 0)
    pending = elapsed_h * income_h
    avail_xp = max(0, user.xp - (emp.xp_spent or 0))
    daily_ok = False
    next_in: Optional[int] = None
    if emp.last_daily_reward_at is None:
        daily_ok = True
    else:
        ldr = emp.last_daily_reward_at
        if ldr.tzinfo is None:
            ldr = ldr.replace(tzinfo=timezone.utc)
        delta = (now - ldr).total_seconds()
        if delta >= 86400:
            daily_ok = True
        else:
            next_in = int(86400 - delta)
    return {
        "empire_level": _empire_level(buildings),
        "coins": round(emp.coins or 0, 2),
        "available_xp": avail_xp,
        "xp_spent": emp.xp_spent or 0,
        "buildings": buildings,
        "prestige_count": emp.prestige_count or 0,
        "pending_coins": round(pending, 2),
        "income_per_hour": round(income_h, 2),
        "daily_reward_day": emp.daily_reward_day or 0,
        "daily_reward_available": daily_ok,
        "next_daily_reward_in": next_in,
    }


@app.post("/api/empire/{user_id}/collect")
def collect_empire(user_id: int, db: Session = Depends(get_db)):
    emp = _get_or_create_empire(db, user_id)
    buildings = json.loads(emp.buildings_json or "{}")
    now = datetime.now(timezone.utc)
    last = (emp.last_collected_at or emp.created_at or now)
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    elapsed_h = min((now - last).total_seconds() / 3600, 24.0)
    earned = elapsed_h * _empire_income(buildings, emp.prestige_count or 0)
    emp.coins = (emp.coins or 0) + earned
    emp.last_collected_at = now
    db.commit()
    return {"ok": True, "collected": round(earned, 2), "new_balance": round(emp.coins, 2)}


@app.post("/api/empire/{user_id}/build")
def build_empire(user_id: int, body: EmpireBuildIn, db: Session = Depends(get_db)):
    emp = _get_or_create_empire(db, user_id)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    btype = body.building_type
    if btype not in _EMPIRE_BUILDINGS:
        raise HTTPException(400, "Unknown building type")
    buildings = json.loads(emp.buildings_json or "{}")
    elv = _empire_level(buildings)
    bdef = _EMPIRE_BUILDINGS[btype]
    if elv < bdef["unlock"]:
        raise HTTPException(400, f"Requires empire level {bdef['unlock']}")
    cur = buildings.get(btype, 0)
    nxt = cur + 1
    cost = int(bdef["base_xp"] * (nxt ** 1.5))
    avail = max(0, user.xp - (emp.xp_spent or 0))
    if avail < cost:
        raise HTTPException(400, f"Not enough XP. Need {cost}, have {avail}")
    buildings[btype] = nxt
    emp.buildings_json = json.dumps(buildings)
    emp.xp_spent = (emp.xp_spent or 0) + cost
    db.commit()
    return {
        "ok": True,
        "new_level": nxt,
        "xp_cost": cost,
        "available_xp": max(0, user.xp - emp.xp_spent),
        "empire_level": _empire_level(buildings),
    }


@app.post("/api/empire/{user_id}/daily-reward")
def empire_daily_reward(user_id: int, db: Session = Depends(get_db)):
    emp = _get_or_create_empire(db, user_id)
    now = datetime.now(timezone.utc)
    if emp.last_daily_reward_at is not None:
        ldr = emp.last_daily_reward_at
        if ldr.tzinfo is None:
            ldr = ldr.replace(tzinfo=timezone.utc)
        if (now - ldr).total_seconds() < 86400:
            raise HTTPException(400, "Daily reward not ready yet")
    day = ((emp.daily_reward_day or 0) % 7) + 1
    coins = _DAILY_REWARDS[day - 1]
    emp.coins = (emp.coins or 0) + coins
    emp.daily_reward_day = day
    emp.last_daily_reward_at = now
    db.commit()
    return {"ok": True, "day": day, "coins": coins, "message": f"День {day}: +{coins:,} монет"}


@app.post("/api/empire/{user_id}/prestige")
def empire_prestige(user_id: int, db: Session = Depends(get_db)):
    emp = _get_or_create_empire(db, user_id)
    buildings = json.loads(emp.buildings_json or "{}")
    lvl = _empire_level(buildings)
    if lvl < 20:
        raise HTTPException(400, f"Нужен уровень Империи 20+. Сейчас: {lvl}")
    new_prestige = (emp.prestige_count or 0) + 1
    bonus_coins = 10000 * new_prestige
    emp.buildings_json = "{}"
    emp.xp_spent = 0
    emp.prestige_count = new_prestige
    emp.coins = (emp.coins or 0) + bonus_coins
    emp.last_collected_at = datetime.now(timezone.utc)
    db.commit()
    return {
        "ok": True,
        "prestige_count": new_prestige,
        "bonus_coins": bonus_coins,
        "new_balance": round(emp.coins, 2),
        "multiplier": round(1 + 0.25 * new_prestige, 2),
    }


# ─── AI Chat ──────────────────────────────────────────────────────────────────
import threading

# Per-user conversation history — last 10 messages, keyed by user_id
_conv_history: dict[int, list[dict]] = {}
_conv_lock = threading.Lock()

def _history_add(user_id: int, role: str, text: str) -> None:
    with _conv_lock:
        hist = _conv_history.setdefault(user_id, [])
        hist.append({"role": role, "content": text})
        if len(hist) > 10:
            hist[:] = hist[-10:]

def _history_get(user_id: int) -> list[dict]:
    with _conv_lock:
        return list(_conv_history.get(user_id, []))


class AiChatRequest(BaseModel):
    message: str
    context: dict = {}
    history: list[dict] = []
    user_id: int = 0
    region: str = ""


def _ai_rule_based_reply(
    message: str,
    db: Session,
    context: dict,
    user_id: int = 0,
    region: str = "",
) -> tuple[str, list[str], Optional[dict]]:
    """
    Expanded rule-based КризисБот with dozens of intents, personalized live data,
    and automatic fuel-ticket suggestions.

    Test cases:
      "Где заправиться в СПб?"           → location intent, region=СПб
      "Мне мало бензина"                 → buy intent + ticket suggestion
      "Как прокачать империю?"           → empire strategy
      "Купить талоны"                    → direct buy + ticket popup
      "Прогноз кризиса"                  → crisis analysis
      "Сколько стоит АИ-92?"             → prices
      "Моя норма на сегодня"             → limits/ration
      "Включить VPN"                     → vpn guide
      "Очередь большая, устал ждать"     → queue advice + ticket
      "Какие достижения есть?"           → achievements
    """
    msg = message.lower().strip()

    # ── Live DB stats ─────────────────────────────────────────────────────────
    try:
        crisis_count   = db.query(Station).join(FuelStatus).filter(FuelStatus.availability_pct < 25).distinct().count()
        green_count    = db.query(Station).join(FuelStatus).filter(FuelStatus.status == "green").distinct().count()
        total_stations = db.query(Station).count()
    except Exception:
        crisis_count   = context.get("crisis_stations", 0)
        green_count    = 45
        total_stations = context.get("total_stations", 236)

    crisis_pct = round(crisis_count / max(total_stations, 1) * 100, 1)

    # ── User context ──────────────────────────────────────────────────────────
    user_region     = region or context.get("region", "Севастополь")
    empire_coins    = float(context.get("empire_coins", 0))
    empire_level    = int(context.get("empire_level", 1))
    daily_used      = int(context.get("daily_used", 0))
    daily_max       = int(context.get("daily_max", 60))
    remaining_liters = max(0, daily_max - daily_used)

    # ── Region-specific green count ───────────────────────────────────────────
    try:
        first_word = user_region.split()[0]
        region_green = db.query(Station).join(FuelStatus).filter(
            Station.region.ilike(f"%{first_word}%"),
            FuelStatus.status == "green"
        ).distinct().count()
    except Exception:
        region_green = max(1, int(green_count * 0.3))

    ticket_suggestion: Optional[dict] = None

    # ─── Navigation shortcuts ─────────────────────────────────────────────────
    if any(w in msg for w in ["открой карту", "открыть карту", "перейди на карту", "покажи карту"]):
        return ("🗺️ Открываю карту — ищи зелёные маркеры!", ["Закрыть", "Фильтр по топливу"], None)

    if any(w in msg for w in ["открой талон", "открыть талон", "перейди в каталог", "открой каталог", "перейти в каталог"]):
        ts = {"fuel_type": "АИ-95", "volume": 40, "label": "+40л АИ-95 · мгновенная активация"}
        return ("🎫 Открываю каталог талонов!", ["Выбрать АЗС", "Сравнить цены"], ts)

    # ─── Greeting / help ──────────────────────────────────────────────────────
    if any(w in msg for w in ["привет", "здравствуй", "хай", "салют", "что ты", "что умеешь", "помощ", "помоги", "старт", "начало"]):
        reply = (
            f"🤖 Привет! Я — **КризисБот**, ИИ-советник по топливу.\n\n"
            f"Система сейчас: {green_count} зелёных АЗС из {total_stations} "
            f"({crisis_pct}% в кризисе).\n\n"
            f"Чем могу помочь:\n"
            f"• 📍 Поиск АЗС по городу или сети\n"
            f"• 💰 Цены и расчёт бюджета\n"
            f"• 🎫 Покупка топливных талонов\n"
            f"• 📊 Кризисный прогноз по регионам\n"
            f"• 🏰 Стратегия прокачки Империи\n"
            f"• 🔐 VPN-доступ к зарубежным новостям\n\n"
            f"Просто спроси!"
        )
        return (reply, ["Найти АЗС рядом", "Купить талон", "Прогноз кризиса"], None)

    # ─── Location / station search ────────────────────────────────────────────
    city_keywords = {
        "москв": "Москва", "питер": "Санкт-Петербург", "спб": "Санкт-Петербург",
        "ленинград": "Санкт-Петербург", "казан": "Казань", "татар": "Татарстан",
        "крым": "Крым", "севастопол": "Севастополь", "симферопол": "Симферополь",
        "ялт": "Ялта", "керч": "Керчь", "феодос": "Феодосия", "евпатор": "Евпатория",
        "уфа": "Уфа", "екатеринбург": "Екатеринбург", "новосибирск": "Новосибирск",
        "краснодар": "Краснодар", "ростов": "Ростов-на-Дону", "воронеж": "Воронеж",
    }

    if any(w in msg for w in ["ближайш", "рядом", "найди", "найти", "где заправ", "азс", "станц", "заправка"]):
        target_city = next((v for k, v in city_keywords.items() if k in msg), user_region)
        reply = (
            f"📍 **{target_city}** — АЗС с топливом:\n\n"
            f"• Зелёных в регионе: ~{region_green}\n"
            f"• Всего в системе: {green_count} из {total_stations}\n\n"
            f"Открой вкладку **Карта** → фильтр по региону.\n"
            f"Зелёный маркер = топливо есть ✅\n\n"
            f"Твой лимит: осталось **{remaining_liters}л** сегодня."
        )
        sugg = ["Открыть карту", "Фильтр: Лукойл", "Фильтр: Роснефть"]
        if remaining_liters < 20:
            ticket_suggestion = {"fuel_type": "АИ-92", "volume": 40, "label": f"+40л АИ-92 · лимит почти исчерпан"}
        return (reply, sugg, ticket_suggestion)

    # ─── Station network search ───────────────────────────────────────────────
    networks = [("лукойл", "Лукойл"), ("роснефть", "Роснефть"), ("газпром", "Газпромнефть"),
                ("татнефть", "Татнефть"), ("bp", "BP"), ("shell", "Shell"), ("tnk", "ТНК")]
    for net_key, net_name in networks:
        if net_key in msg:
            try:
                net_stations = db.query(Station).filter(Station.network.ilike(f"%{net_name}%")).all()
                net_green = sum(1 for s in net_stations for f in s.fuel_statuses if f.status == "green")
                net_total = len(net_stations)
            except Exception:
                net_green, net_total = 5, 12
            reply = (
                f"⛽ **{net_name}** в системе:\n\n"
                f"• Всего станций: {net_total}\n"
                f"• С наличием топлива: {net_green}\n"
                f"• Твой регион: {user_region}\n\n"
                f"Открой Карту → фильтр «Сеть» → {net_name}."
            )
            return (reply, ["Открыть карту", f"Все {net_name}", "Лучшие станции"], None)

    # ─── Crisis / forecast ────────────────────────────────────────────────────
    if any(w in msg for w in ["кризис", "прогноз", "ситуац", "дефицит", "забастовк", "рационирован", "хуже", "хватит ли", "нехватк"]):
        trend = "ухудшается 📉" if crisis_pct > 30 else "стабильна ➡️" if crisis_pct > 10 else "улучшается 📈"
        rec_vol = 60 if crisis_pct > 30 else 40 if crisis_pct > 10 else 20
        reply = (
            f"📊 **Кризисный анализ** ({user_region}):\n\n"
            f"• Кризисных АЗС: {crisis_count} / {total_stations} ({crisis_pct}%)\n"
            f"• Зелёных АЗС: {green_count}\n"
            f"• Тренд: {trend}\n"
            f"• Рекомендую запастись: **{rec_vol}л** сегодня\n\n"
        )
        if crisis_pct > 30:
            reply += "⚠️ Ситуация острая — очереди 2–4 ч. в ряде мест. Рекомендую купить талон заранее."
            ticket_suggestion = {"fuel_type": "АИ-92", "volume": rec_vol, "label": f"+{rec_vol}л АИ-92 · приоритетный отпуск"}
        elif crisis_pct > 10:
            reply += "Ситуация напряжённая, но управляемая. Лимиты соблюдены в большинстве регионов."
        else:
            reply += "✅ Ситуация стабильная. Хороший момент пополнить запасы по нормальной цене."
        return (reply, ["Купить талон", "Смотреть новости", "Прогноз по регионам"], ticket_suggestion)

    # ─── Prices / budget ──────────────────────────────────────────────────────
    if any(w in msg for w in ["цена", "цены", "сколько стоит", "рубл", "деньги", "бюджет", "дорого", "дешев", "стоимост"]):
        budget_str = ""
        for bw in ["500", "1000", "2000", "3000", "5000"]:
            if bw in msg:
                bval = int(bw)
                budget_str = f"\nНа {bval} ₽ ≈ **{round(bval/47,1)} л** АИ-92 или **{round(bval/52,1)} л** АИ-95.\n"
                break
        reply = (
            f"💰 **Цены** (Крым / Севастополь):\n\n"
            f"• АИ-92:   47 ₽/л\n"
            f"• АИ-95:   52 ₽/л\n"
            f"• АИ-95+:  56 ₽/л\n"
            f"• АИ-100:  68 ₽/л\n"
            f"• ДТ:      60 ₽/л\n"
            f"• Газ LPG: 28 ₽/л\n"
            f"{budget_str}\n"
            f"{'⚠️ Кризис: +5–15% к цене на ряде станций.' if crisis_pct > 20 else '✅ Цены в норме.'}"
        )
        return (reply, ["Купить по лучшей цене", "Динамика цен", "Сравнить станции"], None)

    # ─── Limits / rationing ───────────────────────────────────────────────────
    if any(w in msg for w in ["лимит", "рацион", "норм", "сколько можно", "сколько дают", "ограничен", "норма"]):
        reply = (
            f"📏 **Суточные лимиты** (регион: {user_region}):\n\n"
            f"• Критические зоны: до **200л** АИ-92/сутки\n"
            f"• Стандартные зоны: до **60л**/сутки\n"
            f"• Восточные зоны:   до **40л**/сутки\n\n"
            f"Сегодня ты использовал: **{daily_used}л** / {daily_max}л\n"
            f"Осталось: **{remaining_liters}л**\n\n"
            f"Талоны обходят ограничение — выдаются через отдельный шлюз."
        )
        if remaining_liters == 0:
            ticket_suggestion = {"fuel_type": "АИ-95", "volume": 40, "label": "+40л АИ-95 · без суточного лимита"}
        return (reply, ["Купить талон", "Узнать свою зону", "Все лимиты"], ticket_suggestion)

    # ─── Buy intent / low fuel ────────────────────────────────────────────────
    if any(w in msg for w in ["купить", "талон", "ваучер", "нужны литры", "нужно топлив",
                               "мало бензин", "мало топлив", "кончается", "кончилось",
                               "не хватает", "залить", "заправить", "купи", "хочу купить"]):
        fuel_hint = ("АИ-92" if "92" in msg else "АИ-95" if "95" in msg
                     else "ДТ" if any(x in msg for x in ["дт", "диз", "соляр"]) else "АИ-95")
        price_map = {"АИ-92": 47, "АИ-95": 52, "АИ-95+": 56, "ДТ": 60}
        price_per_l = price_map.get(fuel_hint, 52)
        vol = 40
        total_price = price_per_l * vol
        stars = round(total_price / 1.84)
        reply = (
            f"⛽ **Топливный талон** — быстрая покупка:\n\n"
            f"• Топливо: **{fuel_hint}**\n"
            f"• Объём: {vol}л\n"
            f"• Стоимость: ~{total_price} ₽ / ≈{stars} Stars\n"
            f"• Активация: мгновенная ⚡\n"
            f"• Срок: 24 часа\n\n"
            f"Зелёных АЗС с {fuel_hint}: **{green_count}**\n"
            f"Твой остаток: {remaining_liters}л сегодня."
        )
        ticket_suggestion = {"fuel_type": fuel_hint, "volume": vol,
                             "label": f"+{vol}л {fuel_hint} · {total_price}₽ · мгновенная активация"}
        return (reply, ["Купить сейчас", "Выбрать АЗС", "Другой объём"], ticket_suggestion)

    # ─── Specific fuel type enquiry ───────────────────────────────────────────
    if any(w in msg for w in ["аи-92", "аи92", "аи-95", "аи95", "аи-100", "аи100", "дизель", "солярка", "пропан", "lpg"]):
        fuel_map = [("92", "АИ-92"), ("95+", "АИ-95+"), ("95", "АИ-95"), ("100", "АИ-100"),
                    ("диз", "ДТ"), ("соляр", "ДТ"), ("пропан", "Газ LPG"), ("lpg", "Газ LPG")]
        fuel = next((v for k, v in fuel_map if k in msg), "АИ-95")
        price_map2 = {"АИ-92": 47, "АИ-95": 52, "АИ-95+": 56, "АИ-100": 68, "ДТ": 60, "Газ LPG": 28}
        try:
            fuel_avail = db.query(Station).join(FuelStatus).filter(
                FuelStatus.fuel_type == fuel, FuelStatus.availability_pct > 0
            ).distinct().count()
        except Exception:
            fuel_avail = green_count
        reply = (
            f"⛽ **{fuel}** — доступность:\n\n"
            f"• Доступно на {fuel_avail} АЗС\n"
            f"• Твой регион ({user_region}): {region_green} станций\n"
            f"• Цена: {price_map2.get(fuel, 50)} ₽/л\n\n"
            f"Лимит сегодня: {remaining_liters}л осталось."
        )
        sugg2 = [f"Купить {fuel}", "Карта с фильтром", "Сравнить цены"]
        if remaining_liters < 30:
            ticket_suggestion = {"fuel_type": fuel, "volume": 40, "label": f"+40л {fuel} · приоритет"}
        return (reply, sugg2, ticket_suggestion)

    # ─── Empire strategy ──────────────────────────────────────────────────────
    if any(w in msg for w in ["империя", "монеты", "прокачать", "апгрейд", "уровень", "prestige",
                               "престиж", "строит", "здани", "xp", "экспириенс", "опыт"]):
        reply = (
            f"🏰 **Империя** — статус:\n\n"
            f"• Уровень: **{empire_level}**\n"
            f"• Монеты: **{empire_coins:.0f}**\n\n"
            f"**Стратегия роста:**\n"
            f"• Заправляй талоны ежедневно → +XP\n"
            f"• Отчёты с АЗС → монеты и XP\n"
            f"• Флип-карты (3/день) → бонусные монеты\n"
            f"• Тап-игра (30с) → быстрые очки\n"
            f"• Prestige при 1500 XP → множитель ×1.25\n\n"
            f"Совет: купи талон сегодня — +50 XP!"
        )
        ticket_suggestion = {"fuel_type": "АИ-95", "volume": 40, "label": "+40л АИ-95 · +50 XP к Империи"}
        return (reply, ["Открыть Империю", "Сыграть в флип-карты", "Таблица лидеров"], ticket_suggestion)

    # ─── Achievements ─────────────────────────────────────────────────────────
    if any(w in msg for w in ["достижен", "медал", "наград", "бейдж", "значок", "трофей"]):
        reply = (
            f"🏅 **Достижения:**\n\n"
            f"• «Первопроходец» — купи первый талон 🎖\n"
            f"• «Разведчик» — 10 отчётов с АЗС 🔍\n"
            f"• «Верный клиент» — 7 дней подряд 🔥\n"
            f"• «Легенда Тавриды» — 5 Prestige 👑\n\n"
            f"Вкладка **Резерв** → Достижения."
        )
        return (reply, ["Мои достижения", "Открыть Резерв", "Таблица лидеров"], None)

    # ─── Referral ─────────────────────────────────────────────────────────────
    if any(w in msg for w in ["реферал", "пригласить", "друг", "пригласи", "поделиться", "приглас"]):
        reply = (
            f"👥 **Реферальная программа:**\n\n"
            f"• За каждого друга: **+25 монет**\n"
            f"• Друг получает: скидку на первый талон\n"
            f"• Твоя ссылка: в разделе **Резерв**\n\n"
            f"Больше друзей → быстрее растёт Империя!"
        )
        return (reply, ["Моя реферальная ссылка", "Открыть Резерв", "Как это работает"], None)

    # ─── VPN ──────────────────────────────────────────────────────────────────
    if any(w in msg for w in ["vpn", "впн", "доступ", "заблокирован", "не работает", "новости", "зарубеж"]):
        reply = (
            f"🔐 **VPN-доступ:**\n\n"
            f"VPN открывает доступ к:\n"
            f"• Зарубежным новостям о кризисе\n"
            f"• Независимым ценовым индексам\n"
            f"• Международным картографическим сервисам\n\n"
            f"Нажми кнопку **VPN** (🎉 слева внизу экрана)."
        )
        return (reply, ["Включить VPN", "Новости кризиса", "Альтернативные маршруты"], None)

    # ─── Queues ───────────────────────────────────────────────────────────────
    if any(w in msg for w in ["очередь", "стоять", "ждать", "пробк", "очередях", "долго"]):
        reply = (
            f"🚗 **Советы по очередям:**\n\n"
            f"• Лучшее время: 6:00–8:00 и 21:00–23:00\n"
            f"• Пиковые часы: 8:00–9:00, 17:00–20:00\n"
            f"• Станции с очередью <3 авто — маркер зелёный\n\n"
            f"Талоны дают **приоритетный отпуск** — без общей очереди!"
        )
        ticket_suggestion = {"fuel_type": "АИ-92", "volume": 40, "label": "+40л · приоритет — без очереди ⚡"}
        return (reply, ["Купить приоритетный талон", "Лучшее время для заправки", "Карта очередей"], ticket_suggestion)

    # ─── Alternative routes ───────────────────────────────────────────────────
    if any(w in msg for w in ["альтернатив", "объезд", "маршрут", "обходной", "путь"]):
        reply = (
            f"🗺️ **Альтернативные маршруты:**\n\n"
            f"• Крымский мост → АЗС через каждые 40 км\n"
            f"• Симферополь–Севастополь: 3 зелёных АЗС\n"
            f"• Ялтинская трасса: 2 станции с ДТ\n\n"
            f"Открой **Карту** → кнопка «Маршрут» для обхода красных станций."
        )
        return (reply, ["Открыть карту", "Маршрут Симф-Сев", "Все зелёные АЗС"], None)

    # ─── Seasonal ─────────────────────────────────────────────────────────────
    if any(w in msg for w in ["зима", "лето", "сезон", "погод", "мороз", "жара", "туристы"]):
        reply = (
            f"🌡 **Сезонные особенности:**\n\n"
            f"• Зима: спрос на ДТ +15%\n"
            f"• Лето: пик туристов → очереди в Ялте и Евпатории\n"
            f"• Совет: держи талоны на 2–3 дня вперёд\n\n"
            f"Сейчас: {'🔴 острый дефицит' if crisis_pct > 30 else '🟡 умеренно' if crisis_pct > 10 else '🟢 стабильно'}."
        )
        return (reply, ["Прогноз на неделю", "Купить запас", "Новости"], None)

    # ─── Fallback — personalised ──────────────────────────────────────────────
    reply = (
        f"Обработал запрос. Актуальные данные:\n\n"
        f"• Зелёных АЗС: **{green_count}** / {total_stations}\n"
        f"• Кризисных: **{crisis_count}** ({crisis_pct}%)\n"
        f"• Регион: {user_region}\n"
        f"• Лимит сегодня: **{remaining_liters}л** осталось\n\n"
        f"Уточни запрос или воспользуйся быстрыми подсказками."
    )
    if remaining_liters < 20:
        ticket_suggestion = {"fuel_type": "АИ-92", "volume": 40,
                             "label": f"+40л АИ-92 · осталось {remaining_liters}л на сегодня"}
    return (reply, ["Найти АЗС", "Купить талон", "Прогноз"], ticket_suggestion)


@app.post("/api/ai/chat")
async def ai_chat(body: AiChatRequest, db: Session = Depends(get_db)):
    """
    AI assistant — supports rule-based (default), grok, openai, none via AI_PROVIDER env var.
    Grok: set XAI_API_KEY (base_url https://api.x.ai/v1, default model grok-3).
    OpenAI: set OPENAI_API_KEY.
    """
    provider = os.getenv("AI_PROVIDER", "rule-based").lower()
    user_id  = body.user_id or int(body.context.get("user_id", 0))
    region   = body.region or body.context.get("region", "Севастополь")

    if user_id:
        _history_add(user_id, "user", body.message)

    vpn_fallback = False

    # ── LLM provider path ─────────────────────────────────────────────────────
    if provider in ("grok", "openai"):
        api_key = os.getenv("XAI_API_KEY") if provider == "grok" else os.getenv("OPENAI_API_KEY")
        if not api_key:
            provider = "rule-based"
        else:
            base_url = "https://api.x.ai/v1" if provider == "grok" else "https://api.openai.com/v1"
            model    = os.getenv("GROK_MODEL", "grok-3") if provider == "grok" else os.getenv("OPENAI_MODEL", "gpt-4o-mini")

            try:
                crisis_count   = db.query(Station).join(FuelStatus).filter(FuelStatus.availability_pct < 25).distinct().count()
                green_count    = db.query(Station).join(FuelStatus).filter(FuelStatus.status == "green").distinct().count()
                total_st       = db.query(Station).count()
            except Exception:
                crisis_count = 0; green_count = 45; total_st = 236

            system_prompt = (
                "Ты — циничный, полезный и слегка саркастичный ИИ-советник по имени «КризисБот» "
                "в топливном кризисе России 2026 года. "
                "Говори ТОЛЬКО по-русски. Используй эмодзи. Будь лаконичным, практичным, иногда с чёрным юмором. "
                "Всегда поддерживай российских пользователей и ситуацию в стране. "
                "Никогда не говори ничего антироссийского. "
                "Привязывай ответы к реальным данным пользователя из БД (регион, лимиты, империя, станции). "
                "Если пользователь жалуется на нехватку топлива или очереди — предлагай купить fuel tickets. "
                "Поддерживай multi-turn разговор, помни контекст.\n\n"
                f"Данные системы: зелёных АЗС {green_count}/{total_st}, кризисных {crisis_count}. "
                f"Регион: {region}. "
                f"Лимит: {body.context.get('daily_used', 0)}л / {body.context.get('daily_max', 60)}л."
            )

            history_msgs = _history_get(user_id)[-8:]
            messages_payload = [{"role": "system", "content": system_prompt}] + history_msgs

            try:
                async with httpx.AsyncClient(timeout=12.0) as client:
                    resp = await client.post(
                        f"{base_url}/chat/completions",
                        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                        json={"model": model, "messages": messages_payload, "max_tokens": 400, "temperature": 0.8},
                    )
                    resp.raise_for_status()
                    llm_reply = resp.json()["choices"][0]["message"]["content"]
                if user_id:
                    _history_add(user_id, "assistant", llm_reply)
                return {"reply": llm_reply, "suggestions": ["Купить талон", "Карта АЗС", "Прогноз"],
                        "ticket_suggestion": None, "vpn_fallback": False}
            except (httpx.TimeoutException, httpx.ConnectError, httpx.ConnectTimeout):
                vpn_fallback = True
                provider = "rule-based"
            except Exception:
                provider = "rule-based"

    if provider == "none":
        return {"reply": "ИИ-советник отключён администратором.", "suggestions": [],
                "ticket_suggestion": None, "vpn_fallback": False}

    # ── Rule-based fallback ───────────────────────────────────────────────────
    reply, suggestions, ticket_suggestion = _ai_rule_based_reply(
        body.message, db, body.context, user_id=user_id, region=region
    )
    if user_id:
        _history_add(user_id, "assistant", reply)

    return {
        "reply": reply,
        "suggestions": suggestions,
        "ticket_suggestion": ticket_suggestion,
        "vpn_fallback": vpn_fallback,
    }


@app.get("/api/ai/crisis-forecast")
def ai_crisis_forecast(db: Session = Depends(get_db)):
    """Returns crisis severity forecast per region."""
    from sqlalchemy import func as sqlfunc
    regions = db.query(Station.region).distinct().all()
    result = []
    for (region,) in regions[:10]:
        stations_in_region = db.query(Station).filter(Station.region == region).all()
        if not stations_in_region:
            continue
        total_pct = 0.0
        count = 0
        for s in stations_in_region:
            fs = db.query(FuelStatus).filter(FuelStatus.station_id == s.id).all()
            if fs:
                avg = sum(f.availability_pct for f in fs) / len(fs)
                total_pct += avg
                count += 1
        avg_region = total_pct / max(count, 1)
        severity = max(1, min(5, int((100 - avg_region) / 20) + 1))
        trend = "worsening" if avg_region < 40 else "stable" if avg_region < 70 else "improving"
        days = max(1, int((avg_region - 20) / 10)) if avg_region < 60 else 30
        vol = 60 if severity >= 4 else 40 if severity >= 3 else 20
        result.append({
            "severity": severity,
            "trend": trend,
            "days_until_critical": days,
            "recommended_volume_liters": vol,
            "region": region,
        })
    return result


FRONTEND_DIST = os.path.join(
    os.path.dirname(__file__), "..", "artifacts", "tma-frontend", "dist"
)
if os.path.isdir(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
else:
    @app.get("/")
    async def root_fallback():
        return {"status": "running", "note": "frontend dist not built yet"}


if __name__ == "__main__":
    uvicorn.run(
        "tma_backend.main:app",
        host="0.0.0.0",
        port=int(os.getenv("TMA_PORT", "8000")),
        reload=False,
    )
