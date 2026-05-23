import {
  bumpShareView,
  getSessionByShareCode,
  isShareExpired,
} from "@/app/lib/sessions";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const row = await getSessionByShareCode(code);
  if (!row) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  if (isShareExpired(row)) {
    return Response.json({ error: "share link expired" }, { status: 410 });
  }

  // Fire-and-forget view bump. Re-throws would block the read for no benefit.
  bumpShareView(code).catch(() => undefined);

  return Response.json({
    share_code: row.share_code,
    title: row.title,
    messages: row.messages,
    message_count: row.message_count,
    created_at: row.created_at,
    last_message_at: row.last_message_at,
    share_expires_at: row.share_expires_at,
    data_refreshed_at_min: row.data_refreshed_at_min,
    data_refreshed_at_max: row.data_refreshed_at_max,
  });
}
