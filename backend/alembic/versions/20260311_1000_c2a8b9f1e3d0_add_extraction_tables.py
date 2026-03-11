"""add_extraction_tables

Revision ID: c2a8b9f1e3d0
Revises: beeff06d5ffb
Create Date: 2026-03-11 10:00:00.000000+00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c2a8b9f1e3d0"
down_revision: Union[str, None] = "beeff06d5ffb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Enum types ────────────────────────────────────────────────────────────
    workflow_status = postgresql.ENUM(
        "draft", "published", "archived",
        name="workflow_status", create_type=True,
    )
    workflow_status.create(op.get_bind(), checkfirst=True)

    schedule_type = postgresql.ENUM(
        "once", "recurring",
        name="schedule_type", create_type=True,
    )
    schedule_type.create(op.get_bind(), checkfirst=True)

    execution_status = postgresql.ENUM(
        "pending", "running", "success", "failed", "cancelled",
        name="execution_status", create_type=True,
    )
    execution_status.create(op.get_bind(), checkfirst=True)

    log_level = postgresql.ENUM(
        "DEBUG", "INFO", "WARNING", "ERROR",
        name="log_level", create_type=True,
    )
    log_level.create(op.get_bind(), checkfirst=True)

    # ── workflows ─────────────────────────────────────────────────────────────
    op.create_table(
        "workflows",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM("draft", "published", "archived",
                            name="workflow_status", create_type=False),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_workflows_slug"),
    )
    op.create_index("ix_workflows_slug", "workflows", ["slug"], unique=False)

    # ── schedules ─────────────────────────────────────────────────────────────
    op.create_table(
        "schedules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("workflow_id", sa.Integer(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("params", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("param_fingerprint", sa.String(length=64), nullable=False),
        sa.Column(
            "schedule_type",
            postgresql.ENUM("once", "recurring",
                            name="schedule_type", create_type=False),
            nullable=False,
        ),
        sa.Column("cron_expr", sa.String(length=100), nullable=True),
        sa.Column("run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["workflow_id"], ["workflows.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── executions ────────────────────────────────────────────────────────────
    op.create_table(
        "executions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("workflow_id", sa.Integer(), nullable=False),
        sa.Column("schedule_id", sa.Integer(), nullable=True),
        sa.Column("triggered_by", sa.Integer(), nullable=False),
        sa.Column("params", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("param_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("celery_task_id", sa.String(length=255), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM("pending", "running", "success", "failed", "cancelled",
                            name="execution_status", create_type=False),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("error_traceback", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["workflow_id"], ["workflows.id"]),
        sa.ForeignKeyConstraint(["schedule_id"], ["schedules.id"]),
        sa.ForeignKeyConstraint(["triggered_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_executions_workflow_id", "executions", ["workflow_id"])
    op.create_index("ix_executions_triggered_by", "executions", ["triggered_by"])
    op.create_index("ix_executions_status", "executions", ["status"])
    op.create_index(
        "ix_executions_workflow_fingerprint_status",
        "executions",
        ["workflow_id", "param_fingerprint", "status"],
    )

    # ── artifacts ─────────────────────────────────────────────────────────────
    op.create_table(
        "artifacts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("execution_id", sa.Integer(), nullable=False),
        sa.Column("workflow_id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(length=500), nullable=False),
        sa.Column("file_path", sa.String(length=1000), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=True),
        sa.Column("mime_type", sa.String(length=100), nullable=True),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("geo_country", sa.String(length=100), nullable=True),
        sa.Column("geo_region", sa.String(length=100), nullable=True),
        sa.Column("geo_city", sa.String(length=100), nullable=True),
        sa.Column("geo_label", sa.String(length=255), nullable=True),
        sa.Column("data_date", sa.Date(), nullable=True),
        sa.Column("tags", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["execution_id"], ["executions.id"]),
        sa.ForeignKeyConstraint(["workflow_id"], ["workflows.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_artifacts_execution_id", "artifacts", ["execution_id"])
    op.create_index("ix_artifacts_workflow_id", "artifacts", ["workflow_id"])
    op.create_index("ix_artifacts_is_public", "artifacts", ["is_public"])
    op.create_index("ix_artifacts_geo_country", "artifacts", ["geo_country"])
    op.create_index("ix_artifacts_data_date", "artifacts", ["data_date"])

    # ── execution_logs ────────────────────────────────────────────────────────
    op.create_table(
        "execution_logs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("execution_id", sa.Integer(), nullable=False),
        sa.Column(
            "level",
            postgresql.ENUM("DEBUG", "INFO", "WARNING", "ERROR",
                            name="log_level", create_type=False),
            nullable=False,
            server_default="INFO",
        ),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["execution_id"], ["executions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_execution_logs_execution_id", "execution_logs", ["execution_id"])


def downgrade() -> None:
    op.drop_index("ix_execution_logs_execution_id", table_name="execution_logs")
    op.drop_table("execution_logs")

    op.drop_index("ix_artifacts_data_date", table_name="artifacts")
    op.drop_index("ix_artifacts_geo_country", table_name="artifacts")
    op.drop_index("ix_artifacts_is_public", table_name="artifacts")
    op.drop_index("ix_artifacts_workflow_id", table_name="artifacts")
    op.drop_index("ix_artifacts_execution_id", table_name="artifacts")
    op.drop_table("artifacts")

    op.drop_index("ix_executions_workflow_fingerprint_status", table_name="executions")
    op.drop_index("ix_executions_status", table_name="executions")
    op.drop_index("ix_executions_triggered_by", table_name="executions")
    op.drop_index("ix_executions_workflow_id", table_name="executions")
    op.drop_table("executions")

    op.drop_table("schedules")

    op.drop_index("ix_workflows_slug", table_name="workflows")
    op.drop_table("workflows")

    op.execute("DROP TYPE IF EXISTS log_level")
    op.execute("DROP TYPE IF EXISTS execution_status")
    op.execute("DROP TYPE IF EXISTS schedule_type")
    op.execute("DROP TYPE IF EXISTS workflow_status")
