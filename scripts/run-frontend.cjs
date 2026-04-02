/**
 * frontend (Expo) を起動する。backend が選んだポートに合わせて EXPO_PUBLIC_API_URL を自動設定する。
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const net = require("net");

const root = path.join(__dirname, "..");
const frontend = path.join(root, "frontend");
const devPortFile = path.join(root, ".dev", "backend-port.json");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function readBackendPort({ timeoutMs = 12_000, intervalMs = 250 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const raw = fs.readFileSync(devPortFile, "utf8");
      const json = JSON.parse(raw);
      const port = Number(json?.port);
      if (Number.isInteger(port) && port > 0 && port < 65536) return port;
    } catch {
      // ignore and retry
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(intervalMs);
  }
  return null;
}

function canListen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    // host を指定しないことで 0.0.0.0 相当（全IF）で占有確認する。
    // Expo は全IFで待ち受けることがあり、127.0.0.1 だけで確認すると取りこぼす。
    const listenOpts = host ? { port, host } : { port };
    server.listen(listenOpts, () => {
      server.close(() => resolve(true));
    });
  });
}

async function pickPort({
  preferred = 8082,
  host = null,
  maxTries = 50,
} = {}) {
  for (let i = 0; i < maxTries; i++) {
    const port = preferred + i;
    // eslint-disable-next-line no-await-in-loop
    if (await canListen(port, host)) return port;
  }
  return null;
}

(async () => {
  const port = await readBackendPort();
  const apiUrl =
    process.env.EXPO_PUBLIC_API_URL ||
    `http://127.0.0.1:${port || 8003}/api/v1`;

  const preferredExpoPort = Number.parseInt(process.env.EXPO_PORT || "8082", 10);
  const pickedExpoPort =
    (await pickPort({ preferred: preferredExpoPort, host: null })) ??
    preferredExpoPort;

  const env = { ...process.env, EXPO_PUBLIC_API_URL: apiUrl };

  const child =
    process.platform === "win32"
      ? spawn(
          "cmd.exe",
          [
            "/d",
            "/s",
            "/c",
            "npx",
            "expo",
            "start",
            "--port",
            String(pickedExpoPort),
          ],
          {
            cwd: frontend,
            stdio: "inherit",
            shell: false,
            env,
          }
        )
      : spawn("npx", ["expo", "start", "--port", String(pickedExpoPort)], {
          cwd: frontend,
          stdio: "inherit",
          shell: false,
          env,
        });
  child.on("exit", (code) => process.exit(code ?? 0));
})().catch((err) => {
  console.error("[dev:frontend] 起動に失敗しました:", err);
  process.exit(1);
});

