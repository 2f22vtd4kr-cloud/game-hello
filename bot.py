import os
import io
import csv
import re
import logging
import uuid
import sqlite3
import qrcode
import asyncio
import aiohttp
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from telegram import (
    Update, InlineKeyboardButton, InlineKeyboardMarkup,
    KeyboardButton, ReplyKeyboardMarkup, ReplyKeyboardRemove, BotCommand,
    InputFile, WebAppInfo, LabeledPrice,
)
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler,
    ContextTypes, MessageHandler, PreCheckoutQueryHandler, filters
)

load_dotenv()

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

BOT_TOKEN          = os.getenv("TELEGRAM_BOT_TOKEN", "")
# Bot username (without @) used for deep-link generation.
# Set BOT_USERNAME in Replit Secrets or .env to enable ?startapp= links.
BOT_USERNAME       = os.getenv("BOT_USERNAME", "")
ADMIN_PASSWORD     = os.getenv("ADMIN_PASSWORD", "crimea2026")
ADMIN_CHAT_ID      = int(os.getenv("ADMIN_CHAT_ID", "0")) or None   # chat_id администратора
CRYPTO_BOT_TOKEN   = os.getenv("CRYPTO_BOT_TOKEN", "")
CRYPTO_PAY_API     = "https://pay.crypt.bot/api/"
PAID_AMOUNT_USDT   = 12          # фиксированная стоимость ваучера в USDT
USDT_RUB_RATE      = 92          # курс конвертации для отображения суммы в рублях
DB_PATH            = "vouchers.db"
MAP_URL         = "https://fuel.sevtech.org/map"
TMA_URL         = "https://3001-" + os.getenv("REPLIT_DEV_DOMAIN", "localhost")


# ─── Deep-link helpers ────────────────────────────────────────────
# Payload format (matches src/lib/deeplink.ts in the TMA frontend):
#   map             → Map tab (no specific station)
#   map_<id>        → Map tab, station <id> pre-selected
#   catalog_<id>    → Catalog tab, station <id> pre-selected
#   vault           → Vault tab (purchase history)
#   vault_<id>      → Vault tab, purchase <id> highlighted
#   analytics       → Analytics tab
#   reserve         → Reserve (games) tab

def build_start_param(tab: str, entity_id: int | None = None) -> str:
    """Build a Telegram startParam payload string."""
    return f"{tab}_{entity_id}" if entity_id is not None else tab


def tma_deep_link(tab: str, entity_id: int | None = None) -> str:
    """
    Return a ?startapp= deep link that opens the TMA at a specific tab.
    Falls back to the direct TMA URL when BOT_USERNAME is not configured.
    """
    payload = build_start_param(tab, entity_id)
    if BOT_USERNAME:
        return f"https://t.me/{BOT_USERNAME}?startapp={payload}"
    # Fallback: open TMA root — Telegram will show it without pre-navigation
    return TMA_URL


def tma_btn(text: str, tab: str, entity_id: int | None = None) -> "InlineKeyboardButton":
    """Create an InlineKeyboardButton that deep-links into the TMA."""
    return InlineKeyboardButton(text, url=tma_deep_link(tab, entity_id))


DAILY_FREE_LIMIT    = 50   # суточный лимит бесплатных кодов
FREE_COOLDOWN_DAYS  = 7    # дней между бесплатными кодами на один госномер
PAID_COOLDOWN_DAYS  = 7    # дней между платными кодами на один госномер

# Коммерческие цены (только ТЭС)
PAID_PRODUCTS = {
    "95":     {"label": "⚡ Бензин АИ-95 (ТЭС)",    "price": 1500, "station": "TES"},
    "92":     {"label": "🚗 Бензин АИ-92 (ТЭС)",    "price": 1200, "station": "TES"},
    "diesel": {"label": "🚜 Дизельное топливо (ТЭС)", "price":  950, "station": "TES"},
}

FUEL_LABELS    = {"95": "АИ-95", "92": "АИ-92", "diesel": "Дизель"}
STATION_LABELS = {"TES": "ТЭС",  "Atan": "Атан", "VTK": "ВТК"}
FUEL_PREFIX    = {"95": "95",    "92": "92",     "diesel": "DZ"}
STATION_PREFIX = {"TES": "TES",  "Atan": "ATN",  "VTK": "VTK"}

DISTRICTS = ["Гагаринский район", "Ленинский/Нахимовский", "Балаклава/Северная"]

# Допустимые буквы на российских номерах (кириллица + латинские аналоги)
_PL = "АВЕКМНОРСТУХавекмнорстухABEKMHOPCTYXabekmhopctyx"
PLATE_RE = re.compile(rf"^[{_PL}]\d{{3}}[{_PL}]{{2}}\d{{2,3}}$")


# ═══════════════════════════════════════════════════════════════════
#  БАЗА ДАННЫХ
# ═══════════════════════════════════════════════════════════════════

def _conn() -> sqlite3.Connection:
    return sqlite3.connect(DB_PATH)


def init_db() -> None:
    con = _conn()
    cur = con.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS vouchers (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            fuel_type       TEXT NOT NULL,
            station_brand   TEXT NOT NULL DEFAULT 'TES',
            district        TEXT NOT NULL DEFAULT 'Гагаринский район',
            qr_code_payload TEXT NOT NULL UNIQUE,
            status          TEXT NOT NULL DEFAULT 'available',
            voucher_type    TEXT NOT NULL DEFAULT 'free',
            license_plate   TEXT,
            issued_at       TEXT,
            redeemed_at     TEXT
        )
    """)
    # Миграция старой схемы
    for col, definition in [
        ("voucher_type",  "TEXT NOT NULL DEFAULT 'free'"),
        ("license_plate", "TEXT"),
        ("redeemed_at",   "TEXT"),
        ("chat_id",       "INTEGER"),
    ]:
        try:
            cur.execute(f"ALTER TABLE vouchers ADD COLUMN {col} {definition}")
        except sqlite3.OperationalError:
            pass

    cur.execute("""
        CREATE TABLE IF NOT EXISTS pending_payments (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id   TEXT NOT NULL UNIQUE,
            invoice_id INTEGER,
            chat_id    INTEGER NOT NULL,
            plate      TEXT NOT NULL,
            fuel_type  TEXT NOT NULL,
            created_at TEXT NOT NULL,
            pay_url    TEXT
        )
    """)
    # Миграция pending_payments (старая схема без pay_url)
    try:
        cur.execute("ALTER TABLE pending_payments ADD COLUMN pay_url TEXT")
    except sqlite3.OperationalError:
        pass
    existing = cur.execute("SELECT COUNT(*) FROM vouchers").fetchone()[0]
    if existing == 0:
        rows = []
        for fuel in ("95", "92", "diesel"):
            for station in ("TES", "Atan", "VTK"):
                for district in DISTRICTS:
                    for _ in range(10):
                        sp = STATION_PREFIX[station]
                        fp = FUEL_PREFIX[fuel]
                        serial = f"{sp}-{fp}-{uuid.uuid4().hex[:6].upper()}"
                        rows.append((fuel, station, district, serial))
        cur.executemany(
            "INSERT INTO vouchers (fuel_type, station_brand, district, qr_code_payload) VALUES (?,?,?,?)",
            rows
        )
        logger.info(f"БД заполнена: {len(rows)} ваучеров.")
    # New-user tracking for admin notifications
    cur.execute("""
        CREATE TABLE IF NOT EXISTS bot_users (
            chat_id    INTEGER PRIMARY KEY,
            first_seen TEXT NOT NULL
        )
    """)
    con.commit()
    con.close()


def _is_new_user(chat_id: int) -> bool:
    """Returns True if this chat_id has never been seen before."""
    con = _conn()
    row = con.execute("SELECT 1 FROM bot_users WHERE chat_id = ?", (chat_id,)).fetchone()
    con.close()
    return row is None


def _mark_user_seen(chat_id: int) -> None:
    """Record that this user has been seen (idempotent)."""
    con = _conn()
    con.execute(
        "INSERT OR IGNORE INTO bot_users (chat_id, first_seen) VALUES (?, ?)",
        (chat_id, datetime.now(timezone.utc).isoformat()),
    )
    con.commit()
    con.close()


def get_bot_user_count() -> int:
    """Total unique users who have ever started the bot."""
    con = _conn()
    count = con.execute("SELECT COUNT(*) FROM bot_users").fetchone()[0]
    con.close()
    return count


def get_recent_bot_users(limit: int = 10) -> list[dict]:
    """Returns the most recently seen bot users."""
    con = _conn()
    rows = con.execute(
        "SELECT chat_id, first_seen FROM bot_users ORDER BY first_seen DESC LIMIT ?",
        (limit,),
    ).fetchall()
    con.close()
    return [{"chat_id": r[0], "first_seen": r[1]} for r in rows]


def _today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def save_pending_payment(
    order_id: str, invoice_id: int, chat_id: int,
    plate: str, fuel_type: str, pay_url: str = ""
) -> None:
    con = _conn()
    con.execute(
        """INSERT OR IGNORE INTO pending_payments
           (order_id, invoice_id, chat_id, plate, fuel_type, created_at, pay_url)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (order_id, invoice_id, chat_id, plate, fuel_type,
         datetime.now(timezone.utc).isoformat(), pay_url),
    )
    con.commit()
    con.close()


def _n_days_ago_iso(n: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()


def get_user_orders(chat_id: int) -> dict:
    """Возвращает pending-платежи и выданные ваучеры пользователя по chat_id."""
    con = _conn()
    pending_rows = con.execute(
        """SELECT order_id, plate, fuel_type, created_at, pay_url
           FROM pending_payments WHERE chat_id = ?
           ORDER BY created_at DESC""",
        (chat_id,),
    ).fetchall()
    issued_rows = con.execute(
        """SELECT qr_code_payload, fuel_type, station_brand, license_plate,
                  issued_at, voucher_type
           FROM vouchers
           WHERE chat_id = ? AND status = 'issued'
           ORDER BY issued_at DESC LIMIT 20""",
        (chat_id,),
    ).fetchall()
    con.close()
    return {
        "pending": [
            {
                "order_id":   r[0],
                "plate":      r[1],
                "fuel_type":  r[2],
                "created_at": r[3],
                "pay_url":    r[4] or "",
            }
            for r in pending_rows
        ],
        "issued": [
            {
                "payload":    r[0],
                "fuel_type":  r[1],
                "station":    r[2],
                "plate":      r[3],
                "issued_at":  r[4],
                "vtype":      r[5],
            }
            for r in issued_rows
        ],
    }


def pop_expired_pending() -> list[dict]:
    """Возвращает и удаляет из БД просроченные (>30 мин) pending_payments."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    con = _conn()
    rows = con.execute(
        "SELECT order_id, chat_id FROM pending_payments WHERE created_at < ?",
        (cutoff,),
    ).fetchall()
    if rows:
        placeholders = ",".join("?" * len(rows))
        order_ids = [r[0] for r in rows]
        con.execute(
            f"DELETE FROM pending_payments WHERE order_id IN ({placeholders})",
            order_ids,
        )
        con.commit()
    con.close()
    return [{"order_id": r[0], "chat_id": r[1]} for r in rows]


def cancel_pending_payments(chat_id: int) -> list[dict]:
    """Удаляет все pending-платежи пользователя, возвращает invoice_id + plate."""
    con = _conn()
    rows = con.execute(
        "SELECT order_id, invoice_id, plate FROM pending_payments WHERE chat_id = ?",
        (chat_id,),
    ).fetchall()
    if rows:
        placeholders = ",".join("?" * len(rows))
        con.execute(
            f"DELETE FROM pending_payments WHERE order_id IN ({placeholders})",
            [r[0] for r in rows],
        )
        con.commit()
    con.close()
    return [{"order_id": r[0], "invoice_id": r[1], "plate": r[2]} for r in rows]


def get_all_vouchers_export() -> list[dict]:
    """Собирает все ваучеры и активные ожидающие платежи для CSV-выгрузки."""
    con = _conn()
    vouchers = con.execute(
        "SELECT serial, chat_id, license_plate, voucher_type, issued_at, status FROM vouchers ORDER BY issued_at DESC"
    ).fetchall()
    pending = con.execute(
        "SELECT order_id, chat_id, plate, fuel_type, created_at FROM pending_payments ORDER BY created_at DESC"
    ).fetchall()
    con.close()

    rows = []
    for v in vouchers:
        vtype = "Бесплатный" if v[3] == "free" else "Платный 20л"
        rows.append({
            "id":         v[0],
            "chat_id":    v[1] or "",
            "plate":      v[2],
            "type":       vtype,
            "created_at": v[4],
            "status":     v[5],
        })
    for p in pending:
        ftype = "Платный 20л"
        rows.append({
            "id":         p[0],
            "chat_id":    p[1] or "",
            "plate":      p[2],
            "type":       ftype,
            "created_at": p[4],
            "status":     "pending",
        })
    return rows


def issue_any_voucher_sim(plate: str, fuel_type: str, chat_id: int) -> str | None:
    """Выдаёт любой доступный ваучер (для симуляции успешной оплаты в тестах)."""
    con = _conn()
    cur = con.cursor()
    row = cur.execute(
        "SELECT id, qr_code_payload FROM vouchers WHERE status='available' ORDER BY id LIMIT 1"
    ).fetchone()
    if not row:
        con.close()
        return None
    vid, payload = row
    cur.execute(
        "UPDATE vouchers SET status='issued', voucher_type='paid', license_plate=?, issued_at=?, chat_id=? WHERE id=?",
        (plate.upper(), datetime.now(timezone.utc).isoformat(), chat_id, vid),
    )
    con.commit()
    con.close()
    return payload


def cancel_single_pending(order_id: str, chat_id: int) -> dict | None:
    """Удаляет конкретный pending-платёж (проверяет chat_id для защиты от чужих)."""
    con = _conn()
    row = con.execute(
        "SELECT invoice_id, plate, fuel_type FROM pending_payments WHERE order_id = ? AND chat_id = ?",
        (order_id, chat_id),
    ).fetchone()
    if row:
        con.execute("DELETE FROM pending_payments WHERE order_id = ?", (order_id,))
        con.commit()
    con.close()
    return {"invoice_id": row[0], "plate": row[1], "fuel_type": row[2]} if row else None


async def notify_admin(bot, text: str) -> None:
    """Отправляет push-уведомление администратору (ADMIN_CHAT_ID)."""
    if not ADMIN_CHAT_ID:
        return
    try:
        await bot.send_message(chat_id=ADMIN_CHAT_ID, text=text, parse_mode="Markdown")
    except Exception as exc:
        logger.warning(f"notify_admin failed: {exc}")


async def _delete_cryptopay_invoice(invoice_id: int) -> bool:
    """Аннулирует инвойс в CryptoBot через deleteInvoice API."""
    try:
        async with aiohttp.ClientSession() as session:
            resp = await session.post(
                f"{CRYPTO_PAY_API}deleteInvoice",
                headers={"Crypto-Pay-API-Token": CRYPTO_BOT_TOKEN},
                json={"invoice_id": invoice_id},
            )
            result = await resp.json()
            return bool(result.get("ok"))
    except Exception as exc:
        logger.warning(f"deleteInvoice error (invoice_id={invoice_id}): {exc}")
        return False


async def _invoice_cleanup_loop(bot) -> None:
    """Фоновый цикл: каждые 2 минуты чистит просроченные инвойсы."""
    while True:
        await asyncio.sleep(120)
        try:
            expired = pop_expired_pending()
            for rec in expired:
                try:
                    await bot.send_message(
                        chat_id=rec["chat_id"],
                        text=(
                            "⚠️ Срок действия вашего счёта на дополнительный объём (20 л) истёк.\n\n"
                            "Если покупка всё ещё актуальна — оформите заказ заново через меню."
                        ),
                    )
                    logger.info(f"Expired invoice notice sent to chat_id={rec['chat_id']}")
                except Exception as e:
                    logger.warning(f"Failed to notify chat_id={rec['chat_id']}: {e}")
        except Exception as e:
            logger.error(f"Invoice cleanup loop error: {e}")


# ─ Суточный лимит бесплатных кодов ─────────────────────────────────

def free_issued_today() -> int:
    con = _conn()
    n = con.execute(
        "SELECT COUNT(*) FROM vouchers WHERE voucher_type='free' AND issued_at LIKE ?",
        (f"{_today_str()}%",)
    ).fetchone()[0]
    con.close()
    return n


# ─ 7-дневный кулдаун по госномеру ───────────────────────────────────

def plate_cooldown_active(plate: str, vtype: str, days: int) -> bool:
    """True если госномер уже получал ваучер vtype в последние `days` дней."""
    since = _n_days_ago_iso(days)
    con = _conn()
    n = con.execute(
        """SELECT COUNT(*) FROM vouchers
           WHERE license_plate=? AND voucher_type=? AND issued_at >= ?""",
        (plate.upper(), vtype, since)
    ).fetchone()[0]
    con.close()
    return n > 0


# ─ Выдача ваучеров ──────────────────────────────────────────────────

def issue_free_voucher(plate: str, chat_id: int = 0) -> str | None:
    """Берёт любой доступный ваучер и маркирует как бесплатный."""
    con = _conn()
    cur = con.cursor()
    row = cur.execute(
        "SELECT id, qr_code_payload FROM vouchers WHERE status='available' ORDER BY id LIMIT 1"
    ).fetchone()
    if not row:
        con.close()
        return None
    vid, payload = row
    cur.execute(
        "UPDATE vouchers SET status='issued', voucher_type='free', license_plate=?, issued_at=?, chat_id=? WHERE id=?",
        (plate.upper(), datetime.now(timezone.utc).isoformat(), chat_id, vid)
    )
    con.commit()
    con.close()
    return payload


def issue_paid_voucher(plate: str, fuel_type: str, station: str) -> str | None:
    """Берёт ваучер под нужный тип топлива/АЗС и маркирует как платный."""
    con = _conn()
    cur = con.cursor()
    row = cur.execute(
        """SELECT id, qr_code_payload FROM vouchers
           WHERE status='available' AND fuel_type=? AND station_brand=?
           ORDER BY id LIMIT 1""",
        (fuel_type, station)
    ).fetchone()
    if not row:
        con.close()
        return None
    vid, payload = row
    cur.execute(
        "UPDATE vouchers SET status='issued', voucher_type='paid', license_plate=?, issued_at=? WHERE id=?",
        (plate.upper(), datetime.now(timezone.utc).isoformat(), vid)
    )
    con.commit()
    con.close()
    return payload


# ─ Поиск / гашение (для контролёра) ────────────────────────────────

def lookup_voucher(serial: str) -> dict | None:
    con = _conn()
    row = con.execute(
        """SELECT fuel_type, station_brand, district, status,
                  voucher_type, license_plate, issued_at, redeemed_at
           FROM vouchers WHERE qr_code_payload=?""",
        (serial.upper(),)
    ).fetchone()
    con.close()
    if not row:
        return None
    return {
        "fuel_type":     row[0], "station_brand": row[1],
        "district":      row[2], "status":        row[3],
        "voucher_type":  row[4], "license_plate": row[5],
        "issued_at":     row[6], "redeemed_at":   row[7],
    }


def get_stats() -> dict:
    """Агрегированная статистика из БД для команды /stats."""
    today = _today_str()
    con = _conn()
    cur = con.cursor()

    # Общие итоги
    total_issued   = cur.execute("SELECT COUNT(*) FROM vouchers WHERE status != 'available'").fetchone()[0]
    total_redeemed = cur.execute("SELECT COUNT(*) FROM vouchers WHERE status = 'redeemed'").fetchone()[0]
    total_available = cur.execute("SELECT COUNT(*) FROM vouchers WHERE status = 'available'").fetchone()[0]

    # За сегодня
    free_today = cur.execute(
        "SELECT COUNT(*) FROM vouchers WHERE voucher_type='free' AND issued_at LIKE ?",
        (f"{today}%",)
    ).fetchone()[0]
    paid_today = cur.execute(
        "SELECT COUNT(*) FROM vouchers WHERE voucher_type='paid' AND issued_at LIKE ?",
        (f"{today}%",)
    ).fetchone()[0]
    redeemed_today = cur.execute(
        "SELECT COUNT(*) FROM vouchers WHERE status='redeemed' AND redeemed_at LIKE ?",
        (f"{today}%",)
    ).fetchone()[0]

    # Разбивка по типу топлива (всего выданных)
    fuel_rows = cur.execute(
        "SELECT fuel_type, COUNT(*) FROM vouchers WHERE status != 'available' GROUP BY fuel_type"
    ).fetchall()
    fuel_stats = {row[0]: row[1] for row in fuel_rows}

    # Разбивка по типу топлива за сегодня
    fuel_today_rows = cur.execute(
        "SELECT fuel_type, COUNT(*) FROM vouchers WHERE status != 'available' AND issued_at LIKE ? GROUP BY fuel_type",
        (f"{today}%",)
    ).fetchall()
    fuel_today = {row[0]: row[1] for row in fuel_today_rows}

    # Дополнительные агрегаты для расширенной статистики
    free_all = cur.execute(
        "SELECT COUNT(*) FROM vouchers WHERE voucher_type='free' AND status != 'available'"
    ).fetchone()[0]
    paid_all = cur.execute(
        "SELECT COUNT(*) FROM vouchers WHERE voucher_type='paid' AND status != 'available'"
    ).fetchone()[0]
    total_users = cur.execute(
        "SELECT COUNT(DISTINCT chat_id) FROM vouchers WHERE chat_id IS NOT NULL AND chat_id != 0"
    ).fetchone()[0]
    pending_count = cur.execute("SELECT COUNT(*) FROM pending_payments").fetchone()[0]

    con.close()

    free_remaining = max(0, DAILY_FREE_LIMIT - free_today)
    revenue_rub = paid_all * PAID_AMOUNT_USDT * USDT_RUB_RATE

    return {
        "total_issued":    total_issued,
        "total_redeemed":  total_redeemed,
        "total_available": total_available,
        "free_all":        free_all,
        "paid_all":        paid_all,
        "free_today":      free_today,
        "paid_today":      paid_today,
        "redeemed_today":  redeemed_today,
        "fuel_stats":      fuel_stats,
        "fuel_today":      fuel_today,
        "free_remaining":  free_remaining,
        "daily_limit":     DAILY_FREE_LIMIT,
        "today":           today,
        "total_users":     total_users,
        "pending_count":   pending_count,
        "revenue_rub":     revenue_rub,
    }


def redeem_voucher(serial: str) -> str:
    """ok / already / not_found"""
    con = _conn()
    cur = con.cursor()
    row = cur.execute("SELECT status FROM vouchers WHERE qr_code_payload=?", (serial.upper(),)).fetchone()
    if not row:
        con.close()
        return "not_found"
    if row[0] == "redeemed":
        con.close()
        return "already"
    cur.execute(
        "UPDATE vouchers SET status='redeemed', redeemed_at=? WHERE qr_code_payload=?",
        (datetime.now(timezone.utc).isoformat(), serial.upper())
    )
    con.commit()
    con.close()
    return "ok"


# ═══════════════════════════════════════════════════════════════════
#  УТИЛИТЫ
# ═══════════════════════════════════════════════════════════════════

def make_qr(data: str) -> io.BytesIO:
    qr = qrcode.QRCode(version=2, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=4)
    qr.add_data(data)
    qr.make(fit=True)
    buf = io.BytesIO()
    qr.make_image(fill_color="black", back_color="white").save(buf, format="PNG")
    buf.seek(0)
    return buf


def fmt_dt(iso: str | None) -> str:
    if not iso:
        return "—"
    return iso[:19].replace("T", " ")


def main_menu_markup() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🗺️⛽ Топливный Узел — Матрица Снабжения", web_app=WebAppInfo(url=TMA_URL))],
        [InlineKeyboardButton("📂 Получить бесплатный QR-код (Лимит 20л)", callback_data="free_quota")],
        [InlineKeyboardButton("⚡ Заказать дополнительный объем (Платная доза)", callback_data="paid_quota")],
        [InlineKeyboardButton("📜 Актуальные правила и сводки Правительства", callback_data="rules")],
        [InlineKeyboardButton("🗺️ Карта остатков АЗС (fuel.sevtech.org)", url=MAP_URL)],
    ])


def admin_menu_markup() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📊 Статистика системы",          callback_data="admin_stats")],
        [InlineKeyboardButton("👥 Активность пользователей",    callback_data="admin_users")],
        [InlineKeyboardButton("🔍 Проверить статус ваучера",    callback_data="admin_check")],
        [InlineKeyboardButton("🚫 Погасить ваучер",             callback_data="admin_redeem")],
        [InlineKeyboardButton("📤 Экспорт в CSV",               callback_data="admin_export")],
        [InlineKeyboardButton("🚪 Выйти из режима контролёра",  callback_data="admin_exit")],
    ])


# ═══════════════════════════════════════════════════════════════════
#  ОБРАБОТЧИКИ КОМАНД
# ═══════════════════════════════════════════════════════════════════

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    context.user_data.clear()
    user = update.effective_user
    # Notify admin when a new user starts the bot for the first time
    if user and ADMIN_CHAT_ID and user.id != ADMIN_CHAT_ID:
        is_new = _is_new_user(user.id)
        if is_new:
            _mark_user_seen(user.id)
            uname = f"@{user.username}" if user.username else f"#{user.id}"
            fname = user.full_name or ""
            asyncio.create_task(notify_admin(
                context.bot,
                f"👤 *Новый пользователь*\n"
                f"Имя: {fname}\n"
                f"Логин: {uname}\n"
                f"ID: `{user.id}`",
            ))
    await update.message.reply_text(
        "🏛 *Система государственного учёта и распределения ГСМ*\n"
        "_Департамент цифрового развития города Севастополя_\n\n"
        "─────────────────────────────────\n"
        "Уважаемые граждане!\n\n"
        "Настоящий цифровой комплекс является официальным расчётно-учётным каналом, "
        "развёрнутым в целях обеспечения бесперебойного распределения целевых объёмов ГСМ "
        "и минимизации критической нагрузки на серверную инфраструктуру в г. Севастополь.\n\n"
        "Данный сервис предназначен для приоритетного обслуживания пользователей, у которых "
        "не установлен, временно недоступен или функционирует со сбоями специализированный "
        "мессенджер *«Макс»*.\n\n"
        "Для верификации вашего транспортного средства и последующего формирования ваучера "
        "на ГСМ (20 литров) в рамках установленных регламентных лимитов, пожалуйста, "
        "воспользуйтесь разделом меню ниже.\n"
        "─────────────────────────────────",
        parse_mode="Markdown",
        reply_markup=main_menu_markup()
    )


async def admin_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    context.user_data.clear()
    context.user_data["waiting_admin_password"] = True
    await update.message.reply_text(
        "🔐 *Режим контролёра АЗС*\n\nВведите пароль администратора:",
        parse_mode="Markdown",
        reply_markup=ReplyKeyboardRemove()
    )


def _build_stats_text() -> str:
    """Формирует текст статистики из БД."""
    s = get_stats()
    fuel_label = {"95": "АИ-95", "92": "АИ-92", "diesel": "Дизель"}

    def _fuel_line(mapping: dict) -> str:
        return "\n".join(
            f"   • {label}: {mapping.get(code, 0)} шт."
            for code, label in fuel_label.items()
        )

    filled = round(s["free_today"] / s["daily_limit"] * 10)
    bar = "🟩" * filled + "⬜" * (10 - filled)
    pct = round(s["free_today"] / s["daily_limit"] * 100)

    return (
        f"📊 *Статистика системы — {s['today']}*\n"
        f"_Департамент цифрового развития Севастополя_\n\n"

        f"━━━ 👥 ПОЛЬЗОВАТЕЛИ ━━━\n"
        f"👤 Уникальных пользователей в системе: *{s['total_users']}*\n"
        f"⏳ Активных счетов (ожидают оплаты): *{s['pending_count']}*\n\n"

        f"━━━ 🆓 БЕСПЛАТНЫЕ ВАУЧЕРЫ ━━━\n"
        f"📆 За всё время: *{s['free_all']}*\n"
        f"📅 За сегодня: *{s['free_today']}* из *{s['daily_limit']}*\n"
        f"{bar} {pct}%  (осталось: *{s['free_remaining']} шт.*)\n\n"

        f"━━━ 💰 ПЛАТНЫЕ ВАУЧЕРЫ ━━━\n"
        f"📆 За всё время: *{s['paid_all']}*\n"
        f"📅 За сегодня: *{s['paid_today']}*\n"
        f"💵 Сумма сборов (расч.): *{s['paid_all'] * PAID_AMOUNT_USDT} USDT "
        f"≈ {s['revenue_rub']:,} ₽*\n\n"

        f"━━━ 🗂 ОБЩИЕ ИТОГИ ━━━\n"
        f"📤 Всего выдано: *{s['total_issued']}*\n"
        f"✅ Погашено на АЗС: *{s['total_redeemed']}*\n"
        f"🗃 Остаток в базе данных: *{s['total_available']}*\n"
        f"🚫 Погашено сегодня: *{s['redeemed_today']}*\n\n"

        f"━━━ ⛽ РАЗБИВКА ПО ТОПЛИВУ (всего) ━━━\n"
        f"{_fuel_line(s['fuel_stats'])}\n\n"

        f"━━━ ⛽ РАЗБИВКА ПО ТОПЛИВУ (сегодня) ━━━\n"
        f"{_fuel_line(s['fuel_today'])}\n\n"

        f"━━━ 📈 СТАТУС ПЛАТЁЖНОЙ СИСТЕМЫ ━━━\n"
        f"📈 Прямой приём оплат в USDT через Crypto Pay API без задержек"
    )


def _stats_markup() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🔁 Обновить статистику", callback_data="stats_refresh")],
        [InlineKeyboardButton("◀️ Меню контролёра",     callback_data="admin_menu")],
    ])


async def cancel_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_user.id
    cancelled = cancel_pending_payments(chat_id)

    if not cancelled:
        await update.message.reply_text(
            "❌ У вас нет активных заказов, ожидающих оплаты.",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("🏠 Главное меню", callback_data="main_menu")
            ]]),
        )
        return

    for rec in cancelled:
        if rec["invoice_id"]:
            await _delete_cryptopay_invoice(rec["invoice_id"])

    plates = ", ".join({r["plate"] for r in cancelled})
    await update.message.reply_text(
        f"✅ *Ваш заказ успешно отменён.*\n\n"
        f"🚗 Госномер: `{plates}`\n\n"
        "Недельный лимит освобождён — вы можете оформить новый заказ при необходимости.",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("🏠 Главное меню", callback_data="main_menu")
        ]]),
    )


async def myorders_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_user.id
    orders = get_user_orders(chat_id)

    if not orders["pending"] and not orders["issued"]:
        await update.message.reply_text(
            "📭 У вас пока нет оформленных заказов или ваучеров.",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("🏠 Главное меню", callback_data="main_menu")
            ]]),
        )
        return

    lines: list[str] = ["📋 *Ваши заказы и ваучеры:*\n"]
    buttons: list[list[InlineKeyboardButton]] = []
    idx = 0

    for p in orders["pending"]:
        idx += 1
        fuel = FUEL_LABELS.get(p["fuel_type"], p["fuel_type"])
        lines.append(
            f"*{idx}. ⏳ Ожидает оплаты*\n"
            f"   🚗 Госномер: `{p['plate']}`\n"
            f"   ⛽ {fuel}, 20 л\n"
            f"   ⏱ Действует 30 мин с момента создания\n"
        )
        row_btns: list[InlineKeyboardButton] = []
        if p["pay_url"]:
            row_btns.append(InlineKeyboardButton(
                f"💳 Оплатить (заказ {idx})", url=p["pay_url"]
            ))
        row_btns.append(InlineKeyboardButton(
            f"❌ Отменить (заказ {idx})",
            callback_data=f"cancel_order_{p['order_id']}",
        ))
        buttons.append(row_btns)

    for v in orders["issued"]:
        idx += 1
        fuel = FUEL_LABELS.get(v["fuel_type"], v["fuel_type"])
        vtype_label = "🆓 Бесплатный" if v["vtype"] == "free" else "💰 Платный"
        date_str = (v["issued_at"] or "")[:10] or "—"
        lines.append(
            f"*{idx}. ✅ Ваучер выдан ({vtype_label})*\n"
            f"   🚗 Госномер: `{v['plate']}`\n"
            f"   ⛽ {fuel}, 20 л\n"
            f"   📅 Выдан: {date_str}\n"
        )
        buttons.append([
            InlineKeyboardButton(
                f"📷 Показать QR (заказ {idx})",
                callback_data=f"show_qr_{v['payload']}",
            ),
            tma_btn("🗄️ Сейф", "vault"),
        ])

    buttons.append([InlineKeyboardButton("🏠 Главное меню", callback_data="main_menu")])

    await update.message.reply_text(
        "\n".join(lines),
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(buttons),
    )


async def stats_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not context.user_data.get("admin_authenticated"):
        await update.message.reply_text(
            "🔒 Доступ запрещён. Сначала авторизуйтесь через /admin"
        )
        return

    await update.message.reply_text(
        _build_stats_text(), parse_mode="Markdown", reply_markup=_stats_markup()
    )


async def rules_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        "📜 *Актуальные правила и сводки Правительства Севастополя:*\n\n"
        "• Заправка частных лиц осуществляется только на АЗС «ТЭС» с *09:00 до 21:00*.\n\n"
        "• С 06:00 до 09:00 заправляются исключительно *городские службы* (скорая, транспорт, ЖКХ).\n\n"
        "• Заливать топливо в канистры *МОЖНО*, но только при предъявлении оригинала СТС, "
        "номер в котором совпадает с QR-кодом.\n\n"
        "• Полученный код действует до момента гашения, в том числе *на следующий день*.\n\n"
        "• Один автомобиль может получить *один бесплатный код каждые 7 дней*.\n\n"
        "• Один автомобиль может приобрести *один платный ваучер в неделю* (20 л).\n\n"
        f"🗺️ Карта остатков: {MAP_URL}"
    )
    await update.message.reply_text(
        text, parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("🏠 Главное меню", callback_data="main_menu")
        ]])
    )


async def map_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "🗺️ *Карта остатков топлива на АЗС Севастополя*\n\n"
        "Интерактивная карта с 236 АЗС — наличие топлива, очереди, "
        "аналитика и возможность отметить актуальные остатки.\n\n"
        "Откройте Матрицу Снабжения, чтобы увидеть карту в реальном времени:",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(
                "🗺️⛽ Открыть Матрицу Снабжения",
                web_app=WebAppInfo(url=TMA_URL),
            )],
            [tma_btn("🗺️ Карта АЗС (глубокая ссылка)", "map")],
            [InlineKeyboardButton("🏠 Главное меню", callback_data="main_menu")],
        ])
    )


async def subscriptions_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """List the user's active station subscriptions and allow unsubscribing."""
    chat_id = update.effective_user.id

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{TMA_URL}/api/subscriptions/{chat_id}",
                timeout=aiohttp.ClientTimeout(total=8),
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    subs = data.get("subscriptions", [])
                else:
                    subs = []
    except Exception:
        subs = []

    if not subs:
        await update.message.reply_text(
            "🔕 У вас нет активных подписок на АЗС.\n\n"
            "Откройте *Матрицу Снабжения*, найдите нужную АЗС на карте и нажмите 🔔 "
            "чтобы получать мгновенные уведомления о появлении топлива.",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton(
                    "⛽ Открыть Матрицу", web_app=WebAppInfo(url=TMA_URL)
                )
            ]]),
        )
        return

    lines = ["🔔 *Ваши подписки на АЗС:*\n"]
    buttons: list[list[InlineKeyboardButton]] = []

    for sub in subs:
        fuel_part = f" · {sub['fuel_type']}" if sub.get("fuel_type") else " · Все виды топлива"
        lines.append(
            f"• *{sub['station_name']}*\n"
            f"  📍 {sub['station_region']}{fuel_part}\n"
        )
        buttons.append([InlineKeyboardButton(
            f"🔕 Отписаться: {sub['station_name'][:28]}",
            callback_data=f"unsub_{sub['id']}_{chat_id}",
        )])

    buttons.append([InlineKeyboardButton(
        "⛽ Открыть Матрицу", web_app=WebAppInfo(url=TMA_URL)
    )])
    buttons.append([InlineKeyboardButton("🏠 Главное меню", callback_data="main_menu")])

    await update.message.reply_text(
        "\n".join(lines),
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(buttons),
    )


async def tma_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Open the Telegram Mini App directly — optionally at a specific tab."""
    args = context.args  # e.g. /tma reserve  or  /tma vault
    tab_map = {
        "карта": "map", "map": "map",
        "аналитика": "analytics", "analytics": "analytics",
        "каталог": "catalog", "catalog": "catalog",
        "сейф": "vault", "vault": "vault",
        "игры": "reserve", "reserve": "reserve",
    }
    tab = "map"
    if args:
        tab = tab_map.get(args[0].lower(), "map")

    tab_names = {
        "map": "🗺️ Карта АЗС",
        "analytics": "📊 Аналитика",
        "catalog": "🛒 Каталог топлива",
        "vault": "🗄️ Мой Сейф",
        "reserve": "🎮 Игры & Резерв",
    }
    tab_label = tab_names.get(tab, "Матрица Снабжения")

    await update.message.reply_text(
        f"⛽ *Топливный Узел — Матрица Снабжения*\n\n"
        f"Переход: *{tab_label}*\n\n"
        "Интерактивная карта 236 АЗС, аналитика поставок, каталог топлива, "
        "ваучеры и игровые механики — всё в одном приложении.",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(
                "⛽ Открыть Матрицу",
                web_app=WebAppInfo(url=TMA_URL),
            )],
            [tma_btn(f"🔗 Перейти: {tab_label}", tab)],
            [InlineKeyboardButton("🏠 Главное меню", callback_data="main_menu")],
        ]),
    )


# ═══════════════════════════════════════════════════════════════════
#  РОУТЕР INLINE-КНОПОК
# ═══════════════════════════════════════════════════════════════════

async def menu_navigation(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    data = query.data

    # ── Главное меню ──────────────────────────────────────────────
    if data == "main_menu":
        context.user_data.clear()
        await query.edit_message_text(
            "🏛 *Система государственного учёта и распределения топлива*\n"
            "_Департамент цифрового развития Севастополя_\n\n"
            "Выберите действие:",
            parse_mode="Markdown",
            reply_markup=main_menu_markup()
        )

    # ── Правила ───────────────────────────────────────────────────
    elif data == "rules":
        text = (
            "📜 *Актуальные правила и сводки Правительства Севастополя:*\n\n"
            "• Заправка частных лиц осуществляется только на АЗС «ТЭС» с *09:00 до 21:00*.\n\n"
            "• С 06:00 до 09:00 заправляются исключительно *городские службы* (скорая, транспорт, ЖКХ).\n\n"
            "• Заливать топливо в канистры *МОЖНО*, но только при предъявлении оригинала СТС, "
            "номер в котором совпадает с QR-кодом.\n\n"
            "• Полученный код действует до момента гашения, в том числе *на следующий день*.\n\n"
            "• Один автомобиль может получить *один бесплатный код каждые 7 дней*.\n\n"
            "• Один автомобиль может приобрести *один платный ваучер в неделю* (20 л).\n\n"
            f"🗺️ Карта остатков: {MAP_URL}"
        )
        await query.edit_message_text(
            text, parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("⬅️ Главное меню", callback_data="main_menu")
            ]])
        )

    # ── Бесплатный QR-код ─────────────────────────────────────────
    elif data == "free_quota":
        issued_today = free_issued_today()
        if issued_today >= DAILY_FREE_LIMIT:
            await query.edit_message_text(
                "⚠️ *На сегодня QR-коды закончились.*\n\n"
                "Новая партия будет доступна завтра после *22:00*.\n"
                "Количество кодов соответствует официальным нормам поставки топлива "
                "в Севастополь согласно Указу Губернатора.\n\n"
                "Следите за обновлениями на официальном сайте Правительства Севастополя.",
                parse_mode="Markdown",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("⬅️ Главное меню", callback_data="main_menu")
                ]])
            )
            return
        context.user_data["waiting_plate"] = "free"
        await query.edit_message_text(
            "📂 *Получение бесплатного QR-кода (Государственная квота)*\n\n"
            "Введите *госномер автомобиля* (например: А123ВС777):\n\n"
            "⚠️ Контролёр на АЗС ТЭС будет сверять код с номером машины "
            "или оригиналом СТС!",
            parse_mode="Markdown"
        )

    # ── Платный ваучер ────────────────────────────────────────────
    elif data == "paid_quota":
        await query.edit_message_text(
            "⚡ *Внимание! Важная информация о дополнительных объёмах:*\n\n"
            "1. Вы приобретаете *электронный ВАУЧЕР (право на покупку)*, а не само физическое "
            "топливо. Оплата топлива по тарифу АЗС производится непосредственно на кассе "
            "заправки «ТЭС» после гашения QR-кода контролёром.\n\n"
            "2. Количество доступных коммерческих ваучеров в системе *строго ограничено "
            "суточными лимитами поставок* в Севастополь.\n\n"
            "3. Действует жёсткое антикризисное ограничение: *не более 1 дополнительного "
            "ваучера (20 литров) в неделю на один госномер автомобиля*.\n\n"
            "Введите *госномер автомобиля* для проверки недельного лимита:",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("❌ Отмена", callback_data="main_menu")
            ]])
        )
        context.user_data["waiting_plate"] = "paid"

    # ── Выбор вида топлива (платный) ──────────────────────────────
    elif data == "paid_fuel_select":
        plate = context.user_data.get("pending_plate", "")
        await query.edit_message_text(
            f"⚡ *Выберите вид топлива*\n\n🚗 Госномер: `{plate}`",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton(f"{v['label']} — {v['price']} руб.", callback_data=f"paid_buy_{k}")]
                for k, v in PAID_PRODUCTS.items()
            ] + [[InlineKeyboardButton("⬅️ Главное меню", callback_data="main_menu")]])
        )

    # ── Создание реального инвойса Crypto Pay ─────────────────────
    elif data.startswith("paid_buy_"):
        fuel_type = data.split("_")[2]
        product   = PAID_PRODUCTS[fuel_type]
        plate     = context.user_data.get("pending_plate", "")
        context.user_data["paid_fuel_type"] = fuel_type

        await query.edit_message_text("⏳ Создаю счёт на оплату...")

        order_id = uuid.uuid4().hex
        try:
            async with aiohttp.ClientSession() as session:
                resp = await session.post(
                    f"{CRYPTO_PAY_API}createInvoice",
                    headers={"Crypto-Pay-API-Token": CRYPTO_BOT_TOKEN},
                    json={
                        "asset": "USDT",
                        "amount": str(PAID_AMOUNT_USDT),
                        "payload": order_id,
                        "description": "Оплата дополнительного ваучера на 20 литров топлива",
                        "expires_in": 1800,
                    },
                )
                api_result = await resp.json()
        except Exception as exc:
            logger.error(f"CryptoPay createInvoice error: {exc}")
            await query.edit_message_text(
                "⚠️ Ошибка платёжного сервиса. Попробуйте позже.",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("⬅️ Главное меню", callback_data="main_menu")
                ]])
            )
            return

        if not api_result.get("ok"):
            err_msg = api_result.get("error", {}).get("name", "неизвестная ошибка")
            logger.error(f"CryptoPay API error: {err_msg}")
            await query.edit_message_text(
                f"⚠️ Платёжный сервис недоступен: {err_msg}. Попробуйте позже.",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("⬅️ Главное меню", callback_data="main_menu")
                ]])
            )
            return

        invoice    = api_result["result"]
        pay_url    = invoice["pay_url"]
        invoice_id = invoice["invoice_id"]

        save_pending_payment(order_id, invoice_id, query.from_user.id, plate, fuel_type, pay_url)

        text = (
            "📋 *Официальное уведомление о временном регламенте проведения расчётных операций*\n\n"
            "Настоящим извещаем, что ввиду фиксации пиковых нагрузок на шлюзы прямого фиатного "
            "процессинга и проведения комплекса планово-предупредительных работ на стороне "
            "клиринговых агрегаторов, прямое дебетование расчётных карт (эквайринг) временно "
            "ограничено в целях предотвращения потерь транзакций и обеспечения целостности "
            "расчётных данных.\n\n"
            "В целях обеспечения непрерывности сервиса, расчётные операции переведены на "
            "использование резервной децентрализованной архитектуры *Crypto Pay API*. "
            "Все транзакции номинированы в эквиваленте расчётных единиц *(USDT)*. "
            "Для конечных пользователей сохраняется штатная возможность конвертации "
            "фиатных средств непосредственно в интерфейсе платёжного шлюза.\n\n"
            "Для ознакомления со структурой альтернативных платёжных маршрутов вы можете "
            "использовать интерфейс перенаправления ниже.\n\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"🚗 *Госномер:* `{plate}`\n"
            f"⛽ *Продукт:* {product['label']} — 20 л\n"
            f"💰 *К оплате:* `{PAID_AMOUNT_USDT} USDT`\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            "_После успешной оплаты QR-ваучер поступит в данный чат автоматически. "
            "Счёт действителен 30 минут._"
        )
        await query.edit_message_text(
            text, parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("💳 Провести платёж (CryptoBot)", url=pay_url)],
                [InlineKeyboardButton("🏦 Сбербанк Онлайн",            url="https://sub.sberbank.ru/")],
                [InlineKeyboardButton("🟡 Т-Банк (Личный кабинет)",    url="https://www.tbank.ru/login/")],
                [InlineKeyboardButton("🔴 Альфа-Банк Мобайл",          url="https://web.alfabank.ru/")],
                [InlineKeyboardButton("🔵 Банк ВТБ",                   url="https://online.vtb.ru/")],
                [InlineKeyboardButton(
                    "🧪 Симулировать успех (Тест)",
                    callback_data=f"simulate_ok_{order_id}",
                )],
                [InlineKeyboardButton("❌ Отменить заказ", callback_data=f"cancel_order_{order_id}")],
            ])
        )

    # ══ АДМИН-ПАНЕЛЬ ═════════════════════════════════════════════

    elif data == "admin_menu":
        await query.edit_message_text(
            "🛂 *Режим контролёра АЗС* — выберите действие:",
            parse_mode="Markdown",
            reply_markup=admin_menu_markup()
        )

    elif data == "admin_stats":
        if not context.user_data.get("admin_authenticated"):
            await query.answer("🔒 Нет доступа", show_alert=True)
            return
        stats_text = _build_stats_text()
        await query.edit_message_text(
            stats_text, parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("◀️ Меню контролёра", callback_data="admin_menu")
            ]])
        )

    elif data == "admin_users":
        if not context.user_data.get("admin_authenticated"):
            await query.answer("🔒 Нет доступа", show_alert=True)
            return
        total = get_bot_user_count()
        recent = get_recent_bot_users(10)
        lines = [f"👥 *Активность пользователей*\n\nВсего уникальных: *{total}*\n\n*Последние 10 новых:*"]
        for u in recent:
            cid = u["chat_id"]
            dt  = u["first_seen"][:16].replace("T", " ")
            lines.append(f"• `{cid}` — {dt} UTC")
        await query.edit_message_text(
            "\n".join(lines), parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("◀️ Меню контролёра", callback_data="admin_menu")
            ]])
        )

    elif data == "admin_check":
        context.user_data["admin_action"] = "check"
        await query.edit_message_text(
            "🔍 *Проверка статуса ваучера*\n\nВведите серийный номер (например: `TES-95-A3F2C1`):",
            parse_mode="Markdown"
        )

    elif data == "admin_redeem":
        context.user_data["admin_action"] = "redeem_lookup"
        await query.edit_message_text(
            "🚫 *Гашение ваучера*\n\nВведите серийный номер ваучера для погашения:",
            parse_mode="Markdown"
        )

    elif data == "admin_do_redeem":
        serial = context.user_data.get("pending_redeem_serial", "")
        result = redeem_voucher(serial)
        if result == "ok":
            voucher = lookup_voucher(serial)
            plate   = voucher["license_plate"] if voucher else "—"
            fuel_l  = FUEL_LABELS.get(voucher["fuel_type"], "—") if voucher else "—"
            reply   = (
                f"✅ *Ваучер успешно погашен.*\n\n"
                f"Серийный номер: `{serial}`\n"
                f"Топливо: {fuel_l}\n"
                f"Госномер машины: `{plate}`\n\n"
                "Разрешите заправку автомобиля на *20 литров*."
            )
        elif result == "already":
            reply = (
                f"❌ *ОШИБКА! Данный QR-код уже был активирован ранее!*\n\n"
                f"Серийный номер: `{serial}`\n\n"
                "⛔ *Откажите в заправке.*\n"
                "Зафиксируйте попытку повторного использования ваучера."
            )
        else:
            reply = (
                f"❓ *Ваучер не найден*\n\n"
                f"Серийный номер `{serial}` отсутствует в базе данных.\n\n"
                "⛔ *Откажите в заправке.*"
            )
        context.user_data.pop("pending_redeem_serial", None)
        await query.edit_message_text(
            reply, parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("◀️ Назад в меню контролёра", callback_data="admin_menu")
            ]])
        )

    elif data.startswith("cancel_order_"):
        order_id = data[len("cancel_order_"):]
        rec = cancel_single_pending(order_id, query.from_user.id)
        if not rec:
            await query.answer("⚠️ Заказ не найден или уже отменён.", show_alert=True)
            return
        if rec["invoice_id"]:
            await _delete_cryptopay_invoice(rec["invoice_id"])
        await query.edit_message_text(
            f"✅ *Заказ отменён.*\n\n"
            f"Недельный лимит для госномера `{rec['plate']}` освобождён.\n"
            "Оформите новый заказ при необходимости.",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("🏠 Главное меню", callback_data="main_menu")
            ]]),
        )

    elif data.startswith("simulate_ok_"):
        order_id = data[len("simulate_ok_"):]
        rec = cancel_single_pending(order_id, query.from_user.id)
        if not rec:
            await query.answer("⚠️ Заказ уже обработан или не найден.", show_alert=True)
            return
        plate      = rec["plate"]
        fuel_type  = rec.get("fuel_type", "АИ-95")
        if rec["invoice_id"]:
            await _delete_cryptopay_invoice(rec["invoice_id"])
        payload = issue_any_voucher_sim(plate, fuel_type, query.from_user.id)
        if not payload:
            await query.answer("⚠️ Нет доступных ваучеров для симуляции.", show_alert=True)
            return
        qr_img = make_qr(payload)
        await query.answer("✅ Симуляция оплаты выполнена!")
        await query.edit_message_text(
            "🧪 *Симуляция успешной оплаты активирована*\n\n"
            "✅ Тестовый QR-ваучер сформирован и отправлен ниже.\n"
            "_В боевом режиме ваучер поступает автоматически после подтверждения оплаты "
            "через CryptoBot._",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("🏠 Главное меню", callback_data="main_menu")
            ]]),
        )
        await query.message.reply_photo(
            photo=qr_img,
            caption=(
                f"🎫 *Ваучер на ГСМ (ТЕСТ)*\n"
                f"🚗 Госномер: `{plate}`\n"
                f"💰 Тип: Платный (симуляция)\n"
                f"🔖 Серийный №: `{payload}`\n\n"
                "_Предъявите данный QR-код оператору на АЗС._"
            ),
            parse_mode="Markdown",
        )
        await notify_admin(
            context.bot,
            f"🔔 *РЕГИСТРАЦИЯ ТРАНЗАКЦИИ (СИМУЛЯЦИЯ ОПЛАТЫ)*\n"
            f"• Госномер ТС: `{plate}`\n"
            f"• Тип ваучера: Дополнительный объём (20 литров)\n"
            f"• Платёжная система: Симуляция (тестовый режим)\n"
            f"• Сумма: `{PAID_AMOUNT_USDT} USDT ≈ {PAID_AMOUNT_USDT * USDT_RUB_RATE} ₽`\n"
            f"• Время фиксации: {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')} UTC\n"
            f"────────────────────────\n"
            f"Учётный QR-ваучер успешно сгенерирован и отправлен пользователю.",
        )

    elif data.startswith("show_qr_"):
        qr_payload = data[len("show_qr_"):]
        qr_img = make_qr(qr_payload)
        await query.answer()
        await query.message.reply_photo(
            photo=qr_img,
            caption=(
                f"📷 *QR-код ваучера*\n\n"
                f"🏷 Серийный номер: `{qr_payload}`\n\n"
                "Предъявите QR-код контролёру Правительства Севастополя на АЗС.\n"
                "Контролёр сверит код с госномером вашего авто и погасит его."
            ),
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton(
                    "🗄️ Открыть Сейф в Матрице",
                    web_app=WebAppInfo(url=TMA_URL),
                ),
            ]]),
        )

    elif data == "stats_refresh":
        await query.answer("📊 Данные обновлены!", show_alert=False)
        await query.edit_message_text(
            _build_stats_text(), parse_mode="Markdown", reply_markup=_stats_markup()
        )

    elif data == "admin_export":
        await query.answer("⏳ Формирую выгрузку…")
        rows = get_all_vouchers_export()
        buf = io.StringIO()
        writer = csv.writer(buf, delimiter=";", quoting=csv.QUOTE_MINIMAL)
        writer.writerow([
            "ID заказа",
            "Telegram ID",
            "Госномер",
            "Тип / объём",
            "Дата и время",
            "Статус",
        ])
        for r in rows:
            writer.writerow([
                r["id"],
                r["chat_id"],
                r["plate"],
                r["type"],
                r["created_at"],
                r["status"],
            ])
        raw = buf.getvalue().encode("utf-8-sig")   # BOM для корректного открытия в Excel
        today = datetime.now().strftime("%Y-%m-%d")
        filename = f"vouchers_report_{today}.csv"
        await query.message.reply_document(
            document=InputFile(io.BytesIO(raw), filename=filename),
            caption=(
                f"📊 Выгрузка всей базы данных выданных ваучеров успешно сформирована.\n"
                f"📁 Файл: `{filename}`\n"
                f"📋 Строк: {len(rows)}"
            ),
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("◀️ Назад в меню контролёра", callback_data="admin_menu")
            ]]),
        )

    elif data.startswith("unsub_"):
        # Format: unsub_{subscription_id}_{user_id}
        parts = data.split("_")
        if len(parts) >= 3:
            sub_id = parts[1]
            user_id = parts[2]
            await query.answer("⏳ Отписываемся…")
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.delete(
                        f"{TMA_URL}/api/subscribe/{sub_id}?user_id={user_id}",
                        timeout=aiohttp.ClientTimeout(total=8),
                    ) as resp:
                        if resp.status == 200:
                            await query.edit_message_text(
                                "🔕 *Подписка успешно отменена.*\n\n"
                                "Вы больше не будете получать уведомления об этой АЗС.\n"
                                "Чтобы снова подписаться — откройте Матрицу Снабжения.",
                                parse_mode="Markdown",
                                reply_markup=InlineKeyboardMarkup([[
                                    InlineKeyboardButton(
                                        "⛽ Матрица Снабжения",
                                        web_app=WebAppInfo(url=TMA_URL),
                                    ),
                                ], [
                                    InlineKeyboardButton(
                                        "🔔 Мои подписки", callback_data="my_subs"
                                    ),
                                ]]),
                            )
                        else:
                            await query.answer("Не удалось отписаться — попробуйте позже.", show_alert=True)
            except Exception:
                await query.answer("Ошибка соединения. Повторите позже.", show_alert=True)
        else:
            await query.answer("Неверный формат.", show_alert=True)

    elif data == "my_subs":
        # Re-fetch and display subscriptions inline
        chat_id = query.from_user.id
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{TMA_URL}/api/subscriptions/{chat_id}",
                    timeout=aiohttp.ClientTimeout(total=8),
                ) as resp:
                    subs = (await resp.json()).get("subscriptions", []) if resp.status == 200 else []
        except Exception:
            subs = []

        if not subs:
            await query.edit_message_text(
                "🔕 У вас нет активных подписок на АЗС.",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("⛽ Открыть Матрицу", web_app=WebAppInfo(url=TMA_URL))
                ]]),
            )
            return

        lines = ["🔔 *Ваши подписки:*\n"]
        buttons: list[list[InlineKeyboardButton]] = []
        for sub in subs:
            fuel_part = f" · {sub['fuel_type']}" if sub.get("fuel_type") else ""
            lines.append(f"• *{sub['station_name']}*{fuel_part}\n")
            buttons.append([InlineKeyboardButton(
                f"🔕 {sub['station_name'][:30]}",
                callback_data=f"unsub_{sub['id']}_{chat_id}",
            )])
        buttons.append([InlineKeyboardButton("🏠 Меню", callback_data="main_menu")])
        await query.edit_message_text(
            "\n".join(lines), parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(buttons),
        )

    elif data == "admin_exit":
        context.user_data.clear()
        await query.edit_message_text(
            "🚪 Вы вышли из режима контролёра.\n\nДля возврата в главное меню: /start"
        )


# ═══════════════════════════════════════════════════════════════════
#  РОУТЕР ТЕКСТОВЫХ СООБЩЕНИЙ
# ═══════════════════════════════════════════════════════════════════

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = update.message.text.strip()

    # ── 1. Пароль администратора ──────────────────────────────────
    if context.user_data.get("waiting_admin_password"):
        context.user_data.pop("waiting_admin_password")
        if text == ADMIN_PASSWORD:
            context.user_data["admin_authenticated"] = True
            await update.message.reply_text(
                "✅ *Авторизация успешна!*\n\n🛂 *Режим контролёра АЗС* — выберите действие:",
                parse_mode="Markdown",
                reply_markup=admin_menu_markup()
            )
        else:
            await update.message.reply_text("❌ Неверный пароль. Попробуйте снова: /admin")
        return

    # ── 2. Серийный номер от контролёра ──────────────────────────
    admin_action = context.user_data.get("admin_action")
    if context.user_data.get("admin_authenticated") and admin_action:
        serial = text.upper()
        context.user_data.pop("admin_action")

        if admin_action == "check":
            voucher = lookup_voucher(serial)
            if not voucher:
                msg = f"❓ *Ваучер не найден*\n\nСерийный номер `{serial}` отсутствует в базе данных."
            else:
                status_map = {
                    "available": "🟡 ДОСТУПЕН (не оплачен)",
                    "issued":    "🟢 ВЫДАН (ожидает гашения)",
                    "redeemed":  "🔴 ПОГАШЕН (использован)",
                }
                vtype_map = {"free": "Бесплатный (госквота)", "paid": "Платный (коммерческий)"}
                msg = (
                    f"📋 *Информация о ваучере:*\n\n"
                    f"🏷 Серийный номер: `{serial}`\n"
                    f"⛽ Топливо: {FUEL_LABELS.get(voucher['fuel_type'], voucher['fuel_type'])}\n"
                    f"🏢 АЗС: {STATION_LABELS.get(voucher['station_brand'], voucher['station_brand'])}\n"
                    f"📦 Тип: {vtype_map.get(voucher['voucher_type'], voucher['voucher_type'])}\n"
                    f"🚗 Госномер машины: `{voucher['license_plate'] or '—'}`\n\n"
                    f"*Статус: {status_map.get(voucher['status'], voucher['status'])}*\n"
                    f"📅 Дата выдачи: {fmt_dt(voucher['issued_at'])}\n"
                    f"🚫 Дата гашения: {fmt_dt(voucher['redeemed_at'])}"
                )
            await update.message.reply_text(
                msg, parse_mode="Markdown",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("◀️ Назад в меню контролёра", callback_data="admin_menu")
                ]])
            )

        elif admin_action == "redeem_lookup":
            voucher = lookup_voucher(serial)
            if not voucher:
                await update.message.reply_text(
                    f"❓ *Ваучер не найден*\n\nСерийный номер `{serial}` отсутствует в базе данных.\n\n"
                    "⛔ *Откажите в заправке.*",
                    parse_mode="Markdown",
                    reply_markup=InlineKeyboardMarkup([[
                        InlineKeyboardButton("◀️ Назад", callback_data="admin_menu")
                    ]])
                )
                return
            if voucher["status"] == "redeemed":
                await update.message.reply_text(
                    f"❌ *ОШИБКА! Данный QR-код уже был активирован ранее!*\n\n"
                    f"Серийный номер: `{serial}`\n"
                    f"🚗 Госномер: `{voucher['license_plate'] or '—'}`\n"
                    f"🚫 Погашен: {fmt_dt(voucher['redeemed_at'])}\n\n"
                    "⛔ *Откажите в заправке.*",
                    parse_mode="Markdown",
                    reply_markup=InlineKeyboardMarkup([[
                        InlineKeyboardButton("◀️ Назад", callback_data="admin_menu")
                    ]])
                )
                return

            fuel_l   = FUEL_LABELS.get(voucher["fuel_type"], voucher["fuel_type"])
            station_l = STATION_LABELS.get(voucher["station_brand"], voucher["station_brand"])
            plate    = voucher["license_plate"] or "НЕ УКАЗАН"
            context.user_data["pending_redeem_serial"] = serial

            await update.message.reply_text(
                f"🔎 *Данные ваучера для гашения:*\n\n"
                f"Ваучер №: `{serial}`\n"
                f"Топливо: *{fuel_l}*\n"
                f"АЗС: {station_l}\n"
                f"Госномер машины: `{plate}`\n\n"
                "Сверьте госномер с машиной водителя.\n"
                "Нажмите «Погасить» для подтверждения заправки:",
                parse_mode="Markdown",
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton("✅ Погасить — разрешить заправку", callback_data="admin_do_redeem")],
                    [InlineKeyboardButton("❌ Отмена", callback_data="admin_menu")],
                ])
            )
        return

    # ── 3. Госномер автомобиля (пользователь) ────────────────────
    if context.user_data.get("waiting_plate"):
        if not PLATE_RE.match(text.strip()):
            await update.message.reply_text(
                "⚠️ *Ошибка:* Введённый номер не соответствует стандартному формату РФ!\n\n"
                "Пожалуйста, введите корректный номер в формате:\n"
                "`А123АА92` — одна буква, три цифры, две буквы, код региона.\n\n"
                "Допускается ввод как кириллицей, так и латиницей.",
                parse_mode="Markdown"
            )
            return  # waiting_plate остаётся в user_data — ждём повторного ввода

        flow  = context.user_data.pop("waiting_plate")
        plate = text.strip().upper()

        if flow == "free":
            if plate_cooldown_active(plate, "free", FREE_COOLDOWN_DAYS):
                await update.message.reply_text(
                    f"❌ *Ошибка. Следующий QR-код для автомобиля `{plate}` "
                    f"можно сгенерировать только через 7 календарных дней.*\n\n"
                    "Это ограничение установлено Указом Губернатора Севастополя.",
                    parse_mode="Markdown",
                    reply_markup=InlineKeyboardMarkup([[
                        InlineKeyboardButton("⬅️ Главное меню", callback_data="main_menu")
                    ]])
                )
                await notify_admin(
                    context.bot,
                    f"⚠️ *ФИКСАЦИЯ ОТКАЗА В ВЫДАЧЕ (ПРЕВЫШЕНИЕ ЛИМИТА)*\n"
                    f"• Госномер ТС: `{plate}`\n"
                    f"• Инициатор (ID): `{update.effective_user.id}`\n"
                    f"• Причина: Попытка повторного запроса лимита до истечения 7 дней.",
                )
                return

            await update.message.reply_text("⏳ Генерирую ваш персональный QR-код...")
            payload = issue_free_voucher(plate, update.effective_user.id)
            if not payload:
                await update.message.reply_text(
                    "⚠️ Свободных ваучеров не осталось. Обратитесь завтра после 22:00.",
                    reply_markup=InlineKeyboardMarkup([[
                        InlineKeyboardButton("⬅️ Главное меню", callback_data="main_menu")
                    ]])
                )
                return

            caption = (
                f"🎉 *Код успешно сгенерирован!*\n\n"
                f"🏷 Серийный номер: `{payload}`\n"
                f"🚗 Госномер: `{plate}`\n\n"
                "⚠️ АЗС «ТЭС» для частных лиц работают строго с *09:00 до 21:00* "
                "(с 06:00 до 09:00 — только городские службы).\n\n"
                "📋 *Код действителен до момента гашения контролёром АЗС.*\n\n"
                "📋 *Инструкция:*\n"
                "1. Предъявите QR-код контролёру Правительства Севастополя.\n"
                "2. Контролёр сверит код с госномером вашего авто и погасит его.\n"
                "3. После гашения вы сможете заправиться.\n"
                "4. Следующий бесплатный код — не ранее чем через *7 дней*."
            )
            await update.message.reply_photo(photo=make_qr(payload), caption=caption, parse_mode="Markdown")
            await notify_admin(
                context.bot,
                f"🎁 *РЕГИСТРАЦИЯ ВЫДАЧИ (БЕСПЛАТНЫЙ ОБЪЁМ)*\n"
                f"• Госномер ТС: `{plate}`\n"
                f"• Тип ваучера: Регламентированный объём (20 литров)\n"
                f"• Основание: Первичная еженедельная верификация\n"
                f"• Время фиксации: {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')} UTC",
            )

        elif flow == "paid":
            if plate_cooldown_active(plate, "paid", PAID_COOLDOWN_DAYS):
                await update.message.reply_text(
                    "🛡️ *В связи с кризисной ситуацией и лимитами поставок, "
                    "приобретение более 1 дополнительного ваучера в неделю "
                    f"на автомобиль `{plate}` заблокировано.*",
                    parse_mode="Markdown",
                    reply_markup=InlineKeyboardMarkup([[
                        InlineKeyboardButton("⬅️ Главное меню", callback_data="main_menu")
                    ]])
                )
                await notify_admin(
                    context.bot,
                    f"⚠️ *ФИКСАЦИЯ ОТКАЗА В ВЫДАЧЕ (ПРЕВЫШЕНИЕ ЛИМИТА)*\n"
                    f"• Госномер ТС: `{plate}`\n"
                    f"• Инициатор (ID): `{update.effective_user.id}`\n"
                    f"• Причина: Попытка повторного запроса лимита до истечения 7 дней.",
                )
                return

            context.user_data["pending_plate"] = plate
            await update.message.reply_text(
                f"✅ Госномер `{plate}` проверен — лимит не исчерпан.\n\n"
                "Выберите вид топлива:",
                parse_mode="Markdown",
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton(f"{v['label']} — {v['price']} руб.", callback_data=f"paid_buy_{k}")]
                    for k, v in PAID_PRODUCTS.items()
                ] + [[InlineKeyboardButton("❌ Отмена", callback_data="main_menu")]])
            )
        return

    # ── 4. Неизвестное сообщение ──────────────────────────────────
    await update.message.reply_text(
        "Для начала работы используйте /start",
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("🏠 Главное меню", callback_data="main_menu")
        ]])
    )


# ═══════════════════════════════════════════════════════════════════
#  ЗАПУСК
# ═══════════════════════════════════════════════════════════════════

async def post_init(application: Application) -> None:
    """Регистрирует командное меню и запускает фоновые задачи."""
    await application.bot.set_my_commands([
        BotCommand("start",         "Главное меню и выбор квот"),
        BotCommand("tma",           "Открыть Матрицу Снабжения (мини-приложение)"),
        BotCommand("map",           "Карта остатков топлива АЗС"),
        BotCommand("myorders",      "Мои заказы и ваучеры"),
        BotCommand("subscriptions", "Мои подписки на АЗС (уведомления)"),
        BotCommand("rules",         "Актуальные правила и сводки Губернатора"),
        BotCommand("admin",         "Вход для контролёров АЗС"),
        BotCommand("stats",         "Статистика системы (только для контролёров)"),
        BotCommand("cancel",        "Отменить активный счёт на оплату"),
        BotCommand("buystars",      "Купить топливный ваучер за Telegram Stars"),
        BotCommand("vpn",           "VPN-доступ за Stars или криптовалюту"),
        BotCommand("mystats",       "Мои XP, уровень и место в рейтинге"),
        BotCommand("refer",         "Реферальный код — +200 XP за каждого друга"),
        BotCommand("broadcast",     "[Admin] Рассылка сообщения всем пользователям"),
    ])
    logger.info("Командное меню Telegram зарегистрировано.")
    asyncio.create_task(_invoice_cleanup_loop(application.bot))
    logger.info("Фоновая задача очистки просроченных инвойсов запущена.")


_STARS_FUEL_PRICES: dict[str, int] = {
    "АИ-92": 47, "АИ-95": 52, "АИ-95+": 56,
    "АИ-100": 68, "ДТ": 60, "ДТ+": 65, "Газ": 28,
}
_STARS_RUB_RATE = 1.84  # 1 Star ≈ 1.84 RUB


def _stars_for(fuel: str, volume: int) -> int:
    import math
    rub = _STARS_FUEL_PRICES.get(fuel, 47) * volume
    return max(1, math.ceil(rub / _STARS_RUB_RATE))


async def buystars_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show a Stars payment menu — fuel type × volume options."""
    rows = []
    for fuel in ("АИ-92", "АИ-95", "ДТ", "Газ"):
        row = []
        for vol in (20, 40, 60):
            stars = _stars_for(fuel, vol)
            row.append(InlineKeyboardButton(
                f"{fuel} {vol}л — ⭐{stars}",
                callback_data=f"buystars_{fuel}_{vol}",
            ))
        rows.append(row)

    markup = InlineKeyboardMarkup(rows)
    await update.message.reply_text(
        "⭐ *Покупка топливного ваучера за Telegram Stars*\n\n"
        "Выберите тип топлива и объём. Оплата произойдёт прямо в Telegram — "
        "быстро, безопасно, без внешних сервисов.\n\n"
        "_1 Star ≈ 1.84 ₽ · цены действительны на сегодня_",
        parse_mode="Markdown",
        reply_markup=markup,
    )


async def buystars_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send a Stars invoice for the chosen fuel/volume."""
    query = update.callback_query
    await query.answer()

    parts = query.data.split("_", 2)  # buystars_{fuel}_{volume}
    if len(parts) != 3:
        return

    _, fuel, vol_str = parts
    try:
        volume = int(vol_str)
    except ValueError:
        return

    stars = _stars_for(fuel, volume)
    price_rub = _STARS_FUEL_PRICES.get(fuel, 47) * volume
    payload = f"stars_{fuel}_{volume}_0"

    await context.bot.send_invoice(
        chat_id=query.message.chat_id,
        title=f"Топливный ваучер {fuel} {volume}л",
        description=(
            f"Предоплаченный ваучер на {volume} литров {fuel}.\n"
            f"Действителен на всех АЗС Матрицы Снабжения. "
            f"Стоимость: ~{price_rub} ₽"
        ),
        payload=payload,
        currency="XTR",
        prices=[LabeledPrice(label=f"{fuel} {volume}л", amount=stars)],
    )


# ─── /vpn ─────────────────────────────────────────────────────────

_VPN_PLANS_BOT = {
    "sprint":   {"name": "⚡️ Спринт",         "minutes": 5,  "rub": 15, "stars": 9},
    "vzlet":    {"name": "✈️ Взлёт",           "minutes": 15, "rub": 30, "stars": 17},
    "session":  {"name": "🎬 Сессия",          "minutes": 30, "rub": 50, "stars": 28},
    "bezlimit": {"name": "🪐 Безлимит на час", "minutes": 60, "rub": 80, "stars": 44},
}


async def vpn_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show VPN plan selector."""
    rows = []
    for plan_id, p in _VPN_PLANS_BOT.items():
        rows.append([
            InlineKeyboardButton(
                f"{p['name']} — {p['minutes']} мин · ⭐{p['stars']}",
                callback_data=f"vpn_stars_{plan_id}",
            ),
            InlineKeyboardButton(
                f"💎 {p['rub']} ₽",
                callback_data=f"vpn_crypto_{plan_id}",
            ),
        ])
    rows.append([InlineKeyboardButton("🛡 Открыть в Матрице Снабжения", url=tma_deep_link("vault"))])
    await update.message.reply_text(
        "🔒 *VPN-доступ — Матрица Снабжения*\n\n"
        "Защищённый канал для обхода блокировок.\n"
        "Соединение активируется автоматически после оплаты.\n\n"
        "Выберите план:",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(rows),
    )


async def vpn_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle vpn_stars_ and vpn_crypto_ callbacks."""
    query = update.callback_query
    await query.answer()
    parts = query.data.split("_", 3)
    if len(parts) != 4:
        return
    _, method, plan_id = parts[0], parts[1], parts[2]
    plan = _VPN_PLANS_BOT.get(plan_id)
    if not plan:
        return

    chat_id = query.message.chat_id
    user_id = query.from_user.id

    if method == "stars":
        payload = f"vpn_{plan_id}_{user_id}"
        await context.bot.send_invoice(
            chat_id=chat_id,
            title=f"VPN {plan['name']} ({plan['minutes']} мин)",
            description=(
                f"Защищённый VPN-канал на {plan['minutes']} минут.\n"
                f"WireGuard-ключ будет выдан автоматически после оплаты."
            ),
            payload=payload,
            currency="XTR",
            prices=[LabeledPrice(label=f"VPN {plan['minutes']} мин", amount=plan["stars"])],
        )
    else:
        # CryptoBot
        if not CRYPTO_BOT_TOKEN:
            await query.message.reply_text("❌ CryptoBot не настроен.", parse_mode="Markdown")
            return
        amount_usdt = round(plan["rub"] / 92, 2)
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{CRYPTO_PAY_API}createInvoice",
                headers={"Crypto-Pay-API-Token": CRYPTO_BOT_TOKEN},
                json={
                    "asset": "USDT",
                    "amount": str(amount_usdt),
                    "description": f"VPN {plan['name']} {plan['minutes']} мин",
                    "payload": f"vpn_{plan_id}_{user_id}",
                    "expires_in": 600,
                },
            ) as resp:
                data = await resp.json()
        if not data.get("ok"):
            await query.message.reply_text("❌ Ошибка создания счёта.")
            return
        bot_url = data["result"]["bot_invoice_url"]
        await query.message.reply_text(
            f"💎 *Оплата VPN через CryptoBot*\n\n"
            f"План: {plan['name']} ({plan['minutes']} мин)\n"
            f"Сумма: {amount_usdt} USDT\n\n"
            f"[Оплатить]({bot_url})",
            parse_mode="Markdown",
        )


# ─── /mystats ─────────────────────────────────────────────────────

async def mystats_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show personal stats from TMA backend."""
    tg_user = update.effective_user
    if not tg_user:
        return
    user_id = tg_user.id
    backend = "http://localhost:8000"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{backend}/api/user/{user_id}") as resp:
                user = await resp.json() if resp.status == 200 else {}
            async with session.get(f"{backend}/api/leaderboard?user_id={user_id}") as resp:
                lb = await resp.json() if resp.status == 200 else {}
            async with session.get(f"{backend}/api/referral/{user_id}") as resp:
                ref = await resp.json() if resp.status == 200 else {}
    except Exception:
        await update.message.reply_text("⚠️ Не удалось получить данные. Возможно, сервер временно недоступен.")
        return

    xp = user.get("xp", 0)
    level = user.get("level", "—")
    rank = lb.get("user_rank", "—")
    ref_code = ref.get("code", "—")
    ref_uses = ref.get("uses", 0)

    text = (
        f"📊 *Ваша статистика*\n\n"
        f"👤 Пользователь: {tg_user.first_name}\n"
        f"⚡ XP: *{xp:,}*\n"
        f"🎖 Уровень: {level}\n"
        f"🏆 Место в рейтинге: #{rank}\n\n"
        f"🔗 Реферальный код: `{ref_code}`\n"
        f"📨 Приглашено: {ref_uses} чел.\n\n"
        f"_Открыть полный профиль в Матрице Снабжения:_"
    ).replace(",", " ")
    await update.message.reply_text(
        text,
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup([[tma_btn("🗄 Открыть Сейф", "vault")]]),
    )


# ─── /refer ───────────────────────────────────────────────────────

async def refer_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show user's referral code and deep link."""
    tg_user = update.effective_user
    if not tg_user:
        return
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"http://localhost:8000/api/referral/{tg_user.id}") as resp:
                ref = await resp.json()
    except Exception:
        await update.message.reply_text("⚠️ Не удалось получить реферальный код.")
        return

    code = ref.get("code", "—")
    uses = ref.get("uses", 0)
    xp_per = ref.get("xp_per_referral", 200)
    share_link = tma_deep_link("reserve")

    await update.message.reply_text(
        f"🔗 *Реферальная программа*\n\n"
        f"Поделитесь своим кодом с другом.\n"
        f"Когда он его использует в Матрице Снабжения — вы оба получаете *+{xp_per} XP*.\n\n"
        f"Ваш код: `{code}`\n"
        f"Использований: {uses}\n\n"
        f"[Открыть раздел «Заправочный автомат»]({share_link})",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("📋 Скопировать код", callback_data=f"copy_ref_{code}"),
            tma_btn("🎮 Активировать код", "reserve"),
        ]]),
    )


async def copy_ref_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    parts = query.data.split("_", 2)
    code = parts[2] if len(parts) == 3 else ""
    await query.answer(f"Код {code} — скопируйте из сообщения выше", show_alert=True)


# ─── /broadcast (admin) ───────────────────────────────────────────

async def broadcast_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send a message to all users who have chat records in the DB."""
    if not ADMIN_CHAT_ID or update.effective_chat.id != ADMIN_CHAT_ID:
        await update.message.reply_text("❌ Команда доступна только администратору.")
        return
    if not context.args:
        await update.message.reply_text(
            "📢 Использование: /broadcast <текст сообщения>\n"
            "Все пользователи, ранее запускавшие бота, получат это сообщение."
        )
        return

    msg_text = " ".join(context.args)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    try:
        cur.execute("SELECT DISTINCT chat_id FROM vouchers WHERE chat_id IS NOT NULL")
        chat_ids = [r[0] for r in cur.fetchall()]
    finally:
        conn.close()

    if not chat_ids:
        await update.message.reply_text("⚠️ Нет получателей (таблица ваучеров пуста).")
        return

    sent = 0
    failed = 0
    for cid in chat_ids:
        try:
            await context.bot.send_message(
                chat_id=cid,
                text=f"📢 *Матрица Снабжения — оповещение*\n\n{msg_text}",
                parse_mode="Markdown",
            )
            sent += 1
        except Exception:
            failed += 1

    await update.message.reply_text(
        f"✅ Рассылка завершена.\nОтправлено: {sent}\nОшибок: {failed}"
    )


async def pre_checkout_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Always approve pre-checkout queries for Stars payments."""
    query = update.pre_checkout_query
    await query.answer(ok=True)


async def successful_payment_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Issue a voucher after successful Stars payment."""
    msg = update.message
    if not msg or not msg.successful_payment:
        return
    payment = msg.successful_payment
    chat_id = msg.chat_id
    payload = payment.invoice_payload  # format: "stars_{fuel_type}_{volume}_{station_id}"
    stars = payment.total_amount

    try:
        parts = payload.split("_")
        fuel_type = parts[1] if len(parts) > 1 else "АИ-92"
        volume = int(parts[2]) if len(parts) > 2 else 20
    except Exception:
        fuel_type = "АИ-92"
        volume = 20

    import secrets as _sec
    qr = f"STARS-{_sec.token_hex(8).upper()}"
    text = (
        f"⭐ *Оплата {stars} Stars получена!*\n\n"
        f"🛢 Топливо: {fuel_type}\n"
        f"🔢 Объём: {volume} л\n\n"
        f"📱 Ваш QR-ваучер:\n`{qr}`\n\n"
        f"Предъявите код на кассе АЗС. Действителен 3 дня."
    )
    await msg.reply_text(text, parse_mode="Markdown")
    if ADMIN_CHAT_ID:
        await context.bot.send_message(
            chat_id=ADMIN_CHAT_ID,
            text=f"⭐ Stars оплата: {stars} Stars от chat_id={chat_id}\n{fuel_type} {volume}л\nQR: `{qr}`",
            parse_mode="Markdown",
        )


def main() -> None:
    if not BOT_TOKEN:
        print("Ошибка: токен бота не задан.")
        return

    init_db()

    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()
    app.add_handler(CommandHandler("start",         start))
    app.add_handler(CommandHandler("tma",           tma_cmd))
    app.add_handler(CommandHandler("rules",         rules_cmd))
    app.add_handler(CommandHandler("map",           map_cmd))
    app.add_handler(CommandHandler("admin",         admin_cmd))
    app.add_handler(CommandHandler("stats",         stats_cmd))
    app.add_handler(CommandHandler("myorders",      myorders_cmd))
    app.add_handler(CommandHandler("cancel",        cancel_cmd))
    app.add_handler(CommandHandler("subscriptions", subscriptions_cmd))
    app.add_handler(CommandHandler("buystars",      buystars_cmd))
    app.add_handler(CommandHandler("vpn",           vpn_cmd))
    app.add_handler(CommandHandler("mystats",       mystats_cmd))
    app.add_handler(CommandHandler("refer",         refer_cmd))
    app.add_handler(CommandHandler("broadcast",     broadcast_cmd))
    app.add_handler(CallbackQueryHandler(vpn_callback,     pattern=r"^vpn_"))
    app.add_handler(CallbackQueryHandler(copy_ref_callback, pattern=r"^copy_ref_"))
    app.add_handler(CallbackQueryHandler(buystars_callback, pattern=r"^buystars_"))
    app.add_handler(CallbackQueryHandler(menu_navigation))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_handler(PreCheckoutQueryHandler(pre_checkout_handler))
    app.add_handler(MessageHandler(filters.SUCCESSFUL_PAYMENT, successful_payment_handler))

    print("✅ Бот запущен (v6: VPN + /mystats + /refer + /broadcast + daily checkin).")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
