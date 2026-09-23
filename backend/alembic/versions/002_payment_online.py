"""Add online payment fields

Revision ID: 002_payment_online
Revises: 001_initial
Create Date: 2026-09-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002_payment_online"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("payments") as batch:
        batch.add_column(
            sa.Column("status", sa.String(32), nullable=False, server_default="confirmed")
        )
        batch.add_column(
            sa.Column("provider", sa.String(32), nullable=False, server_default="manual")
        )
        batch.add_column(sa.Column("provider_order_id", sa.String(255), nullable=True))
        batch.add_column(sa.Column("provider_payload", sa.Text(), nullable=True))
        batch.add_column(sa.Column("pay_url", sa.String(1000), nullable=True))
        batch.add_column(sa.Column("qr_code", sa.Text(), nullable=True))
        batch.add_column(sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_payments_status", "payments", ["status"])
    op.create_index("ix_payments_provider_order_id", "payments", ["provider_order_id"])


def downgrade() -> None:
    op.drop_index("ix_payments_provider_order_id", table_name="payments")
    op.drop_index("ix_payments_status", table_name="payments")
    with op.batch_alter_table("payments") as batch:
        batch.drop_column("confirmed_at")
        batch.drop_column("qr_code")
        batch.drop_column("pay_url")
        batch.drop_column("provider_payload")
        batch.drop_column("provider_order_id")
        batch.drop_column("provider")
        batch.drop_column("status")
