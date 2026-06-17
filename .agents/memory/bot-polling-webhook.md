---
name: Bot polling vs webhook conflict
description: Production bot must use webhook mode to avoid 409 conflicts with dev bot polling the same token.
---

## Rule
`start.sh` must NOT contain `unset REPLIT_DEPLOYMENT`. Keeping `REPLIT_DEPLOYMENT` set in production lets `bot.py` detect it is running in production and use webhook mode on `localhost:8443`, with FastAPI proxying `/tg/webhook` → `localhost:8443`.

**Why:** If `REPLIT_DEPLOYMENT` is unset in start.sh, the production bot runs in polling mode. If any dev instance also has the token set, both bots poll the same token simultaneously → Telegram returns 409 Conflict → dev bot gives up after 10 retries, disrupting development.

**How to apply:**
- In production (`REPLIT_DEPLOYMENT` is set): bot uses `app.run_webhook(listen="0.0.0.0", port=8443, ...)`. FastAPI has `/tg/webhook` POST route that proxies to `http://127.0.0.1:8443/tg/webhook`.
- In dev (`REPLIT_DEPLOYMENT` not set): bot uses `asyncio.run(_run_bot_polling(app))`.
- `TMA_URL` in bot.py reads from `TMA_URL` env var, defaulting to the current production domain `https://fuel-tickets-ru--velychkodoro.replit.app`.
- VPN plan IDs: `"sprint"` (5 min), `"vzlet"` (15 min), `"session"` (30 min), `"bezlimit"` (60 min). "month"/"week" are NOT valid plan IDs.
