---
name: Map tab never remount
description: Leaflet maps must never unmount or they lose viewport state; use CSS visibility toggle.
---

The rule: `<MapTab visible={activeTab === "map"} />` is always rendered in the component tree. Inside MapTab, the root div uses `visibility: visible/hidden` + `pointerEvents: auto/none` based on the `visible` prop.

**Why:** react-leaflet re-initializes the entire map (tiles, zoom, pan position, cluster calculations) on mount. If you conditionally render it, every tab switch causes a full re-init and visible flash. The CSS visibility trick keeps the component alive without layout cost.

**How to apply:** In `App.tsx`, render MapTab unconditionally outside any conditional block. All other tabs use `{activeTab === "X" && <Tab />}` pattern (they are lightweight and remounting them is fine).
