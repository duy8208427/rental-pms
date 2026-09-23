"""Add manager role and managed_property_id on users

Revision ID: 006_manager_role
Revises: 005_expense_cycle_journal
Create Date: 2026-09-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006_manager_role"
down_revision: Union[str, None] = "005_expense_cycle_journal"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(
            sa.Column("managed_property_id", sa.String(36), nullable=True)
        )
        batch.create_foreign_key(
            "fk_users_managed_property_id",
            "properties",
            ["managed_property_id"],
            ["id"],
        )
        batch.create_index("ix_users_managed_property_id", ["managed_property_id"])


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_index("ix_users_managed_property_id")
        batch.drop_constraint("fk_users_managed_property_id", type_="foreignkey")
        batch.drop_column("managed_property_id")
