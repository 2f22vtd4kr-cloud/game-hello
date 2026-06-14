#!/bin/bash
# Do NOT use 'set -e' — bot failure must not kill FastAPI in production

echo "=== TMA Production Start (Autoscale) ==="

# Clean old processes if any stale ones exist
pkill -f "python bot.py" 2>/dev/null || true
pkill -f "tma_backend.main" 2>/dev/null || true
sleep 1

# Bot in background — force polling (safer on Replit)
echo "Starting Telegram Bot (polling)..."
unset REPLIT_DEPLOYMENT
python bot.py &
BOT_PID=$!

echo "Starting FastAPI Backend (serves React frontend) on port ${TMA_PORT:-8080}..."
exec python -m tma_backend.main
