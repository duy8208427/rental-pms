from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.auth import AdminUser, OpsUser, effective_property_id
from app.database import get_db
from app.models import (
    Contract,
    Expense,
    Invoice,
    InvoiceStatus,
    Occupancy,
    OccupancyKind,
    OccupancyStatus,
    Payment,
    Unit,
    UnitStatus,
)
from app.schemas import CalendarBlock, DashboardOut, RoomBoardUnit
from app.services.occupancy import (
    ACTIVE_STATUSES,
    compute_display_status,
    current_occupancy,
    refresh_overdue_invoices,
    unit_balance_due,
)

router = APIRouter(tags=["dashboard"])


@router.get("/room-board", response_model=list[RoomBoardUnit])
def room_board(
    user: OpsUser,
    db: Session = Depends(get_db),
    property_id: str | None = None,
):
    refresh_overdue_invoices(db)
    scoped = effective_property_id(user, property_id)
    q = select(Unit).order_by(Unit.floor, Unit.code)
    if scoped:
        q = q.where(Unit.property_id == scoped)
    units = db.scalars(q).all()
    result: list[RoomBoardUnit] = []
    for u in units:
        occ = current_occupancy(db, u.id)
        status = compute_display_status(db, u)
        result.append(
            RoomBoardUnit(
                id=u.id,
                code=u.code,
                name=u.name,
                floor=u.floor,
                unit_type=u.unit_type,
                capacity=u.capacity,
                price_per_night=u.price_per_night,
                price_per_month=u.price_per_month,
                price_per_hour=u.price_per_hour,
                notes=u.notes,
                display_status=status,
                tenant_name=occ.tenant.full_name if occ and occ.tenant else None,
                occupancy_id=occ.id if occ else None,
                occupancy_kind=occ.kind if occ else None,
                end_date=occ.end_date if occ else None,
                balance_due=unit_balance_due(db, occ.id if occ else None),
            )
        )
    return result


@router.get("/calendar", response_model=list[CalendarBlock])
def calendar(
    _: AdminUser,
    db: Session = Depends(get_db),
    property_id: str | None = None,
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
):
    q = (
        select(Occupancy)
        .options(joinedload(Occupancy.unit), joinedload(Occupancy.tenant))
        .where(
            Occupancy.status.in_(list(ACTIVE_STATUSES) + [OccupancyStatus.completed]),
            Occupancy.start_date < to_date,
            Occupancy.end_date > from_date,
        )
        .order_by(Occupancy.start_date)
    )
    if property_id:
        q = q.join(Unit).where(Unit.property_id == property_id)
    rows = db.scalars(q).unique().all()
    return [
        CalendarBlock(
            occupancy_id=o.id,
            unit_id=o.unit_id,
            unit_code=o.unit.code if o.unit else "",
            tenant_name=o.tenant.full_name if o.tenant else "",
            kind=o.kind,
            status=o.status,
            start_date=o.start_date,
            end_date=o.end_date,
        )
        for o in rows
    ]


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(
    _: AdminUser,
    db: Session = Depends(get_db),
    property_id: str | None = None,
):
    refresh_overdue_invoices(db)
    today = date.today()
    month_start = today.replace(day=1)

    q = select(Unit)
    if property_id:
        q = q.where(Unit.property_id == property_id)
    units = db.scalars(q).all()

    counts = {
        UnitStatus.vacant: 0,
        UnitStatus.occupied: 0,
        UnitStatus.reserved: 0,
        UnitStatus.maintenance: 0,
        UnitStatus.checkout_today: 0,
        UnitStatus.overdue: 0,
    }
    for u in units:
        st = compute_display_status(db, u, today)
        counts[st] = counts.get(st, 0) + 1

    total = len(units) or 1
    occupied_like = counts[UnitStatus.occupied] + counts[UnitStatus.checkout_today] + counts[UnitStatus.overdue]

    pay_q = (
        select(func.coalesce(func.sum(Payment.amount), 0))
        .select_from(Payment)
        .where(Payment.paid_at >= month_start)
    )
    if property_id:
        pay_q = (
            pay_q.join(Invoice, Payment.invoice_id == Invoice.id)
            .join(Occupancy, Invoice.occupancy_id == Occupancy.id)
            .join(Unit, Occupancy.unit_id == Unit.id)
            .where(Unit.property_id == property_id)
        )
    revenue = db.scalar(pay_q) or Decimal("0")

    exp_q = select(func.coalesce(func.sum(Expense.amount), 0)).where(Expense.expense_date >= month_start)
    if property_id:
        exp_q = exp_q.where(Expense.property_id == property_id)
    expense = db.scalar(exp_q) or Decimal("0")

    overdue_q = select(Invoice).where(Invoice.status == InvoiceStatus.overdue)
    if property_id:
        overdue_q = (
            overdue_q.join(Occupancy, Invoice.occupancy_id == Occupancy.id)
            .join(Unit, Occupancy.unit_id == Unit.id)
            .where(Unit.property_id == property_id)
        )
    overdue_inv = db.scalars(overdue_q).all()
    overdue_amount = sum((i.amount - i.paid_amount for i in overdue_inv), Decimal("0"))

    checkouts = sum(1 for u in units if compute_display_status(db, u, today) == UnitStatus.checkout_today)

    soon = today + timedelta(days=30)
    expiring_q = (
        select(func.count())
        .select_from(Contract)
        .join(Occupancy)
        .where(
            Occupancy.status.in_(ACTIVE_STATUSES),
            Occupancy.kind == OccupancyKind.contract,
            Occupancy.end_date <= soon,
            Occupancy.end_date >= today,
        )
    )
    if property_id:
        expiring_q = expiring_q.join(Unit, Occupancy.unit_id == Unit.id).where(
            Unit.property_id == property_id
        )
    expiring = db.scalar(expiring_q) or 0

    return DashboardOut(
        total_units=len(units),
        vacant_units=counts[UnitStatus.vacant],
        occupied_units=occupied_like,
        reserved_units=counts[UnitStatus.reserved],
        maintenance_units=counts[UnitStatus.maintenance],
        occupancy_rate=round(occupied_like / total * 100, 1),
        revenue_month=Decimal(str(revenue)),
        expense_month=Decimal(str(expense)),
        overdue_invoices=len(overdue_inv),
        overdue_amount=overdue_amount,
        checkouts_today=checkouts,
        contracts_expiring_30d=int(expiring),
    )
