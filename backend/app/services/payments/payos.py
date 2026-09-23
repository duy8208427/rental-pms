from __future__ import annotations

import hashlib
import hmac
import json
from decimal import Decimal
from typing import Any

import httpx
from fastapi import HTTPException

from app.config import Settings
from app.services.payments.base import GatewayCreateResult, WebhookResult


def _payos_signature(checksum_key: str, data: dict[str, Any]) -> str:
    """PayOS checksum: sort keys, join key=value&, HMAC SHA256."""
    pairs = []
    for key in sorted(data.keys()):
        val = data[key]
        if val is None:
            val = ""
        pairs.append(f"{key}={val}")
    raw = "&".join(pairs)
    return hmac.new(
        checksum_key.encode("utf-8"),
        raw.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


class PayOSGateway:
    def __init__(self, settings: Settings):
        self.settings = settings

    def _configured(self) -> bool:
        return bool(
            self.settings.payos_client_id
            and self.settings.payos_api_key
            and self.settings.payos_checksum_key
        )

    def create_payment(
        self,
        *,
        order_id: str,
        amount: Decimal,
        description: str,
        buyer_name: str | None = None,
    ) -> GatewayCreateResult:
        if not self._configured():
            raise HTTPException(
                503,
                "PayOS chưa cấu hình (PAYOS_CLIENT_ID / API_KEY / CHECKSUM_KEY). "
                "Dùng PAYMENT_MODE=sandbox để demo local.",
            )

        # PayOS orderCode must be integer
        order_code = abs(hash(order_id)) % (10**9)
        amount_int = int(amount)
        desc = (description or "Thanh toan")[:25]
        cancel_url = self.settings.payos_cancel_url
        return_url = self.settings.payos_return_url

        sign_data = {
            "amount": amount_int,
            "cancelUrl": cancel_url,
            "description": desc,
            "orderCode": order_code,
            "returnUrl": return_url,
        }
        signature = _payos_signature(self.settings.payos_checksum_key, sign_data)

        body: dict[str, Any] = {
            "orderCode": order_code,
            "amount": amount_int,
            "description": desc,
            "cancelUrl": cancel_url,
            "returnUrl": return_url,
            "signature": signature,
        }
        if buyer_name:
            body["buyerName"] = buyer_name

        headers = {
            "x-client-id": self.settings.payos_client_id,
            "x-api-key": self.settings.payos_api_key,
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.post(self.settings.payos_endpoint, json=body, headers=headers)
                data = res.json()
        except Exception as exc:
            raise HTTPException(502, f"Không kết nối được PayOS: {exc}") from exc

        if res.status_code >= 400 or data.get("code") not in ("00", 0, "0"):
            raise HTTPException(
                502,
                f"PayOS từ chối tạo giao dịch: {data.get('desc') or data}",
            )

        payload = data.get("data") or {}
        return GatewayCreateResult(
            provider_order_id=str(order_code),
            pay_url=payload.get("checkoutUrl"),
            qr_code=payload.get("qrCode"),
            raw=data,
        )

    def parse_webhook(self, payload: dict[str, Any]) -> WebhookResult:
        if not self._configured():
            raise HTTPException(503, "PayOS chưa cấu hình")

        data = payload.get("data") or payload
        # Verify signature on data object when present
        received = str(payload.get("signature") or data.get("signature") or "")
        if received and isinstance(data, dict):
            # PayOS webhook: sign fields amount, code, desc, orderCode, paymentLinkId, status, etc.
            sign_fields = {
                k: data.get(k)
                for k in (
                    "amount",
                    "code",
                    "desc",
                    "orderCode",
                    "paymentLinkId",
                    "status",
                    "transactionDateTime",
                    "currency",
                )
                if k in data
            }
            if sign_fields:
                expected = _payos_signature(self.settings.payos_checksum_key, sign_fields)
                if not hmac.compare_digest(expected, received):
                    # Some PayOS versions send signature over different field sets;
                    # fall back to sorting all non-null stringifiable fields except signature
                    alt = {k: v for k, v in data.items() if k != "signature" and not isinstance(v, (dict, list))}
                    expected2 = _payos_signature(self.settings.payos_checksum_key, alt)
                    if not hmac.compare_digest(expected2, received):
                        raise HTTPException(400, "Chữ ký PayOS không hợp lệ")

        order_code = str(data.get("orderCode") or "")
        status = str(data.get("status") or payload.get("code") or "").upper()
        success = status in ("PAID", "00", "SUCCESS") or str(payload.get("code")) == "00"
        amount_raw = data.get("amount")
        return WebhookResult(
            provider_order_id=order_code,
            success=success,
            amount=Decimal(str(amount_raw)) if amount_raw is not None else None,
            raw=payload if isinstance(payload, dict) else {"data": payload},
            message=str(data.get("desc") or status),
        )
