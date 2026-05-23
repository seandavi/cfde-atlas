import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { customAlphabet } from "nanoid";

import { getSql } from "@/app/lib/db";

// nanoid alphabet: URL-safe, no ambiguous look-alikes. Matches issue #22 spec.
const SESSION_ID_ALPHABET =
  "0123456789ABCDEFGHJKMNPQRSTVWXYZabcdefghijkmnopqrstuvwxyz";
const SHARE_CODE_ALPHABET = SESSION_ID_ALPHABET;

const newSessionId = customAlphabet(SESSION_ID_ALPHABET, 12);
const newShareCode = customAlphabet(SHARE_CODE_ALPHABET, 16);

const DEFAULT_SHARE_TTL_DAYS = 30;
const SESSION_COOKIE_NAME = "cfde_atlas_session";

/* ----------------- Types ----------------- */

export type SessionRow = {
  session_id: string;
  share_code: string | null;
  parent_session_id: string | null;
  title: string | null;
  messages: unknown[];
  message_count: number;
  created_at: string;
  last_message_at: string | null;
  share_expires_at: string | null;
  share_view_count: number;
  share_last_viewed_at: string | null;
  data_refreshed_at_min: string | null;
  data_refreshed_at_max: string | null;
};

/* ----------------- Signed cookie ----------------- */

function signingSecret(): string {
  const secret = process.env.SESSION_SIGNING_SECRET;
  if (secret && secret.length >= 16) return secret;
  // Dev fallback: derive from DATABASE_URL so local dev does not require a
  // separate env var. Production deployments MUST set SESSION_SIGNING_SECRET.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SIGNING_SECRET is required in production (min 16 chars).",
    );
  }
  return process.env.DATABASE_URL ?? "cfde-atlas-dev-fallback-secret";
}

function sign(sessionId: string): string {
  return createHmac("sha256", signingSecret())
    .update(sessionId)
    .digest("base64url");
}

export function mintSessionCookie(sessionId: string): {
  name: string;
  value: string;
} {
  return { name: SESSION_COOKIE_NAME, value: `${sessionId}.${sign(sessionId)}` };
}

export function verifySessionCookie(
  raw: string | undefined,
  expectedSessionId: string,
): boolean {
  if (!raw) return false;
  const dot = raw.indexOf(".");
  if (dot === -1) return false;
  const id = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (id !== expectedSessionId) return false;
  const expected = sign(expectedSessionId);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function sessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

/* ----------------- DB operations ----------------- */

export type CreateSessionInput = {
  parentSessionId?: string | null;
  seedMessages?: unknown[];
  clientFingerprint?: string | null;
  userAgent?: string | null;
};

export async function createSession(
  input: CreateSessionInput = {},
): Promise<SessionRow> {
  const sql = getSql();
  const id = newSessionId();
  const seed = input.seedMessages ?? [];
  const count = Array.isArray(seed) ? seed.length : 0;
  const [row] = await sql<SessionRow[]>`
    INSERT INTO chat.sessions
      (session_id, parent_session_id, messages, message_count,
       last_message_at, client_fingerprint, user_agent)
    VALUES
      (${id},
       ${input.parentSessionId ?? null},
       ${sql.json(seed as never)},
       ${count},
       ${count > 0 ? new Date() : null},
       ${input.clientFingerprint ?? null},
       ${input.userAgent ?? null})
    RETURNING *
  `;
  return row;
}

export async function getSessionById(
  sessionId: string,
): Promise<SessionRow | null> {
  const sql = getSql();
  const rows = await sql<SessionRow[]>`
    SELECT * FROM chat.sessions WHERE session_id = ${sessionId} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getSessionByShareCode(
  shareCode: string,
): Promise<SessionRow | null> {
  const sql = getSql();
  const rows = await sql<SessionRow[]>`
    SELECT * FROM chat.sessions WHERE share_code = ${shareCode} LIMIT 1
  `;
  return rows[0] ?? null;
}

export type UpdateMessagesInput = {
  sessionId: string;
  messages: unknown[];
  title?: string | null;
  dataRefreshedAtMin?: string | null;
  dataRefreshedAtMax?: string | null;
};

export async function updateSessionMessages(
  input: UpdateMessagesInput,
): Promise<SessionRow | null> {
  const sql = getSql();
  const count = Array.isArray(input.messages) ? input.messages.length : 0;
  // Title is set only on first write — preserve any earlier value.
  const rows = await sql<SessionRow[]>`
    UPDATE chat.sessions
       SET messages              = ${sql.json(input.messages as never)},
           message_count         = ${count},
           last_message_at       = NOW(),
           title                 = COALESCE(title, ${input.title ?? null}),
           data_refreshed_at_min = LEAST(
             data_refreshed_at_min,
             ${input.dataRefreshedAtMin ?? null}::timestamptz
           ),
           data_refreshed_at_max = GREATEST(
             data_refreshed_at_max,
             ${input.dataRefreshedAtMax ?? null}::timestamptz
           )
     WHERE session_id = ${input.sessionId}
     RETURNING *
  `;
  return rows[0] ?? null;
}

export type ShareSessionInput = {
  sessionId: string;
  ttlDays?: number;
};

export type ShareSessionResult = {
  share_code: string;
  share_expires_at: string | null;
  created: boolean;
};

export async function shareSession(
  input: ShareSessionInput,
): Promise<ShareSessionResult | null> {
  const sql = getSql();
  const ttlDays = Math.max(1, Math.min(365, input.ttlDays ?? DEFAULT_SHARE_TTL_DAYS));
  // Mint a candidate code; only used if share_code is still NULL. Idempotent —
  // re-sharing returns the existing code unchanged (TTL also unchanged).
  const candidate = newShareCode();
  const rows = await sql<
    { share_code: string; share_expires_at: string | null; was_new: boolean }[]
  >`
    UPDATE chat.sessions
       SET share_code       = COALESCE(share_code, ${candidate}),
           share_expires_at = COALESCE(
             share_expires_at,
             NOW() + (${ttlDays}::int * INTERVAL '1 day')
           )
     WHERE session_id = ${input.sessionId}
     RETURNING share_code, share_expires_at,
               (share_code = ${candidate}) AS was_new
  `;
  if (rows.length === 0) return null;
  return {
    share_code: rows[0].share_code,
    share_expires_at: rows[0].share_expires_at,
    created: rows[0].was_new,
  };
}

export async function bumpShareView(shareCode: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE chat.sessions
       SET share_view_count     = share_view_count + 1,
           share_last_viewed_at = NOW()
     WHERE share_code = ${shareCode}
  `;
}

/* ----------------- Sharing helpers ----------------- */

export function isShareExpired(row: Pick<SessionRow, "share_expires_at">): boolean {
  if (!row.share_expires_at) return false;
  return new Date(row.share_expires_at).getTime() < Date.now();
}

export function shareUrl(shareCode: string, origin: string): string {
  const trimmed = origin.replace(/\/+$/, "");
  return `${trimmed}/c/${shareCode}`;
}

/* ----------------- Title derivation ----------------- */

export function deriveTitle(messages: unknown[]): string | null {
  // First user message → first 60 chars. Cheap, no LLM call.
  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    const msg = m as Record<string, unknown>;
    if (msg.role !== "user") continue;
    const parts = msg.parts;
    if (!Array.isArray(parts)) continue;
    const text = parts
      .filter(
        (p): p is { type: "text"; text: string } =>
          !!p &&
          typeof p === "object" &&
          (p as Record<string, unknown>).type === "text" &&
          typeof (p as Record<string, unknown>).text === "string",
      )
      .map((p) => p.text)
      .join(" ")
      .trim();
    if (!text) continue;
    return text.length > 60 ? `${text.slice(0, 60).trimEnd()}…` : text;
  }
  return null;
}

/* ----------------- Misc ----------------- */

export function newRequestId(): string {
  return randomBytes(8).toString("hex");
}

export const SHARE_TTL_DAYS_DEFAULT = DEFAULT_SHARE_TTL_DAYS;
