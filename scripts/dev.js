import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const preferredBackendPort = Number(process.env.PORT || 3001);
const backendPort = await findOpenPort(preferredBackendPort);
const apiProxyTarget = `http://localhost:${backendPort}`;
const viteCli = path.join(rootDir, "node_modules", "vite", "bin", "vite.js");

if (backendPort !== preferredBackendPort) {
  console.log(`Port ${preferredBackendPort} is busy. Backend will use ${backendPort} instead.`);
}

const processes = [
  spawn(process.execPath, ["backend/server.js"], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(backendPort),
    },
    stdio: "inherit",
  }),
  spawn(process.execPath, [viteCli, "--host", "0.0.0.0"], {
    cwd: rootDir,
    env: {
      ...process.env,
      API_PROXY_TARGET: apiProxyTarget,
    },
    stdio: "inherit",
  }),
];

function findOpenPort(startPort) {
  return new Promise((resolve, reject) => {
    function tryPort(port) {
      const server = net.createServer();

      server.once("error", (error) => {
        if (error.code === "EADDRINUSE") {
          tryPort(port + 1);
          return;
        }

        reject(error);
      });

      server.once("listening", () => {
        server.close(() => resolve(port));
      });

      server.listen(port);
    }

    tryPort(startPort);
  });
}

function stopAll() {
  for (const child of processes) {
    if (!child.killed) {
      child.kill();
    }
  }
}

for (const child of processes) {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      stopAll();
      process.exit(code);
    }
  });
}

process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopAll();
  process.exit(0);
});
