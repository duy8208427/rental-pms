from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from decimal import Decimal
from typing import Any

import httpx
from fastapi import HTTPException

from app.config import Settings
from app.services.payments.base import GatewayCreateResult, WebhookResult


class MomoGateway:
    def __init__(self, settings: Settings):
        self.settings = settings

    def _configured(self) -> bool:
        return bool(
            self.settings.momo_partner_code
            and self.settings.momo_access_key
            and self.settings.momo_secret_key
        )

    def create_payment(
        self,
        *,
        order_id: str,
        amount: Decimal,
        description: str,
        buyer_name: str | None = None,
    ) -> GatewayCreateResult:
        _ = buyer_name
        if not self._configured():
            raise HTTPException(
                503,
                "MoMo chưa cấu hình (MOMO_PARTNER_CODE / ACCESS_KEY / SECRET_KEY). "
                "Dùng PAYMENT_MODE=sandbox để demo local.",
            )

        request_id = str(uuid.uuid4())
        amount_int = int(amount)
        order_info = (description or "Thanh toan hoa don")[:50]
        extra_data = ""
        raw_signature = (
            f"accessKey={self.settings.momo_access_key}"
            f"&amount={amount_int}"
            f"&extraData={extra_data}"
            f"&ipnUrl={self.settings.momo_ipn_url}"
            f"&orderId={order_id}"
            f"&orderInfo={order_info}"
            f"&partnerCode={self.settings.momo_partner_code}"
            f"&redirectUrl={self.settings.momo_redirect_url}"
            f"&requestId={request_id}"
            f"&requestType=captureWallet"
        )
        signature = hmac.new(
            self.settings.momo_secret_key.encode("utf-8"),
            raw_signature.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        body = {
            "partnerCode": self.settings.momo_partner_code,
            "partnerName": "Rental PMS",
            "storeId": "RentalPMS",
            "requestId": request_id,
            "amount": amount_int,
            "orderId": order_id,
            "orderInfo": order_info,
            "redirectUrl": self.settings.momo_redirect_url,
            "ipnUrl": self.settings.momo_ipn_url,
            "lang": "vi",
            "extraData": extra_data,
            "requestType": "captureWallet",
            "signature": signature,
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.post(self.settings.momo_endpoint, json=body)
                data = res.json()
        except Exception as exc:
            raise HTTPException(502, f"Không kết nối được MoMo: {exc}") from exc

        if res.status_code >= 400 or data.get("resultCode", -1) not in (0,):
            raise HTTPException(
                502,
                f"MoMo từ chối tạo giao dịch: {data.get('message') or data}",
            )

        return GatewayCreateResult(
            provider_order_id=order_id,
            pay_url=data.get("payUrl") or data.get("deeplink"),
            qr_code=data.get("qrCodeUrl") or data.get("payUrl"),
            raw=data,
        )

    def parse_webhook(self, payload: dict[str, Any]) -> WebhookResult:
        if not self._configured():
            raise HTTPException(503, "MoMo chưa cấu hình")

        access_key = self.settings.momo_access_key
        amount = payload.get("amount", "")
        extra_data = payload.get("extraData", "")
        message = payload.get("message", "")
        order_id = payload.get("orderId", "")
        order_info = payload.get("orderInfo", "")
        order_type = payload.get("orderType", "")
        partner_code = payload.get("partnerCode", "")
        pay_type = payload.get("payType", "")
        request_id = payload.get("requestId", "")
        response_time = payload.get("responseTime", "")
        result_code = payload.get("resultCode", "")
        trans_id = payload.get("transId", "")

        raw_signature = (
            f"accessKey={access_key}"
            f"&amount={amount}"
            f"&extraData={extra_data}"
            f"&message={message}"
            f"&orderId={order_id}"
            f"&orderInfo={order_info}"
            f"&orderType={order_type}"
            f"&partnerCode={partner_code}"
            f"&payType={pay_type}"
            f"&requestId={request_id}"
            f"&responseTime={response_time}"
            f"&resultCode={result_code}"
            f"&transId={trans_id}"
        )
        expected = hmac.new(
            self.settings.momo_secret_key.encode("utf-8"),
            raw_signature.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        received = str(payload.get("signature") or "")
        if not hmac.compare_digest(expected, received):
            raise HTTPException(400, "Chữ ký MoMo không hợp lệ")

        success = str(result_code) == "0"
        return WebhookResult(
            provider_order_id=str(order_id),
            success=success,
            amount=Decimal(str(amount)) if amount != "" else None,
            raw=payload,
            message=str(message or ("OK" if success else "FAILED")),
        )


def momo_ipn_ack(success: bool = True) -> dict[str, Any]:
    return {"resultCode": 0 if success else 1, "message": "OK" if success else "Failed"}
