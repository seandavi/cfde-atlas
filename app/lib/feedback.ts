import { getSql } from "@/app/lib/db";

export type FeedbackRating = -1 | 1;

export type UpsertFeedbackInput = {
  sessionId: string;
  messageId: string;
  rating: FeedbackRating;
  note?: string | null;
  clientFingerprint?: string | null;
};

export type FeedbackRow = {
  feedback_id: number;
  session_id: string;
  message_id: string;
  rating: FeedbackRating;
  note: string | null;
  created_at: string;
  updated_at: string;
  client_fingerprint: string | null;
};

export async function upsertFeedback(
  input: UpsertFeedbackInput,
): Promise<FeedbackRow> {
  const sql = getSql();
  const note = input.note?.trim() ? input.note.trim().slice(0, 2000) : null;
  const [row] = await sql<FeedbackRow[]>`
    INSERT INTO chat.feedback
      (session_id, message_id, rating, note, client_fingerprint)
    VALUES
      (${input.sessionId},
       ${input.messageId},
       ${input.rating},
       ${note},
       ${input.clientFingerprint ?? null})
    ON CONFLICT (session_id, message_id) DO UPDATE
      SET rating             = EXCLUDED.rating,
          note               = EXCLUDED.note,
          client_fingerprint = COALESCE(EXCLUDED.client_fingerprint,
                                        chat.feedback.client_fingerprint),
          updated_at         = NOW()
    RETURNING *
  `;
  return row;
}

export async function clearFeedback(
  sessionId: string,
  messageId: string,
): Promise<boolean> {
  const sql = getSql();
  const rows = await sql<{ feedback_id: number }[]>`
    DELETE FROM chat.feedback
     WHERE session_id = ${sessionId}
       AND message_id = ${messageId}
    RETURNING feedback_id
  `;
  return rows.length > 0;
}

export function isValidRating(value: unknown): value is FeedbackRating | null {
  return value === 1 || value === -1 || value === null;
}
