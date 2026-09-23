from datetime import date, datetime, timezone
from pathlib import Path
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import HTMLResponse
from sqlalchemy import extract, select
from sqlalchemy.orm import Session, joinedload

from app.auth import CurrentUser, AdminUser, OpsUser, effective_property_id
from app.config import get_settings
from app.database import get_db
from app.models import (
    Expense,
    ExpenseJournal,
    ExpenseStatus,
    Invoice,
    Occupancy,
    Payment,
    PaymentProvider,
    PaymentStatus,
    Unit,
    UserRole,
)
from app.schemas import (
    ExpenseCreate,
    ExpenseJournalOut,
    ExpenseMonthStatus,
    ExpenseOut,
    ExpenseUpdate,
    InvoiceCreate,
    InvoiceOut,
    OnlinePaymentCreate,
    PaymentCreate,
    PaymentOut,
)
from app.services.finance import (
    apply_expense_collecting_transitions,
    compute_next_due_date,
    confirm_payment,
    create_invoice,
    recompute_invoice_status,
)
from app.services.payments import apply_webhook_result, create_online_payment
from app.services.payments.momo import MomoGateway, momo_ipn_ack
from app.services.payments.payos import PayOSGateway

router = APIRouter(tags=["finance"])

UPLOAD_ROOT = Path(__file__).resolve().parent.parent.parent / "uploads" / "expenses"


def _invoice_load_options():
    return (
        joinedload(Invoice.tenant),
        joinedload(Invoice.occupancy)
        .joinedload(Occupancy.unit)
        .joinedload(Unit.property),
    )


def _invoice_out(inv: Invoice) -> InvoiceOut:
    unit = inv.occupancy.unit if inv.occupancy else None
    prop = unit.property if unit else None
    return InvoiceOut(
        id=inv.id,
        occupancy_id=inv.occupancy_id,
        tenant_id=inv.tenant_id,
        invoice_no=inv.invoice_no,
        issue_date=inv.issue_date,
        due_date=inv.due_date,
        amount=inv.amount,
        paid_amount=inv.paid_amount,
        status=inv.status,
        description=inv.description,
        tenant_name=inv.tenant.full_name if inv.tenant else None,
        property_id=prop.id if prop else None,
        property_name=prop.name if prop else None,
        unit_code=unit.code if unit else None,
        balance=inv.amount - inv.paid_amount,
        created_at=inv.created_at,
    )


def _payment_out(p: Payment) -> PaymentOut:
    inv = p.invoice
    return PaymentOut(
        id=p.id,
        invoice_id=p.invoice_id,
        amount=p.amount,
        method=p.method,
        status=p.status,
        provider=p.provider,
        provider_order_id=p.provider_order_id,
        pay_url=p.pay_url,
        qr_code=p.qr_code,
        paid_at=p.paid_at,
        confirmed_at=p.confirmed_at,
        reference=p.reference,
        notes=p.notes,
        created_at=p.created_at,
        tenant_name=inv.tenant.full_name if inv and inv.tenant else None,
        invoice_no=inv.invoice_no if inv else None,
    )


def _can_access_invoice(user, inv: Invoice, db: Session | None = None) -> bool:
    if user.role == UserRole.admin:
        return True
    if user.role == UserRole.tenant:
        return user.tenant_id == inv.tenant_id
    if user.role == UserRole.manager:
        if not user.managed_property_id:
            return False
        occ = inv.occupancy
        if occ is None and inv.occupancy_id and db is not None:
            occ = db.get(Occupancy, inv.occupancy_id)
        if occ is None:
            return False
        unit = occ.unit
        if unit is None and db is not None:
            unit = db.get(Unit, occ.unit_id)
        return bool(unit and unit.property_id == user.managed_property_id)
    return False


def _can_access_payment(user, payment: Payment, db: Session | None = None) -> bool:
    inv = payment.invoice
    if inv is None:
        return user.role == UserRole.admin
    return _can_access_invoice(user, inv, db)


@router.get("/invoices", response_model=list[InvoiceOut])
def list_invoices(
    user: CurrentUser,
    db: Session = Depends(get_db),
    status: str | None = None,
    property_id: str | None = None,
):
    if user.role not in (UserRole.admin, UserRole.tenant, UserRole.manager):
        raise HTTPException(403, "Không đủ quyền")

    q = (
        select(Invoice)
        .options(*_invoice_load_options())
        .order_by(Invoice.issue_date.desc())
    )
    if user.role == UserRole.tenant:
        q = q.where(Invoice.tenant_id == user.tenant_id)
    if status:
        q = q.where(Invoice.status == status)

    scoped = None
    if user.role in (UserRole.admin, UserRole.manager):
        scoped = effective_property_id(user, property_id)
    elif property_id:
        scoped = property_id

    if scoped:
        q = (
            q.join(Occupancy, Invoice.occupancy_id == Occupancy.id)
            .join(Unit, Occupancy.unit_id == Unit.id)
            .where(Unit.property_id == scoped)
        )
    return [_invoice_out(i) for i in db.scalars(q).unique().all()]


@router.post("/invoices", response_model=InvoiceOut)
def create_invoice_api(body: InvoiceCreate, _: AdminUser, db: Session = Depends(get_db)):
    inv = create_invoice(
        db,
        tenant_id=body.tenant_id,
        occupancy_id=body.occupancy_id,
        amount=body.amount,
        description=body.description,
        issue_date=body.issue_date,
        due_date=body.due_date,
        invoice_no=body.invoice_no,
    )
    db.commit()
    inv = db.scalars(
        select(Invoice).options(*_invoice_load_options()).where(Invoice.id == inv.id)
    ).unique().one()
    return _invoice_out(inv)


@router.get("/invoices/{invoice_id}/payments", response_model=list[PaymentOut])
def list_invoice_payments(invoice_id: str, user: CurrentUser, db: Session = Depends(get_db)):
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Không tìm thấy hóa đơn")
    if not _can_access_invoice(user, inv, db):
        raise HTTPException(403, "Không đủ quyền")
    rows = db.scalars(
        select(Payment).where(Payment.invoice_id == invoice_id).order_by(Payment.paid_at.desc())
    ).all()
    return [_payment_out(p) for p in rows]


@router.get("/payments", response_model=list[PaymentOut])
def list_payments(
    _: AdminUser,
    db: Session = Depends(get_db),
    invoice_id: str | None = None,
    year: int | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
):
    q = (
        select(Payment)
        .options(joinedload(Payment.invoice).joinedload(Invoice.tenant))
        .where(Payment.status == PaymentStatus.confirmed)
        .order_by(Payment.paid_at.desc())
    )
    if invoice_id:
        q = q.where(Payment.invoice_id == invoice_id)
    if year is not None:
        q = q.where(extract("year", Payment.paid_at) == year)
    if month is not None:
        q = q.where(extract("month", Payment.paid_at) == month)
    return [_payment_out(p) for p in db.scalars(q).unique().all()]


@router.get("/payments/{payment_id}", response_model=PaymentOut)
def get_payment(payment_id: str, user: CurrentUser, db: Session = Depends(get_db)):
    payment = db.scalars(
        select(Payment).options(joinedload(Payment.invoice)).where(Payment.id == payment_id)
    ).unique().one_or_none()
    if not payment:
        raise HTTPException(404, "Không tìm thấy thanh toán")
    if not _can_access_payment(user, payment, db):
        raise HTTPException(403, "Không đủ quyền")
    return _payment_out(payment)


@router.post("/payments", response_model=PaymentOut)
def create_payment(body: PaymentCreate, user: OpsUser, db: Session = Depends(get_db)):
    inv = db.scalars(
        select(Invoice)
        .options(
            joinedload(Invoice.occupancy).joinedload(Occupancy.unit),
        )
        .where(Invoice.id == body.invoice_id)
    ).unique().one_or_none()
    if not inv:
        raise HTTPException(404, "Không tìm thấy hóa đơn")
    if not _can_access_invoice(user, inv, db):
        raise HTTPException(403, "Không đủ quyền")
    remaining = inv.amount - inv.paid_amount
    if body.amount > remaining:
        raise HTTPException(400, f"Số tiền vượt công nợ còn lại ({remaining})")
    now = body.paid_at or datetime.now(timezone.utc)
    payment = Payment(
        invoice_id=body.invoice_id,
        amount=body.amount,
        method=body.method,
        status=PaymentStatus.confirmed,
        provider=PaymentProvider.manual,
        paid_at=now,
        confirmed_at=now,
        reference=body.reference,
        notes=body.notes,
    )
    db.add(payment)
    inv.paid_amount += body.amount
    recompute_invoice_status(inv)
    db.commit()
    payment = db.scalars(
        select(Payment)
        .options(joinedload(Payment.invoice).joinedload(Invoice.tenant))
        .where(Payment.id == payment.id)
    ).unique().one()
    return _payment_out(payment)


@router.post("/payments/online", response_model=PaymentOut)
def create_online_payment_api(
    body: OnlinePaymentCreate,
    user: CurrentUser,
    db: Session = Depends(get_db),
):
    if user.role != UserRole.tenant and user.role != UserRole.admin:
        raise HTTPException(403, "Không đủ quyền")
    payment = create_online_payment(
        db,
        user=user,
        invoice_id=body.invoice_id,
        method=body.method,
        amount=body.amount,
    )
    return _payment_out(payment)


@router.post("/webhooks/momo")
def webhook_momo(payload: dict, db: Session = Depends(get_db)):
    settings = get_settings()
    if settings.payment_mode.lower() == "sandbox":
        order_id = str(payload.get("orderId") or "")
        success = str(payload.get("resultCode", "0")) == "0"
        apply_webhook_result(db, provider_order_id=order_id, success=success, raw=payload)
        return momo_ipn_ack(True)
    result = MomoGateway(settings).parse_webhook(payload)
    apply_webhook_result(
        db,
        provider_order_id=result.provider_order_id,
        success=result.success,
        amount=result.amount,
        raw=result.raw,
    )
    return momo_ipn_ack(True)


@router.post("/webhooks/payos")
def webhook_payos(payload: dict, db: Session = Depends(get_db)):
    settings = get_settings()
    if settings.payment_mode.lower() == "sandbox":
        data = payload.get("data") or payload
        order_id = str(data.get("orderCode") or payload.get("orderCode") or "")
        status = str(data.get("status") or "").upper()
        success = status in ("PAID", "SUCCESS") or payload.get("success") is True
        if payload.get("success") is False:
            success = False
        apply_webhook_result(db, provider_order_id=order_id, success=success, raw=payload)
        return {"success": True}
    result = PayOSGateway(settings).parse_webhook(payload)
    apply_webhook_result(
        db,
        provider_order_id=result.provider_order_id,
        success=result.success,
        amount=result.amount,
        raw=result.raw,
    )
    return {"success": True}


@router.get("/payments/sandbox/pay/{order_id}", response_class=HTMLResponse)
def sandbox_pay_page(order_id: str, db: Session = Depends(get_db)):
    """Local demo page: simulate gateway redirect + confirm."""
    settings = get_settings()
    if settings.payment_mode.lower() != "sandbox":
        raise HTTPException(404, "Sandbox disabled")
    payment = db.scalar(
        select(Payment).where(Payment.provider_order_id == order_id).limit(1)
    )
    if not payment:
        raise HTTPException(404, "Không tìm thấy giao dịch")
    if payment.status == PaymentStatus.confirmed:
        return HTMLResponse(
            "<html><body style='font-family:sans-serif;padding:2rem'>"
            "<h1>Đã thanh toán</h1><p>Giao dịch đã được xác nhận trước đó.</p></body></html>"
        )
    return HTMLResponse(
        f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Sandbox Pay</title></head>
<body style="font-family:sans-serif;padding:2rem;max-width:480px">
  <h1>Sandbox thanh toán</h1>
  <p>Mã: <code>{order_id}</code></p>
  <p>Số tiền: <strong>{int(payment.amount):,}₫</strong></p>
  <p>Phương thức: {payment.method.value}</p>
  <form method="post" action="/api/payments/sandbox/confirm/{order_id}">
    <button type="submit" style="padding:12px 20px;background:#0A4ABF;color:#fff;border:0;cursor:pointer">
      Xác nhận đã chuyển tiền
    </button>
  </form>
</body></html>"""
    )


@router.post("/payments/sandbox/confirm/{order_id}", response_class=HTMLResponse)
def sandbox_confirm(order_id: str, db: Session = Depends(get_db)):
    settings = get_settings()
    if settings.payment_mode.lower() != "sandbox":
        raise HTTPException(404, "Sandbox disabled")
    payment = apply_webhook_result(db, provider_order_id=order_id, success=True, raw={"sandbox": True})
    if not payment:
        raise HTTPException(404, "Không tìm thấy giao dịch")
    return HTMLResponse(
        "<html><body style='font-family:sans-serif;padding:2rem'>"
        "<h1>Thành công</h1><p>Backend đã xác nhận thanh toán. "
        "Quay lại app để thấy trạng thái thành công.</p></body></html>"
    )


@router.get("/payments/return/momo", response_class=HTMLResponse)
@router.get("/payments/return/payos", response_class=HTMLResponse)
def payment_return():
    return HTMLResponse(
        "<html><body style='font-family:sans-serif;padding:2rem'>"
        "<h1>Đang xử lý</h1><p>Vui lòng quay lại ứng dụng. "
        "Trạng thái sẽ cập nhật sau khi cổng thanh toán gửi xác nhận.</p></body></html>"
    )


@router.get("/expenses/month-status", response_model=ExpenseMonthStatus)
def expenses_month_status(
    _: AdminUser,
    db: Session = Depends(get_db),
    year: int | None = None,
    month: int | None = Query(None, ge=1, le=12),
):
    today = date.today()
    year = year or today.year
    month = month or today.month
    rows = db.scalars(
        select(Expense).where(
            extract("year", Expense.expense_date) == year,
            extract("month", Expense.expense_date) == month,
        )
    ).all()
    total = len(rows)
    unpaid = sum(1 for r in rows if r.status != ExpenseStatus.paid)
    if total == 0:
        label = "Chưa có chi phí"
        paid = False
    elif unpaid == 0:
        label = "Tháng này: Đã đóng"
        paid = True
    else:
        label = "Tháng này: Chưa đóng"
        paid = False
    return ExpenseMonthStatus(
        year=year,
        month=month,
        total=total,
        unpaid=unpaid,
        paid=paid,
        label=label,
    )


@router.get("/expenses", response_model=list[ExpenseOut])
def list_expenses(
    _: AdminUser,
    db: Session = Depends(get_db),
    property_id: str | None = None,
):
    q = select(Expense).order_by(Expense.expense_date.desc())
    if property_id:
        q = q.where(Expense.property_id == property_id)
    rows = list(db.scalars(q).all())
    apply_expense_collecting_transitions(db, rows)
    return rows


@router.post("/expenses", response_model=ExpenseOut)
def create_expense(body: ExpenseCreate, _: AdminUser, db: Session = Depends(get_db)):
    data = body.model_dump()
    due = data.get("due_date") or data.get("expense_date")
    data["due_date"] = due
    if data.get("next_due_date") is None:
        data["next_due_date"] = compute_next_due_date(
            due, data["due_cycle"], data.get("recurring", True)
        )
    expense = Expense(**data)
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.patch("/expenses/{expense_id}", response_model=ExpenseOut)
def update_expense(expense_id: str, body: ExpenseUpdate, _: AdminUser, db: Session = Depends(get_db)):
    expense = db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(404, "Không tìm thấy chi phí")
    data = body.model_dump(exclude_unset=True)
    becoming_paid = data.get("status") == ExpenseStatus.paid and expense.status != ExpenseStatus.paid
    if data.get("status") == ExpenseStatus.paid:
        paid_at = data.get("paid_at") or expense.paid_at
        image_url = data.get("image_url") if "image_url" in data else expense.image_url
        if not paid_at:
            raise HTTPException(400, "Cần chọn thời gian đóng trước khi đánh dấu đã đóng")
        if not image_url:
            raise HTTPException(400, "Cần upload hình ảnh chứng từ trước khi đánh dấu đã đóng")
        data["paid_at"] = paid_at
    if data.get("status") == ExpenseStatus.unpaid:
        data["paid_at"] = None
    for k, v in data.items():
        setattr(expense, k, v)

    # Recompute next_due if cycle/recurring/due_date changed while not marking paid
    if not becoming_paid and any(k in data for k in ("due_cycle", "recurring", "due_date")):
        if "next_due_date" not in data:
            expense.next_due_date = compute_next_due_date(
                expense.due_date, expense.due_cycle, expense.recurring
            )

    if becoming_paid:
        paid_at = expense.paid_at
        assert paid_at is not None
        db.add(
            ExpenseJournal(
                expense_id=expense.id,
                amount=expense.amount,
                due_date=expense.due_date,
                paid_at=paid_at,
                image_url=expense.image_url,
                category=expense.category,
                description=expense.description,
            )
        )
        if expense.recurring and expense.due_date is not None:
            expense.next_due_date = compute_next_due_date(
                expense.due_date, expense.due_cycle, True
            )
        else:
            expense.next_due_date = None
        expense.status = ExpenseStatus.paid

    db.commit()
    db.refresh(expense)
    return expense


@router.get("/expenses/{expense_id}/journals", response_model=list[ExpenseJournalOut])
def list_expense_journals(expense_id: str, _: AdminUser, db: Session = Depends(get_db)):
    expense = db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(404, "Không tìm thấy chi phí")
    return db.scalars(
        select(ExpenseJournal)
        .where(ExpenseJournal.expense_id == expense_id)
        .order_by(ExpenseJournal.paid_at.desc())
    ).all()


@router.post("/expenses/{expense_id}/image", response_model=ExpenseOut)
async def upload_expense_image(
    expense_id: str,
    _: AdminUser,
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
):
    expense = db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(404, "Không tìm thấy chi phí")
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Chỉ nhận file ảnh")
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "img.jpg").suffix or ".jpg"
    name = f"{expense_id}_{uuid.uuid4().hex[:8]}{ext}"
    dest = UPLOAD_ROOT / name
    dest.write_bytes(await file.read())
    expense.image_url = f"/uploads/expenses/{name}"
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/expenses/{expense_id}")
def delete_expense(expense_id: str, _: AdminUser, db: Session = Depends(get_db)):
    expense = db.get(Expense, expense_id)
    if not expense:
        raise HTTPException(404, "Không tìm thấy chi phí")
    db.delete(expense)
    db.commit()
    return {"ok": True}
