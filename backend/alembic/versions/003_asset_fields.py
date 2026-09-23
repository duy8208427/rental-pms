"""Add asset supplier and date fields

Revision ID: 003_asset_fields
Revises: 002_payment_online
Create Date: 2026-09-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003_asset_fields"
down_revision: Union[str, None] = "002_payment_online"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("assets") as batch:
        batch.add_column(sa.Column("supplier", sa.String(255), nullable=True))
        batch.add_column(sa.Column("purchased_at", sa.Date(), nullable=True))
        batch.add_column(sa.Column("last_repaired_at", sa.Date(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("assets") as batch:
        batch.drop_column("last_repaired_at")
        batch.drop_column("purchased_at")
        batch.drop_column("supplier")
