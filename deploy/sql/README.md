# Database migrations

Schema files for `cfde-atlas`. Apply in numeric order against the same Postgres database the app points at via `DATABASE_URL`.

The app does not run migrations on boot. Apply manually (one-time) or wire into your ETL/deploy pipeline.

## Apply

```bash
psql "$DATABASE_URL" -f deploy/sql/001_chat_sessions.sql
psql "$DATABASE_URL" -f deploy/sql/002_chat_feedback.sql
```

All files are idempotent (`CREATE … IF NOT EXISTS`), so re-running is safe.

## Schemas owned here

- `chat.sessions` — chat session persistence + sharing. See GitHub issue #22.
- `chat.feedback` — per-turn 👍/👎 ratings (and optional thumbs-down notes), FK to `chat.sessions(session_id)` with cascade. See GitHub issue #36 and ADR-0005.

The `analytics` schema is owned by `cfde-atlas-etl`, not this repo.
