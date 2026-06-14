#!/bin/bash
# Production entrypoint — bot runs in background, FastAPI is the foreground process.
# Do NOT use set -e: a bot crash must not kill the FastAPI server.

echo "[start.sh] Starting Telegram Bot in background..."
python bot.py &
BOT_PID=$!
echo "[start.sh] Bot PID=$BOT_PID"

echo "[start.sh] Starting TMA Backend on port ${TMA_PORT:-8080}..."
exec python -m tma_backend.main
