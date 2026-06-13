/**
 * Application entry point.
 *
 * IMPORTANT — Leaflet CSS and marker icons MUST be imported here (bundled via
 * Vite) rather than loaded from a CDN.  Telegram WebView blocks external
 * requests and can be offline; CDN-loaded assets cause a blank / crash.
 *
 * NOTE: React.StrictMode is intentionally omitted.  StrictMode in React 18/19
 * double-invokes ref callbacks (mount → null → mount again) so that imperative
 * libraries like Leaflet receive the same DOM node twice and throw
 * "Map container is already initialized".  This is a known incompatibility;
 * the recommended workaround is to run without StrictMode in production and
 * development when using react-leaflet.
 */
import { createRoot } from "react-dom/client";

// 1. Leaflet CSS — bundled (not CDN) so it works in offline Telegram WebView
import "leaflet/dist/leaflet.css";

// 2. Global app styles
import "./index.css";

// 3. Fix Leaflet default marker icons for Vite (Webpack-style require() doesn't
//    work in Vite's ESM environment; we import the images directly so Vite
//    fingerprints and bundles them).
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Remove the broken _getIconUrl getter that Leaflet ships for Webpack environments
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

import App from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element — check index.html");

createRoot(root).render(<App />);
