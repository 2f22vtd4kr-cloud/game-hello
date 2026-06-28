# Топливный Узел — Матрица Снабжения

A premium Telegram bot + Telegram Mini App (TMA) fuel availability dashboard for Sevastopol/Crimea region. Features 1295 seeded gas stations, real-time availability tracking, gamification, VPN access, and a **Cobalt Starfield** design system. 100% Russian UI.

---

## 🔁 SESSION HANDOFF (read this first every session)

**Last updated: 2026-06-28**

### Current deployment
- **Live app**: `https://game-hello--olpasicater.replit.app`
- **Deploy type**: Replit autoscale (free tier — only autoscale available)
- **Entry point**: `start.sh` → runs bot + FastAPI; FastAPI serves static React build from `artifacts/tma-frontend/dist/`
- **CryptoBot webhook**: `https://game-hello--olpasicater.replit.app/api/cryptobot-webhook`
- **PAYMENT_SIGNING_SECRET**: already set as a Replit secret — do not regenerate

### What was just completed (2026-06-28)
1. **VPN modal scroll fixed** — `VpnModal.tsx` had `overflow: "hidden"` overriding `overflowY: "auto"`, and `touchAction: "none"` killing all touch. Fixed to `touchAction: "pan-y"`, removed conflicting hidden overflow.
2. **Background color gap fixed** — `App.tsx` was calling `tg.setHeaderColor("#050507")` (old black). Changed to `#1318B0` (cobalt) so Telegram's native header matches the app seamlessly.
3. **Network logos upgraded** — Replaced blurry Google favicon fetches in `CatalogTab.tsx` `NetworkLogo` component with crisp inline SVG logos for all 6 networks: Лукойл (red + flame), Роснефть (navy + bar grid), Газпромнефть (blue + flame + G-DRIVE), Башнефть (purple + arch), Татнефть (green + arch), ННК (amber + ННК bold).
4. **Bot webhook mode** — `bot.py` detects `REPLIT_DEPLOYMENT` env var; in production runs `run_webhook()` on `127.0.0.1:8443`; FastAPI `/tg/webhook` proxies to it. Dev still uses polling.
5. **Full Cobalt Starfield design system** — all tabs migrated (see section below).

### Known open items / what to work on next
- The app is fully functional and deployed — no critical bugs known as of handoff
- Possible next features: push notifications for fuel level drops, route planning to nearest open station, loyalty points redemption history export
- VPN tab: consider adding a "copy key" button to the ActiveSessionBanner for the WireGuard config key

### Dev workflow reminder
1. Start all 4 workflows: **TMA Backend** (port 8000), **TMA Frontend** (port 5000), **Telegram Bot**, **Mockup Sandbox**
2. If backend port 8000 is stuck: `fuser -k 8000/tcp` then restart workflow
3. Frontend auto-proxies `/api` and `/health` to `localhost:8000` via Vite
4. To force a fresh station seed: delete `tma.db` at workspace root, restart backend

---

## ⚠️ CURRENT DESIGN SYSTEM — Cobalt Starfield

The old "cyberpunk" palette (`#050507` bg, `#a855f7` violet, `#db2777` magenta) was **fully replaced**. Do NOT use it. Reference image: `attached_assets/IMG_2581_1782645108290.jpeg` — "Building The Future" poster: royal cobalt blue bg, white star particles, coral-orange accent.

**Current palette:**
- Background: `linear-gradient(160deg, #1E22DC 0%, #181CC6 40%, #1318B0 75%, #1015A5 100%)` — vivid royal cobalt
- Telegram header/bg color (set via SDK): `#1318B0`
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

**Tabs on Cobalt Starfield:** MapTab ✅, VaultTab ✅, BottomNav ✅, MarketTicker ✅, IntroSplash ✅, AnalyticsTab ✅, CatalogTab ✅, GamesTab ✅, AiTab ✅, VpnModal ✅
**All tabs on Cobalt Starfield — none remaining.**

---

## Run & Operate

**TMA Backend (FastAPI)**
- `python -m tma_backend.main` — runs on port 8000
- PostgreSQL in production (DATABASE_URL secret set); SQLite at workspace root in dev

**TMA Frontend (React + Vite)**
- `pnpm --filter @workspace/tma-frontend run dev` — runs on port 5000

**Telegram Bot**
- `python bot.py` — webhook in production (REPLIT_DEPLOYMENT set), polling in dev

**API Server (Express, pre-existing)**
- `pnpm --filter @workspace/api-server run dev` — runs on port 8080

**Workspace commands**
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks/Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

---

## Stack

- **Bot**: python-telegram-bot 20.7, aiohttp, SQLite (vouchers.db)
- **TMA Backend**: FastAPI + Uvicorn, SQLAlchemy 2.x, APScheduler 3.x, SQLite (dev) / PostgreSQL (prod)
- **TMA Frontend**: React 19, Vite 7, TypeScript, Zustand 5, Framer Motion, react-leaflet 4, recharts 2, qrcode
- **API Server**: Express 5, Drizzle ORM, PostgreSQL, Zod
- pnpm workspaces, Node.js 24, TypeScript 5.9

---

## Where things live

- `bot.py` — Telegram bot; webhook (prod) / polling (dev); voucher QR flow
- `start.sh` — production entry point: starts bot + FastAPI
- `tma_backend/`
  - `main.py` — all routes + APScheduler jobs + `/tg/webhook` proxy
  - `models.py` — SQLAlchemy models
  - `schemas.py` — Pydantic request/response schemas
  - `payment.py` — MockPaymentProvider (no external APIs)
  - `seed_stations.py` — deterministic 236-station seeder
  - `seed_excel_stations.py` — 1222 real stations from Excel; threshold 600 guards re-seed
  - `seed_regions.py` — 23 region definitions
  - `database.py` — WAL SQLite / PostgreSQL engine + session factory
- `artifacts/tma-frontend/src/`
  - `App.tsx` — root; map always mounted; sets Telegram header/bg color to `#1318B0`
  - `components/` — MapTab, AnalyticsTab, CatalogTab, VaultTab, ReserveTab, BottomNav, VpnModal, StationCard, Toast, ErrorBoundary, GamesTab, AiTab, NewsTab
  - `stores/` — useUserStore, useStationStore, useMapStore, useVaultStore, useGameStore, usePriceStore (Zustand)
  - `api/client.ts` — all backend API calls (proxied via Vite to localhost:8000)
  - `types/index.ts` — shared TS types + XP tier constants + VPN_PLANS

---

## Architecture decisions

- **Map never remounts**: MapTab receives a `visible` boolean and uses CSS `visibility` toggle. All other tabs use conditional rendering. This preserves map viewport state during tab switches.
- **TMA Backend on port 8000**: Replit only exposes ports from an allowlist; 5001 is not in the list.
- **38% block mechanic**: `CatalogTab` calls `POST /api/catalog/purchase`; the backend uses `MockPaymentProvider` which randomly blocks ~38% of sessions with a realistic block message. UI shows a full-screen overlay.
- **Daily limits by zone_type**: `critical` zone gets 200 L/day АИ-92, `standard` 60 L, `eastern` 40 L per fuel type. Limits reset midnight via APScheduler.
- **Gamification**: Flip card game (3/day), tap game (30s), XP tiers (Новичок → Легенда Тавриды at 0/100/500/1500 XP).
- **No external payment API**: MockPaymentProvider simulates real payment flows including failures and receipts. Telegram Stars + CryptoBot wired in VPN tab (real invoices).
- **PostgreSQL in production**: When DATABASE_URL secret is set, backend uses PostgreSQL. tma.db stays 0 bytes. Raw SQL must use Python `datetime` objects not SQLite `date('now')`. Extra model columns added via `ALTER TABLE` in `_run_migrations()` at startup.
- **Bot webhook vs polling**: `REPLIT_DEPLOYMENT` env var is the toggle. Production `start.sh` must NOT unset it — causes both bot instances to poll and get 409 conflict.
- **Network logos**: All 6 network logos in `CatalogTab.tsx` are inline SVGs — no external image requests, crisp at any size.

---

## Product

- **Map tab**: Leaflet dark-map with 1295 stations, color-coded by availability (green/yellow/red), marker clustering, region/status/fuel filters, per-station detail sheet with crowd-reporting buttons
- **Analytics tab**: Regional supply bar charts, 24h availability trend line, per-region stacked availability bars with % indicators
- **Catalog tab**: Network selection (6 networks, inline SVG logos), fuel selection with daily limit bars, volume selector (20/40/60 L), Stars + CryptoBot payment, 38% block overlay
- **Vault tab**: Purchase history with active QR codes (generated client-side via `qrcode` npm), XP progress bar
- **Games tab**: Daily flip-card lottery, 30-second tapping game, Empire game, XP tier display
- **AI tab**: Fuel situation AI assistant (Gemini → Groq fallback → rule-based)
- **News tab**: Regional fuel news feed with severity badges
- **VPN tab**: Bottom-sheet modal, WireGuard session purchase via Stars or CryptoBot, active session countdown timer + config key display

---

## User preferences

- **No underscore labels in UI**: Never render `СЛОВО_СЛОВО` gray micro-labels (e.g. `МАТРИЦА_СНАБЖЕНИЯ`, `ДИНАМИКА_НАЛИЧИЯ`) above section headings — not in mockups, not in production. Section titles stand alone.
- **No "требуется реакция" or "КРИЗИС_ДЕФИЦИТА"**: Crisis banners show only a count + percentage, no underscore-cased category names.

---

## Gotchas

- TMA Backend default port is 8000 (not 5001 — not in Replit allowlist). Override with `TMA_PORT` env var.
- SQLite DB in dev is at workspace root: `/home/runner/workspace/tma.db` (NOT `tma_backend/tma.db`) — uvicorn CWD is workspace root.
- In production, DATABASE_URL is set → PostgreSQL is used → tma.db is 0 bytes (normal).
- `react-leaflet@4.2.1` has peer dep warnings with React 19 — cosmetic, app works correctly.
- `TMA_URL` in `bot.py` uses `REPLIT_DEV_DOMAIN` env var at runtime — differs between dev and prod.
- Bot conflict error (409) on restart is transient — old getUpdates session expires within seconds. If it persists, `fuser -k 8000/tcp`.
- APScheduler runs 4 background jobs: simulate availability shifts (every 8 min), remove expired reports (every 30 min), generate analytics snapshots (every 15 min), reset daily limits (daily at midnight).
- FastAPI literal routes must be declared BEFORE parameterized routes (e.g. `/api/empire/leaderboard` before `/api/empire/{user_id}`).
- VpnModal: do NOT add `overflow: "hidden"` to the scrollable sheet container — it overrides `overflowY: "auto"`. Use `touchAction: "pan-y"` not `"none"`.

---

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- TMA frontend proxies `/api` and `/health` to `localhost:8000` via Vite's `server.proxy`
- Memory index: `.agents/memory/MEMORY.md` — durable lessons + topic files
