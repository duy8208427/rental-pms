"""Add adults/children on bookings

Revision ID: 009_booking_guests_split
Revises: 008_feedback
Create Date: 2026-09-18
"""

from typing import Sequence, Union

from alembic import op

revision: str = "009_booking_guests_split"
down_revision: Union[str, None] = "008_feedback"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    cols = {row[1] for row in bind.exec_driver_sql("PRAGMA table_info(bookings)").fetchall()}
    if "adults" not in cols:
        op.execute("ALTER TABLE bookings ADD COLUMN adults INTEGER NOT NULL DEFAULT 1")
    if "children" not in cols:
        op.execute("ALTER TABLE bookings ADD COLUMN children INTEGER NOT NULL DEFAULT 0")
    # Backfill from guests where adults still default-only
    op.execute(
        "UPDATE bookings SET adults = CASE WHEN guests > 0 THEN guests ELSE 1 END, "
        "children = 0 WHERE adults = 1 AND children = 0 AND guests > 1"
    )


def downgrade() -> None:
    pass
