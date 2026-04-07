"""
デプロイ後の Cloud Run 起動時に、PostgreSQL スキーマを idempotent に追従させる。

手動で SQL を流さなくても、コンテンツ言語列などが自動で揃う。
SQLite（テスト等）では何もしない。
"""
from __future__ import annotations

import logging

from sqlalchemy import Engine, text

logger = logging.getLogger(__name__)


def _pg_column_exists(conn, table_name: str, column_name: str) -> bool:
    row = conn.execute(
        text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = :table_name
              AND column_name = :column_name
            """
        ),
        {"table_name": table_name, "column_name": column_name},
    ).first()
    return row is not None


def _pg_question_set_languages_schema_ready(conn) -> bool:
    """
    初回マイグレーション済みなら True（以降の起動では DDL を投げない）。
    content_languages が NOT NULL かつ、ORM 用の content_language 列もあること。
    """
    rows = conn.execute(
        text(
            """
            SELECT column_name, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'question_sets'
              AND column_name IN ('content_languages', 'content_language')
            """
        )
    ).fetchall()
    by = {r[0]: r[1] for r in rows}
    if by.get("content_languages") != "NO":
        return False
    if by.get("content_language") != "NO":
        return False
    return True


def run_startup_migrations(engine: Engine) -> None:
    if engine.dialect.name != "postgresql":
        return

    # 毎回フル DDL する必要はない。Cloud Run のコールドスタートで無駄なロック・ログを減らす。
    with engine.connect() as conn:
        if _pg_question_set_languages_schema_ready(conn):
            logger.debug(
                "Startup DB migrations skipped (question_sets language columns already in place)."
            )
            return

    # question_sets.content_languages: 複数言語 JSON 配列
    # ADD は DEFAULT なし → 既存行のみ NULL のまま → UPDATE で content_language から正しく埋める
    # （Alembic 等で content_language 単体列を既に DROP 済みの DB ではスキップ）
    tail_statements = [
        """
        UPDATE question_sets
        SET content_languages = '["ja"]'::jsonb
        WHERE content_languages IS NULL
        """,
        """
        ALTER TABLE question_sets
        ALTER COLUMN content_languages SET DEFAULT '["ja"]'::jsonb
        """,
        """
        ALTER TABLE question_sets
        ALTER COLUMN content_languages SET NOT NULL
        """,
    ]

    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                    ALTER TABLE question_sets
                    ADD COLUMN IF NOT EXISTS content_languages JSONB
                    """
                )
            )
            # トランザクション前半で列の有無は変わらない（列復帰は tail の後）ので 1 回だけ見る
            had_content_language_column = _pg_column_exists(
                conn, "question_sets", "content_language"
            )
            if had_content_language_column:
                conn.execute(
                    text(
                        """
                        UPDATE question_sets
                        SET content_languages = jsonb_build_array(content_language)
                        WHERE content_languages IS NULL
                          AND content_language IS NOT NULL
                        """
                    )
                )
            for raw in tail_statements:
                conn.execute(text(raw.strip()))
            # ORM・一覧フィルタは QuestionSet.content_language も参照する。
            # content_languages のみ残した DB では列を戻し、配列先頭で埋める。
            if not had_content_language_column:
                conn.execute(
                    text(
                        """
                        ALTER TABLE question_sets
                        ADD COLUMN content_language VARCHAR
                        """
                    )
                )
                conn.execute(
                    text(
                        """
                        UPDATE question_sets
                        SET content_language = COALESCE(content_languages->>0, 'ja')
                        WHERE content_language IS NULL
                        """
                    )
                )
                conn.execute(
                    text(
                        """
                        ALTER TABLE question_sets
                        ALTER COLUMN content_language SET DEFAULT 'ja'
                        """
                    )
                )
                conn.execute(
                    text(
                        """
                        ALTER TABLE question_sets
                        ALTER COLUMN content_language SET NOT NULL
                        """
                    )
                )
                logger.info(
                    "Restored question_sets.content_language from content_languages (PostgreSQL)."
                )
        logger.info("Startup DB migrations applied (PostgreSQL).")
    except Exception:
        logger.exception("Startup DB migrations failed.")
        raise
