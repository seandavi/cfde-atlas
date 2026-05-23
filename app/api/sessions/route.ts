import { cookies, headers } from "next/headers";
import { createHash } from "node:crypto";

import {
  createSession,
  getSessionByShareCode,
  isShareExpired,
  mintSessionCookie,
} from "@/app/lib/sessions";

export const dynamic = "force-dynamic";

type CreateBody = {
  // Optional: fork from a shared transcript. Server resolves the share_code
  // to the parent session_id and copies the messages.
  fork_share_code?: string;
  // Optional: caller-supplied parent session id (when forking from a
  // session the caller already owns — rare, but lets us avoid a share trip).
  parent_session_id?: string;
};

function fingerprint(): string {
  // IP hash for rate-limit + abuse signal. Headers come from the upstream
  // proxy (Traefik forwards `x-forwarded-for`). Hash so we never log raw IPs.
  // Done synchronously from the request — does not leave this handler.
  return "pending";
}

export async function POST(req: Request) {
  let body: CreateBody = {};
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    // empty body is fine — most callers POST with no payload.
  }

  const hdrs = await headers();
  const ipRaw = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ua = hdrs.get("user-agent") ?? null;
  const fp = ipRaw ? createHash("sha256").update(ipRaw).digest("hex") : null;
  void fingerprint;

  let parentId: string | null = body.parent_session_id ?? null;
  let seed: unknown[] = [];

  if (body.fork_share_code) {
    const parent = await getSessionByShareCode(body.fork_share_code);
    if (!parent || isShareExpired(parent)) {
      return Response.json(
        { error: "fork_share_code does not resolve to an accessible session." },
        { status: 404 },
      );
    }
    parentId = parent.session_id;
    seed = Array.isArray(parent.messages) ? parent.messages : [];
  }

  const row = await createSession({
    parentSessionId: parentId,
    seedMessages: seed,
    clientFingerprint: fp,
    userAgent: ua,
  });

  const cookie = mintSessionCookie(row.session_id);
  const store = await cookies();
  store.set(cookie.name, cookie.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // 90d — outlives any single browser session, expires before staleness
    // becomes a concern.
    maxAge: 60 * 60 * 24 * 90,
  });

  return Response.json({
    session_id: row.session_id,
    parent_session_id: row.parent_session_id,
    message_count: row.message_count,
    messages: row.messages,
  });
}
