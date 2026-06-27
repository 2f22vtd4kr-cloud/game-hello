# HANDOFF.md — Session Handoff Log

Read this file at the start of every new Replit session. Each session appends a new entry so the chain of context is never lost across imports.

---

## Session: 2026-06-27 — Anti-Inflation Widget Sprint

### What we were building
A "market price vs. your locked price" theme across the entire TMA app. The product angle: users buy fuel vouchers that lock today's price for 90 days, while the live WebSocket feed shows market prices rising. The UI should dramatize this gap to drive purchases.

### What was done this session

#### 1. Canvas mockups (mockup-sandbox)
Three design variants were built and placed on the canvas (y=2640 row, artifact `XegfDyZt7HqfW2Bb8Ghoy`):
- **A · InflationBanner** (`artifacts/mockup-sandbox/src/components/mockups/inflation/InflationBanner.tsx`) — full-width anti-inflation hero banner with animated price counter and CTA
- **B · SavingsCalculator** (`artifacts/mockup-sandbox/src/components/mockups/inflation/SavingsCalculator.tsx`) — interactive volume/fuel calculator showing projected 90-day savings
- **C · CatalogRedesign** (`artifacts/mockup-sandbox/src/components/mockups/inflation/CatalogRedesign.tsx`) — full CatalogTab redesign concept with integrated live price widget

#### 2. Voucher expiry extended to 90 days (backend)
In `tma_backend/main.py`, all voucher creation paths changed from 30-day to 90-day expiry:
- Station purchase endpoint (~line 1472)
- Network voucher creation (~line 1673)
- Crypto bot voucher (~line 1724)
- Stars payment flow (~line 1787)

#### 3. VaultTab expiry indicators updated
`artifacts/tma-frontend/src/components/VaultTab.tsx` — expiry colour thresholds now match 90-day scale:
- 🔴 red = ≤ 30 days remaining
- 🟡 yellow = 31–60 days remaining
- 🟢 green = > 60 days remaining

#### 4. CatalogTab anti-inflation redesign
`artifacts/tma-frontend/src/components/CatalogTab.tsx`:
- **Anti-inflation hero banner** added at top of network voucher section
- **90-day lock badge** ("ЗАМОРОЖЕНО НА 90 ДНЕЙ") added inside each `FuelItem` card, replacing the vague old disclaimer
- **"Заморожено на 90 дней"** row added in network voucher price summary card
- **Green badge** in `PaymentConfirmModal` reinforcing the 90-day lock
- Stats pill "СРОК" updated to "90 дней" (was "до мес.")

#### 5. LiveMarketWidget — the main feature of this session
New component `LiveMarketWidget` added directly inside `CatalogTab.tsx` (defined above `FuelItem`, around line 312).

**What it does:**
- Reads live prices from `usePriceStore` WebSocket feed (`/ws/prices`)
- Computes average market price across all regions for the selected fuel type
- Projects 4 price points forward: now → +1mo → +2mo → +3mo
- Monthly growth rate = `min(5%, 2.8% + current_premium * 0.15)` — adapts to how elevated the live market already is relative to `FUEL_PRICES` base
- Renders an SVG mini line chart: red rising market line vs. green dashed flat locked-price line, with red-tinted gap fill
- Shows savings callout: `+{N}₽ за {volume}л · 3мес` (updates live on every WS tick)
- Flashes red border when WebSocket delivers a price change ≥ 0.05 ₽/л

**Where it's rendered:**
1. **Inside every `FuelItem` card** (station voucher purchase) — `compact` mode, between the daily limit bar and volume buttons
2. **Inside the network voucher expanded panel** — full mode, between the fuel chip selector and the price comparison bar

### Where we stopped
The `LiveMarketWidget` was implemented and HMR-confirmed live. The user's next suggested feature (not yet started) was:
> Push-notification opt-in inside the widget — alert user when market price crosses a self-set threshold (e.g. "notify me when АИ-92 hits 75₽")

### Key files changed this session
| File | What changed |
|------|-------------|
| `tma_backend/main.py` | Voucher expiry: 30d → 90d (4 endpoints) |
| `artifacts/tma-frontend/src/components/CatalogTab.tsx` | LiveMarketWidget component + 2 usage insertions + anti-inflation banner + 90-day badge |
| `artifacts/tma-frontend/src/components/VaultTab.tsx` | Expiry thresholds updated for 90-day scale |
| `artifacts/mockup-sandbox/src/components/mockups/inflation/InflationBanner.tsx` | New mockup |
| `artifacts/mockup-sandbox/src/components/mockups/inflation/SavingsCalculator.tsx` | New mockup |
| `artifacts/mockup-sandbox/src/components/mockups/inflation/CatalogRedesign.tsx` | New mockup |

### Architecture reminders for next session
- **WebSocket prices**: `usePriceStore` at `artifacts/tma-frontend/src/stores/usePriceStore.ts` — `prices[region][fuelType]` → `{ effective, multiplier, is_crisis }`. `getPrice(region, fuelType)` helper. `connected` boolean.
- **FUEL_PRICES base**: hardcoded const at top of `CatalogTab.tsx` — `{ "АИ-92": 65, "АИ-95": 71, ... }`. Used as baseline for market premium calculation.
- **Port**: TMA Backend on 8000, TMA Frontend on 3001, mockup-sandbox on 8081.
- **DB**: SQLite at workspace root `/home/runner/workspace/tma.db` (uvicorn CWD = workspace root). In production (REPLIT_DEPLOYMENT set) → PostgreSQL via DATABASE_URL.
- **Bot**: polling in dev, webhook in production — do NOT unset `REPLIT_DEPLOYMENT` in start scripts.

---

## Session: 2026-06-27 — Price Alert Opt-In Inside LiveMarketWidget

### What we were building
A push-notification opt-in button inside the `LiveMarketWidget` so users can set a personal price threshold (e.g. "notify me when АИ-92 hits 75₽") and receive a Telegram message when the market crosses it.

### What was done this session

#### 1. New DB model — `MarketPriceAlert`
`tma_backend/models.py` — new SQLAlchemy model with fields: `user_id`, `telegram_chat_id`, `fuel_type`, `threshold_rub`, `direction` ("above"/"below"), `active`, `created_at`, `last_notified_at`. Unique constraint on `(user_id, fuel_type)` — one alert per fuel type per user.

#### 2. Pydantic schemas
`tma_backend/schemas.py` — added `MarketPriceAlertIn` (with direction validator) and `MarketPriceAlertOut`.

#### 3. Backend migration + endpoints
`tma_backend/main.py`:
- `_run_migrations()` — added `CREATE TABLE IF NOT EXISTS market_price_alerts` DDL (PostgreSQL-compatible)
- `POST /api/price-alerts` — upsert alert (resets cooldown on update)
- `GET /api/price-alerts/{user_id}` — list active alerts for user
- `DELETE /api/price-alerts/{alert_id}?user_id=` — delete alert

#### 4. Scheduler job `check_market_price_alerts`
`tma_backend/main.py` — runs every 10 min. Computes avg effective price per fuel type from `FuelPriceEvent` table, checks all active alerts, sends Telegram HTML message if threshold crossed. 6-hour cooldown per alert to avoid spam. Also fixed a pre-existing missing `finally: db.close()` in `detect_price_spikes`.

#### 5. Frontend API client
`artifacts/tma-frontend/src/api/client.ts` — added `setPriceAlert`, `fetchPriceAlerts`, `deletePriceAlert`, and `PriceAlertOut` interface.

#### 6. LiveMarketWidget UI update
`artifacts/tma-frontend/src/components/CatalogTab.tsx` — `LiveMarketWidget` now:
- Loads existing alert for its `fuelType` on mount via `fetchPriceAlerts`
- Shows a 🔕/🔔 bell button in the widget header (top-right)
- When active: button is amber with threshold shown (e.g. `≥75₽`); clicking it deletes the alert
- When inactive: clicking opens an inline panel below the chart with direction toggle (↑/↓) + number input + save button
- Toast notifications on set/delete

### Where we stopped
Feature is fully built and live. The bot's 409 Conflict errors in logs are transient (old polling session expiry) — not a bug.

### Key files changed this session
| File | What changed |
|------|-------------|
| `tma_backend/models.py` | Added `MarketPriceAlert` model |
| `tma_backend/schemas.py` | Added `MarketPriceAlertIn`, `MarketPriceAlertOut` |
| `tma_backend/main.py` | Migration DDL, 3 REST endpoints, `check_market_price_alerts` scheduler job (every 10 min), fixed `detect_price_spikes` missing `finally: db.close()` |
| `artifacts/tma-frontend/src/api/client.ts` | Added `setPriceAlert`, `fetchPriceAlerts`, `deletePriceAlert`, `PriceAlertOut` |
| `artifacts/tma-frontend/src/components/CatalogTab.tsx` | Updated `LiveMarketWidget` with bell opt-in button + inline form |

### Architecture reminders for next session
- Alert table: one row per `(user_id, fuel_type)` — upsert on save, 6h cooldown on notify
- `telegram_chat_id` = `user.id` for TMA users (Telegram DM chat ID = user ID)
- Alert check runs every 10 min via APScheduler; uses `FuelPriceEvent` for current prices
- `direction: "above"` = notify when `current >= threshold`; `"below"` = notify when `current <= threshold`

---

## Handoff Convention

Every session must append a new `## Session: YYYY-MM-DD — Title` block above this line before ending. Include:
1. What we were building (1–2 lines of context)
2. What was done (bullet list with file paths)
3. Where we stopped / what's next
4. Any new architecture decisions or gotchas discovered

This file lives at repo root and is committed each session so it survives across Replit imports.
