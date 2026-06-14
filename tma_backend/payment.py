"""
Payment abstraction layer.

MockPaymentProvider   — always active, no external calls.
CryptoBotProvider     — real CryptoBot API (requires CRYPTO_BOT_TOKEN).
StarsPaymentProvider  — Telegram Stars via bot (requires BOT_TOKEN).
"""

import hashlib
import hmac
import os
import secrets
import time
import logging
import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

SIGNING_SECRET   = os.getenv("PAYMENT_SIGNING_SECRET", "tma_node_signing_key_dev_2026")
CRYPTO_BOT_TOKEN = os.getenv("CRYPTO_BOT_TOKEN", "")
CRYPTO_PAY_API   = os.getenv("CRYPTO_PAY_API", "https://pay.crypt.bot/api")
# PAYMENT_METHOD controls which provider is used:
#   "auto"      → CryptoBotProvider when CRYPTO_BOT_TOKEN is set, else Mock
#   "cryptobot" → CryptoBotProvider (requires CRYPTO_BOT_TOKEN)
#   "stars"     → StarsPaymentProvider (Telegram Stars)
#   "mock"      → MockPaymentProvider (testing)
PAYMENT_METHOD = os.getenv("PAYMENT_METHOD", "auto")

FUEL_PRICES_RUB: dict[str, int] = {
    "АИ-92": 47, "АИ-95": 52, "АИ-95+": 56,
    "АИ-100": 68, "ДТ": 60, "ДТ+": 65, "Газ": 28,
}
USDT_RUB_RATE = 92.0


@dataclass
class PaymentResult:
    ok: bool
    transaction_id: str
    qr_hash: str
    checkout_url: Optional[str] = None
    invoice_id: Optional[int] = None
    stars_amount: Optional[int] = None
    error: Optional[str] = None


def generate_qr_hash(user_id: int, fuel_type: str, volume: int) -> str:
    raw = f"{user_id}:{fuel_type}:{volume}:{time.time_ns()}:{secrets.token_hex(8)}"
    sig = hmac.new(SIGNING_SECRET.encode(), raw.encode(), hashlib.sha256).hexdigest()
    return f"TMA-{sig[:32].upper()}"


class PaymentProvider(ABC):
    @abstractmethod
    def create_invoice(
        self,
        user_id: int,
        fuel_type: str,
        volume: int,
        price_rub: int,
    ) -> PaymentResult: ...


class MockPaymentProvider(PaymentProvider):
    """Fully functional mock — no external calls."""

    def create_invoice(
        self,
        user_id: int,
        fuel_type: str,
        volume: int,
        price_rub: int,
    ) -> PaymentResult:
        tx_id = f"MOCK-{secrets.token_hex(10).upper()}"
        qr = generate_qr_hash(user_id, fuel_type, volume)
        return PaymentResult(ok=True, transaction_id=tx_id, qr_hash=qr)


class CryptoBotProvider(PaymentProvider):
    """
    Real CryptoBot invoice via https://pay.crypt.bot/api/createInvoice.
    Requires CRYPTO_BOT_TOKEN secret.
    """

    def __init__(self) -> None:
        self.token = CRYPTO_BOT_TOKEN
        self.headers = {"Crypto-Pay-API-Token": self.token}

    def create_invoice(
        self,
        user_id: int,
        fuel_type: str,
        volume: int,
        price_rub: int,
    ) -> PaymentResult:
        amount_usdt = round(price_rub / USDT_RUB_RATE, 2)
        qr = generate_qr_hash(user_id, fuel_type, volume)
        description = f"⛽️ Ваучер {volume}л {fuel_type} — Топливо"

        try:
            resp = httpx.post(
                f"{CRYPTO_PAY_API}/createInvoice",
                headers=self.headers,
                json={
                    "asset": "USDT",
                    "amount": str(amount_usdt),
                    "description": description,
                    "payload": qr,
                    "allow_comments": False,
                    "allow_anonymous": False,
                    "expires_in": 3600,
                },
                timeout=10,
            )
            data = resp.json()
            if not data.get("ok"):
                error_msg = data.get("error", {}).get("name", "CryptoBot error")
                logger.error("CryptoBot createInvoice failed: %s", data)
                tx_id = f"CB-ERR-{secrets.token_hex(6).upper()}"
                return PaymentResult(
                    ok=False, transaction_id=tx_id, qr_hash=qr,
                    error=error_msg,
                )
            invoice = data["result"]
            invoice_id = invoice.get("invoice_id", 0)
            pay_url = invoice.get("pay_url", f"https://t.me/CryptoBot?start=invoice_{invoice_id}")
            tx_id = f"CB-{invoice_id}"
            return PaymentResult(
                ok=True, transaction_id=tx_id, qr_hash=qr,
                checkout_url=pay_url, invoice_id=invoice_id,
            )
        except Exception as exc:
            logger.exception("CryptoBotProvider network error: %s", exc)
            tx_id = f"CB-NET-{secrets.token_hex(6).upper()}"
            return PaymentResult(
                ok=False, transaction_id=tx_id, qr_hash=qr,
                error=str(exc),
            )


class StarsPaymentProvider(PaymentProvider):
    """
    Creates a Telegram Stars invoice record.
    The actual Stars invoice is sent by the bot; here we just compute
    how many Stars are needed and return the metadata.
    Stars price: 1 Star ≈ $0.02 USD ≈ 1.84 RUB (at ~92 RUB/USD).
    We use ceil(price_rub / 1.84) stars, minimum 1.
    """

    STAR_RUB_RATE = 1.84  # 1 Star ≈ 1.84 RUB

    def create_invoice(
        self,
        user_id: int,
        fuel_type: str,
        volume: int,
        price_rub: int,
    ) -> PaymentResult:
        import math
        stars = max(1, math.ceil(price_rub / self.STAR_RUB_RATE))
        qr = generate_qr_hash(user_id, fuel_type, volume)
        tx_id = f"STARS-{secrets.token_hex(8).upper()}"
        return PaymentResult(
            ok=True, transaction_id=tx_id, qr_hash=qr,
            stars_amount=stars,
        )


def get_provider(method: str = PAYMENT_METHOD) -> PaymentProvider:
    """
    Return the appropriate provider by method name.
    Defaults to PAYMENT_METHOD env var ("auto" → CryptoBot if token set, else Mock).
    """
    resolved = method if method != "auto" else ("cryptobot" if CRYPTO_BOT_TOKEN else "mock")
    if resolved == "cryptobot":
        if not CRYPTO_BOT_TOKEN:
            logger.warning("PAYMENT_METHOD=cryptobot but CRYPTO_BOT_TOKEN is not set — falling back to mock")
            return MockPaymentProvider()
        return CryptoBotProvider()
    if resolved == "stars":
        return StarsPaymentProvider()
    return MockPaymentProvider()


# Module-level default provider (uses PAYMENT_METHOD env var)
provider: PaymentProvider = get_provider()
