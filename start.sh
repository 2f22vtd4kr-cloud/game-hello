#!/bin/bash
set -e

echo "Starting Telegram Bot..."
python bot.py &
BOT_PID=$!

echo "Starting TMA Backend on port ${TMA_PORT:-8000}..."
exec python -m tma_backend.main
