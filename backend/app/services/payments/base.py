from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Optional, Protocol


@dataclass
class GatewayCreateResult:
    provider_order_id: str
    pay_url: Optional[str] = None
    qr_code: Optional[str] = None
    raw: Optional[dict[str, Any]] = None


@dataclass
class WebhookResult:
    provider_order_id: str
    success: bool
    amount: Optional[Decimal] = None
    raw: Optional[dict[str, Any]] = None
    message: str = ""


class PaymentGateway(Protocol):
    def create_payment(
        self,
        *,
        order_id: str,
        amount: Decimal,
        description: str,
        buyer_name: str | None = None,
    ) -> GatewayCreateResult: ...

    def parse_webhook(self, payload: dict[str, Any]) -> WebhookResult: ...
