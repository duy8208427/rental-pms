from __future__ import annotations

import json
import uuid
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.config import Settings, get_settings
from app.models import (
    Invoice,
    InvoiceStatus,
    Payment,
    PaymentMethod,
    PaymentProvider,
    PaymentStatus,
    User,
    UserRole,
)
from app.services.finance import confirm_payment, fail_payment
from app.services.payments.base import GatewayCreateResult
from app.services.payments.momo import MomoGateway
from app.services.payments.payos import PayOSGateway


ONLINE_METHODS = {PaymentMethod.momo, PaymentMethod.vietqr}


def _sandbox_create(order_id: str, amount: Decimal, method: PaymentMethod) -> GatewayCreateResult:
    base = get_settings().public_api_base.rstrip("/")
    return GatewayCreateResult(
        provider_order_id=order_id,
        pay_url=f"{base}/api/payments/sandbox/pay/{order_id}",
        qr_code=f"SANDBOX|{method.value}|{order_id}|{int(amount)}",
        raw={"sandbox": True, "order_id": order_id},
    )


def create_online_payment(
    db: Session,
    *,
    user: User,
    invoice_id: str,
    method: PaymentMethod,
    amount: Decimal | None = None,
    settings: Settings | None = None,
) -> Payment:
    settings = settings or get_settings()
    if method not in ONLINE_METHODS:
        raise HTTPException(400, "Phương thức phải là momo hoặc vietqr")

    inv = db.scalars(
        select(Invoice).options(joinedload(Invoice.tenant)).where(Invoice.id == invoice_id)
    ).unique().one_or_none()
    if not inv:
        raise HTTPException(404, "Không tìm thấy hóa đơn")
    if user.role == UserRole.tenant:
        if not user.tenant_id or inv.tenant_id != user.tenant_id:
            raise HTTPException(403, "Không đủ quyền")
    if inv.status == InvoiceStatus.cancelled:
        raise HTTPException(400, "Hóa đơn đã hủy")
    if inv.status == InvoiceStatus.paid:
        raise HTTPException(400, "Hóa đơn đã thanh toán đủ")

    remaining = inv.amount - inv.paid_amount
    if remaining <= 0:
        raise HTTPException(400, "Không còn công nợ")
    pay_amount = amount if amount is not None else remaining
    if pay_amount <= 0:
        raise HTTPException(400, "Số tiền phải > 0")
    if pay_amount > remaining:
        raise HTTPException(400, f"Số tiền vượt công nợ còn lại ({remaining})")

    order_id = f"PMS-{uuid.uuid4().hex[:16].upper()}"
    description = f"HD {inv.invoice_no}"
    buyer = inv.tenant.full_name if inv.tenant else None

    use_sandbox = settings.payment_mode.lower() == "sandbox"
    provider: PaymentProvider
    result: GatewayCreateResult

    if use_sandbox:
        provider = PaymentProvider.sandbox
        result = _sandbox_create(order_id, pay_amount, method)
    elif method == PaymentMethod.momo:
        provider = PaymentProvider.momo
        result = MomoGateway(settings).create_payment(
            order_id=order_id,
            amount=pay_amount,
            description=description,
            buyer_name=buyer,
        )
    else:
        provider = PaymentProvider.payos
        result = PayOSGateway(settings).create_payment(
            order_id=order_id,
            amount=pay_amount,
            description=description,
            buyer_name=buyer,
        )

    payment = Payment(
        invoice_id=inv.id,
        amount=pay_amount,
        method=method,
        status=PaymentStatus.pending,
        provider=provider,
        provider_order_id=result.provider_order_id,
        provider_payload=json.dumps(result.raw or {}, ensure_ascii=False, default=str),
        pay_url=result.pay_url,
        qr_code=result.qr_code,
        reference=result.provider_order_id,
        notes=f"Online {method.value}",
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


def find_payment_by_provider_order(db: Session, provider_order_id: str) -> Payment | None:
    return db.scalar(
        select(Payment)
        .options(joinedload(Payment.invoice))
        .where(Payment.provider_order_id == provider_order_id)
        .limit(1)
    )


def apply_webhook_result(
    db: Session,
    *,
    provider_order_id: str,
    success: bool,
    amount: Decimal | None = None,
    raw: dict[str, Any] | None = None,
) -> Payment | None:
    payment = find_payment_by_provider_order(db, provider_order_id)
    if not payment:
        return None
    if raw:
        payment.provider_payload = json.dumps(raw, ensure_ascii=False, default=str)
    if success:
        if amount is not None and amount > 0 and amount != payment.amount:
            # Trust gateway amount if within remaining; else keep original pending amount
            remaining = payment.invoice.amount - payment.invoice.paid_amount
            if amount <= remaining:
                payment.amount = amount
        confirm_payment(db, payment)
    else:
        fail_payment(payment, notes="Gateway báo thất bại")
    db.commit()
    db.refresh(payment)
    return payment
