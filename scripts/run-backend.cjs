/**
 * backend の venv 内 Python で uvicorn を起動する（Windows / macOS / Linux 共通）
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const net = require("net");

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

function canListen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    server.listen({ port, host }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function pickPort({
  preferred = 8003,
  host = "127.0.0.1",
  maxTries = 50,
} = {}) {
  for (let i = 0; i < maxTries; i++) {
    const port = preferred + i;
    // eslint-disable-next-line no-await-in-loop
    if (await canListen(port, host)) return port;
  }
  return null;
}

async function writeDevPortFile({ port }) {
  const dir = path.join(__dirname, "..", ".dev");
  const file = path.join(dir, "backend-port.json");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify({ port, origin: `http://127.0.0.1:${port}` }, null, 2) + "\n",
    "utf8"
  );
}

// Windows: uvicorn の --reload は子プロセス終了時に CMD が「バッチ ジョブを終了しますか (Y/N)?」を出し、
// concurrently など非対話でフロントと併走すると止まる。watchfiles でプロセス再起動に切り替える。
// macOS/Linux: 従来どおり uvicorn --reload（軽い）
(async () => {
  const preferred = Number.parseInt(process.env.BACKEND_PORT || "8003", 10);
  const port = await pickPort({ preferred, host: "127.0.0.1" });
  if (!port) {
    console.error(
      `[dev:backend] 空きポートが見つかりませんでした（開始: ${preferred}、試行: 50）`
    );
    process.exit(1);
  }

  await writeDevPortFile({ port });

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
          `${pyForCmd} -m uvicorn app.main:app --host 127.0.0.1 --port ${port}`,
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
          String(port),
        ],
    { cwd: backend, stdio: "inherit", shell: false }
  );
  child.on("exit", (code) => process.exit(code ?? 0));
})().catch((err) => {
  console.error("[dev:backend] 起動に失敗しました:", err);
  process.exit(1);
});
