"""add_gin_index_on_artifacts_tags

Adds a GIN index on artifacts.tags so PostgreSQL can efficiently evaluate
the array overlap operator (&&) used by the public artifact search endpoint.
Without this, every tag search is a full table scan.

Revision ID: a1b2c3d4e5f6
Revises: c2a8b9f1e3d0
Create Date: 2026-03-11 11:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "c2a8b9f1e3d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # CONCURRENTLY cannot run inside a transaction block (which Alembic uses),
    # so we use a plain CREATE INDEX here. On a table with existing live traffic
    # that needs zero-lock-time index creation, run this statement manually
    # outside Alembic after deployment:
    #   CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_artifacts_tags_gin
    #   ON artifacts USING gin(tags);
    op.create_index(
        "ix_artifacts_tags_gin",
        "artifacts",
        ["tags"],
        postgresql_using="gin",
    )


def downgrade() -> None:
    op.drop_index("ix_artifacts_tags_gin", table_name="artifacts")
