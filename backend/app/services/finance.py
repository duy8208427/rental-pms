import uuid
import calendar
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import (
    Expense,
    ExpenseDueCycle,
    ExpenseStatus,
    Invoice,
    InvoiceStatus,
    Payment,
    PaymentStatus,
)


def next_invoice_no(db: Session, prefix: str = "INV") -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"{prefix}-{stamp}-{uuid.uuid4().hex[:6].upper()}"


def next_contract_no(db: Session) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"HD-{stamp}-{uuid.uuid4().hex[:4].upper()}"


def create_invoice(
    db: Session,
    *,
    tenant_id: str,
    amount: Decimal,
    occupancy_id: str | None = None,
    description: str | None = None,
    issue_date: date | None = None,
    due_date: date | None = None,
    invoice_no: str | None = None,
) -> Invoice:
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Số tiền hóa đơn phải > 0")
    issue = issue_date or date.today()
    due = due_date or (issue + timedelta(days=7))
    inv = Invoice(
        tenant_id=tenant_id,
        occupancy_id=occupancy_id,
        invoice_no=invoice_no or next_invoice_no(db),
        issue_date=issue,
        due_date=due,
        amount=amount,
        paid_amount=Decimal("0"),
        status=InvoiceStatus.issued,
        description=description,
    )
    db.add(inv)
    return inv


def recompute_invoice_status(invoice: Invoice) -> None:
    if invoice.status == InvoiceStatus.cancelled:
        return
    if invoice.paid_amount <= 0:
        invoice.status = (
            InvoiceStatus.overdue if invoice.due_date < date.today() else InvoiceStatus.issued
        )
    elif invoice.paid_amount >= invoice.amount:
        invoice.status = InvoiceStatus.paid
        invoice.paid_amount = invoice.amount
    else:
        invoice.status = (
            InvoiceStatus.overdue
            if invoice.due_date < date.today()
            else InvoiceStatus.partially_paid
        )


def confirm_payment(db: Session, payment: Payment) -> Payment:
    """Mark pending payment as confirmed and apply amount to invoice (idempotent)."""
    if payment.status == PaymentStatus.confirmed:
        return payment
    if payment.status not in (PaymentStatus.pending, PaymentStatus.failed):
        raise HTTPException(400, f"Không thể xác nhận thanh toán ở trạng thái {payment.status}")

    inv = payment.invoice or db.get(Invoice, payment.invoice_id)
    if not inv:
        raise HTTPException(404, "Không tìm thấy hóa đơn")
    if inv.status == InvoiceStatus.cancelled:
        raise HTTPException(400, "Hóa đơn đã hủy")

    remaining = inv.amount - inv.paid_amount
    if remaining <= 0:
        payment.status = PaymentStatus.confirmed
        payment.confirmed_at = datetime.now(timezone.utc)
        return payment
    if payment.amount > remaining:
        payment.amount = remaining

    inv.paid_amount += payment.amount
    payment.status = PaymentStatus.confirmed
    payment.confirmed_at = datetime.now(timezone.utc)
    recompute_invoice_status(inv)
    return payment


def fail_payment(payment: Payment, notes: str | None = None) -> Payment:
    if payment.status == PaymentStatus.confirmed:
        return payment
    payment.status = PaymentStatus.failed
    if notes:
        payment.notes = (payment.notes + " | " if payment.notes else "") + notes
    return payment


def add_calendar_months(d: date, months: int) -> date:
    y = d.year + (d.month - 1 + months) // 12
    m = (d.month - 1 + months) % 12 + 1
    last = calendar.monthrange(y, m)[1]
    return date(y, m, min(d.day, last))


def advance_expense_due(d: date, cycle: ExpenseDueCycle) -> date:
    if cycle == ExpenseDueCycle.monthly:
        return add_calendar_months(d, 1)
    if cycle == ExpenseDueCycle.quarterly:
        return add_calendar_months(d, 3)
    return add_calendar_months(d, 12)


def compute_next_due_date(
    due: date | None,
    cycle: ExpenseDueCycle,
    recurring: bool,
) -> date | None:
    if not recurring or due is None:
        return None
    return advance_expense_due(due, cycle)


def maybe_promote_expense_collecting(expense: Expense, today: date | None = None) -> bool:
    """If paid recurring expense is within 2 months of next due, switch to collecting."""
    today = today or date.today()
    if (
        not expense.recurring
        or expense.next_due_date is None
        or expense.status != ExpenseStatus.paid
    ):
        return False
    threshold = add_calendar_months(expense.next_due_date, -2)
    if today < threshold:
        return False
    expense.status = ExpenseStatus.collecting
    expense.paid_at = None
    expense.image_url = None
    expense.due_date = expense.next_due_date
    return True


def apply_expense_collecting_transitions(db: Session, expenses: list[Expense]) -> None:
    changed = False
    for expense in expenses:
        if maybe_promote_expense_collecting(expense):
            changed = True
    if changed:
        db.commit()
        for expense in expenses:
            db.refresh(expense)
