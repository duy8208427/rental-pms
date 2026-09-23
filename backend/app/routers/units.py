from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import AdminUser
from app.database import get_db
from app.models import Occupancy, Unit
from app.schemas import OccupancyOut, UnitCreate, UnitOut, UnitUpdate
from app.services.occupancy import ACTIVE_STATUSES, compute_display_status, has_overlap

router = APIRouter(prefix="/units", tags=["units"])


def _unit_out(db: Session, unit: Unit) -> UnitOut:
    data = UnitOut.model_validate(unit)
    data.display_status = compute_display_status(db, unit)
    return data


@router.get("", response_model=list[UnitOut])
def list_units(
    _: AdminUser,
    db: Session = Depends(get_db),
    property_id: str | None = None,
):
    q = select(Unit).order_by(Unit.floor, Unit.code)
    if property_id:
        q = q.where(Unit.property_id == property_id)
    units = db.scalars(q).all()
    return [_unit_out(db, u) for u in units]


@router.post("", response_model=UnitOut)
def create_unit(body: UnitCreate, _: AdminUser, db: Session = Depends(get_db)):
    unit = Unit(**body.model_dump())
    db.add(unit)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Mã phòng đã tồn tại trong cơ sở này")
    db.refresh(unit)
    return _unit_out(db, unit)


@router.get("/{unit_id}", response_model=UnitOut)
def get_unit(unit_id: str, _: AdminUser, db: Session = Depends(get_db)):
    unit = db.get(Unit, unit_id)
    if not unit:
        raise HTTPException(404, "Không tìm thấy unit")
    return _unit_out(db, unit)


@router.patch("/{unit_id}", response_model=UnitOut)
def update_unit(unit_id: str, body: UnitUpdate, _: AdminUser, db: Session = Depends(get_db)):
    unit = db.get(Unit, unit_id)
    if not unit:
        raise HTTPException(404, "Không tìm thấy unit")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(unit, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Mã phòng đã tồn tại trong cơ sở này")
    db.refresh(unit)
    return _unit_out(db, unit)


@router.delete("/{unit_id}")
def delete_unit(unit_id: str, _: AdminUser, db: Session = Depends(get_db)):
    unit = db.get(Unit, unit_id)
    if not unit:
        raise HTTPException(404, "Không tìm thấy unit")
    db.delete(unit)
    db.commit()
    return {"ok": True}


@router.get("/{unit_id}/availability")
def availability(
    unit_id: str,
    _: AdminUser,
    db: Session = Depends(get_db),
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
):
    unit = db.get(Unit, unit_id)
    if not unit:
        raise HTTPException(404, "Không tìm thấy unit")
    available = not has_overlap(db, unit_id, from_date, to_date)
    overlaps = db.scalars(
        select(Occupancy).where(
            Occupancy.unit_id == unit_id,
            Occupancy.status.in_(ACTIVE_STATUSES),
            Occupancy.start_date < to_date,
            Occupancy.end_date > from_date,
        )
    ).all()
    return {
        "unit_id": unit_id,
        "from": from_date,
        "to": to_date,
        "available": available,
        "conflicts": [
            OccupancyOut(
                id=o.id,
                unit_id=o.unit_id,
                tenant_id=o.tenant_id,
                kind=o.kind,
                status=o.status,
                start_date=o.start_date,
                end_date=o.end_date,
                notes=o.notes,
                created_at=o.created_at,
            )
            for o in overlaps
        ],
    }
