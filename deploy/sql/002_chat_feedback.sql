-- chat.feedback: one row per (session, assistant message) rating.
--
-- Per-turn 👍/👎 signal from the chat UI. Designed in GitHub issue #36.
--
-- - One rating per (session_id, message_id) — UPSERT semantics on conflict.
-- - rating: +1 (thumbs up) | -1 (thumbs down). Clearing is a DELETE of the
--   row from the API, so the table never carries a 0/NULL rating.
-- - note: optional free-form text, only used on thumbs-down per the spec.
-- - client_fingerprint: re-derived at write time (hashed x-forwarded-for),
--   so it can be missing for sessions resumed across IPs.
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS chat.feedback (
  feedback_id        BIGSERIAL PRIMARY KEY,
  session_id         TEXT NOT NULL REFERENCES chat.sessions(session_id) ON DELETE CASCADE,
  message_id         TEXT NOT NULL,
  rating             SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
  note               TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_fingerprint TEXT,
  UNIQUE (session_id, message_id)
);

CREATE INDEX IF NOT EXISTS feedback_session_id_idx
  ON chat.feedback (session_id);
CREATE INDEX IF NOT EXISTS feedback_created_at_idx
  ON chat.feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_rating_created_at_idx
  ON chat.feedback (rating, created_at DESC);
