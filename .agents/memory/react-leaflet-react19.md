---
name: react-leaflet React 19 peer warnings
description: react-leaflet@4.x declares peer dep on React 18; works fine with React 19 despite warnings.
---

The rule: ignore the pnpm peer dependency warnings for react-leaflet and react-leaflet-cluster with React 19.

**Why:** react-leaflet@4.2.1 and react-leaflet-cluster@2.1.0 declare `peerDependencies: { react: "^18.0.0" }` but the workspace uses React 19. The libraries work correctly at runtime — the React APIs they use are stable across versions.

**How to apply:** Do not downgrade React or pin react-leaflet@5 (which added React 19 support but has API changes). The warnings appear on every `pnpm install` and can be ignored.
