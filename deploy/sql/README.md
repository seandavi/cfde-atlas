# Database migrations

Schema files for `cfde-atlas`. Apply in numeric order against the same Postgres database the app points at via `DATABASE_URL`.

The app does not run migrations on boot. Apply manually (one-time) or wire into your ETL/deploy pipeline.

## Apply

```bash
psql "$DATABASE_URL" -f deploy/sql/001_chat_sessions.sql
```

All files are idempotent (`CREATE … IF NOT EXISTS`), so re-running is safe.

## Schemas owned here

- `chat.sessions` — chat session persistence + sharing. See GitHub issue #22.

The `analytics` schema is owned by `cfde-atlas-etl`, not this repo.
