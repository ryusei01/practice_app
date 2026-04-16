"""public.alembic_version に RLS を有効化（Supabase / PostgREST 向け）

Revision ID: 20260416_alembic_version_rls
Revises: 20260408_content_languages
Create Date: 2026-04-16

ポリシー未作成のため anon / authenticated は API 経由で行にアクセスできない。
マイグレーション実行ユーザー（テーブル所有者）は RLS をバイパスする。
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "20260416_alembic_version_rls"
down_revision: Union[str, Sequence[str], None] = "20260408_content_languages"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _alembic_version_table_exists(connection) -> bool:
    row = connection.execute(
        text(
            """
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'alembic_version'
            """
        )
    ).first()
    return row is not None


def upgrade() -> None:
    conn = op.get_bind()
    if not _alembic_version_table_exists(conn):
        return
    op.execute(text("ALTER TABLE public.alembic_version ENABLE ROW LEVEL SECURITY"))


def downgrade() -> None:
    conn = op.get_bind()
    if not _alembic_version_table_exists(conn):
        return
    op.execute(text("ALTER TABLE public.alembic_version DISABLE ROW LEVEL SECURITY"))
