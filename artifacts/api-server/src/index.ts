/**
 * Production entry point.
 *
 * Replit artifact-mode always runs this file (artifacts/api-server/dist/index.mjs)
 * on PORT=8080. This file:
 *   1. Binds port 8080 immediately (so health checks pass)
 *   2. Serves the built React SPA from tma-frontend/dist/ directly
 *   3. Proxies /api/* and /ws/* to FastAPI (port 8000)
 *   4. Spawns FastAPI + Telegram bot as child processes
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { logger } from "./lib/logger";

// Paths resolved relative to this built file: artifacts/api-server/dist/index.mjs
// dist/ → api-server/ → artifacts/ → workspace/
const WORKSPACE = path.resolve(import.meta.dirname, "..", "..", "..");
const FRONTEND_DIST = path.join(WORKSPACE, "artifacts", "tma-frontend", "dist");
const FASTAPI_PORT = 8000;
const PORT = parseInt(process.env["PORT"] ?? "8080", 10);

logger.info({ PORT, WORKSPACE, FRONTEND_DIST }, "Launcher starting");

// ── MIME types for static files ──────────────────────────────────────────────
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript",
  ".mjs":  "application/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".png":  "image/png",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".map":  "application/json",
};

function serveStatic(urlPath: string, res: http.ServerResponse): boolean {
  // Resolve file path safely
  const rel = urlPath === "/" ? "/index.html" : urlPath;
  const abs = path.join(FRONTEND_DIST, rel);
  // Security: stay within FRONTEND_DIST
  if (!abs.startsWith(FRONTEND_DIST)) return false;

  try {
    const stat = fs.statSync(abs);
    if (!stat.isFile()) throw new Error("not a file");
    const ext = path.extname(abs).toLowerCase();
    const mime = MIME[ext] ?? "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": mime,
      "Cache-Control": ext === ".html" ? "no-cache" : "max-age=31536000,immutable",
    });
    fs.createReadStream(abs).pipe(res, { end: true });
    return true;
  } catch {
    // Fall through — try serving index.html for SPA routes
    try {
      const index = path.join(FRONTEND_DIST, "index.html");
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      });
      fs.createReadStream(index).pipe(res, { end: true });
      return true;
    } catch {
      return false;
    }
  }
}

// ── Reverse proxy to FastAPI ──────────────────────────────────────────────────
function proxyToFastAPI(req: http.IncomingMessage, res: http.ServerResponse): void {
  const options: http.RequestOptions = {
    hostname: "127.0.0.1",
    port: FASTAPI_PORT,
    path: req.url ?? "/",
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${FASTAPI_PORT}` },
  };
  const upstream = http.request(options, (upRes) => {
    res.writeHead(upRes.statusCode ?? 200, upRes.headers);
    upRes.pipe(res, { end: true });
  });
  upstream.on("error", () => {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "starting" }));
  });
  req.pipe(upstream, { end: true });
}

// ── Request router ────────────────────────────────────────────────────────────
function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = req.url ?? "/";

  // Health checks — always 200
  if (url === "/api/healthz" || url === "/webhook" || url === "/api" || url === "/api/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // API and WebSocket upgrade paths → proxy to FastAPI
  if (url.startsWith("/api/") || url.startsWith("/health")) {
    proxyToFastAPI(req, res);
    return;
  }

  // Static files → serve directly from dist
  if (!serveStatic(url, res)) {
    res.writeHead(404);
    res.end("Not found");
  }
}

// ── WebSocket proxy ───────────────────────────────────────────────────────────
function handleUpgrade(
  req: http.IncomingMessage,
  socket: import("node:net").Socket,
  head: Buffer,
): void {
  const net = require("node:net") as typeof import("node:net");
  const upstream = net.createConnection(FASTAPI_PORT, "127.0.0.1", () => {
    const reqLine = `${req.method ?? "GET"} ${req.url ?? "/"} HTTP/1.1\r\n`;
    const hdrs = Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join("\r\n") + "\r\n\r\n";
    upstream.write(reqLine + hdrs);
    if (head.length) upstream.write(head);
    upstream.pipe(socket, { end: true });
    socket.pipe(upstream, { end: true });
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
}

// ── Process spawner ───────────────────────────────────────────────────────────
function spawnProc(cmd: string, args: string[], env: Record<string, string>, label: string): ChildProcess {
  const child = spawn(cmd, args, { stdio: "inherit", env: { ...process.env, ...env }, cwd: WORKSPACE });
  child.on("error", (err) => logger.error({ err, label }, `${label} spawn error`));
  child.on("exit", (code, signal) => {
    logger.warn({ code, signal, label }, `${label} exited — restarting in 5s`);
    setTimeout(() => spawnProc(cmd, args, env, label), 5000);
  });
  logger.info({ pid: child.pid, label }, `${label} started`);
  return child;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const server = http.createServer(handleRequest);
server.on("upgrade", handleUpgrade);

const hasDist = fs.existsSync(path.join(FRONTEND_DIST, "index.html"));
logger.info({ hasDist, FRONTEND_DIST }, "Frontend dist status");

server.listen(PORT, "0.0.0.0", () => {
  logger.info({ PORT }, "Server listening");

  // In development, TMA Backend and Telegram Bot run as separate Replit workflows.
  // Only spawn child processes in production to avoid conflicts.
  if (process.env["NODE_ENV"] === "production") {
    // FastAPI on port 8000 — serves /api/* routes
    spawnProc("python", ["-m", "tma_backend.main"], { TMA_PORT: String(FASTAPI_PORT) }, "TMA Backend");

    // Telegram bot
    spawnProc("python", ["bot.py"], {}, "Telegram Bot");
  } else {
    logger.info("Development mode — TMA Backend and Telegram Bot managed by Replit workflows");
  }
});
