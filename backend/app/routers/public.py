"""Public catalog + guest booking (no JWT)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import (
    Booking,
    Occupancy,
    OccupancyKind,
    OccupancyStatus,
    Property,
    Tenant,
    Unit,
    UnitStatus,
)
from app.schemas import PropertyOut, PublicCalendarBlock, validate_person_name, validate_phone
from app.services.finance import create_invoice
from app.services.occupancy import ensure_available, has_overlap

router = APIRouter(prefix="/public", tags=["public"])


class PublicUnitOut(BaseModel):
    id: str
    property_id: str
    code: str
    name: str
    unit_type: str
    floor: int
    area_m2: Decimal | None = None
    capacity: int
    price_per_night: Decimal | None = None
    price_per_month: Decimal | None = None
    nights: int | None = None
    total_estimate: Decimal | None = None


class PublicAvailabilityOut(BaseModel):
    unit_id: str
    available: bool
    from_date: date
    to_date: date


class PublicBookingCreate(BaseModel):
    unit_id: str
    start_date: date
    end_date: date
    guests: int | None = Field(default=None, ge=1)
    adults: int | None = Field(default=None, ge=1)
    children: int | None = Field(default=None, ge=0)
    full_name: str = Field(min_length=2, max_length=255)
    phone: str = Field(min_length=8, max_length=50)
    email: EmailStr
    notes: str | None = None
    auto_invoice: bool = True

    @field_validator("full_name", mode="before")
    @classmethod
    def _name(cls, v: object) -> str:
        return validate_person_name(v)

    @field_validator("phone", mode="before")
    @classmethod
    def _phone(cls, v: object) -> str:
        out = validate_phone(v, required=True)
        assert out is not None
        return out


class PublicBookingOut(BaseModel):
    booking_id: str
    unit_code: str
    property_name: str | None = None
    guest_name: str
    start_date: date
    end_date: date
    guests: int
    adults: int = 1
    children: int = 0
    nights: int
    rate_per_night: Decimal
    total_amount: Decimal
    status: str
    message: str = "Đặt phòng thành công. Vui lòng liên hệ lễ tân khi nhận phòng."


def _find_or_create_tenant(
    db: Session,
    *,
    full_name: str,
    phone: str,
    email: str | None,
) -> Tenant:
    phone_norm = phone.strip()
    clauses = [Tenant.phone == phone_norm]
    if email:
        clauses.append(Tenant.email == email.lower())
    existing = db.scalar(select(Tenant).where(or_(*clauses)).limit(1))
    if existing:
        if full_name and existing.full_name != full_name:
            existing.full_name = full_name
        if email and not existing.email:
            existing.email = email.lower()
        return existing
    tenant = Tenant(
        full_name=full_name.strip(),
        phone=phone_norm,
        email=email.lower() if email else None,
    )
    db.add(tenant)
    db.flush()
    return tenant


@router.get("/properties", response_model=list[PropertyOut])
def public_properties(db: Session = Depends(get_db)):
    return db.scalars(select(Property).order_by(Property.name)).all()


class PublicUnitCodeOut(BaseModel):
    id: str
    code: str
    name: str


@router.get("/unit-codes", response_model=list[PublicUnitCodeOut])
def public_unit_codes(
    db: Session = Depends(get_db),
    property_id: str = Query(...),
):
    """All units of a property (for calendar rows) — no PII."""
    units = db.scalars(
        select(Unit).where(Unit.property_id == property_id).order_by(Unit.floor, Unit.code)
    ).all()
    return [PublicUnitCodeOut(id=u.id, code=u.code, name=u.name) for u in units]


@router.get("/calendar", response_model=list[PublicCalendarBlock])
def public_calendar(
    db: Session = Depends(get_db),
    property_id: str | None = None,
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
):
    """Occupancy schedule without guest identity (hotel / office / workshop)."""
    if to_date <= from_date:
        raise HTTPException(400, "Khoảng ngày không hợp lệ")
    q = (
        select(Occupancy)
        .options(joinedload(Occupancy.unit))
        .where(
            Occupancy.status.in_([OccupancyStatus.reserved, OccupancyStatus.active]),
            Occupancy.start_date < to_date,
            Occupancy.end_date > from_date,
        )
        .order_by(Occupancy.start_date)
    )
    if property_id:
        q = q.join(Unit, Occupancy.unit_id == Unit.id).where(Unit.property_id == property_id)
    rows = db.scalars(q).unique().all()
    return [
        PublicCalendarBlock(
            unit_id=o.unit_id,
            unit_code=o.unit.code if o.unit else "",
            property_id=o.unit.property_id if o.unit else None,
            kind=o.kind,
            status=o.status,
            start_date=o.start_date,
            end_date=o.end_date,
        )
        for o in rows
    ]


@router.get("/units", response_model=list[PublicUnitOut])
def public_units(
    db: Session = Depends(get_db),
    property_id: str | None = None,
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
):
    if to_date <= from_date:
        raise HTTPException(400, "Ngày trả phòng phải sau ngày nhận phòng")
    q = select(Unit).order_by(Unit.floor, Unit.code)
    if property_id:
        q = q.where(Unit.property_id == property_id)
    units = db.scalars(q).all()
    nights = (to_date - from_date).days
    result: list[PublicUnitOut] = []
    for u in units:
        if u.status_override == UnitStatus.maintenance:
            continue
        if has_overlap(db, u.id, from_date, to_date):
            continue
        rate = u.price_per_night or Decimal("0")
        result.append(
            PublicUnitOut(
                id=u.id,
                property_id=u.property_id,
                code=u.code,
                name=u.name,
                unit_type=u.unit_type.value if hasattr(u.unit_type, "value") else str(u.unit_type),
                floor=u.floor,
                area_m2=u.area_m2,
                capacity=u.capacity,
                price_per_night=u.price_per_night,
                price_per_month=u.price_per_month,
                nights=nights,
                total_estimate=rate * nights,
            )
        )
    return result


@router.get("/units/{unit_id}/availability", response_model=PublicAvailabilityOut)
def public_availability(
    unit_id: str,
    db: Session = Depends(get_db),
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
):
    unit = db.get(Unit, unit_id)
    if not unit:
        raise HTTPException(404, "Không tìm thấy phòng")
    available = (
        unit.status_override != UnitStatus.maintenance
        and not has_overlap(db, unit_id, from_date, to_date)
    )
    return PublicAvailabilityOut(
        unit_id=unit_id,
        available=available,
        from_date=from_date,
        to_date=to_date,
    )


@router.post("/bookings", response_model=PublicBookingOut)
def public_create_booking(body: PublicBookingCreate, db: Session = Depends(get_db)):
    unit = ensure_available(db, body.unit_id, body.start_date, body.end_date)
    prop = db.get(Property, unit.property_id)

    if body.adults is not None or body.children is not None:
        adults = body.adults if body.adults is not None else 1
        children = body.children if body.children is not None else 0
    elif body.guests is not None:
        adults = body.guests
        children = 0
    else:
        adults, children = 1, 0
    guests = adults + children
    if guests < 1:
        raise HTTPException(400, "Cần ít nhất 1 khách")
    if guests > unit.capacity:
        raise HTTPException(400, f"Phòng tối đa {unit.capacity} khách")

    tenant = _find_or_create_tenant(
        db,
        full_name=body.full_name,
        phone=body.phone,
        email=str(body.email),
    )
    nights = (body.end_date - body.start_date).days
    if nights < 1:
        raise HTTPException(400, "Cần ít nhất 1 đêm")
    rate = unit.price_per_night or Decimal("0")
    total = rate * nights

    note = body.notes or "Đặt qua website khách"
    if prop and getattr(prop.property_type, "value", prop.property_type) == "hotel":
        note = f"{note} · {adults} người lớn, {children} trẻ em"

    occ = Occupancy(
        unit_id=body.unit_id,
        tenant_id=tenant.id,
        kind=OccupancyKind.booking,
        status=OccupancyStatus.reserved,
        start_date=body.start_date,
        end_date=body.end_date,
        notes=note,
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
            tenant_id=tenant.id,
            occupancy_id=occ.id,
            amount=total,
            description=f"Booking web {unit.code} {body.start_date} → {body.end_date} ({nights} đêm)",
        )
    db.commit()

    booking = db.scalars(
        select(Booking)
        .options(
            joinedload(Booking.occupancy).joinedload(Occupancy.unit),
            joinedload(Booking.occupancy).joinedload(Occupancy.tenant),
        )
        .where(Booking.id == booking.id)
    ).unique().one()

    return PublicBookingOut(
        booking_id=booking.id,
        unit_code=unit.code,
        property_name=prop.name if prop else None,
        guest_name=tenant.full_name,
        start_date=body.start_date,
        end_date=body.end_date,
        guests=guests,
        adults=adults,
        children=children,
        nights=nights,
        rate_per_night=rate,
        total_amount=total,
        status=OccupancyStatus.reserved.value,
    )
