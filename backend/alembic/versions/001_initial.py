"""Initial schema

Revision ID: 001_initial
Revises:
Create Date: 2026-03-26
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tables are created via Base.metadata.create_all on startup for MVP.
    # This revision documents the baseline; generate a real autogenerate
    # migration after switching to Postgres if needed.
    pass


def downgrade() -> None:
    pass
