---
name: TMA Backend port
description: Replit allowlist does not include port 5001; TMA backend must run on 8000.
---

The rule: `tma_backend/main.py` defaults to port 8000 (via `TMA_PORT` env var). Do not use 5001.

**Why:** Replit's workflow system only allows binding to specific ports: 3000, 3001, 3002, 3003, 4200, 5000, 5173, 6000, 6800, 8000, 8008, 8080, 8099, 9000. Port 5001 was originally intended but rejected with "Port 5001 is not available".

**How to apply:** If you ever need to change the backend port, pick from the allowlist above. Update `tma_backend/main.py` default, `artifacts/tma-frontend/vite.config.ts` proxy target, and the workflow `waitForPort`.
