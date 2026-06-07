import os
import io
import logging
import uuid
import sqlite3
import qrcode
from datetime import datetime
from dotenv import load_dotenv
from telegram import (
    Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo,
    KeyboardButton, ReplyKeyboardMarkup, ReplyKeyboardRemove
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

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
MONETIX_API_KEY = os.getenv("MONETIX_API_KEY", "")
DB_PATH = "vouchers.db"
MAP_URL = "https://fuel.sevtech.org/map"

FUEL_PRODUCTS = {
    "95": {
        "name": "⚡ Бензин АИ-95",
        "stations": {
            "TES": {"price": 1500, "label": "ТЭС Premium Евро-5"},
            "Atan": {"price": 1450, "label": "Атан Ultra 95"},
            "VTK": {"price": 1400, "label": "ВТК Стандарт 95"}
        }
    },
    "92": {
        "name": "🚗 Бензин АИ-92",
        "stations": {
            "TES": {"price": 1200, "label": "ТЭС Классик 92"},
            "Atan": {"price": 1150, "label": "Атан Регуляр 92"},
            "VTK": {"price": 1100, "label": "ВТК Эконом 92"}
        }
    },
    "diesel": {
        "name": "🚜 Дизельное топливо",
        "stations": {
            "TES": {"price": 950, "label": "ТЭС Дизель Pro"},
            "Atan": {"price": 900, "label": "Атан ЭкоДизель"},
            "VTK": {"price": 800, "label": "ВТК Бюджет Дизель"}
        }
    }
}

DISTRICTS = ["Гагаринский район", "Ленинский/Нахимовский", "Балаклава/Северная"]

FUEL_PREFIX = {"95": "95", "92": "92", "diesel": "DZ"}
STATION_PREFIX = {"TES": "TES", "Atan": "ATN", "VTK": "VTK"}


# ─── База данных ────────────────────────────────────────────────────────────

def init_db() -> None:
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS vouchers (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            fuel_type       TEXT NOT NULL,
            station_brand   TEXT NOT NULL,
            district        TEXT NOT NULL,
            qr_code_payload TEXT NOT NULL UNIQUE,
            status          TEXT NOT NULL DEFAULT 'available',
            issued_at       TEXT
        )
    """)
    existing = cur.execute("SELECT COUNT(*) FROM vouchers").fetchone()[0]
    if existing == 0:
        rows = []
        for fuel in FUEL_PRODUCTS:
            for station in FUEL_PRODUCTS[fuel]["stations"]:
                for district in DISTRICTS:
                    for _ in range(5):
                        fp = FUEL_PREFIX[fuel]
                        sp = STATION_PREFIX[station]
                        serial = f"{sp}-{fp}-{uuid.uuid4().hex[:6].upper()}"
                        rows.append((fuel, station, district, serial, "available"))
        cur.executemany(
            "INSERT INTO vouchers (fuel_type, station_brand, district, qr_code_payload, status) VALUES (?,?,?,?,?)",
            rows
        )
        logger.info(f"База данных заполнена: {len(rows)} тестовых ваучеров.")
    con.commit()
    con.close()


def get_and_issue_voucher(fuel_type: str, station_brand: str, district: str):
    """Берёт первый свободный ваучер и помечает его как выданный."""
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    row = cur.execute(
        """SELECT id, qr_code_payload FROM vouchers
           WHERE fuel_type=? AND station_brand=? AND district=? AND status='available'
           ORDER BY id LIMIT 1""",
        (fuel_type, station_brand, district)
    ).fetchone()
    if not row:
        con.close()
        return None
    voucher_id, payload = row
    cur.execute(
        "UPDATE vouchers SET status='issued', issued_at=? WHERE id=?",
        (datetime.utcnow().isoformat(), voucher_id)
    )
    con.commit()
    con.close()
    return payload


# ─── Утилиты ────────────────────────────────────────────────────────────────

def make_qr(data: str) -> io.BytesIO:
    qr = qrcode.QRCode(
        version=2,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


def district_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton("📍 Поделиться геолокацией", request_location=True)],
            [KeyboardButton("Гагаринский район"), KeyboardButton("Ленинский/Нахимовский")],
            [KeyboardButton("Балаклава/Северная")]
        ],
        resize_keyboard=True,
        one_time_keyboard=True
    )


def station_list_message(fuel_type: str, district: str) -> tuple[str, InlineKeyboardMarkup]:
    fuel_name = FUEL_PRODUCTS[fuel_type]["name"]
    text = (
        f"🏙 *Район: {district}*\n"
        f"⛽ *Тип топлива: {fuel_name} (20 л)*\n\n"
        "Выберите сеть АЗС для оформления ваучера:\n\n"
        "⚠️ *Внимание!* Перед выездом на АЗС обязательно сверяйте фактическое "
        "наличие горючего на официальной интерактивной карте:\n"
        f"{MAP_URL}"
    )
    keyboard = []
    for station_id, info in FUEL_PRODUCTS[fuel_type]["stations"].items():
        keyboard.append([
            InlineKeyboardButton(
                f"{info['label']} — {info['price']} руб.",
                callback_data=f"buy_{fuel_type}_{station_id}"
            )
        ])
    keyboard.append([
        InlineKeyboardButton("🗺️ Открыть карту остатков АЗС", url=MAP_URL)
    ])
    keyboard.append([
        InlineKeyboardButton("⬅️ Вернуться в главное меню", callback_data="main_menu")
    ])
    return text, InlineKeyboardMarkup(keyboard)


# ─── Обработчики ────────────────────────────────────────────────────────────

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    context.user_data.clear()
    text = (
        "⛽ *Добро пожаловать в сервис топливных ваучеров Севастополя!*\n\n"
        "Здесь вы можете получить ваучер на АЗС сети ТЭС, Атан или ВТК.\n"
        "Ваучер — одноразовый QR-код на 20 литров, действующий до гашения контролёром.\n\n"
        "👉 *Выберите тип топлива:*"
    )
    keyboard = [
        [InlineKeyboardButton("⚡ Бензин АИ-95", callback_data="fuel_95")],
        [InlineKeyboardButton("🚗 Бензин АИ-92", callback_data="fuel_92")],
        [InlineKeyboardButton("🚜 Дизельное топливо", callback_data="fuel_diesel")]
    ]
    await update.message.reply_text(
        text, parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )


async def menu_navigation(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    data = query.data

    # ── Шаг 1: выбор топлива → запрос геолокации/района ──────────────────
    if data.startswith("fuel_"):
        fuel_type = data.split("_")[1]
        context.user_data["fuel_type"] = fuel_type
        fuel_name = FUEL_PRODUCTS[fuel_type]["name"]

        await query.edit_message_text(
            f"✅ Выбрано: *{fuel_name}*\n\n"
            "📍 *Система квотирования топлива в Севастополе.*\n"
            "Для поиска работающих станций ТЭС и проверки суточных лимитов "
            "поделитесь геолокацией или выберите район города вручную:",
            parse_mode="Markdown"
        )
        await query.message.reply_text(
            "Выберите способ определения района:",
            reply_markup=district_keyboard()
        )

    # ── Шаг 3: карточка заказа ────────────────────────────────────────────
    elif data.startswith("buy_"):
        parts = data.split("_")
        fuel_type = parts[1]
        station_id = parts[2]
        product = FUEL_PRODUCTS[fuel_type]["stations"][station_id]
        price = product["price"]

        context.user_data["station_id"] = station_id

        simulated_monetix_url = f"https://paymetodaygo.online/checkout/{uuid.uuid4().hex[:10]}"

        checkout_text = (
            f"🛒 *Подтверждение заказа:*\n\n"
            f"• *Товар:* 20 л ({product['label']})\n"
            f"• *Формат:* Одноразовый QR-ваучер\n"
            f"• *К оплате:* `{price} RUB`\n\n"
            "Нажмите кнопку для оплаты через СБП или используйте тестовую симуляцию."
        )

        keyboard = [
            [InlineKeyboardButton("💳 Оплатить через СБП", web_app=WebAppInfo(url=simulated_monetix_url))],
            [InlineKeyboardButton("🤖 Тестовая оплата (Симуляция)", callback_data=f"sim_{fuel_type}_{station_id}")],
            [InlineKeyboardButton("❌ Отменить заказ", callback_data="main_menu")]
        ]
        await query.edit_message_text(
            checkout_text, parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )

    # ── Шаг 4: симуляция оплаты → выдача ваучера из БД ───────────────────
    elif data.startswith("sim_"):
        parts = data.split("_")
        fuel_type = parts[1]
        station_id = parts[2]
        district = context.user_data.get("district", "Гагаринский район")

        await query.edit_message_text("⏳ Обрабатываю платёж и формирую ваучер...")

        payload = get_and_issue_voucher(fuel_type, station_id, district)

        if not payload:
            await query.edit_message_text(
                "⚠️ *Ваучеры для выбранной комбинации закончились.*\n\n"
                "Попробуйте другую АЗС или район.",
                parse_mode="Markdown",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("⬅️ В главное меню", callback_data="main_menu")
                ]])
            )
            return

        await query.edit_message_text(
            "🎉 *Оплата успешно получена!*\n\nФормирую ваш персональный QR-код...",
            parse_mode="Markdown"
        )

        qr_image = make_qr(payload)
        station_label = FUEL_PRODUCTS[fuel_type]["stations"][station_id]["label"]

        caption = (
            f"🎉 *Ваш персональный QR-код на 20 литров успешно сгенерирован!*\n\n"
            f"🏷 Серийный номер: `{payload}`\n"
            f"⛽ АЗС: {station_label}\n"
            f"🏙 Район: {district}\n\n"
            "📋 *Инструкция:*\n"
            "1. Код действует до момента гашения сотрудником АЗС.\n"
            "2. На заправке ТЭС предъявите код контролёру Правительства Севастополя.\n"
            "3. Контролёр сверит данные кода с госномером вашего авто и погасит его, "
            "после чего вы сможете заправиться.\n"
            "4. Повторный код для этой машины можно получить только через 7 дней."
        )

        await query.message.reply_photo(
            photo=qr_image,
            caption=caption,
            parse_mode="Markdown"
        )

    # ── Главное меню ──────────────────────────────────────────────────────
    elif data == "main_menu":
        context.user_data.clear()
        keyboard = [
            [InlineKeyboardButton("⚡ Бензин АИ-95", callback_data="fuel_95")],
            [InlineKeyboardButton("🚗 Бензин АИ-92", callback_data="fuel_92")],
            [InlineKeyboardButton("🚜 Дизельное топливо", callback_data="fuel_diesel")]
        ]
        await query.edit_message_text(
            "⛽ Выберите тип топлива:",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )


async def handle_location(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обрабатывает геолокацию пользователя."""
    fuel_type = context.user_data.get("fuel_type")
    if not fuel_type:
        await update.message.reply_text(
            "Пожалуйста, начните с команды /start.",
            reply_markup=ReplyKeyboardRemove()
        )
        return

    loc = update.message.location
    lat, lon = loc.latitude, loc.longitude

    # Простая классификация по координатам Севастополя
    if lat < 44.55:
        district = "Балаклава/Северная"
    elif lon < 33.52:
        district = "Гагаринский район"
    else:
        district = "Ленинский/Нахимовский"

    context.user_data["district"] = district

    await update.message.reply_text(
        f"📍 Определён район: *{district}*",
        parse_mode="Markdown",
        reply_markup=ReplyKeyboardRemove()
    )

    text, markup = station_list_message(fuel_type, district)
    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=markup)


async def handle_district_choice(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обрабатывает ручной выбор района."""
    fuel_type = context.user_data.get("fuel_type")
    if not fuel_type:
        await update.message.reply_text(
            "Пожалуйста, начните с команды /start.",
            reply_markup=ReplyKeyboardRemove()
        )
        return

    district = update.message.text
    context.user_data["district"] = district

    await update.message.reply_text(
        f"📍 Выбран район: *{district}*",
        parse_mode="Markdown",
        reply_markup=ReplyKeyboardRemove()
    )

    text, markup = station_list_message(fuel_type, district)
    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=markup)


# ─── Запуск ─────────────────────────────────────────────────────────────────

def main() -> None:
    if not BOT_TOKEN:
        print("Ошибка: токен бота не задан.")
        return

    init_db()

    app = Application.builder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(menu_navigation))
    app.add_handler(MessageHandler(filters.LOCATION, handle_location))
    app.add_handler(MessageHandler(
        filters.Text(DISTRICTS),
        handle_district_choice
    ))

    print("✅ Бот запущен (режим: Севастополь + SQLite ваучеры).")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
