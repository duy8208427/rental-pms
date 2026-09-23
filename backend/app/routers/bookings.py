from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import AdminUser
from app.database import get_db
from app.models import Booking, Occupancy, OccupancyKind, OccupancyStatus, Tenant
from app.schemas import BookingCreate, BookingOut, OccupancyOut
from app.services.finance import create_invoice
from app.services.occupancy import ensure_available

router = APIRouter(prefix="/bookings", tags=["bookings"])


def _occ_out(o: Occupancy) -> OccupancyOut:
    return OccupancyOut(
        id=o.id,
        unit_id=o.unit_id,
        tenant_id=o.tenant_id,
        kind=o.kind,
        status=o.status,
        start_date=o.start_date,
        end_date=o.end_date,
        notes=o.notes,
        tenant_name=o.tenant.full_name if o.tenant else None,
        unit_code=o.unit.code if o.unit else None,
        created_at=o.created_at,
    )


def _booking_out(b: Booking) -> BookingOut:
    return BookingOut(
        id=b.id,
        occupancy_id=b.occupancy_id,
        guests=b.guests,
        adults=getattr(b, "adults", None) or b.guests or 1,
        children=getattr(b, "children", None) or 0,
        rate_per_night=b.rate_per_night,
        total_amount=b.total_amount,
        checked_in_at=b.checked_in_at,
        checked_out_at=b.checked_out_at,
        occupancy=_occ_out(b.occupancy) if b.occupancy else None,
        created_at=b.created_at,
    )


@router.get("", response_model=list[BookingOut])
def list_bookings(_: AdminUser, db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Booking)
        .options(
            joinedload(Booking.occupancy).joinedload(Occupancy.tenant),
            joinedload(Booking.occupancy).joinedload(Occupancy.unit),
        )
        .order_by(Booking.created_at.desc())
    ).unique().all()
    return [_booking_out(b) for b in rows]


@router.post("", response_model=BookingOut)
def create_booking(body: BookingCreate, _: AdminUser, db: Session = Depends(get_db)):
    if not db.get(Tenant, body.tenant_id):
        raise HTTPException(404, "Không tìm thấy khách thuê")
    unit = ensure_available(db, body.unit_id, body.start_date, body.end_date)
    nights = (body.end_date - body.start_date).days
    rate = body.rate_per_night if body.rate_per_night is not None else (unit.price_per_night or Decimal("0"))
    total = rate * nights

    if body.adults is not None or body.children is not None:
        adults = body.adults if body.adults is not None else 1
        children = body.children if body.children is not None else 0
    else:
        guests_in = body.guests if body.guests is not None else 1
        adults, children = guests_in, 0
    guests = adults + children
    if guests < 1:
        raise HTTPException(400, "Cần ít nhất 1 khách")
    if guests > unit.capacity:
        raise HTTPException(400, f"Phòng tối đa {unit.capacity} khách")

    occ = Occupancy(
        unit_id=body.unit_id,
        tenant_id=body.tenant_id,
        kind=OccupancyKind.booking,
        status=OccupancyStatus.reserved,
        start_date=body.start_date,
        end_date=body.end_date,
        notes=body.notes,
    )
    db.add(occ)
    db.flush()
    booking = Booking(
        occupancy_id=occ.id,
        guests=guests,
        adults=adults,
        children=children,
        rate_per_night=rate,
        total_amount=total,
    )
    db.add(booking)
    if body.auto_invoice and total > 0:
        create_invoice(
            db,
            tenant_id=body.tenant_id,
            occupancy_id=occ.id,
            amount=total,
            description=f"Booking {unit.code} {body.start_date} → {body.end_date} ({nights} đêm)",
        )
    db.commit()
    booking = db.scalars(
        select(Booking)
        .options(
            joinedload(Booking.occupancy).joinedload(Occupancy.tenant),
            joinedload(Booking.occupancy).joinedload(Occupancy.unit),
        )
        .where(Booking.id == booking.id)
    ).unique().one()
    return _booking_out(booking)


@router.post("/{booking_id}/check-in", response_model=BookingOut)
def check_in(booking_id: str, _: AdminUser, db: Session = Depends(get_db)):
    booking = db.scalars(
        select(Booking)
        .options(
            joinedload(Booking.occupancy).joinedload(Occupancy.tenant),
            joinedload(Booking.occupancy).joinedload(Occupancy.unit),
        )
        .where(Booking.id == booking_id)
    ).unique().one_or_none()
    if not booking:
        raise HTTPException(404, "Không tìm thấy booking")
    if booking.occupancy.status == OccupancyStatus.cancelled:
        raise HTTPException(400, "Booking đã hủy")
    booking.checked_in_at = datetime.now(timezone.utc)
    booking.occupancy.status = OccupancyStatus.active
    db.commit()
    db.refresh(booking)
    return _booking_out(booking)


@router.post("/{booking_id}/check-out", response_model=BookingOut)
def check_out(booking_id: str, _: AdminUser, db: Session = Depends(get_db)):
    booking = db.scalars(
        select(Booking)
        .options(
            joinedload(Booking.occupancy).joinedload(Occupancy.tenant),
            joinedload(Booking.occupancy).joinedload(Occupancy.unit),
        )
        .where(Booking.id == booking_id)
    ).unique().one_or_none()
    if not booking:
        raise HTTPException(404, "Không tìm thấy booking")
    if booking.occupancy.status == OccupancyStatus.cancelled:
        raise HTTPException(400, "Booking đã hủy — không thể check-out")
    if booking.occupancy.status == OccupancyStatus.completed:
        raise HTTPException(400, "Booking đã hoàn thành")
    booking.checked_out_at = datetime.now(timezone.utc)
    booking.occupancy.status = OccupancyStatus.completed
    db.commit()
    db.refresh(booking)
    return _booking_out(booking)


@router.post("/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking(booking_id: str, _: AdminUser, db: Session = Depends(get_db)):
    booking = db.scalars(
        select(Booking)
        .options(
            joinedload(Booking.occupancy).joinedload(Occupancy.tenant),
            joinedload(Booking.occupancy).joinedload(Occupancy.unit),
        )
        .where(Booking.id == booking_id)
    ).unique().one_or_none()
    if not booking:
        raise HTTPException(404, "Không tìm thấy booking")
    booking.occupancy.status = OccupancyStatus.cancelled
    db.commit()
    db.refresh(booking)
    return _booking_out(booking)
