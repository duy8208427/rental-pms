from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import AdminUser
from app.database import get_db
from app.models import Property
from app.schemas import PropertyCreate, PropertyOut, PropertyUpdate

router = APIRouter(prefix="/properties", tags=["properties"])


@router.get("", response_model=list[PropertyOut])
def list_properties(_: AdminUser, db: Session = Depends(get_db)):
    return db.scalars(select(Property).order_by(Property.name)).all()


@router.post("", response_model=PropertyOut)
def create_property(body: PropertyCreate, _: AdminUser, db: Session = Depends(get_db)):
    prop = Property(**body.model_dump())
    db.add(prop)
    db.commit()
    db.refresh(prop)
    return prop


@router.get("/{property_id}", response_model=PropertyOut)
def get_property(property_id: str, _: AdminUser, db: Session = Depends(get_db)):
    prop = db.get(Property, property_id)
    if not prop:
        raise HTTPException(404, "Không tìm thấy cơ sở")
    return prop


@router.patch("/{property_id}", response_model=PropertyOut)
def update_property(
    property_id: str, body: PropertyUpdate, _: AdminUser, db: Session = Depends(get_db)
):
    prop = db.get(Property, property_id)
    if not prop:
        raise HTTPException(404, "Không tìm thấy cơ sở")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(prop, k, v)
    db.commit()
    db.refresh(prop)
    return prop


@router.delete("/{property_id}")
def delete_property(property_id: str, _: AdminUser, db: Session = Depends(get_db)):
    prop = db.get(Property, property_id)
    if not prop:
        raise HTTPException(404, "Không tìm thấy cơ sở")
    db.delete(prop)
    db.commit()
    return {"ok": True}
