import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],

  base: "./",

  resolve: {
    dedupe: ["react", "react-dom", "react/jsx-runtime", "leaflet"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@assets": path.resolve(__dirname, "../../attached_assets"),
      leaflet: path.resolve(__dirname, "../../node_modules/.pnpm/leaflet@1.9.4/node_modules/leaflet"),
    },
  },

  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,

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
        manualChunks: {
          leaflet: ["leaflet", "react-leaflet", "react-leaflet-cluster"],
          charts: ["recharts"],
          motion: ["framer-motion"],
        },
      },
    },
  },
});
