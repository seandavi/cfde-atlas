# 0005 — Per-turn feedback storage and retrieval

- **Status:** Accepted
- **Date:** 2026-05-24
- **Deciders:** Sean Davis, Claude
- **Affects:** `app/components/FeedbackBar.tsx`, `app/api/sessions/[id]/feedback/route.ts`, `app/lib/feedback.ts`, `deploy/sql/002_chat_feedback.sql`, `app/lib/analytics.ts`

## Context

Issue #36 introduces a 👍/👎 row under every completed assistant message. The signal needs to land somewhere a reader can query — both to spot systematically-bad turns and to inform prompt / tool adjustments.

Two storage targets were on the table:

1. **`chat.feedback` in Postgres**, foreign-keyed to `chat.sessions(session_id)`.
2. **`turns.log` (JSONL → Vector → ClickHouse)** as a new event type alongside `assistant_completed`.

## Decision

**Persist ratings in `chat.feedback` in the application Postgres.** Emit a fire-and-forget GA event (`feedback_submitted`) carrying only the rating bucket and a `had_note` boolean — the note text itself never leaves Postgres.

Wire format and behavior:

- One row per `(session_id, message_id)`. `ON CONFLICT DO UPDATE` swaps the rating; `DELETE` clears it.
- `rating` is a `SMALLINT` constrained to `{-1, 1}`. There is no zero / null rating — clearing removes the row entirely. This keeps the table easy to count without `WHERE rating IS NOT NULL` everywhere.
- `note` is free-form user text, only set on thumbs-down per the UI spec. Trimmed and capped at 2000 chars at the route boundary (`app/api/sessions/[id]/feedback/route.ts`).
- `client_fingerprint` is re-derived from `x-forwarded-for` at write time using the same SHA-256 hash as `POST /api/sessions`. Nullable — local dev without a proxy populates it as `NULL`.
- Auth: the same signed `cfde_atlas_session` cookie that protects `PUT /api/sessions/:id`. Anyone forking a shared transcript gets a new `session_id` and rates their own copy — there is no path for a viewer to rate someone else's session.
- The shared-view path (`/c/<code>`) intentionally does **not** render `FeedbackBar`. Read-only viewers have no signed session cookie for the underlying `session_id`.

## Where the data lands

Operators who want to see what users are flagging:

```sql
-- Recent thumbs-down with notes, newest first.
SELECT f.created_at, f.session_id, f.message_id, f.note,
       s.title, s.message_count
  FROM chat.feedback f
  JOIN chat.sessions s USING (session_id)
 WHERE f.rating = -1
 ORDER BY f.created_at DESC
 LIMIT 50;

-- Daily rating mix.
SELECT date_trunc('day', created_at) AS day,
       SUM(CASE WHEN rating =  1 THEN 1 ELSE 0 END) AS up,
       SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END) AS down
  FROM chat.feedback
 GROUP BY 1
 ORDER BY 1 DESC;

-- Pull the full transcript for a flagged turn (the assistant message id
-- joins back into chat.sessions.messages, which is JSONB).
SELECT s.messages
  FROM chat.sessions s
  JOIN chat.feedback f USING (session_id)
 WHERE f.message_id = $1;
```

There is no built-in admin UI for v1 — raw SQL is the read path.

## Reasons

- **Foreign-key integrity.** Sessions own their feedback (`ON DELETE CASCADE`). A session purge takes its feedback rows with it; that matters for the privacy story.
- **Notes are user-authored prose.** Same shape as the prompt/response content already in `chat.sessions.messages` — same database, same privacy boundary. Sending notes through Vector / ClickHouse would split the privacy review surface in two.
- **GA stays metric-shaped.** The event carries `{rating, had_note}` only. This matches the privacy contract laid out in BLUEPRINT.md §Gotchas ("no prompt text, no assistant text") that `app/lib/analytics.ts` enforces by being the single GA call site.
- **Upsert on `(session_id, message_id)`** matches the UI behavior: swap by clicking the other thumb, clear by re-clicking the active one.

## Costs we accept

- **No cross-session aggregation.** A user who rates the same prompt twice in two different sessions produces two rows. Acceptable — the unit is the assistant turn, and turns are session-local.
- **No per-tool / per-token feedback.** Per-turn is the right resolution per the issue. If we ever want finer grain, a new table is cheaper than reshaping this one.
- **No moderation pipeline for notes.** The note column is free-form text from authenticated session-cookie holders. Volume is expected to be tiny (low single-digit %); review is manual via the SQL above. Revisit if we get scale or abuse signal.

## Revisit triggers

- Notes become voluminous enough that a moderation queue is warranted.
- We want to display aggregate "users flagged this answer" badges on shared transcripts — that needs a public-read API path which today does not exist.
- ORCID auth lights up (#40) and we want to attribute ratings to a user identity rather than a session cookie.

## Out of scope

- A `/feedback` slash command. Explicitly rejected in #36 — the audience uses 👍/👎.
- Surfacing feedback on shared `/c/<code>` pages. Read-only viewers do not own the session cookie required to write to `chat.feedback`.
- Streaming ratings into the turn-log (`turns.log`). The turn-log is the machine signal per ADR-0003; feedback is the human signal and stays separate by design.
