/**
 * backend の venv 内 Python で uvicorn を起動する（Windows / macOS / Linux 共通）
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const backend = path.join(__dirname, "..", "backend");
const py =
  process.platform === "win32"
    ? path.join(backend, "venv", "Scripts", "python.exe")
    : path.join(backend, "venv", "bin", "python");

if (!fs.existsSync(py)) {
  console.error(
    "[dev:backend] backend/venv が見つかりません。次を実行してください: cd backend && python -m venv venv && pip install -r requirements.txt"
  );
  process.exit(1);
}

const pyForCmd = py.includes(" ") ? `"${py}"` : py;

// Windows: uvicorn の --reload は子プロセス終了時に CMD が「バッチ ジョブを終了しますか (Y/N)?」を出し、
// concurrently など非対話でフロントと併走すると止まる。watchfiles でプロセス再起動に切り替える。
// macOS/Linux: 従来どおり uvicorn --reload（軽い）
const child = spawn(
  py,
  process.platform === "win32"
    ? [
        "-m",
        "watchfiles",
        "--filter",
        "python",
        "--grace-period",
        "2",
        "--ignore-paths",
        "__pycache__",
        `${pyForCmd} -m uvicorn app.main:app --host 127.0.0.1 --port 8003`,
        "app",
      ]
    : [
        "-m",
        "uvicorn",
        "app.main:app",
        "--reload",
        "--reload-dir",
        "app",
        "--host",
        "127.0.0.1",
        "--port",
        "8003",
      ],
  { cwd: backend, stdio: "inherit", shell: false }
);
child.on("exit", (code) => process.exit(code ?? 0));
