import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import Database from "better-sqlite3";
import QRCode from "qrcode";
import path from "path";
import { logger } from "../lib/logger";

const router = Router();

const CRYPTO_BOT_TOKEN = process.env.CRYPTO_BOT_TOKEN ?? "";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID ? Number(process.env.ADMIN_CHAT_ID) : null;
const PAID_AMOUNT_USDT = 12;
const USDT_RUB_RATE = 92;
const DB_PATH = path.join(process.cwd(), "vouchers.db");
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const FUEL_LABELS: Record<string, string> = {
  "95": "АИ-95",
  "92": "АИ-92",
  diesel: "Дизель",
};
const STATION_LABELS: Record<string, string> = {
  TES: "ТЭС",
  Atan: "Атан",
  VTK: "ВТК",
};

function verifySignature(rawBody: Buffer, signature: string): boolean {
  try {
    const secret = crypto
      .createHash("sha256")
      .update(CRYPTO_BOT_TOKEN)
      .digest();
    const hmac = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    return hmac === signature;
  } catch {
    return false;
  }
}

async function sendTelegramPhoto(
  chatId: number,
  qrBuffer: Buffer,
  caption: string,
): Promise<void> {
  const formData = new FormData();
  formData.append("chat_id", chatId.toString());
  formData.append(
    "photo",
    new Blob([qrBuffer], { type: "image/png" }),
    "voucher_qr.png",
  );
  formData.append("caption", caption);
  formData.append("parse_mode", "Markdown");

  const resp = await fetch(`${TG_API}/sendPhoto`, {
    method: "POST",
    body: formData,
  });
  if (!resp.ok) {
    const err = await resp.text();
    logger.error({ err }, "Telegram sendPhoto failed");
  }
}

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  await fetch(`${TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

router.post("/cryptobot", async (req: Request, res: Response) => {
  const signature = req.headers["crypto-pay-api-signature"];
  if (typeof signature !== "string" || !req.rawBody) {
    res.status(400).json({ ok: false, error: "missing signature or body" });
    return;
  }

  if (!verifySignature(req.rawBody, signature)) {
    logger.warn("CryptoBot webhook: invalid signature");
    res.status(403).json({ ok: false, error: "invalid signature" });
    return;
  }

  const update = req.body as {
    update_type?: string;
    payload?: { invoice_id?: number; status?: string; payload?: string };
  };

  if (update.update_type !== "invoice_paid") {
    res.json({ ok: true });
    return;
  }

  const invoice = update.payload;
  if (!invoice || invoice.status !== "paid" || !invoice.payload) {
    res.json({ ok: true });
    return;
  }

  const orderId = invoice.payload;

  let db: Database.Database | null = null;
  try {
    db = new Database(DB_PATH);

    const pending = db
      .prepare(
        "SELECT chat_id, plate, fuel_type FROM pending_payments WHERE order_id = ?",
      )
      .get(orderId) as
      | { chat_id: number; plate: string; fuel_type: string }
      | undefined;

    if (!pending) {
      logger.warn({ orderId }, "CryptoBot webhook: pending_payment not found");
      res.json({ ok: true });
      return;
    }

    const { chat_id, plate, fuel_type } = pending;

    const voucher = db
      .prepare(
        `SELECT id, qr_code_payload, station_brand
         FROM vouchers
         WHERE fuel_type = ? AND station_brand = 'TES' AND status = 'available'
         LIMIT 1`,
      )
      .get(fuel_type) as
      | { id: number; qr_code_payload: string; station_brand: string }
      | undefined;

    if (!voucher) {
      await sendTelegramMessage(
        chat_id,
        "⚠️ Оплата получена, но ваучеры временно исчерпаны. Свяжитесь с поддержкой.",
      );
      res.json({ ok: true });
      return;
    }

    const now = new Date().toISOString().slice(0, 10);
    db.prepare(
      `UPDATE vouchers
       SET status='issued', license_plate=?, issued_at=?, voucher_type='paid', chat_id=?
       WHERE id=?`,
    ).run(plate, now, chat_id, voucher.id);

    db.prepare("DELETE FROM pending_payments WHERE order_id=?").run(orderId);

    const qrBuffer = await QRCode.toBuffer(voucher.qr_code_payload, {
      errorCorrectionLevel: "H",
      width: 512,
    });

    const fuelLabel = FUEL_LABELS[fuel_type] ?? fuel_type;
    const stationLabel = STATION_LABELS[voucher.station_brand] ?? voucher.station_brand;

    const caption =
      `⚡ *Коммерческий ваучер на 20 литров*\n\n` +
      `🏷 Ваучер №\`${voucher.qr_code_payload}\`\n` +
      `⛽ Топливо: *${fuelLabel}*\n` +
      `🏪 АЗС: *${stationLabel}*\n` +
      `🚗 Госномер: \`${plate}\`\n\n` +
      `⚠️ *Важно:* Сам бензин оплачивается отдельно на кассе АЗС «ТЭС» после гашения QR-кода контролёром.\n\n` +
      `📋 *Инструкция:*\n` +
      `1. Предъявите QR контролёру Правительства Севастополя на АЗС ТЭС.\n` +
      `2. Контролёр сверит код с госномером и погасит его.\n` +
      `3. После гашения оплатите топливо на кассе по тарифу АЗС.\n` +
      `4. Следующий платный ваучер — не ранее чем через *7 дней*.`;

    await sendTelegramPhoto(chat_id, qrBuffer, caption);
    logger.info({ orderId, plate, fuel_type }, "Paid voucher issued via webhook");

    if (ADMIN_CHAT_ID) {
      const now = new Date().toLocaleString("ru-RU", { timeZone: "UTC" });
      const adminMsg =
        `🔔 *РЕГИСТРАЦИЯ ТРАНЗАКЦИИ (УСПЕШНАЯ ОПЛАТА)*\n` +
        `• Госномер ТС: \`${plate}\`\n` +
        `• Тип ваучера: Дополнительный объём (20 литров)\n` +
        `• Платёжная система: Crypto Pay API (P2P-Фиат)\n` +
        `• Сумма: \`${PAID_AMOUNT_USDT} USDT ≈ ${PAID_AMOUNT_USDT * USDT_RUB_RATE} ₽\`\n` +
        `• Время фиксации: ${now} UTC\n` +
        `────────────────────────\n` +
        `Учётный QR-ваучер успешно сгенерирован и отправлен пользователю.`;
      await sendTelegramMessage(ADMIN_CHAT_ID, adminMsg).catch(() => {});
    }
  } catch (err) {
    logger.error({ err, orderId }, "CryptoBot webhook processing error");
    res.status(500).json({ ok: false, error: "internal error" });
    return;
  } finally {
    db?.close();
  }

  res.json({ ok: true });
});

export default router;
