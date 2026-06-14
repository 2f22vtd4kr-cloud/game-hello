import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],

  /**
   * base: './' — Required for Telegram Mini App static deployments.
   * Assets are referenced with relative paths so they work regardless of the
   * hosting path prefix (e.g. served from a CDN subfolder or Replit domain).
   */
  base: "./",

  resolve: {
    // Force a single copy of React and Leaflet across the entire pnpm workspace.
    // Without this, react-leaflet (and other packages) can pull in a second React
    // instance, causing the "Invalid hook call" crash in Telegram WebView.
    dedupe: ["react", "react-dom", "react/jsx-runtime", "leaflet"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@assets": path.resolve(__dirname, "../../attached_assets"),
      // Ensure Leaflet resolves to the ESM package (not a CDN copy)
      leaflet: path.resolve(__dirname, "../../node_modules/.pnpm/leaflet@1.9.4/node_modules/leaflet"),
    },
  },

  server: {
    host: "0.0.0.0",
    port: 3001,
    allowedHosts: true,

    /**
     * HMR: use the Replit dev domain so the proxy doesn't block the
     * WebSocket upgrade. Falls back gracefully if REPLIT_DEV_DOMAIN
     * is not set (local dev).
     */
    hmr: process.env.REPLIT_DEV_DOMAIN
      ? {
          protocol: "wss",
          host: process.env.REPLIT_DEV_DOMAIN,
          clientPort: 443,
        }
      : {
          protocol: "wss",
          clientPort: 443,
        },

    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split Leaflet into its own chunk — it's large and rarely changes
        manualChunks: {
          leaflet: ["leaflet", "react-leaflet", "react-leaflet-cluster"],
          charts: ["recharts"],
          motion: ["framer-motion"],
        },
      },
    },
  },
});
