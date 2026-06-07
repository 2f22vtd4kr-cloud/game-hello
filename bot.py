import os
import io
import re
import logging
import uuid
import sqlite3
import qrcode
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from telegram import (
    Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo,
    KeyboardButton, ReplyKeyboardMarkup, ReplyKeyboardRemove, BotCommand
)
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler,
    ContextTypes, MessageHandler, filters
)

load_dotenv()

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

BOT_TOKEN       = os.getenv("TELEGRAM_BOT_TOKEN", "")
ADMIN_PASSWORD  = os.getenv("ADMIN_PASSWORD", "crimea2026")
DB_PATH         = "vouchers.db"
MAP_URL         = "https://fuel.sevtech.org/map"

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
    ]:
        try:
            cur.execute(f"ALTER TABLE vouchers ADD COLUMN {col} {definition}")
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
    con.commit()
    con.close()


def _today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _n_days_ago_iso(n: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()


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

def issue_free_voucher(plate: str) -> str | None:
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
        "UPDATE vouchers SET status='issued', voucher_type='free', license_plate=?, issued_at=? WHERE id=?",
        (plate.upper(), datetime.now(timezone.utc).isoformat(), vid)
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

    con.close()

    free_remaining = max(0, DAILY_FREE_LIMIT - free_today)

    return {
        "total_issued":    total_issued,
        "total_redeemed":  total_redeemed,
        "total_available": total_available,
        "free_today":      free_today,
        "paid_today":      paid_today,
        "redeemed_today":  redeemed_today,
        "fuel_stats":      fuel_stats,
        "fuel_today":      fuel_today,
        "free_remaining":  free_remaining,
        "daily_limit":     DAILY_FREE_LIMIT,
        "today":           today,
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
        [InlineKeyboardButton("📂 Получить бесплатный QR-код (Лимит 20л)", callback_data="free_quota")],
        [InlineKeyboardButton("⚡ Заказать дополнительный объем (Платная доза)", callback_data="paid_quota")],
        [InlineKeyboardButton("📜 Актуальные правила и сводки Правительства", callback_data="rules")],
        [InlineKeyboardButton("🗺️ Карта остатков АЗС (fuel.sevtech.org)", url=MAP_URL)],
    ])


def admin_menu_markup() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🔍 Проверить статус ваучера", callback_data="admin_check")],
        [InlineKeyboardButton("🚫 Погасить ваучер",          callback_data="admin_redeem")],
        [InlineKeyboardButton("🚪 Выйти из режима контролёра", callback_data="admin_exit")],
    ])


# ═══════════════════════════════════════════════════════════════════
#  ОБРАБОТЧИКИ КОМАНД
# ═══════════════════════════════════════════════════════════════════

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    context.user_data.clear()
    await update.message.reply_text(
        "🏛 *Система государственного учёта и распределения топлива*\n"
        "_Департамент цифрового развития Севастополя_\n\n"
        "Выберите действие:",
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

        f"━━━ 🗂 ОБЩИЕ ИТОГИ ━━━\n"
        f"📤 Всего выдано ваучеров: *{s['total_issued']}*\n"
        f"✅ Всего погашено на АЗС: *{s['total_redeemed']}*\n"
        f"🗃 Остаток в базе данных: *{s['total_available']}*\n\n"

        f"━━━ 📅 СЕГОДНЯ ━━━\n"
        f"🆓 Бесплатных госквот выдано: *{s['free_today']}*\n"
        f"💰 Платных ваучеров куплено: *{s['paid_today']}*\n"
        f"🚫 Погашено на АЗС сегодня: *{s['redeemed_today']}*\n\n"

        f"━━━ ⛽ РАЗБИВКА ПО ТОПЛИВУ (всего) ━━━\n"
        f"{_fuel_line(s['fuel_stats'])}\n\n"

        f"━━━ ⛽ РАЗБИВКА ПО ТОПЛИВУ (сегодня) ━━━\n"
        f"{_fuel_line(s['fuel_today'])}\n\n"

        f"━━━ 🚦 ЛИМИТ БЕСПЛАТНЫХ КВОТ ━━━\n"
        f"{bar} {pct}%\n"
        f"Использовано: *{s['free_today']}* из *{s['daily_limit']}*\n"
        f"Осталось до исчерпания: *{s['free_remaining']} шт.*"
    )


def _stats_markup() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🔁 Обновить статистику", callback_data="stats_refresh")],
        [InlineKeyboardButton("◀️ Меню контролёра",     callback_data="admin_menu")],
    ])


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
        f"🗺️ *Карта остатков топлива на АЗС Севастополя:*\n\n{MAP_URL}\n\n"
        "Сверяйте наличие топлива перед выездом на заправку.",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("🗺️ Открыть карту", url=MAP_URL)],
            [InlineKeyboardButton("🏠 Главное меню", callback_data="main_menu")],
        ])
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

    # ── Карточка платного заказа ──────────────────────────────────
    elif data.startswith("paid_buy_"):
        fuel_type = data.split("_")[2]
        product   = PAID_PRODUCTS[fuel_type]
        plate     = context.user_data.get("pending_plate", "")
        context.user_data["paid_fuel_type"] = fuel_type

        sim_url = f"https://paymetodaygo.online/checkout/{uuid.uuid4().hex[:10]}"
        text = (
            f"🛒 *Подтверждение коммерческого заказа:*\n\n"
            f"• *Товар:* {product['label']}\n"
            f"• *Объём:* 20 литров\n"
            f"• *К оплате:* `{product['price']} RUB`\n"
            f"• *Госномер:* `{plate}`\n\n"
            "Выберите способ оплаты:"
        )
        await query.edit_message_text(
            text, parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("💳 Оплатить сервисный сбор за ваучер (СБП)", web_app=WebAppInfo(url=sim_url))],
                [InlineKeyboardButton("🤖 Тестовая оплата (Симуляция)", callback_data=f"paid_sim_{fuel_type}")],
                [InlineKeyboardButton("❌ Отменить", callback_data="main_menu")],
            ])
        )

    # ── Симуляция платного заказа ─────────────────────────────────
    elif data.startswith("paid_sim_"):
        fuel_type = data.split("_")[2]
        plate     = context.user_data.get("pending_plate", "НЕИЗВЕСТЕН")
        product   = PAID_PRODUCTS[fuel_type]

        await query.edit_message_text("⏳ Обрабатываю платёж...")

        payload = issue_paid_voucher(plate, fuel_type, product["station"])
        if not payload:
            await query.edit_message_text(
                "⚠️ Ваучеры временно недоступны. Попробуйте позже.",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("⬅️ Главное меню", callback_data="main_menu")
                ]])
            )
            return

        await query.edit_message_text(
            "🎉 *Оплата прошла успешно!* Формирую ваучер...",
            parse_mode="Markdown"
        )
        caption = (
            f"⚡ *Коммерческий ваучер на 20 литров*\n\n"
            f"🏷 Выдан дополнительный коммерческий ваучер №`{payload}` на объём до *20 литров*.\n"
            f"⛽ АЗС: {product['label']}\n"
            f"🚗 Госномер: `{plate}`\n\n"
            "⚠️ *Важно:* Сам бензин оплачивается отдельно на кассе АЗС «ТЭС» после гашения "
            "QR-кода контролёром. Данный ваучер подтверждает только *право на покупку* топлива.\n\n"
            "📋 *Инструкция:*\n"
            "1. Код действует до момента гашения сотрудником АЗС.\n"
            "2. Предъявите код контролёру Правительства Севастополя на АЗС ТЭС.\n"
            "3. Контролёр сверит код с госномером вашего авто и погасит его.\n"
            "4. После гашения оплатите топливо на кассе по тарифу АЗС.\n"
            "5. Следующий платный ваучер — не ранее чем через *7 дней*."
        )
        await query.message.reply_photo(photo=make_qr(payload), caption=caption, parse_mode="Markdown")

    # ══ АДМИН-ПАНЕЛЬ ═════════════════════════════════════════════

    elif data == "admin_menu":
        await query.edit_message_text(
            "🛂 *Режим контролёра АЗС* — выберите действие:",
            parse_mode="Markdown",
            reply_markup=admin_menu_markup()
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

    elif data == "stats_refresh":
        await query.answer("📊 Данные обновлены!", show_alert=False)
        await query.edit_message_text(
            _build_stats_text(), parse_mode="Markdown", reply_markup=_stats_markup()
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
                return

            await update.message.reply_text("⏳ Генерирую ваш персональный QR-код...")
            payload = issue_free_voucher(plate)
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
    """Регистрирует командное меню (синяя кнопка «Меню» в Telegram)."""
    await application.bot.set_my_commands([
        BotCommand("start", "Главное меню и выбор квот"),
        BotCommand("rules", "Актуальные правила и сводки Губернатора"),
        BotCommand("map",   "Карта остатков топлива АЗС"),
        BotCommand("admin", "Вход для контролёров АЗС"),
        BotCommand("stats", "Статистика системы (только для контролёров)"),
    ])
    logger.info("Командное меню Telegram зарегистрировано.")


def main() -> None:
    if not BOT_TOKEN:
        print("Ошибка: токен бота не задан.")
        return

    init_db()

    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("rules", rules_cmd))
    app.add_handler(CommandHandler("map",   map_cmd))
    app.add_handler(CommandHandler("admin", admin_cmd))
    app.add_handler(CommandHandler("stats", stats_cmd))
    app.add_handler(CallbackQueryHandler(menu_navigation))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))

    print("✅ Бот запущен (v5: госквота + платная доза + контролёр + /stats).")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
