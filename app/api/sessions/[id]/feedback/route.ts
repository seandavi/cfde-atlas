import { cookies, headers } from "next/headers";
import { createHash } from "node:crypto";

import {
  clearFeedback,
  isValidRating,
  upsertFeedback,
  type FeedbackRating,
} from "@/app/lib/feedback";
import { sessionCookieName, verifySessionCookie } from "@/app/lib/sessions";

export const dynamic = "force-dynamic";

type FeedbackBody = {
  message_id?: unknown;
  rating?: unknown;
  note?: unknown;
};

const MAX_NOTE_LENGTH = 2000;

function fingerprintFrom(h: Headers): string | null {
  const ipRaw = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (!ipRaw) return null;
  return createHash("sha256").update(ipRaw).digest("hex");
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const store = await cookies();
  const raw = store.get(sessionCookieName())?.value;
  if (!verifySessionCookie(raw, id)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: FeedbackBody;
  try {
    body = (await req.json()) as FeedbackBody;
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const messageId =
    typeof body.message_id === "string" ? body.message_id.trim() : "";
  if (!messageId) {
    return Response.json(
      { error: "message_id is required" },
      { status: 400 },
    );
  }

  if (!isValidRating(body.rating)) {
    return Response.json(
      { error: "rating must be 1, -1, or null" },
      { status: 400 },
    );
  }

  if (body.rating === null) {
    const removed = await clearFeedback(id, messageId);
    return Response.json({ session_id: id, message_id: messageId, removed });
  }

  let note: string | null = null;
  if (typeof body.note === "string") {
    const trimmed = body.note.trim();
    if (trimmed.length > MAX_NOTE_LENGTH) {
      return Response.json(
        { error: `note must be ≤ ${MAX_NOTE_LENGTH} characters` },
        { status: 400 },
      );
    }
    note = trimmed.length > 0 ? trimmed : null;
  }

  const hdrs = await headers();
  const row = await upsertFeedback({
    sessionId: id,
    messageId,
    rating: body.rating as FeedbackRating,
    note,
    clientFingerprint: fingerprintFrom(hdrs),
  });

  return Response.json({
    session_id: row.session_id,
    message_id: row.message_id,
    rating: row.rating,
    has_note: row.note !== null,
    updated_at: row.updated_at,
  });
}
