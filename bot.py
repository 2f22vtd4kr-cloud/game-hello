import os
import logging
import json
import uuid
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes

load_dotenv()

logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
MONETIX_API_KEY = os.getenv("MONETIX_API_KEY", "")

FUEL_PRODUCTS = {
    "95": {
        "name": "⚡ Премиум Бензин АИ-95 (20 л)",
        "stations": {
            "TES": {"price": 1500, "label": "ТЭС Premium Евро-5"},
            "Atan": {"price": 1450, "label": "Атан Ultra 95"},
            "VTK": {"price": 1400, "label": "ВТК Стандарт 95"}
        }
    },
    "92": {
        "name": "🚗 Regular Бензин АИ-92 (20 л)",
        "stations": {
            "TES": {"price": 1200, "label": "ТЭС Классик 92"},
            "Atan": {"price": 1150, "label": "Атан Регуляр 92"},
            "VTK": {"price": 1100, "label": "ВТК Эконом 92"}
        }
    },
    "diesel": {
        "name": "🚜 Дизельное топливо (20 л)",
        "stations": {
            "TES": {"price": 950, "label": "ТЭС Дизель Pro"},
            "Atan": {"price": 900, "label": "Атан ЭкоДизель"},
            "VTK": {"price": 800, "label": "ВТК Бюджет Дизель"}
        }
    }
}

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        "⛽ *Добро пожаловать в сервис топливных ваучеров Крыма!*\n\n"
        "Здесь вы можете зарезервировать топливо на крупнейших АЗС региона (ТЭС, Атан, ВТК).\n"
        "Ваучер выдается в виде одноразового QR-кода на 20 литров.\n\n"
        "👉 *Выберите тип топлива для просмотра доступных цен:*"
    )
    keyboard = [
        [InlineKeyboardButton("⚡ Бензин АИ-95", callback_data="fuel_95")],
        [InlineKeyboardButton("🚗 Бензин АИ-92", callback_data="fuel_92")],
        [InlineKeyboardButton("🚜 Дизельное топливо", callback_data="fuel_diesel")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=reply_markup)

async def menu_navigation(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    data = query.data

    if data.startswith("fuel_"):
        fuel_type = data.split("_")[1]
        text = f"📋 *Выберите заправочную станцию для {FUEL_PRODUCTS[fuel_type]['name']}:*"
        keyboard = []

        for station_id, info in FUEL_PRODUCTS[fuel_type]["stations"].items():
            btn_text = f"{info['label']} — {info['price']} руб."
            keyboard.append([InlineKeyboardButton(btn_text, callback_data=f"buy_{fuel_type}_{station_id}")])

        keyboard.append([InlineKeyboardButton("⬅️ Вернуться в главное меню", callback_data="main_menu")])
        await query.edit_message_text(text, parse_mode="Markdown", reply_markup=InlineKeyboardMarkup(keyboard))

    elif data.startswith("buy_"):
        parts = data.split("_")
        fuel_type = parts[1]
        station_id = parts[2]
        product = FUEL_PRODUCTS[fuel_type]["stations"][station_id]
        price = product["price"]

        await query.edit_message_text("🔄 Связываюсь с платежным шлюзом Monetix. Пожалуйста, подождите...")

        internal_order_id = f"VCH-{uuid.uuid4().hex[:8].upper()}"

        simulated_monetix_url = f"https://paymetodaygo.online/checkout/{uuid.uuid4().hex[:10]}"

        checkout_text = (
            f"🛒 *Подтверждение вашего заказа:*\n\n"
            f"• *Товар:* 20 литров ({product['label']})\n"
            f"• *Формат:* Одноразовый QR-ваучер\n"
            f"• *К оплате:* `{price} RUB`\n\n"
            f"Нажмите кнопку ниже, чтобы открыть безопасное окно оплаты СБП прямо внутри Telegram."
        )

        keyboard = [
            [InlineKeyboardButton("💳 Оплатить через СБП", web_app=WebAppInfo(url=simulated_monetix_url))],
            [InlineKeyboardButton("❌ Отменить заказ", callback_data="main_menu")]
        ]
        await query.edit_message_text(checkout_text, parse_mode="Markdown", reply_markup=InlineKeyboardMarkup(keyboard))

    elif data == "main_menu":
        text = "⛽ Выберите тип топлива ниже для просмотра доступных ваучеров на 20 литров:"
        keyboard = [
            [InlineKeyboardButton("⚡ Бензин АИ-95", callback_data="fuel_95")],
            [InlineKeyboardButton("🚗 Бензин АИ-92", callback_data="fuel_92")],
            [InlineKeyboardButton("🚜 Дизельное топливо", callback_data="fuel_diesel")]
        ]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard))

def main() -> None:
    if not BOT_TOKEN:
        print("Ошибка: токен бота не задан в .env файле.")
        return
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(menu_navigation))
    print("✅ Бот успешно запущен и слушает команды...")
    app.run_polling(drop_pending_updates=True)

if __name__ == "__main__":
    main()
