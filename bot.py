import os
import logging
import httpx
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, PreCheckoutQueryHandler, ContextTypes, filters

load_dotenv()

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
INTERNAL_API_SECRET = os.getenv("INTERNAL_API_SECRET", "tma_internal_dev_2026")
TMA_BACKEND_URL = os.getenv("TMA_BACKEND_URL", "http://localhost:8000")

STAR_RUB_RATE = 1.84  # 1 Star ≈ 1.84 RUB


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "Менюшечку слева внизу 🎟️ тыц! И выбираешь бензинчик, дизельку там… ⬇️ что хочешь"
    )


async def successful_payment(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Fires when a user completes a Telegram Stars payment.
    Station voucher payload:  tma_{user_id}_{fuel_type}_{volume}_{station_id}
    Network voucher payload:  tmanet_{user_id}_{fuel_type}_{volume}_{network~encoded}
    """
    payment = update.message.successful_payment
    payload = payment.invoice_payload
    stars_amount = payment.total_amount
    chat_id = update.effective_chat.id

    logger.info("successful_payment: payload=%s stars=%d chat_id=%d", payload, stars_amount, chat_id)

    is_network = payload.startswith("tmanet_")

    try:
        if is_network:
            parts = payload.split("_", 4)  # tmanet, user_id, fuel_type, volume, network~encoded
            if len(parts) < 5:
                raise ValueError(f"Bad tmanet payload: {payload}")
            _, user_id_str, fuel_type, volume_str, safe_network = parts
            user_id = int(user_id_str)
            volume = int(volume_str)
            network = safe_network.replace("~", " ")
            price_rub = round(stars_amount * STAR_RUB_RATE)
        else:
            parts = payload.split("_", 4)  # tma, user_id, fuel_type, volume, station_id
            if parts[0] != "tma" or len(parts) < 5:
                raise ValueError(f"Bad tma payload: {payload}")
            _, user_id_str, fuel_type, volume_str, station_id_str = parts
            user_id = int(user_id_str)
            volume = int(volume_str)
            station_id = int(station_id_str)
            price_rub = round(stars_amount * STAR_RUB_RATE)
    except Exception as exc:
        logger.error("Failed to parse Stars payment payload: %s — %s", payload, exc)
        await update.message.reply_text(
            "⚠️ Оплата получена, но произошла ошибка при оформлении ваучера. "
            "Обратитесь в поддержку и сообщите: " + payload
        )
        return

    # Record purchase in TMA backend
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            if is_network:
                resp = await client.post(
                    f"{TMA_BACKEND_URL}/internal/record-network-stars-purchase",
                    json={
                        "user_id": user_id,
                        "fuel_type": fuel_type,
                        "volume": volume,
                        "network": network,
                        "price_rub": price_rub,
                        "stars_amount": stars_amount,
                        "internal_secret": INTERNAL_API_SECRET,
                    },
                )
                label = f"Сетевой ваучер {network} {volume} л {fuel_type}"
            else:
                resp = await client.post(
                    f"{TMA_BACKEND_URL}/internal/record-stars-purchase",
                    json={
                        "user_id": user_id,
                        "fuel_type": fuel_type,
                        "volume": volume,
                        "station_id": station_id,
                        "price_rub": price_rub,
                        "stars_amount": stars_amount,
                        "internal_secret": INTERNAL_API_SECRET,
                    },
                )
                label = f"Ваучер {volume} л {fuel_type}"

        if resp.status_code == 200:
            logger.info("Stars purchase recorded: user_id=%d %s", user_id, label)
            await update.message.reply_text(
                f"✅ Оплата прошла! {label} активирован.\n"
                f"Открой 🗄 Хранилище в приложении — там твой QR-код."
            )
        else:
            logger.error("record-stars-purchase returned %d: %s", resp.status_code, resp.text)
            await update.message.reply_text(
                "⚠️ Оплата получена, но ваучер временно не удалось записать. "
                "Попробуй открыть приложение через минуту — либо напиши в поддержку."
            )
    except Exception as exc:
        logger.exception("Failed to call record-stars-purchase: %s", exc)
        await update.message.reply_text(
            "⚠️ Оплата получена, но сервер временно недоступен. "
            "Ваучер появится в Хранилище в течение нескольких минут."
        )


async def pre_checkout_query(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Telegram requires answering pre_checkout_query within 10 seconds.
    Always approve — actual validation happens in successful_payment.
    """
    query = update.pre_checkout_query
    await query.answer(ok=True)
    logger.info("pre_checkout_query answered ok=True: id=%s payload=%s", query.id, query.invoice_payload)


async def post_init(app: Application) -> None:
    await app.bot.delete_my_commands()
    logger.info("Bot command list cleared.")


def main() -> None:
    if not BOT_TOKEN:
        logger.warning(
            "TELEGRAM_BOT_TOKEN is not set — bot is disabled. "
            "Set the secret to enable the Telegram bot."
        )
        import time
        while True:
            time.sleep(3600)
        return

    app = (
        Application.builder()
        .token(BOT_TOKEN)
        .post_init(post_init)
        .build()
    )
    app.add_handler(CommandHandler("start", start))
    app.add_handler(PreCheckoutQueryHandler(pre_checkout_query))
    app.add_handler(MessageHandler(filters.SUCCESSFUL_PAYMENT, successful_payment))
    logger.info("Бот запущен.")

    if os.getenv("REPLIT_DEPLOYMENT"):
        # Production (autoscale): webhook mode — Telegram pushes updates to our
        # public URL, FastAPI at /tg/webhook proxies here on port 8443.
        # This avoids 409 conflicts from multiple polling instances.
        domain = os.getenv("REPLIT_DOMAINS", "").split(",")[0].strip()
        webhook_url = f"https://{domain}/tg/webhook"
        logger.info("Production webhook mode: %s → localhost:8443", webhook_url)
        app.run_webhook(
            listen="127.0.0.1",
            port=8443,
            url_path="/tg/webhook",
            webhook_url=webhook_url,
        )
    else:
        # Development: polling (simpler, no public URL needed)
        app.run_polling()


if __name__ == "__main__":
    main()
