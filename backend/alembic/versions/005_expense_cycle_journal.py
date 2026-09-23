"""Add expense due cycle, next due, and journals

Revision ID: 005_expense_cycle_journal
Revises: 004_expense_fields
Create Date: 2026-09-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005_expense_cycle_journal"
down_revision: Union[str, None] = "004_expense_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("expenses") as batch:
        batch.add_column(
            sa.Column(
                "due_cycle",
                sa.Enum("monthly", "quarterly", "yearly", name="expenseduecycle"),
                nullable=False,
                server_default="monthly",
            )
        )
        batch.add_column(
            sa.Column("recurring", sa.Boolean(), nullable=False, server_default=sa.true())
        )
        batch.add_column(sa.Column("due_date", sa.Date(), nullable=True))
        batch.add_column(sa.Column("next_due_date", sa.Date(), nullable=True))

    op.create_table(
        "expense_journals",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("expense_id", sa.String(36), sa.ForeignKey("expenses.id"), nullable=False, index=True),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("expense_journals")
    with op.batch_alter_table("expenses") as batch:
        batch.drop_column("next_due_date")
        batch.drop_column("due_date")
        batch.drop_column("recurring")
        batch.drop_column("due_cycle")
