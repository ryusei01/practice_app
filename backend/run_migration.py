"""
DB を Alembic で head まで更新する（本番・CI・ローカル PostgreSQL 向け）。

スキーマの素生成のみが必要な場合（例: テストのインメモリ SQLite）は
`Base.metadata.create_all` をフィクスチャ側で使うこと。
"""
from pathlib import Path

from alembic import command
from alembic.config import Config


def run_migration(revision: str = "head") -> None:
    backend_dir = Path(__file__).resolve().parent
    cfg = Config(str(backend_dir / "alembic.ini"))
    cfg.set_main_option("script_location", str(backend_dir / "alembic"))
    command.upgrade(cfg, revision)


if __name__ == "__main__":
    run_migration()
