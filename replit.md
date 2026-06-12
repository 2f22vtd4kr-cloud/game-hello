# Топливный Узел — Матрица Снабжения

A premium Telegram bot + Telegram Mini App (TMA) fuel availability dashboard for Sevastopol/Crimea region. Features 236 seeded gas stations, real-time availability tracking, gamification, and a cyberpunk UI (#050507 bg, #a855f7 violet, #db2777 magenta). 100% Russian UI.

## Run & Operate

**TMA Backend (FastAPI)**
- `python -m tma_backend.main` — runs on port 8000
- SQLite DB auto-created at `tma_backend/tma.db`

**TMA Frontend (React + Vite)**
- `pnpm --filter @workspace/tma-frontend run dev` — runs on port 3001

**Telegram Bot**
- `python bot.py` — polling bot with voucher QR system

**API Server (Express, pre-existing)**
- `pnpm --filter @workspace/api-server run dev` — runs on port 8080

**Workspace commands**
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks/Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- **Bot**: python-telegram-bot 20.7, aiohttp, SQLite (vouchers.db)
- **TMA Backend**: FastAPI + Uvicorn, SQLAlchemy 2.x, APScheduler 3.x, SQLite (WAL mode)
- **TMA Frontend**: React 19, Vite 7, TypeScript, Zustand 5, Framer Motion, react-leaflet 4, recharts 2, qrcode
- **API Server**: Express 5, Drizzle ORM, PostgreSQL, Zod
- pnpm workspaces, Node.js 24, TypeScript 5.9

## Where things live

- `bot.py` — Telegram bot with voucher QR flow (old stack, SQLite `vouchers.db`)
- `tma_backend/` — FastAPI backend for TMA
  - `main.py` — all routes + APScheduler jobs
  - `models.py` — 6 SQLAlchemy models
  - `schemas.py` — Pydantic request/response schemas
  - `payment.py` — MockPaymentProvider (no external APIs)
  - `seed_stations.py` — deterministic 236-station seeder
  - `seed_regions.py` — 23 region definitions
  - `database.py` — WAL SQLite engine + session factory
- `artifacts/tma-frontend/src/`
  - `App.tsx` — root; map always mounted, other tabs unmount/remount
  - `components/` — MapTab, AnalyticsTab, CatalogTab, VaultTab, ReserveTab, BottomNav, StationCard, Toast, ErrorBoundary
  - `stores/` — useUserStore, useStationStore, useMapStore, useVaultStore, useGameStore (Zustand)
  - `api/client.ts` — all backend API calls (proxied via Vite to localhost:8000)
  - `types/index.ts` — shared TS types + XP tier constants

## Architecture decisions

- **Map never remounts**: MapTab receives a `visible` boolean and uses CSS `visibility` toggle. All other tabs use conditional rendering. This preserves map viewport state during tab switches.
- **TMA Backend on port 8000**: Replit only exposes ports from an allowlist; 5001 is not in the list. Default changed from 5001 → 8000 via `TMA_PORT` env var.
- **38% block mechanic**: `CatalogTab` calls `POST /api/catalog/purchase`; the backend uses `MockPaymentProvider` which randomly blocks ~38% of sessions with a realistic block message. UI shows a full-screen overlay.
- **Daily limits by zone_type**: `critical` zone gets 200 L/day АИ-92, `standard` 60 L, `eastern` 40 L per fuel type. Limits reset midnight via APScheduler.
- **Gamification**: Flip card game (3/day), tap game (30s), XP tiers (Новичок → Легенда Тавриды at 0/100/500/1500 XP).
- **No external payment API**: MockPaymentProvider simulates real payment flows including failures and receipts.

## Product

- **Map tab**: Leaflet dark-map with 236+ stations, color-coded by availability (green/yellow/red), marker clustering, region/status/fuel filters, per-station detail sheet with crowd-reporting buttons
- **Analytics tab**: Regional supply bar charts, 24h availability trend line, per-region stacked availability bars with % indicators
- **Catalog tab**: Station search, fuel selection with daily limit bars, volume selector (20/40/60 L), 38% block overlay
- **Vault tab**: Purchase history with active QR codes (generated client-side via `qrcode` npm), XP progress bar
- **Reserve tab**: Daily flip-card lottery, 30-second tapping game, XP tier display

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- TMA Backend default port changed to 8000 (was 5001, not in Replit allowlist). Override with `TMA_PORT` env var.
- `react-leaflet@4.2.1` has peer dep warnings with React 19 — these are cosmetic, app works correctly.
- `TMA_URL` in `bot.py` uses `REPLIT_DEV_DOMAIN` env var at runtime — will differ between dev and prod environments.
- Bot conflict error on restart is transient — old getUpdates session expires within seconds.
- APScheduler runs 4 background jobs: simulate availability shifts (every 8 min), remove expired reports (every 30 min), generate analytics snapshots (every 15 min), reset daily limits (daily at midnight).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- TMA frontend proxies `/api` and `/health` to `localhost:8000` via Vite's `server.proxy`
