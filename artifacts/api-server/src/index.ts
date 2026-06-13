/**
 * Production launcher.
 *
 * Replit artifact-mode always runs this file with PORT env var set to 8080.
 * We forward that PORT to the TMA FastAPI backend via TMA_PORT, spawn the
 * Telegram bot as a side-process, then keep this Node process alive so the
 * artifact runner doesn't restart everything.
 */
import { spawn, type ChildProcess } from "child_process";
import { logger } from "./lib/logger";

const PORT = process.env["PORT"] ?? "8080";

function spawnProcess(
  cmd: string,
  args: string[],
  env: Record<string, string> = {},
  label: string,
): ChildProcess {
  const child = spawn(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  child.on("error", (err) => {
    logger.error({ err, label }, `${label} failed to start`);
  });
  child.on("exit", (code, signal) => {
    logger.warn({ code, signal, label }, `${label} exited — restarting in 3s`);
    setTimeout(() => spawnProcess(cmd, args, env, label), 3000);
  });
  logger.info({ label, pid: child.pid }, `${label} started`);
  return child;
}

logger.info({ PORT }, "Топливный Узел launcher starting");

// TMA FastAPI backend — serves both the API and the built React frontend
spawnProcess(
  "python",
  ["-m", "tma_backend.main"],
  { TMA_PORT: PORT },
  "TMA Backend",
);

// Telegram bot — fire-and-forget side process
spawnProcess("python", ["bot.py"], {}, "Telegram Bot");

// Keep the Node.js process alive so the artifact runner doesn't kill everything
setInterval(() => {}, 1 << 30);
