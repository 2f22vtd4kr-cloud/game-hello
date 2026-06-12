"""
Payment abstraction layer.

MockPaymentProvider is always active and requires no external accounts.
CryptoBotProvider activates when ENABLE_REAL_PAYMENTS=true and CRYPTO_BOT_TOKEN is set.
"""

import hashlib
import hmac
import os
import secrets
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

SIGNING_SECRET = os.getenv("PAYMENT_SIGNING_SECRET", "tma_node_signing_key_dev_2026")
ENABLE_REAL = os.getenv("ENABLE_REAL_PAYMENTS", "false").lower() == "true"


@dataclass
class PaymentResult:
    ok: bool
    transaction_id: str
    qr_hash: str
    checkout_url: Optional[str] = None
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
    """
    Fully functional mock provider.
    Generates real transaction hashes and QR passes with no external calls.
    """

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
    """Requires ENABLE_REAL_PAYMENTS=true and CRYPTO_BOT_TOKEN."""

    def __init__(self):
        self.token = os.getenv("CRYPTO_BOT_TOKEN", "")

    def create_invoice(
        self,
        user_id: int,
        fuel_type: str,
        volume: int,
        price_rub: int,
    ) -> PaymentResult:
        amount_usdt = round(price_rub / 92, 2)
        tx_id = f"CB-{secrets.token_hex(10).upper()}"
        qr = generate_qr_hash(user_id, fuel_type, volume)
        checkout_url = f"https://t.me/CryptoBot?start=invoice_{tx_id}"
        return PaymentResult(
            ok=True, transaction_id=tx_id, qr_hash=qr,
            checkout_url=checkout_url,
        )


def get_provider() -> PaymentProvider:
    if ENABLE_REAL and os.getenv("CRYPTO_BOT_TOKEN"):
        return CryptoBotProvider()
    return MockPaymentProvider()


provider: PaymentProvider = get_provider()
