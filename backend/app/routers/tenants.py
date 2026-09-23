from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import CurrentUser, AdminUser
from app.database import get_db
from app.models import Occupancy, Tenant, UserRole
from app.schemas import OccupancyOut, TenantCreate, TenantOut, TenantUpdate

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.get("", response_model=list[TenantOut])
def list_tenants(user: CurrentUser, db: Session = Depends(get_db)):
    if user.role == UserRole.tenant:
        if not user.tenant_id:
            return []
        t = db.get(Tenant, user.tenant_id)
        return [t] if t else []
    return db.scalars(select(Tenant).order_by(Tenant.full_name)).all()


@router.post("", response_model=TenantOut)
def create_tenant(body: TenantCreate, _: AdminUser, db: Session = Depends(get_db)):
    tenant = Tenant(**body.model_dump())
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.get("/{tenant_id}", response_model=TenantOut)
def get_tenant(tenant_id: str, user: CurrentUser, db: Session = Depends(get_db)):
    if user.role == UserRole.tenant and user.tenant_id != tenant_id:
        raise HTTPException(403, "Không đủ quyền")
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(404, "Không tìm thấy khách thuê")
    return tenant


@router.patch("/{tenant_id}", response_model=TenantOut)
def update_tenant(
    tenant_id: str, body: TenantUpdate, _: AdminUser, db: Session = Depends(get_db)
):
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(404, "Không tìm thấy khách thuê")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(tenant, k, v)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.delete("/{tenant_id}")
def delete_tenant(tenant_id: str, _: AdminUser, db: Session = Depends(get_db)):
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(404, "Không tìm thấy khách thuê")
    db.delete(tenant)
    db.commit()
    return {"ok": True}


@router.get("/{tenant_id}/history", response_model=list[OccupancyOut])
def tenant_history(tenant_id: str, user: CurrentUser, db: Session = Depends(get_db)):
    if user.role == UserRole.tenant and user.tenant_id != tenant_id:
        raise HTTPException(403, "Không đủ quyền")
    rows = db.scalars(
        select(Occupancy)
        .options(joinedload(Occupancy.unit), joinedload(Occupancy.tenant))
        .where(Occupancy.tenant_id == tenant_id)
        .order_by(Occupancy.start_date.desc())
    ).unique().all()
    return [
        OccupancyOut(
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
        for o in rows
    ]
