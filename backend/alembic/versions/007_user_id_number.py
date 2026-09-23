"""Add id_number (CCCD) on users

Revision ID: 007_user_id_number
Revises: 006_manager_role
Create Date: 2026-09-18
"""

from typing import Sequence, Union

from alembic import op

revision: str = "007_user_id_number"
down_revision: Union[str, None] = "006_manager_role"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite-friendly: avoid batch_alter_table circular FK reorder
    bind = op.get_bind()
    cols = {row[1] for row in bind.exec_driver_sql("PRAGMA table_info(users)").fetchall()}
    if "id_number" not in cols:
        op.execute("ALTER TABLE users ADD COLUMN id_number VARCHAR(50)")


def downgrade() -> None:
    # SQLite cannot drop column reliably in older versions — no-op
    pass
