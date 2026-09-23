from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.auth import AdminUser
from app.database import get_db
from app.models import Asset, AssetCondition, Unit
from app.schemas import AssetCreate, AssetOut, AssetUpdate

router = APIRouter(prefix="/assets", tags=["assets"])


def _asset_out(a: Asset) -> AssetOut:
    return AssetOut(
        id=a.id,
        unit_id=a.unit_id,
        name=a.name,
        category=a.category,
        quantity=a.quantity,
        condition=a.condition,
        supplier=a.supplier,
        purchased_at=a.purchased_at,
        last_repaired_at=a.last_repaired_at,
        purchase_value=a.purchase_value,
        notes=a.notes,
        unit_code=a.unit.code if a.unit else None,
        created_at=a.created_at,
    )


@router.get("", response_model=list[AssetOut])
def list_assets(
    _: AdminUser,
    db: Session = Depends(get_db),
    q: str | None = None,
    unit_id: str | None = None,
    condition: AssetCondition | None = None,
    category: str | None = None,
    supplier: str | None = None,
    purchased_from: date | None = None,
    purchased_to: date | None = None,
    repaired_from: date | None = None,
    repaired_to: date | None = None,
    amount_min: Decimal | None = None,
    amount_max: Decimal | None = None,
):
    query = select(Asset).options(joinedload(Asset.unit)).order_by(Asset.name)
    if q:
        like = f"%{q.strip()}%"
        query = query.where(
            or_(
                Asset.name.ilike(like),
                Asset.supplier.ilike(like),
                Asset.category.ilike(like),
            )
        )
    if unit_id:
        query = query.where(Asset.unit_id == unit_id)
    if condition:
        query = query.where(Asset.condition == condition)
    if category:
        query = query.where(Asset.category.ilike(f"%{category.strip()}%"))
    if supplier:
        query = query.where(Asset.supplier.ilike(f"%{supplier.strip()}%"))
    if purchased_from:
        query = query.where(Asset.purchased_at >= purchased_from)
    if purchased_to:
        query = query.where(Asset.purchased_at <= purchased_to)
    if repaired_from:
        query = query.where(Asset.last_repaired_at >= repaired_from)
    if repaired_to:
        query = query.where(Asset.last_repaired_at <= repaired_to)
    if amount_min is not None:
        query = query.where(Asset.purchase_value >= amount_min)
    if amount_max is not None:
        query = query.where(Asset.purchase_value <= amount_max)
    return [_asset_out(a) for a in db.scalars(query).unique().all()]


@router.post("", response_model=AssetOut)
def create_asset(body: AssetCreate, _: AdminUser, db: Session = Depends(get_db)):
    if not db.get(Unit, body.unit_id):
        raise HTTPException(404, "Không tìm thấy phòng/unit")
    asset = Asset(**body.model_dump())
    db.add(asset)
    db.commit()
    asset = db.scalars(
        select(Asset).options(joinedload(Asset.unit)).where(Asset.id == asset.id)
    ).unique().one()
    return _asset_out(asset)


@router.patch("/{asset_id}", response_model=AssetOut)
def update_asset(asset_id: str, body: AssetUpdate, _: AdminUser, db: Session = Depends(get_db)):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(404, "Không tìm thấy tài sản")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(asset, k, v)
    db.commit()
    asset = db.scalars(
        select(Asset).options(joinedload(Asset.unit)).where(Asset.id == asset_id)
    ).unique().one()
    return _asset_out(asset)


@router.delete("/{asset_id}")
def delete_asset(asset_id: str, _: AdminUser, db: Session = Depends(get_db)):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(404, "Không tìm thấy tài sản")
    db.delete(asset)
    db.commit()
    return {"ok": True}
