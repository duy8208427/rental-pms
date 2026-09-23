"""Add expense payment status and image fields

Revision ID: 004_expense_fields
Revises: 003_asset_fields
Create Date: 2026-09-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004_expense_fields"
down_revision: Union[str, None] = "003_asset_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("expenses") as batch:
        batch.add_column(
            sa.Column(
                "status",
                sa.Enum("unpaid", "paid", name="expensestatus"),
                nullable=False,
                server_default="unpaid",
            )
        )
        batch.add_column(sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("image_url", sa.String(500), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("expenses") as batch:
        batch.drop_column("image_url")
        batch.drop_column("paid_at")
        batch.drop_column("status")
