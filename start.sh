#!/bin/bash
set -e

echo "Starting Telegram Bot..."
python bot.py &
BOT_PID=$!

echo "Starting TMA Backend..."
python -m tma_backend.main &
BACKEND_PID=$!

echo "All services started (bot=$BOT_PID, backend=$BACKEND_PID)"

wait $BOT_PID $BACKEND_PID
