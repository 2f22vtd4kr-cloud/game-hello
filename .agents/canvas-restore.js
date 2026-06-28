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

// ── Auto-detect domain ────────────────────────────────────────────────────────
const { execSync } = await import('child_process');
const DOMAIN   = execSync('echo $REPLIT_DOMAINS').toString().trim().split(',')[0];
const APP_URL  = `https://${DOMAIN}`;                          // TMA Frontend (port 5000)
const BASE     = `https://${DOMAIN}:8099/__mockup/preview/redesign`; // Mockup Sandbox

console.log("Domain:", DOMAIN);
console.log("App URL:", APP_URL);

const W = 390, H = 844;

// ── Mockup sandbox screens ────────────────────────────────────────────────────
//
// STATUS as of 2026-06-28:
//   ds-loading   — ✅ Graduated → IntroSplash.tsx
//   ds-map       — ✅ Graduated → MapTab.tsx (cobalt starfield)
//   ds-analytics — ✅ Graduated → AnalyticsTab.tsx (cobalt starfield)
//   ds-catalog   — ✅ Graduated → CatalogTab.tsx (cobalt starfield, Progressive Disclosure)
//   ds-vault     — 🔵 NEXT to graduate → VaultTab.tsx
//   ds-games     — 🔵 Dormant → GamesTab.tsx (Reserve tab)
//   ds-vpn       — 🔵 Dormant
//   ds-ai        — 🔵 Dormant
//
// TAB ORDER in bottom nav: Карта → Аналитика → Каталог → Хранилище → Резерв

const FRAMES = [
  // ── Row 0 ─────────────────────────────────────────────────────────────────
  { id: "ds-map",       file: "MapTab",        name: "Map Tab — Cobalt Starfield",            col: 0, row: 0 },
  { id: "ds-loading",   file: "LoadingScreen", name: "Loading Screen — Vertical Typography",  col: 1, row: 0 },
  { id: "ds-vault",     file: "VaultTab",      name: "Vault Tab — Wallet & QR Codes",         col: 2, row: 0 },
  { id: "ds-games",     file: "GamesTab",      name: "Games Tab — Oil Empire & Mini-Games",   col: 3, row: 0 },
  // ── Row 1 ─────────────────────────────────────────────────────────────────
  { id: "ds-analytics", file: "AnalyticsTab",  name: "Analytics Tab — Cobalt Starfield",      col: 0, row: 1 },
  { id: "ds-catalog",   file: "CatalogTab",    name: "Catalog Tab — Cobalt Starfield",         col: 1, row: 1 },
  { id: "ds-vpn",       file: "VPNTab",        name: "VPN Tab — Anonymous Channel",           col: 2, row: 1 },
  { id: "ds-ai",        file: "AiNewsTab",     name: "AI/News Tab — CrisisBot & Feed",        col: 3, row: 1 },
];

const GAP_X = 50, GAP_Y = 100;
const ORIGIN_X = 500, ORIGIN_Y = 118;

// ── 1. Create mockup sandbox placeholders ─────────────────────────────────────
await applyCanvasActions({
  actions: FRAMES.map(f => ({
    type: "create",
    shapeId: f.id,
    shape: {
      type: "iframe",
      x: ORIGIN_X + f.col * (W + GAP_X),
      y: ORIGIN_Y + f.row * (H + GAP_Y),
      w: W,
      h: H,
      state: "building",
      componentName: f.name,
    },
  })),
});

// ── 2. Go live (mockup sandbox) ───────────────────────────────────────────────
await applyCanvasActions({
  actions: FRAMES.map(f => ({
    type: "update",
    shapeId: f.id,
    updates: {
      shapeType: "iframe",
      state: "live",
      url: `${BASE}/${f.file}`,
      componentPath: `artifacts/mockup-sandbox/src/components/mockups/redesign/${f.file}.tsx`,
      componentName: f.name,
    },
  })),
});

console.log("Mockup sandbox iframes live.");

// ── 3. Create live-app phone preview (Catalog tab, port 5000) ─────────────────
//    Position: just to the right of the 8-screen mockup grid
const PHONE_X = ORIGIN_X + 4 * (W + GAP_X) + 200;  // well to the right of mockup grid
const PHONE_Y = ORIGIN_Y;

await applyCanvasActions({
  actions: [{
    type: "create",
    shapeId: "catalog-phone-preview",
    shape: {
      type: "iframe",
      x: PHONE_X,
      y: PHONE_Y,
      w: W,
      h: H,
      state: "live",
      url: APP_URL,
      componentName: "Каталог · телефон (живое приложение)",
    },
  }],
});

console.log("Live catalog phone preview placed.");

// ── 4. Focus on the catalog phone preview ─────────────────────────────────────
await focusCanvasShapes({ shapeIds: ["catalog-phone-preview"], animateMs: 500 });

console.log("");
console.log("━━ CANVAS RESTORED ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  8 mockup sandbox iframes: ds-map, ds-loading, ds-vault,");
console.log("    ds-games, ds-analytics, ds-catalog, ds-vpn, ds-ai");
console.log("  1 live app phone preview: catalog-phone-preview");
console.log("  Focused on: catalog-phone-preview");
console.log("");
console.log("GRADUATION STATUS:");
console.log("  ✅ ds-loading   → IntroSplash.tsx");
console.log("  ✅ ds-map       → MapTab.tsx (cobalt starfield)");
console.log("  ✅ ds-analytics → AnalyticsTab.tsx (cobalt starfield)");
console.log("  ✅ ds-catalog   → CatalogTab.tsx (Progressive Disclosure)");
console.log("  🔵 ds-vault     → VaultTab.tsx  ← NEXT");
console.log("  🔵 ds-games     → GamesTab.tsx (Reserve tab)");
console.log("  🔵 ds-vpn, ds-ai → lower priority");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("");
console.log("NEXT WORK: Graduate VaultTab mockup → production VaultTab.tsx");
console.log("  Production file: artifacts/tma-frontend/src/components/VaultTab.tsx");
console.log("  Mockup: artifacts/mockup-sandbox/src/components/mockups/redesign/VaultTab.tsx");
console.log("  Shows: purchase history, active QR codes (qrcode npm), XP progress bar, tier badge");
