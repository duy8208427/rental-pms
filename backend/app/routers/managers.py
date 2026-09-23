from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import AdminUser, hash_password
from app.database import get_db
from app.models import Property, User, UserRole
from app.schemas import ManagerCreate, ManagerUpdate, UserOut

router = APIRouter(prefix="/managers", tags=["managers"])


def _manager_out(user: User) -> UserOut:
    data = UserOut.model_validate(user)
    name = user.managed_property.name if user.managed_property else None
    return data.model_copy(update={"managed_property_name": name})


def _get_manager(db: Session, manager_id: str) -> User:
    user = db.scalars(
        select(User)
        .options(joinedload(User.managed_property))
        .where(User.id == manager_id, User.role == UserRole.manager)
    ).unique().one_or_none()
    if not user:
        raise HTTPException(404, "Không tìm thấy người quản lý")
    return user


def _require_property(db: Session, property_id: str) -> Property:
    prop = db.get(Property, property_id)
    if not prop:
        raise HTTPException(400, "Cơ sở không tồn tại")
    return prop


@router.get("", response_model=list[UserOut])
def list_managers(_: AdminUser, db: Session = Depends(get_db)):
    rows = db.scalars(
        select(User)
        .options(joinedload(User.managed_property))
        .where(User.role == UserRole.manager)
        .order_by(User.full_name)
    ).unique().all()
    return [_manager_out(u) for u in rows]


@router.post("", response_model=UserOut)
def create_manager(body: ManagerCreate, _: AdminUser, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    existing = db.scalar(select(User).where(User.email == email))
    if existing:
        raise HTTPException(400, "Email đã được sử dụng")
    _require_property(db, body.managed_property_id)
    id_number = body.id_number.strip()
    if not id_number:
        raise HTTPException(400, "CCCD là bắt buộc")
    user = User(
        email=email,
        password_hash=hash_password(body.password),
        full_name=body.full_name.strip(),
        phone=(body.phone or "").strip() or None,
        id_number=id_number,
        role=UserRole.manager,
        managed_property_id=body.managed_property_id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    return _manager_out(_get_manager(db, user.id))


@router.patch("/{manager_id}", response_model=UserOut)
def update_manager(
    manager_id: str,
    body: ManagerUpdate,
    _: AdminUser,
    db: Session = Depends(get_db),
):
    user = _get_manager(db, manager_id)
    data = body.model_dump(exclude_unset=True)
    if "managed_property_id" in data and data["managed_property_id"] is not None:
        _require_property(db, data["managed_property_id"])
        user.managed_property_id = data["managed_property_id"]
    if "full_name" in data and data["full_name"] is not None:
        user.full_name = data["full_name"].strip()
    if "phone" in data:
        phone = data["phone"]
        user.phone = (phone or "").strip() or None
    if "id_number" in data and data["id_number"] is not None:
        id_number = data["id_number"].strip()
        if not id_number:
            raise HTTPException(400, "CCCD là bắt buộc")
        user.id_number = id_number
    if "password" in data and data["password"]:
        user.password_hash = hash_password(data["password"])
    if "is_active" in data and data["is_active"] is not None:
        user.is_active = data["is_active"]
    db.commit()
    return _manager_out(_get_manager(db, manager_id))


@router.delete("/{manager_id}")
def deactivate_manager(manager_id: str, _: AdminUser, db: Session = Depends(get_db)):
    user = _get_manager(db, manager_id)
    user.is_active = False
    db.commit()
    return {"ok": True}
