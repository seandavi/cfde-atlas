import { cookies, headers } from "next/headers";

import {
  SHARE_TTL_DAYS_DEFAULT,
  sessionCookieName,
  shareSession,
  shareUrl,
  verifySessionCookie,
} from "@/app/lib/sessions";

export const dynamic = "force-dynamic";

type ShareBody = { ttl_days?: number };

function originFromHeaders(h: Headers): string {
  const explicit = process.env.PUBLIC_BASE_URL;
  if (explicit) return explicit;
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
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

  let body: ShareBody = {};
  try {
    body = (await req.json()) as ShareBody;
  } catch {
    // empty body is fine — use default TTL.
  }

  const result = await shareSession({
    sessionId: id,
    ttlDays: body.ttl_days ?? SHARE_TTL_DAYS_DEFAULT,
  });
  if (!result) {
    return Response.json({ error: "session not found" }, { status: 404 });
  }

  const hdrs = await headers();
  return Response.json({
    share_code: result.share_code,
    share_url: shareUrl(result.share_code, originFromHeaders(hdrs)),
    share_expires_at: result.share_expires_at,
    created: result.created,
  });
}
