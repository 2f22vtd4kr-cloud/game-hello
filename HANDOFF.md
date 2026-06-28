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

## Session: 2026-06-28 — Premium Redesign Canvas Mockups (All 7 Screens)

### What we were building
Full premium redesign of all app screens on canvas for user approval before graduating to production. Design direction: deep dark #0A0A0F, "night drive in Mercedes" atmosphere, Apple minimalism, glassmorphism/Liquid Glass, dynamic per-network color accents, progressive disclosure.

### What was done this session
7 canvas mockup screens built in `artifacts/mockup-sandbox/src/components/mockups/redesign/` via parallel DESIGN subagents:

| File | Canvas Shape ID | Screen |
|------|-----------------|--------|
| `LoadingScreen.tsx` | `ds-loading` | Vertical stacked typography splash — "ПОХУЙ / ИНФЛЯЦИЯ / — / БЕРИ ТАЛОНЫ / И ЗАМОРАЖИВАЙ / ЦЕНЫ" with alternating cyan/purple highlight blocks behind each word. Stars particle bg. Animated progress bar at bottom. |
| `MapTab.tsx` | `ds-map` | Dark simulated map with glowing station markers (green/yellow/red). LIVE ticker strip. Search + filter chips. Glassmorphic bottom-sheet station modal (Lukoil #12 open state) — map blurs behind modal, fuel availability bars, crowd-report buttons, "Купить талон" CTA. |
| `CatalogTab.tsx` | `ds-catalog` | "Талоны на топливо" header + anti-inflation lock badge. Сетевые/Станционные tab switcher. 2-column network card grid (Lukoil/Rosneft/Gazprom/Bashneft with per-network color glows). Expanded Lukoil card with fuel chips, volume selector, mini market chart widget, purchase CTA. |
| `VaultTab.tsx` | `ds-vault` | XP/level badge, violet→cyan progress bar, summary stats row. 3 active vouchers (network-colored borders). Top voucher expanded with inline SVG QR code + "Предъявить на АЗС". Purchase history rows. |
| `VPNTab.tsx` | `ds-vpn` | Full-screen modal. Animated pulsing shield icon (green when active). Connection info + session timer. 3 feature chips. Pricing tiers (7/30/90 days in Telegram Stars). "Отключить VPN" ghost button. |
| `GamesTab.tsx` | `ds-games` | Sub-tabs: Империя/Мини-игры/Опыт. Resource bar (oil/fuel/coins/stars). 5×5 isometric CSS grid with buildings + ambient purple glow. Mini-game preview cards (flip/tap). Daily rewards scroll strip. |
| `AiNewsTab.tsx` | `ds-ai` | Sub-tabs: ИИ-Советник/Сводка. Bot profile header (CrisisBot, онлайн). Chat bubbles: bot welcome, user question, bot reply with action card, typing indicator. Quick-action chips. Frosted glass input bar. |

Shared CSS/animations in: `_group.css` (same folder — imported by components that need keyframes).

### Design system tokens applied to all screens
- Background: `#0A0A0F`; card surface: `rgba(255,255,255,0.04–0.07)` glassmorphism
- Accent: `#A855F7` violet, `#22D3EE` cyan
- Network glows: Lukoil `#EF4444`, Rosneft `#3B82F6`, Gazprom `#22D3EE`, Bashneft `#8B5CF6`, Tatneft `#22C55E`, NNK `#F59E0B`
- Font: Inter; mobile portrait 390×844; bottom nav 72px glassmorphic

### Where we stopped
All 7 canvas screens presented for user approval. Not yet graduated to production app.

### Next steps (once user approves screens)
1. Graduate each approved screen using `mockup-graduate` skill
2. Key preservation rules for graduation:
   - MapTab: keep Leaflet + react-leaflet, station clusters, real API data, crowd-report `POST /api/stations/{id}/report`
   - CatalogTab: keep `POST /api/catalog/purchase` + 38% MockPaymentProvider block mechanic + `LiveMarketWidget`
   - VaultTab: keep `qrcode` lib for QR generation, purchase history from `/api/vouchers/{user_id}`
   - AiNewsTab: keep `AI_PROVIDER` env var pattern + `CrisisBot` + news tab
   - LoadingScreen: mount on app init, unmount after initial API data loads (stations + user)
   - VPNTab, GamesTab: already exist as `VpnTab.tsx` / `GamesTab.tsx` in frontend — graduate replaces them

### Fixes done this session
- Fixed Tailwind CSS missing from TMA Frontend (installed `tailwindcss` + `@tailwindcss/vite`, added plugin to `vite.config.ts`, added `@import "tailwindcss"` to `index.css`)
- TMA Frontend moved from port 3001 → 5000 (Replit-exposed port)

---

## Session: 2026-06-28 — Map Tab Cobalt Starfield Redesign

### What we were building
Continued the premium redesign series. Focus: (1) migrate project back to Replit with all workflows running, (2) redesign the Map Tab mockup with a bold cobalt/starfield aesthetic inspired by a "Building the Future" poster reference — deep royal blue, orange accents, interactive station markers, glassmorphic modal, slide-up filter panel.

### What was done this session

#### 1. Replit migration restored — all 4 workflows running
- **TMA Backend** → `python -m tma_backend.main` on port 8000 ✓
- **TMA Frontend** → `pnpm --filter @workspace/tma-frontend run dev` on port **5000** (moved from 3001)
- **Telegram Bot** → `python bot.py` ✓
- **Mockup Sandbox** → `cd artifacts/mockup-sandbox && PORT=8099 BASE_PATH=/__mockup pnpm dev` on port 8099 ✓

#### 2. LoadingScreen graduated to production
`artifacts/tma-frontend/src/components/IntroSplash.tsx` — the vertical stacked-typography loading screen (ПОХ*Й / ИНФЛЯЦИЯ— / БЕРИ ТАЛОНЫ / И ЗАМОРАЖИВАЙ / ЦЕНЫ / colRise animation) was graduated from the mockup sandbox into the live app.

#### 3. Map Tab full redesign — Cobalt Starfield
`artifacts/mockup-sandbox/src/components/mockups/redesign/MapTab.tsx` — completely rewritten. Old: dark/black glassmorphic. New:

**Visual direction:**
- Background: deep cobalt gradient (`#0B0C4A → #060730`)
- 80 procedural star particles (SVG, `useMemo` for stable positions per render)
- Indigo road-grid SVG lines + faint district labels (СЕВЕРНАЯ / ЦЕНТР / КОРАБЕЛЬНАЯ / ГАГАРИНСКИЙ)
- Primary action colour: orange/coral **#E8622A** (was violet #A855F7) — CTAs, active filters, nav indicator, filter panel apply button
- Long-shadow typographic effect on station name + modal headers

**Interactivity (fully functional within the mockup, no backend):**
- `useState` for: `selectedId` (station modal), `filtersOpen` (filter panel), `activeFuel`, `activeSort`, `activeNet`
- **9 station markers** — each clickable; selected marker grows (18px core vs 11px), gains a glow ring, shows name label above; unselected markers have independent `markerPulse` animation
- **Filter fuel chips** (Все/АИ-92/АИ-95/ДТ/Газ) — filters visible markers in real-time
- **Station detail modal** — slides up (`slideUp` keyframe .35s cubic-bezier) from bottom; shows: name with long-shadow, address, network badge + rating + availability badge, per-fuel price bars with glow fills, crowd-report buttons (✅/⚠️/❌), orange "Купить талон ⛽" CTA; tap ✕ to close
- **Filter panel** — tap filter icon in search bar → frosted overlay + slide-up panel with Sort (4 options) + Network (7 options) + Apply button
- **Legend pill** — floats bottom-right, moves up when modal is open (`bottom` transition)

**Removed:** "Матрица Снабжения" text removed from both MapTab.tsx (header) and LoadingScreen.tsx (bottom caption) per user request.

### Canvas state at session end
| Shape ID | Component | Status |
|----------|-----------|--------|
| `ds-loading` | `LoadingScreen.tsx` | Graduated to production — mockup kept for reference |
| `ds-map` | `MapTab.tsx` | **Ready for graduation next session** |
| `ds-catalog` | `CatalogTab.tsx` | Dormant — from prev session, unchanged |
| `ds-vault` | `VaultTab.tsx` | Dormant — from prev session, unchanged |
| `ds-vpn` | `VPNTab.tsx` | Dormant — from prev session, unchanged |
| `ds-games` | `GamesTab.tsx` | Dormant — from prev session, unchanged |
| `ds-ai` | `AiNewsTab.tsx` | Dormant — from prev session, unchanged |

### Restoring canvas next session (ONE step)
```
// At session start: read + paste .agents/canvas-restore.js into code_execution
// Domain is AUTO-DETECTED via child_process — no manual substitution needed.
// Prerequisites: "TMA Frontend" (port 5000) + "Mockup Sandbox" (port 8099) workflows running.
// Result: 8 mockup iframes + 1 live catalog-phone-preview, focused on catalog preview.
```

### Next steps
1. Graduate `MapTab.tsx` cobalt starfield design into production `artifacts/tma-frontend/src/components/MapTab.tsx`
   - Keep Leaflet + react-leaflet for real map tiles
   - Apply cobalt background to the map tile layer (custom TileLayer style or CSS filter)
   - Port the glassmorphic modal (station info sheet) — wire to real API data + crowd-report `POST /api/stations/{id}/report`
   - Port the slide-up filter panel — wire to existing region/fuel/status filter state in `useMapStore`
   - Replace purple accent with orange `#E8622A` on CTAs
2. Iterate on remaining dormant screens (Catalog, Vault, etc.) or go straight to graduation

### Gotchas discovered this session
- TMA Frontend must run on port **5000** (Replit-exposed); 3001 was blocked in preview pane
- `presentArtifact` is permanently stale — always use `focusCanvasShapes({ shapeIds })` to focus existing canvas shapes
- Canvas shapes are ephemeral (lost on session end); `.agents/canvas-restore.js` re-creates all 7 in one `code_execution` call
- Mockup Sandbox port must be **8099** (8081 not in Replit's allowed workflow port list)

---

## Session: 2026-06-28 — Progressive Disclosure + Canvas Phone Preview

### What we were building
Applied Progressive Disclosure UX pattern to CatalogTab (collapsing 7 filter rows into a single filter bar + bottom sheet), fixed all underscore micro-labels across all tab components, fixed phone-width rendering in canvas iframe.

### What was done this session

#### 1. Underscore label cleanup (all components)
Removed all `СЛОВО_СЛОВО` underscore gray micro-labels across:
- `CatalogTab.tsx` — 10 labels fixed (СЕТЕВОЙ ТАЛОН, ЛУЧШИЕ ПРЕДЛОЖЕНИЯ, НЕДАВНИЕ ЗАПРОСЫ, etc.)
- `MapTab.tsx`, `FuelCalculatorModal.tsx`, `VpnModal.tsx`, `VaultTab.tsx`, `AnalyticsTab.tsx`, `StationCard.tsx`, `ReserveTab.tsx` — 31 more labels fixed
- Total: 41 underscore labels removed across 8 components

#### 2. CatalogTab stat pill fix
- `СРОК` stat pill: `"до мес."` → `"90 дней"` (was missed in previous session)

#### 3. CatalogTab Progressive Disclosure
`artifacts/tma-frontend/src/components/CatalogTab.tsx`:
- Replaced 7 rows of filter chips (Zone / Status / City / Network / Crisis heat / Clear-all / Fuel type) with a **single compact filter bar** (crisis dot + sort + ⚙ filter button)
- New `showFiltersSheet` state: tapping ⚙ opens a **bottom-sheet modal** (AnimatePresence spring slide-up) with all filter options inside; "Применить" button closes it and shows filtered station count
- Filter badge on the ⚙ button shows count of active filters
- New `showDeals` state: "ЛУЧШИЕ ПРЕДЛОЖЕНИЯ" section is now **collapsible** (tap header to expand/collapse with chevron animation)
- Added `activeFilterCount` computed variable (placed after `matchedFuelType` to avoid TDZ issue)
- New state vars: `showFiltersSheet`, `showDeals`

#### 4. Phone-width constraint (canvas/iframe fix)
`artifacts/tma-frontend/src/App.tsx`:
- Added `<style>{`body{max-width:430px;margin:0 auto;overflow-x:hidden}`}</style>` to root render
- Fixes desktop rendering when app is embedded in canvas phone-sized iframe

#### 5. Canvas phone preview
- Added `catalog-phone-preview` iframe shape (390×844) on canvas to the right of the full-size artifact
- Canvas focused on this shape for phone-size preview

### Where we stopped / what's next
1. **Graduate MapTab cobalt-starfield design** — still pending from previous session (ds-map canvas shape)
2. Remaining dormant screens: VaultTab, VPNTab, GamesTab, AiNewsTab

### Architecture decisions
- `activeFilterCount` must be declared AFTER `matchedFuelType` (line ~1009 in CatalogTab) — `matchedFuelType` is not a useState hook, it's computed from `debouncedQuery`, so ordering matters to avoid TDZ
- Phone-width clamp via `body` style tag in App.tsx root render (not index.html) so it reloads cleanly with HMR

### Gotchas discovered this session
- Canvas iframe renders desktop layout unless `body{max-width:430px}` is enforced — pure CSS fix, no proxy/wrapping needed
- Python sed replacement is safest for large block replacements (>50 lines) — use markers + `str.index()` not regex
- `activeFilterCount` using `cityFilter` etc. must come AFTER all useState declarations AND after `matchedFuelType` computed value

---

## Session: 2026-06-28 — VaultTab Cobalt Starfield Graduation + Top Ticker Removal

### What we were building
Removed the global top market-ticker bar (redundant with Analytics tab's own ticker), then graduated the VaultTab mockup into production with the cobalt starfield design system.

### What was done this session

#### 1. Top ticker bar removed
`artifacts/tma-frontend/src/App.tsx` — removed `<MarketTicker>` fixed strip + its import. The Analytics tab already has a live ticker; the global bar was duplicate.

#### 2. VaultTab cobalt starfield graduation
`artifacts/tma-frontend/src/components/VaultTab.tsx`:
- Added `useMemo` import
- 70 procedural star particles (SVG, `useMemo`, stable positions)
- Outer wrapper: `background: linear-gradient(160deg, #0B0C4A, #07083A, #060730)` — matches MapTab
- Ambient glow blobs (violet top-left, navy bottom-right) via `position: fixed`
- New header: large "Хранилище" `2rem` bold title with violet glow, XP badge (`XP_TIER_THRESHOLDS` wired), animated XP progress bar (framer-motion), SECURE badge
- Tier color: `#f59e0b` (≥5), `#E8622A` orange (≥3), `#A855F7` violet (default)
- All real data wiring preserved: `useVaultStore`, `useUserStore`, `fetchReferral`, `fetchAchievements`, `fetchUserSubscriptions`, `fetchCreditsBalance`, `fetchUserNotes`, QRModal, PurchaseCard, achievements, subscriptions, notes, favorites, credit history, CSV export

#### 3. Canvas updated
- `ds-vault` canvas frame → live production app
- `.agents/canvas-restore.js` updated: `ds-vault` marked `live: true`
- `ds-games` is now `🔵 NEXT`

### Canvas state at session end
| Shape ID | Component | Status |
|----------|-----------|--------|
| `ds-map` | `MapTab.tsx` | ✅ LIVE |
| `ds-loading` | `IntroSplash.tsx` | ✅ LIVE |
| `ds-vault` | `VaultTab.tsx` | ✅ LIVE — graduated this session |
| `ds-analytics` | `AnalyticsTab.tsx` | ✅ LIVE |
| `ds-catalog` | `CatalogTab.tsx` | ✅ LIVE |
| `ds-games` | `GamesTab.tsx` | 🔵 NEXT |
| `ds-vpn` | `VPNTab.tsx` | 🔵 dormant |
| `ds-ai` | `AiNewsTab.tsx` | 🔵 dormant |

### Next steps
1. Graduate `GamesTab` mockup — preserve `EmpireGame`, flip-card lottery, tap game, XP tier display
2. Remaining: VPNTab, AiNewsTab

### Gotchas discovered this session
- React hooks (`useMemo`) must be declared BEFORE any conditional early return (`if (!user) return`) — placing them after causes "hooks called conditionally" error
- Bot 409 Conflict errors in logs are transient (old polling session expiry) — expected behavior, not a bug

---

## Handoff Convention

Every session must append a new `## Session: YYYY-MM-DD — Title` block above this line before ending. Include:
1. What we were building (1–2 lines of context)
2. What was done (bullet list with file paths)
3. Where we stopped / what's next
4. Any new architecture decisions or gotchas discovered

This file lives at repo root and is committed each session so it survives across Replit imports.
