---
name: PostgreSQL in production
description: DATABASE_URL secret is set — the app uses PostgreSQL, not SQLite. Key implications for raw SQL and schema migrations.
---

## Rule
When `DATABASE_URL` is set as a Replit secret, `tma_backend/database.py` connects to PostgreSQL. SQLite fallback (`tma.db`) is never used in production — tma.db stays 0 bytes.

**Why:** The backend checks `os.environ.get("DATABASE_URL")` at startup. If set, it builds a PostgreSQL engine. The SQLite path is only taken when DATABASE_URL is absent (local dev without the secret).

**How to apply:**
- Raw SQL in FastAPI routes must NOT use SQLite-specific functions: `date('now')` → use Python `datetime.now(timezone.utc)` passed as a bind param; `datetime('now', '-24 hours')` → `datetime.now(timezone.utc) - timedelta(hours=24)`.
- Table names in raw SQL must match `__tablename__` exactly: `purchase_history` (not `purchases`), `station_reports` (not `crowd_reports`).
- New model columns added after initial `create_all` must be applied via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `_run_migrations()` in `main.py`. PostgreSQL 9.6+ supports `IF NOT EXISTS` on ADD COLUMN.
- If a migration silently fails (exception is swallowed at DEBUG level), run the DDL directly with a Python script against the live DB engine to force the column to exist.
