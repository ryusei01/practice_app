"""Alembic 環境。DATABASE_URL はアプリと同一（app.core.config.settings）。"""
from __future__ import annotations

import os
import sys
from logging.config import fileConfig

from sqlalchemy import create_engine, pool, text
from alembic import context

# 複数 Cloud Run インスタンスが同時に upgrade しないよう PostgreSQL のみロック
_ALEMBIC_PG_ADVISORY_LOCK_ID = 872_530_451

# backend/ をパスに（app パッケージ解決）
_backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)

from app.core.config import settings  # noqa: E402
from app.core.database import Base  # noqa: E402
import app.models  # noqa: F401, E402 — メタデータ登録

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = settings.DATABASE_URL
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(
        settings.DATABASE_URL,
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        if connection.dialect.name == "postgresql":
            connection.execute(
                text(f"SELECT pg_advisory_lock({_ALEMBIC_PG_ADVISORY_LOCK_ID})")
            )
        try:
            context.configure(connection=connection, target_metadata=target_metadata)
            with context.begin_transaction():
                context.run_migrations()
        finally:
            if connection.dialect.name == "postgresql":
                connection.execute(
                    text(f"SELECT pg_advisory_unlock({_ALEMBIC_PG_ADVISORY_LOCK_ID})")
                )
            connection.commit()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
