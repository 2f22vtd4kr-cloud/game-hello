# Топливный Узел — Матрица Снабжения

A premium Telegram bot + Telegram Mini App (TMA) fuel availability dashboard for Sevastopol/Crimea region. Features 1000+ seeded gas stations (1295 total), real-time availability tracking, gamification, and a **Cobalt Starfield** design system. 100% Russian UI.

## ⚠️ CURRENT DESIGN SYSTEM — Cobalt Starfield (as of 2026-06-28)

The old "cyberpunk" palette (#050507 bg, #a855f7 violet, #db2777 magenta) was **fully replaced**. Do NOT use it. The reference image is `attached_assets/IMG_2581_1782645108290.jpeg` — "Building The Future" poster: royal cobalt blue bg, white star particles, coral-orange accent.

**Current palette:**
- Background: `linear-gradient(160deg, #1E22DC 0%, #181CC6 40%, #1318B0 75%, #1015A5 100%)` — vivid royal cobalt
- CTA / active accent: `#E8622A` coral-orange
- Active state chrome: `rgba(255,255,255,0.15)` bg + `rgba(255,255,255,0.32)` border + `#ffffff` text — **WHITE, not purple**
- Glass panels: `rgba(14–24, 18–28, 158–198, 0.72–0.97)` cobalt-tinted
- Data ok: `#22c55e` green; warning: `#fbbf24` amber; crisis: `#ff6b6b` coral-red
- Stars: 80–100 deterministic SVG white dots with twinkle keyframe

**BANNED colors (zero tolerance in UI chrome):**
- `#db2777` rose magenta — gone
- `#f472b6` rose pink — gone
- `#a855f7` violet — only allowed on map cluster markers; never in buttons/badges/borders/separators
- `linear-gradient(135deg, #a855f7, #db2777)` CTA gradient — gone

**Tabs graduated to cobalt:** MapTab ✅, VaultTab ✅, BottomNav ✅, MarketTicker ✅, IntroSplash ✅, AnalyticsTab ✅, CatalogTab ✅, GamesTab ✅, AiTab ✅
**All tabs on Cobalt Starfield — none remaining.**

## Run & Operate

**TMA Backend (FastAPI)**
- `python -m tma_backend.main` — runs on port 8000
- SQLite DB auto-created at `tma_backend/tma.db`

**TMA Frontend (React + Vite)**
- `pnpm --filter @workspace/tma-frontend run dev` — runs on port 5000

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

- **No underscore labels in UI**: Never render `СЛОВО_СЛОВО` gray micro-labels (e.g. `МАТРИЦА_СНАБЖЕНИЯ`, `ДИНАМИКА_НАЛИЧИЯ`) above section headings — not in mockups, not in production. Section titles stand alone.
- **No "требуется реакция" or "КРИЗИС_ДЕФИЦИТА"**: Crisis banners show only a count + percentage, no underscore-cased category names.

## Gotchas

- TMA Backend default port changed to 8000 (was 5001, not in Replit allowlist). Override with `TMA_PORT` env var.
- SQLite DB is created at workspace root: `/home/runner/workspace/tma.db` (NOT `tma_backend/tma.db`) — uvicorn CWD is workspace root.
- `react-leaflet@4.2.1` has peer dep warnings with React 19 — these are cosmetic, app works correctly.
- `TMA_URL` in `bot.py` uses `REPLIT_DEV_DOMAIN` env var at runtime — will differ between dev and prod environments.
- Bot conflict error on restart is transient — old getUpdates session expires within seconds.
- APScheduler runs 4 background jobs: simulate availability shifts (every 8 min), remove expired reports (every 30 min), generate analytics snapshots (every 15 min), reset daily limits (daily at midnight).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- TMA frontend proxies `/api` and `/health` to `localhost:8000` via Vite's `server.proxy`
