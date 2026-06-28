#!/bin/bash
# Do NOT use 'set -e' — bot failure must not kill FastAPI in production

echo "=== TMA Production Start (VM) ==="

# Clean old processes if any stale ones exist
pkill -f "python bot.py" 2>/dev/null || true
pkill -f "tma_backend.main" 2>/dev/null || true
sleep 1

# Bot in background.
# In production (REPLIT_DEPLOYMENT is set) the bot uses webhook mode on
# localhost:8443 and FastAPI proxies /tg/webhook → it.
# In dev (REPLIT_DEPLOYMENT not set) it falls back to polling.
echo "Starting Telegram Bot..."
python bot.py &
BOT_PID=$!

# Force port 5000 — Replit's deployment proxy expects this port
# (matches the localPort=5000 -> externalPort=80 mapping in .replit)
export TMA_PORT=5000

echo "Starting FastAPI Backend (serves React frontend) on port ${TMA_PORT}..."
exec python -m tma_backend.main
