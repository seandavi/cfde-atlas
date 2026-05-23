-- chat.sessions: one row per chat session.
--
-- Sharing is a column flip on this same row (mint share_code, set TTL).
-- See GitHub issue #22 for the design rationale.
--
-- Idempotent: safe to re-run.

CREATE SCHEMA IF NOT EXISTS chat;

CREATE TABLE IF NOT EXISTS chat.sessions (
  session_id            TEXT PRIMARY KEY,
  share_code            TEXT UNIQUE,
  parent_session_id     TEXT REFERENCES chat.sessions(session_id),
  title                 TEXT,
  messages              JSONB NOT NULL DEFAULT '[]'::jsonb,
  message_count         INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at       TIMESTAMPTZ,
  share_expires_at      TIMESTAMPTZ,
  share_view_count      INTEGER NOT NULL DEFAULT 0,
  share_last_viewed_at  TIMESTAMPTZ,
  data_refreshed_at_min TIMESTAMPTZ,
  data_refreshed_at_max TIMESTAMPTZ,
  client_fingerprint    TEXT,
  user_agent            TEXT
);

CREATE INDEX IF NOT EXISTS sessions_created_at_idx
  ON chat.sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS sessions_share_code_idx
  ON chat.sessions (share_code) WHERE share_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS sessions_last_message_at_idx
  ON chat.sessions (last_message_at DESC);
CREATE INDEX IF NOT EXISTS sessions_parent_idx
  ON chat.sessions (parent_session_id) WHERE parent_session_id IS NOT NULL;
