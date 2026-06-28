---
name: Cobalt Starfield Design System
description: Complete handoff — color palette, implementation patterns, what's done, what's next, and common traps. Read this before touching any frontend file.
---

# Cobalt Starfield Design System — Handoff

## Why the palette changed

The old palette was "cyberpunk": near-black `#050507` background, `#a855f7` violet, `#db2777` magenta/rose as accent.
The owner provided a new reference: **IMG_2581** — the "Building The Future" site.
That site is **vivid royal cobalt blue background + small white star dots + white text + coral-orange accent**.

The old palette had rose/magenta (`#db2777`, `#f472b6`) leaking into every button, badge, and separator.
The owner explicitly rejected this: "What the fuck do those rose colors have to do with the design reference."

## The approved color system (as of 2026-06-28)

| Role | Value | Notes |
|------|-------|-------|
| Page background | `linear-gradient(160deg, #1E22DC 0%, #181CC6 40%, #1318B0 75%, #1015A5 100%)` | Vivid royal cobalt |
| Glass panel bg | `rgba(14–24, 18–28, 158–198, 0.72–0.97)` | Cobalt-tinted glass |
| **Active/selected state** | `rgba(255,255,255,0.15)` bg + `rgba(255,255,255,0.32)` border + `#ffffff` text | **WHITE, not purple** |
| Inactive state | `rgba(14,18,158,0.75)` bg + `rgba(255,255,255,0.07)` border + `#9ca3af` text | Dim cobalt glass |
| Data: available/ok | `#22c55e` or `#6ee7b7` (mint in ticker) | Green family |
| Data: warning/stress | `#fbbf24` amber | |
| Data: critical/crisis | `#ff6b6b` coral-red | NOT `#ef4444`, NOT `#db2777` rose |
| Separator dots | `rgba(255,255,255,0.14)` · | Tiny white mid-dots |
| Map cluster markers | `radial-gradient(circle at 38% 32%, #8b5cf6, #5b21b6)` | Purple sphere, matches reference IMG_2601 |
| Station markers | `#22c55e` / `#FFD600` / `#FF1744` | Availability data |

### What is BANNED

- `#db2777` — rose magenta. Gone. Zero uses in UI chrome.
- `#f472b6` — rose pink. Gone.
- `#a855f7` — old violet. **Only allowed** on map cluster markers if absolutely needed; never in UI chrome (buttons, badges, separators, borders).
- Any `linear-gradient(135deg, #a855f7, #db2777)` as a CTA button. The old cyberpunk CTA. Gone.

### What is still OK for DATA indicators (not chrome)
- `#22c55e` green for availability status
- `#ef4444` / `#FF1744` red for crisis
- `#FFD600` / `#fbbf24` amber for warnings
- Purple sphere gradient for map cluster count badges (matches the reference map image IMG_2601 which showed purple clusters)

---

## What was implemented this session (2026-06-28)

### 1. MapTab — cobalt tiles via CSS filter
**File:** `artifacts/tma-frontend/src/components/MapTab.tsx`
**Key line in `AMBIENT_CSS`:**
```css
.leaflet-tile-pane {
  filter: sepia(100%) hue-rotate(200deg) saturate(7) brightness(0.82);
}
```
**Why sepia first:** CartoDB dark tiles are near-zero saturation grayscale. `hue-rotate` alone does nothing on gray pixels (no chroma to rotate). `sepia(100%)` adds warm orange-brown chroma first, then `hue-rotate(200deg)` shifts it from warm → blue. `saturate(7)` punches it vivid. `brightness(0.82)` keeps it dark and readable.

### 2. MapTab — cobalt container + starfield overlay
- Container: `linear-gradient(160deg, #1E22DC → #1015A5)`
- `MapStarField` SVG component: 100 deterministic white stars via LCG RNG seeded at `0xC0BA1750`, each with `--op` CSS var for `mapStarTwinkle` keyframe
- **Critical placement:** `<MapStarField />` must be AFTER `</MapContainer>` with `zIndex:500, pointerEvents:none`. If placed before MapContainer it renders BEHIND the Leaflet layer and is invisible.

### 3. MapTab — all chrome colors purged of rose/purple
Every UI widget now uses the white active-state system:
- Filter buttons: `rgba(255,255,255,0.15)` bg when active
- Filter active border: `rgba(255,255,255,0.32)`
- Active text: `#ffffff`
- The "Все" status button (previously `#a855f7`): now `#ffffff`
- Cluster markers: purple sphere (kept, matches reference)
- No `#db2777` anywhere

### 4. MarketTicker — full cobalt redesign
**File:** `artifacts/tma-frontend/src/components/MarketTicker.tsx`
- Background: `linear-gradient(90deg, rgba(14,18,175,0.99) → rgba(22,27,210,0.99))`
- Crisis state: left side bleeds to near-black, keeps cobalt on right
- LIVE dot: `#6ee7b7` mint-green with glow animation
- LIVE text: `#ffffff`
- Separator between items: `rgba(255,255,255,0.14) ·` (single dot)
- Price ticker colors: crisis=`#ff6b6b`, stress=`#fbbf24`, drop=`#6ee7b7`, normal=`rgba(255,255,255,0.55)`
- Fades: left/right gradient in cobalt color so scroll looks seamless
- Old rose/purple `◆` separator at `rgba(168,85,247,0.25)` — REMOVED

### 5. BottomNav — analytics tab restored + cobalt redesign
**File:** `artifacts/tma-frontend/src/components/BottomNav.tsx`

**THE BUG THAT WAS FIXED:** The `TABS` array previously only had 5 tabs: map, catalog, ai, games, news. The analytics tab had been silently removed at some point. The owner was furious about this.

Current TABS order: `map | analytics | catalog | ai | games`
(News was dropped from nav; that's intentional — nav has 5 slots, news was deprioritized)

Design: cobalt glass pill (`linear-gradient(rgba(22,27,210,0.97) → rgba(14,18,175,0.97))`), `borderRadius:22px`, twinkling white `NavStars` SVG overlay, active tab shows white glass pill highlight with `layoutId="nav-pill"` Framer Motion animation, active icon = `#ffffff` with drop-shadow glow.

### 6. AnalyticsTab wired into routing
**File:** `artifacts/tma-frontend/src/App.tsx`
- Import: `import { AnalyticsTab } from "@/components/AnalyticsTab";`
- Added to `tabOrder`: `["map", "analytics", "catalog", "ai", "games", "news"]`
- Render: `{activeTab === "analytics" && <AnalyticsTab />}`
- `AnalyticsTab` accepts `onNavigate?: (tab: TabId) => void` (optional — safe to render without it)

### 7. URL-based tab routing added
`App.tsx` now reads `?tab=<tabId>` from the URL on mount and navigates to it.
Useful for canvas iframes, deep links, debug URLs:
- `/?tab=analytics` → opens analytics
- `/?tab=catalog` → opens catalog
- etc.

### 8. TabId type updated
`artifacts/tma-frontend/src/types/index.ts`:
```ts
export type TabId = "map" | "analytics" | "catalog" | "ai" | "games" | "news";
```

---

## Graduation status (updated 2026-06-28)

### ✅ Already graduated to cobalt starfield
- **MapTab** — cobalt tiles (CSS filter) + starfield + white chrome, orange CTAs
- **VaultTab** — cobalt gradient bg + 70 starfield particles + violet glow header
- **BottomNav** — cobalt glass pill + NavStars + white active states
- **MarketTicker** — cobalt strip, mint LIVE dot, no rose
- **IntroSplash (LoadingScreen)** — vertical stacked typography splash
- **AnalyticsTab** — graduated to cobalt
- **CatalogTab** — graduated to cobalt

### ✅ AiTab — graduated to cobalt (2026-06-28)
- Cobalt gradient bg + 88-star deterministic starfield (`twinkle` keyframe)
- Bot avatar: `linear-gradient(135deg, #2228e8, #E8622A)` cobalt-to-coral
- Bot bubbles: cobalt glass `rgba(16,20,165,0.72)` + white border
- User bubbles: coral-orange gradient `#E8622A → #c94f1e`
- Send button: `#E8622A` coral-orange
- Chips: white active-state `rgba(255,255,255,0.15)` + `rgba(255,255,255,0.32)` border
- Thinking dots: coral-orange
- VPN pill: white active-state chrome

### ✅ GamesTab / GamesPage — graduated to cobalt (prior session)
- Cobalt gradient bg + 60-star deterministic starfield (`gt` keyframe)
- White active-state sub-tab switcher (empire / minigames / xp)
- All old violet/magenta palette removed

### Pattern to apply to each tab

Each tab needs:
1. Root container: `background: "linear-gradient(160deg, #1E22DC 0%, #181CC6 40%, #1318B0 75%, #1015A5 100%)"`, `position:"relative"`, `minHeight:"100vh"`
2. A `<StarField />` SVG component (copy pattern from MapTab `MapStarField`) placed with `position:absolute, inset:0, zIndex:0, pointerEvents:none, opacity:0.35`
3. All content wrapped in a div with `position:relative, zIndex:1`
4. Card/panel backgrounds: `rgba(255,255,255,0.05–0.08)` glass + `rgba(255,255,255,0.08–0.12)` border
5. Active states: white glass (see table above) — never purple or rose
6. A `<style>` tag at root with `starTwinkle` keyframe (unique name per file to avoid collision)

### Keyframe naming convention — CRITICAL
Each file must prefix its keyframes to avoid CSS collision (since React injects style tags globally):
- MapTab: `mapStarTwinkle`, `ambientFlow`, `ambientPulse`
- AnalyticsTab: `starTwinkle`, `ambientFlow`, `ambientPulse` (these collide — rename if both pages are mounted simultaneously, but currently they don't mount together)
- CatalogTab: `ctStarTwinkle`, `ctAmbientFlow`, `ctAmbientPulse`, `ctScanPulse`
- Next tabs: use `gm` (games), `ai`, `vt` (vault) prefixes

---

## Common traps and gotchas

1. **Tile CSS filter requires `sepia()` first.** `hue-rotate` + `saturate` alone does nothing on grayscale images. Always: `sepia(100%) hue-rotate(200deg) saturate(7) brightness(0.82)`.

2. **StarField must be AFTER MapContainer.** Leaflet maps paint at high z-index internally. Any element placed before MapContainer in JSX renders behind the map layer. Pattern: `</MapContainer>` → `<div style={{ position:"absolute", inset:0, zIndex:500, pointerEvents:"none", opacity:0.38 }}><MapStarField /></div>`.

3. **TabId type must include "analytics"** — it was missing when the owner first raised the issue. If you add any new tab, update `src/types/index.ts` first.

4. **AnalyticsTab `onNavigate` prop is optional** — you can render `<AnalyticsTab />` with no props. Safe.

5. **`?tab=` URL routing is additive** — it fires only on mount, doesn't conflict with Telegram deep links. If both Telegram `start_param` and `?tab=` are present, the Telegram link wins because it's processed first and overrides.

6. **No rose in chrome, ever.** If you see `#db2777`, `#f472b6`, or a gradient `#a855f7 → #db2777` in a button/badge/border, replace it with white active states. These are not artistic choices — they were explicitly banned by the owner.

7. **The `ds-analytics` canvas iframe** — the canvas shape labeled "Аналитика ✅ LIVE — cobalt starfield" points to `artifacts/tma-frontend/src/components/AnalyticsTab.tsx`. To see it in the live app, use `/?tab=analytics` in the preview URL.
