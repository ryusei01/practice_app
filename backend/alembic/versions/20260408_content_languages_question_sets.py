"""question_sets に content_languages (JSONB) を追加し既存行を埋める

Revision ID: 20260408_content_languages
Revises:
Create Date: 2026-04-08

PostgreSQL 専用（本番 DB）。冪等に近い raw SQL。
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "20260408_content_languages"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(connection, column_name: str) -> bool:
    row = connection.execute(
        text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'question_sets'
              AND column_name = :col
            """
        ),
        {"col": column_name},
    ).first()
    return row is not None


def upgrade() -> None:
    conn = op.get_bind()

    op.execute(
        text(
            """
            ALTER TABLE question_sets
            ADD COLUMN IF NOT EXISTS content_languages JSONB
            """
        )
    )

    if _column_exists(conn, "content_language"):
        op.execute(
            text(
                """
                UPDATE question_sets
                SET content_languages = jsonb_build_array(content_language)
                WHERE content_languages IS NULL
                  AND content_language IS NOT NULL
                """
            )
        )

    op.execute(
        text(
            """
            UPDATE question_sets
            SET content_languages = '["ja"]'::jsonb
            WHERE content_languages IS NULL
            """
        )
    )
    op.execute(
        text(
            """
            ALTER TABLE question_sets
            ALTER COLUMN content_languages SET DEFAULT '["ja"]'::jsonb
            """
        )
    )
    op.execute(
        text(
            """
            ALTER TABLE question_sets
            ALTER COLUMN content_languages SET NOT NULL
            """
        )
    )

    if not _column_exists(conn, "content_language"):
        op.execute(
            text(
                """
                ALTER TABLE question_sets
                ADD COLUMN content_language VARCHAR
                """
            )
        )
        op.execute(
            text(
                """
                UPDATE question_sets
                SET content_language = COALESCE(content_languages->>0, 'ja')
                WHERE content_language IS NULL
                """
            )
        )
        op.execute(
            text(
                """
                ALTER TABLE question_sets
                ALTER COLUMN content_language SET DEFAULT 'ja'
                """
            )
        )
        op.execute(
            text(
                """
                ALTER TABLE question_sets
                ALTER COLUMN content_language SET NOT NULL
                """
            )
        )


def downgrade() -> None:
    op.execute(text("ALTER TABLE question_sets DROP COLUMN IF EXISTS content_languages"))
