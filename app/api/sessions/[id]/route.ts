import { cookies } from "next/headers";

import {
  deriveTitle,
  getSessionById,
  sessionCookieName,
  updateSessionMessages,
  verifySessionCookie,
} from "@/app/lib/sessions";

export const dynamic = "force-dynamic";

type PutBody = {
  messages: unknown[];
  data_refreshed_at_min?: string | null;
  data_refreshed_at_max?: string | null;
};

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const store = await cookies();
  const raw = store.get(sessionCookieName())?.value;
  if (!verifySessionCookie(raw, id)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body.messages)) {
    return Response.json(
      { error: "messages must be an array of UIMessage" },
      { status: 400 },
    );
  }

  const row = await updateSessionMessages({
    sessionId: id,
    messages: body.messages,
    title: deriveTitle(body.messages),
    dataRefreshedAtMin: body.data_refreshed_at_min ?? null,
    dataRefreshedAtMax: body.data_refreshed_at_max ?? null,
  });

  if (!row) {
    return Response.json({ error: "session not found" }, { status: 404 });
  }

  return Response.json({
    session_id: row.session_id,
    message_count: row.message_count,
    title: row.title,
    last_message_at: row.last_message_at,
  });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  // Caller-bound read. Used after navigation to /c/<code> → Fork → /?session=<id>
  // (not currently a flow, but reserved for symmetry).
  const { id } = await ctx.params;
  const store = await cookies();
  const raw = store.get(sessionCookieName())?.value;
  if (!verifySessionCookie(raw, id)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const row = await getSessionById(id);
  if (!row) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(row);
}
