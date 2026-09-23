"""Occupancy engine — single source of truth for unit availability."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import (
    Invoice,
    InvoiceStatus,
    Occupancy,
    OccupancyStatus,
    Unit,
    UnitStatus,
)


ACTIVE_STATUSES = (OccupancyStatus.reserved, OccupancyStatus.active)


def assert_valid_range(start: date, end: date) -> None:
    if end <= start:
        raise HTTPException(status_code=400, detail="end_date phải sau start_date")


def has_overlap(
    db: Session,
    unit_id: str,
    start: date,
    end: date,
    exclude_occupancy_id: str | None = None,
) -> bool:
    """Half-open interval [start, end) — checkout day frees the unit."""
    q = select(Occupancy).where(
        Occupancy.unit_id == unit_id,
        Occupancy.status.in_(ACTIVE_STATUSES),
        Occupancy.start_date < end,
        Occupancy.end_date > start,
    )
    if exclude_occupancy_id:
        q = q.where(Occupancy.id != exclude_occupancy_id)
    return db.scalar(q.limit(1)) is not None


def ensure_available(
    db: Session,
    unit_id: str,
    start: date,
    end: date,
    exclude_occupancy_id: str | None = None,
) -> Unit:
    assert_valid_range(start, end)
    unit = db.get(Unit, unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng/unit")
    if unit.status_override == UnitStatus.maintenance:
        raise HTTPException(status_code=409, detail="Unit đang bảo trì")
    if has_overlap(db, unit_id, start, end, exclude_occupancy_id):
        raise HTTPException(status_code=409, detail="Unit đã bị chiếm trong khoảng thời gian này")
    return unit


def current_occupancy(db: Session, unit_id: str, on: date | None = None) -> Occupancy | None:
    on = on or date.today()
    return db.scalar(
        select(Occupancy)
        .options(joinedload(Occupancy.tenant))
        .where(
            Occupancy.unit_id == unit_id,
            Occupancy.status.in_(ACTIVE_STATUSES),
            Occupancy.start_date <= on,
            Occupancy.end_date > on,
        )
        .order_by(Occupancy.start_date.desc())
        .limit(1)
    )


def unit_balance_due(db: Session, occupancy_id: str | None) -> Decimal:
    if not occupancy_id:
        return Decimal("0")
    invoices = db.scalars(
        select(Invoice).where(
            Invoice.occupancy_id == occupancy_id,
            Invoice.status.in_(
                [
                    InvoiceStatus.issued,
                    InvoiceStatus.partially_paid,
                    InvoiceStatus.overdue,
                ]
            ),
        )
    ).all()
    return sum((inv.amount - inv.paid_amount for inv in invoices), Decimal("0"))


def compute_display_status(db: Session, unit: Unit, on: date | None = None) -> UnitStatus:
    on = on or date.today()
    if unit.status_override == UnitStatus.maintenance:
        return UnitStatus.maintenance

    occ = current_occupancy(db, unit.id, on)
    if not occ:
        return UnitStatus.vacant

    balance = unit_balance_due(db, occ.id)
    if balance > 0 and occ.end_date <= on:
        return UnitStatus.overdue
    if occ.end_date == on:
        return UnitStatus.checkout_today
    if occ.status == OccupancyStatus.reserved:
        return UnitStatus.reserved
    return UnitStatus.occupied


def refresh_overdue_invoices(db: Session, today: date | None = None) -> None:
    today = today or date.today()
    invoices = db.scalars(
        select(Invoice).where(
            Invoice.status.in_([InvoiceStatus.issued, InvoiceStatus.partially_paid]),
            Invoice.due_date < today,
        )
    ).all()
    for inv in invoices:
        inv.status = InvoiceStatus.overdue
    if invoices:
        db.commit()
