from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import CurrentUser, create_access_token, verify_password
from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, TokenResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_out(user: User) -> UserOut:
    data = UserOut.model_validate(user)
    name = user.managed_property.name if user.managed_property else None
    return data.model_copy(update={"managed_property_name": name})


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(
        select(User)
        .options(joinedload(User.managed_property))
        .where(User.email == body.email.lower())
    )
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Tài khoản đã bị khóa")
    token = create_access_token(user.id, user.role.value)
    return TokenResponse(access_token=token, user=_user_out(user))


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser, db: Session = Depends(get_db)):
    loaded = db.scalars(
        select(User).options(joinedload(User.managed_property)).where(User.id == user.id)
    ).unique().one()
    return _user_out(loaded)
