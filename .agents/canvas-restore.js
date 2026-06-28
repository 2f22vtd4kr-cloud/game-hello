/**
 * CANVAS RESTORATION SCRIPT — Zero-friction cold start
 *
 * USAGE (paste entire file into a single code_execution call):
 *   1. Make sure "TMA Frontend" workflow is running (port 5000)
 *   2. Make sure "Mockup Sandbox" workflow is running (port 8099)
 *   3. Paste this entire file into code_execution → Done
 *
 * No manual domain substitution needed — domain is auto-detected.
 */

const { execSync } = await import('child_process');
const DOMAIN  = execSync('echo $REPLIT_DOMAINS').toString().trim().split(',')[0];
const APP_URL = `https://${DOMAIN}`;                           // TMA Frontend (port 5000) — cobalt starfield IS production
const BASE    = `https://${DOMAIN}:8099/__mockup/preview/redesign`; // Mockup Sandbox (port 8099)

console.log("Domain:", DOMAIN);

const W = 390, H = 844;
const GAP_X = 50, GAP_Y = 100;
const ORIGIN_X = 500, ORIGIN_Y = 118;

// ── GRADUATION STATUS ──────────────────────────────────────────────────────────
//   ds-map       ✅ LIVE — MapTab.tsx       (cobalt starfield in production)
//   ds-loading   ✅ LIVE — IntroSplash.tsx  (graduated)
//   ds-analytics ✅ LIVE — AnalyticsTab.tsx (cobalt starfield in production)
//   ds-catalog   ✅ LIVE — CatalogTab.tsx   (cobalt starfield in production)
//   ds-vault     ✅ LIVE — VaultTab.tsx     (cobalt starfield, stars, orange XP)
//   ds-games     🔵 NEXT — GamesTab.tsx
//   ds-vpn       🔵 dormant
//   ds-ai        🔵 dormant
//
// Graduated tabs (✅) show the LIVE production app (port 5000).
// Dormant tabs  (🔵) show the mockup sandbox (port 8099).

const FRAMES = [
  // row 0
  { id: "ds-map",       col: 0, row: 0, live: true,  file: "MapTab",        name: "Карта ✅ LIVE — cobalt starfield",           path: "artifacts/tma-frontend/src/components/MapTab.tsx" },
  { id: "ds-loading",   col: 1, row: 0, live: false, file: "LoadingScreen", name: "Загрузка ✅ Graduated — Loading Screen",      path: "artifacts/tma-frontend/src/components/IntroSplash.tsx" },
  { id: "ds-vault",     col: 2, row: 0, live: true,  file: "VaultTab",      name: "Хранилище ✅ LIVE — cobalt starfield",        path: "artifacts/tma-frontend/src/components/VaultTab.tsx" },
  { id: "ds-games",     col: 3, row: 0, live: false, file: "GamesTab",      name: "Резерв 🔵 — Games Tab",                      path: "artifacts/mockup-sandbox/src/components/mockups/redesign/GamesTab.tsx" },
  // row 1
  { id: "ds-analytics", col: 0, row: 1, live: true,  file: "AnalyticsTab",  name: "Аналитика ✅ LIVE — cobalt starfield",        path: "artifacts/tma-frontend/src/components/AnalyticsTab.tsx" },
  { id: "ds-catalog",   col: 1, row: 1, live: true,  file: "CatalogTab",    name: "Каталог ✅ LIVE — cobalt starfield",          path: "artifacts/tma-frontend/src/components/CatalogTab.tsx" },
  { id: "ds-vpn",       col: 2, row: 1, live: false, file: "VPNTab",        name: "VPN 🔵 — Anonymous Channel",                 path: "artifacts/mockup-sandbox/src/components/mockups/redesign/VPNTab.tsx" },
  { id: "ds-ai",        col: 3, row: 1, live: false, file: "AiNewsTab",     name: "AI/Новости 🔵 — CrisisBot & Feed",           path: "artifacts/mockup-sandbox/src/components/mockups/redesign/AiNewsTab.tsx" },
];

// 1. Create all frames as building placeholders
await applyCanvasActions({
  actions: FRAMES.map(f => ({
    type: "create",
    shapeId: f.id,
    shape: {
      type: "iframe",
      x: ORIGIN_X + f.col * (W + GAP_X),
      y: ORIGIN_Y + f.row * (H + GAP_Y),
      w: W, h: H,
      state: "building",
      componentName: f.name,
    },
  })),
});

// 2. Go live — graduated tabs use APP_URL, dormant tabs use mockup sandbox
await applyCanvasActions({
  actions: FRAMES.map(f => ({
    type: "update",
    shapeId: f.id,
    updates: {
      shapeType: "iframe",
      state: "live",
      url: f.live ? APP_URL : `${BASE}/${f.file}`,
      componentPath: f.path,
      componentName: f.name,
    },
  })),
});

// 3. Focus the whole grid
await focusCanvasShapes({ shapeIds: FRAMES.map(f => f.id), animateMs: 500, padding: 100 });

console.log("━━ CANVAS RESTORED ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  ✅ ds-map       → LIVE app (cobalt starfield)");
console.log("  ✅ ds-loading   → LIVE app (IntroSplash)");
console.log("  ✅ ds-analytics → LIVE app (cobalt starfield)");
console.log("  ✅ ds-catalog   → LIVE app (cobalt starfield)");
console.log("  🔵 ds-vault     → mockup sandbox  ← NEXT to graduate");
console.log("  🔵 ds-games     → mockup sandbox");
console.log("  🔵 ds-vpn       → mockup sandbox");
console.log("  🔵 ds-ai        → mockup sandbox");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
