"""Feedback + feedback images

Revision ID: 008_feedback
Revises: 007_user_id_number
Create Date: 2026-09-18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008_feedback"
down_revision: Union[str, None] = "007_user_id_number"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    tables = {row[0] for row in bind.exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    if "feedbacks" not in tables:
        op.create_table(
            "feedbacks",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("status", sa.Enum("new", "done", name="feedbackstatus"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
    if "feedback_images" not in tables:
        op.create_table(
            "feedback_images",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column(
                "feedback_id",
                sa.String(36),
                sa.ForeignKey("feedbacks.id"),
                nullable=False,
                index=True,
            ),
            sa.Column("url", sa.String(500), nullable=False),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )


def downgrade() -> None:
    op.drop_table("feedback_images")
    op.drop_table("feedbacks")
