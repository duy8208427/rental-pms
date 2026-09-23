"""Seed sample feedback for admin inbox demo (idempotent)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Feedback, FeedbackStatus, User, UserRole

SAMPLES = [
    {
        "email": "tenant@example.com",
        "title": "Ứng dụng chậm khi xem hóa đơn",
        "content": "Khi mở tab Hóa đơn trên điện thoại, danh sách load rất lâu (hơn 10 giây). Mong cải thiện tốc độ.",
        "status": FeedbackStatus.new,
    },
    {
        "email": "tenant@example.com",
        "title": "Wi‑Fi phòng yếu vào buổi tối",
        "content": "Từ khoảng 19h–22h tín hiệu Wi‑Fi phòng rất yếu, xem video bị giật. Mong kiểm tra lại access point tầng này.",
        "status": FeedbackStatus.new,
    },
    {
        "email": "manager.hotel@example.com",
        "title": "Sơ đồ phòng không cập nhật sau checkout",
        "content": "Sau khi checkout khách, sơ đồ phòng vẫn hiện trạng thái đang thuê khoảng vài phút. Mong đồng bộ ngay sau checkout.",
        "status": FeedbackStatus.done,
    },
    {
        "email": "manager.office@example.com",
        "title": "Đề xuất thêm lọc theo tầng",
        "content": "Trên sơ đồ phòng, nên có bộ lọc theo tầng để thao tác nhanh hơn khi tòa nhiều tầng.",
        "status": FeedbackStatus.new,
    },
]


def seed_feedback() -> None:
    db = SessionLocal()
    try:
        created = 0
        for sample in SAMPLES:
            user = db.scalar(select(User).where(User.email == sample["email"]))
            if not user:
                print(f"skip (no user): {sample['email']}")
                continue
            if user.role not in (UserRole.tenant, UserRole.manager):
                print(f"skip (role): {sample['email']}")
                continue
            exists = db.scalar(
                select(Feedback).where(
                    Feedback.user_id == user.id,
                    Feedback.title == sample["title"],
                )
            )
            if exists:
                print(f"exists: {sample['title']}")
                continue
            db.add(
                Feedback(
                    user_id=user.id,
                    title=sample["title"],
                    content=sample["content"],
                    status=sample["status"],
                )
            )
            created += 1
            print(f"added [{user.role.value}]: {sample['title']}".encode("utf-8", "replace").decode("utf-8"))
        db.commit()
        print(f"done, created={created}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_feedback()
