import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import AdminUser, CurrentUser
from app.database import get_db
from app.models import Feedback, FeedbackImage, FeedbackStatus, UserRole
from app.schemas import FeedbackOut

router = APIRouter(prefix="/feedback", tags=["feedback"])

UPLOAD_ROOT = Path(__file__).resolve().parent.parent.parent / "uploads" / "feedback"
ALLOWED_SUBMITTERS = {UserRole.tenant, UserRole.manager}


def _feedback_out(fb: Feedback) -> FeedbackOut:
    user = fb.user
    return FeedbackOut(
        id=fb.id,
        user_id=fb.user_id,
        title=fb.title,
        content=fb.content,
        status=fb.status,
        created_at=fb.created_at,
        user_name=user.full_name if user else None,
        user_email=user.email if user else None,
        user_role=user.role if user else None,
        images=list(fb.images or []),
    )


def _load_options():
    return (joinedload(Feedback.user), joinedload(Feedback.images))


@router.post("", response_model=FeedbackOut)
async def create_feedback(
    user: CurrentUser,
    db: Session = Depends(get_db),
    title: str = Form(...),
    content: str = Form(...),
    files: list[UploadFile] | None = File(None),
):
    if user.role not in ALLOWED_SUBMITTERS:
        raise HTTPException(403, "Chỉ khách thuê và người quản lý được gửi góp ý")
    title = title.strip()
    content = content.strip()
    if not title:
        raise HTTPException(400, "Tiêu đề là bắt buộc")
    if not content:
        raise HTTPException(400, "Nội dung là bắt buộc")

    fb = Feedback(user_id=user.id, title=title, content=content, status=FeedbackStatus.new)
    db.add(fb)
    db.flush()

    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    for i, file in enumerate(files or []):
        if not file.filename:
            continue
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(400, "Chỉ nhận file ảnh")
        ext = Path(file.filename or "img.jpg").suffix or ".jpg"
        name = f"{fb.id}_{uuid.uuid4().hex[:8]}{ext}"
        dest = UPLOAD_ROOT / name
        dest.write_bytes(await file.read())
        db.add(
            FeedbackImage(
                feedback_id=fb.id,
                url=f"/uploads/feedback/{name}",
                sort_order=i,
            )
        )

    db.commit()
    loaded = db.scalars(
        select(Feedback).options(*_load_options()).where(Feedback.id == fb.id)
    ).unique().one()
    return _feedback_out(loaded)


@router.get("/mine", response_model=list[FeedbackOut])
def list_my_feedback(user: CurrentUser, db: Session = Depends(get_db)):
    if user.role not in ALLOWED_SUBMITTERS:
        raise HTTPException(403, "Không đủ quyền")
    rows = db.scalars(
        select(Feedback)
        .options(*_load_options())
        .where(Feedback.user_id == user.id)
        .order_by(Feedback.created_at.desc())
    ).unique().all()
    return [_feedback_out(r) for r in rows]


@router.get("", response_model=list[FeedbackOut])
def list_feedback(_: AdminUser, db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Feedback).options(*_load_options()).order_by(Feedback.created_at.desc())
    ).unique().all()
    return [_feedback_out(r) for r in rows]


@router.get("/{feedback_id}", response_model=FeedbackOut)
def get_feedback(feedback_id: str, _: AdminUser, db: Session = Depends(get_db)):
    fb = db.scalars(
        select(Feedback).options(*_load_options()).where(Feedback.id == feedback_id)
    ).unique().first()
    if not fb:
        raise HTTPException(404, "Không tìm thấy góp ý")
    return _feedback_out(fb)


@router.post("/{feedback_id}/done", response_model=FeedbackOut)
def mark_feedback_done(feedback_id: str, _: AdminUser, db: Session = Depends(get_db)):
    fb = db.scalars(
        select(Feedback).options(*_load_options()).where(Feedback.id == feedback_id)
    ).unique().first()
    if not fb:
        raise HTTPException(404, "Không tìm thấy góp ý")
    fb.status = FeedbackStatus.done
    db.commit()
    loaded = db.scalars(
        select(Feedback).options(*_load_options()).where(Feedback.id == feedback_id)
    ).unique().one()
    return _feedback_out(loaded)


@router.post("/{feedback_id}/reopen", response_model=FeedbackOut)
def reopen_feedback(feedback_id: str, _: AdminUser, db: Session = Depends(get_db)):
    fb = db.scalars(
        select(Feedback).options(*_load_options()).where(Feedback.id == feedback_id)
    ).unique().first()
    if not fb:
        raise HTTPException(404, "Không tìm thấy góp ý")
    fb.status = FeedbackStatus.new
    db.commit()
    loaded = db.scalars(
        select(Feedback).options(*_load_options()).where(Feedback.id == feedback_id)
    ).unique().one()
    return _feedback_out(loaded)
