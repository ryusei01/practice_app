import os
import subprocess
import sys
from pathlib import Path


def load_env(path: Path) -> None:
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ[k] = v


def run_alembic(*args: str) -> None:
    env = dict(os.environ)
    env.setdefault("PYTHONUTF8", "1")
    env.setdefault("PYTHONIOENCODING", "utf-8")
    subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "alembic.ini", *args],
        check=True,
        env=env,
    )


def main() -> int:
    load_env(Path(__file__).resolve().parent / ".env")
    run_alembic("current")
    run_alembic("heads")
    run_alembic("history", "-i")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
