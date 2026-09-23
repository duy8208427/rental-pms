from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import CurrentUser, AdminUser
from app.database import get_db
from app.models import Contract, Occupancy, OccupancyKind, OccupancyStatus, Tenant, UserRole
from app.schemas import ContractCreate, ContractOut, OccupancyOut
from app.services.finance import create_invoice, next_contract_no
from app.services.occupancy import ensure_available

router = APIRouter(prefix="/contracts", tags=["contracts"])


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


def _contract_status(c: Contract) -> str:
    if c.terminated_at:
        return "terminated"
    if c.occupancy:
        return c.occupancy.status.value if hasattr(c.occupancy.status, "value") else str(c.occupancy.status)
    return "unknown"


def _contract_out(c: Contract) -> ContractOut:
    occ = c.occupancy
    return ContractOut(
        id=c.id,
        occupancy_id=c.occupancy_id,
        contract_no=c.contract_no,
        deposit=c.deposit,
        monthly_rent=c.monthly_rent,
        billing_cycle=c.billing_cycle,
        signed_at=c.signed_at,
        terminated_at=c.terminated_at,
        occupancy=_occ_out(occ) if occ else None,
        unit_code=occ.unit.code if occ and occ.unit else None,
        start_date=occ.start_date if occ else None,
        end_date=occ.end_date if occ else None,
        status=_contract_status(c),
        created_at=c.created_at,
    )


@router.get("", response_model=list[ContractOut])
def list_contracts(user: CurrentUser, db: Session = Depends(get_db)):
    q = (
        select(Contract)
        .options(
            joinedload(Contract.occupancy).joinedload(Occupancy.tenant),
            joinedload(Contract.occupancy).joinedload(Occupancy.unit),
        )
        .order_by(Contract.created_at.desc())
    )
    if user.role == UserRole.tenant:
        if not user.tenant_id:
            return []
        q = q.join(Occupancy, Contract.occupancy_id == Occupancy.id).where(
            Occupancy.tenant_id == user.tenant_id
        )
    rows = db.scalars(q).unique().all()
    return [_contract_out(c) for c in rows]


@router.post("", response_model=ContractOut)
def create_contract(body: ContractCreate, _: AdminUser, db: Session = Depends(get_db)):
    if not db.get(Tenant, body.tenant_id):
        raise HTTPException(404, "Không tìm thấy khách thuê")
    unit = ensure_available(db, body.unit_id, body.start_date, body.end_date)
    rent = body.monthly_rent if body.monthly_rent is not None else (unit.price_per_month or Decimal("0"))

    today = date.today()
    status = OccupancyStatus.active if body.start_date <= today < body.end_date else OccupancyStatus.reserved

    occ = Occupancy(
        unit_id=body.unit_id,
        tenant_id=body.tenant_id,
        kind=OccupancyKind.contract,
        status=status,
        start_date=body.start_date,
        end_date=body.end_date,
        notes=body.notes,
    )
    db.add(occ)
    db.flush()
    contract = Contract(
        occupancy_id=occ.id,
        contract_no=body.contract_no or next_contract_no(db),
        deposit=body.deposit,
        monthly_rent=rent,
        billing_cycle=body.billing_cycle,
        signed_at=body.signed_at or body.start_date,
    )
    db.add(contract)
    if body.auto_invoice:
        if body.deposit > 0:
            create_invoice(
                db,
                tenant_id=body.tenant_id,
                occupancy_id=occ.id,
                amount=body.deposit,
                description=f"Đặt cọc HĐ {contract.contract_no} — {unit.code}",
            )
        if rent > 0:
            create_invoice(
                db,
                tenant_id=body.tenant_id,
                occupancy_id=occ.id,
                amount=rent,
                description=f"Tiền thuê tháng đầu HĐ {contract.contract_no} — {unit.code}",
            )
    db.commit()
    contract = db.scalars(
        select(Contract)
        .options(
            joinedload(Contract.occupancy).joinedload(Occupancy.tenant),
            joinedload(Contract.occupancy).joinedload(Occupancy.unit),
        )
        .where(Contract.id == contract.id)
    ).unique().one()
    return _contract_out(contract)


def _add_months(d: date, months: int) -> date:
    total = d.month - 1 + months
    year = d.year + total // 12
    month = total % 12 + 1
    day = min(d.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
                      31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
    return date(year, month, day)


@router.post("/{contract_id}/renew", response_model=ContractOut)
def renew_contract(
    contract_id: str,
    user: AdminUser,
    db: Session = Depends(get_db),
    months: int = 12,
):
    _ = user
    contract = db.scalars(
        select(Contract)
        .options(
            joinedload(Contract.occupancy).joinedload(Occupancy.tenant),
            joinedload(Contract.occupancy).joinedload(Occupancy.unit),
        )
        .where(Contract.id == contract_id)
    ).unique().one_or_none()
    if not contract:
        raise HTTPException(404, "Không tìm thấy hợp đồng")
    today = date.today()
    old_end = contract.occupancy.end_date
    base = old_end if old_end > today else today
    new_end = _add_months(base, months)
    ensure_available(
        db,
        contract.occupancy.unit_id,
        base,
        new_end,
        exclude_occupancy_id=contract.occupancy_id,
    )
    contract.occupancy.end_date = new_end
    contract.occupancy.status = OccupancyStatus.active
    contract.terminated_at = None
    db.commit()
    db.refresh(contract)
    return _contract_out(contract)


@router.post("/{contract_id}/terminate", response_model=ContractOut)
def terminate_contract(contract_id: str, _: AdminUser, db: Session = Depends(get_db)):
    contract = db.scalars(
        select(Contract)
        .options(
            joinedload(Contract.occupancy).joinedload(Occupancy.tenant),
            joinedload(Contract.occupancy).joinedload(Occupancy.unit),
        )
        .where(Contract.id == contract_id)
    ).unique().one_or_none()
    if not contract:
        raise HTTPException(404, "Không tìm thấy hợp đồng")
    today = date.today()
    contract.terminated_at = today
    contract.occupancy.end_date = today
    contract.occupancy.status = OccupancyStatus.completed
    db.commit()
    db.refresh(contract)
    return _contract_out(contract)
