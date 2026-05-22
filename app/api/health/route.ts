import { getSql } from "@/app/lib/db";

// Force dynamic — this handler reads live DB state on every request,
// so any caching would defeat the purpose.
export const dynamic = "force-dynamic";

// Time-budget for the DB ping. The handler itself MUST resolve quickly
// (uptime checks are 10s-budgeted; the GCP uptime check times out at
// 10s per probe). 5s leaves headroom for network + Traefik routing.
const DB_PING_TIMEOUT_MS = 5_000;

async function pingDb(): Promise<void> {
  const sql = getSql();
  const query: Promise<unknown> = sql`SELECT 1 AS ping`;
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(new Error(`db ping timed out after ${DB_PING_TIMEOUT_MS}ms`)),
      DB_PING_TIMEOUT_MS,
    ),
  );
  await Promise.race([query, timeout]);
}

export async function GET() {
  const checks: Record<string, string> = {};
  let allOk = true;

  // DB connectivity — the most meaningful dependency. If pg is wedged
  // or DATABASE_URL is missing, the chatbot tools fail anyway, so this
  // surfaces the right signal.
  //
  // We deliberately do NOT call Gemini here: each probe would cost a
  // (small) Gemini API charge, and with checks every 60s from 5 regions
  // that's ~7k API calls/day for monitoring alone. If Gemini is broken,
  // users surface that within seconds of trying the chat.
  try {
    await pingDb();
    checks.db = "ok";
  } catch (e) {
    checks.db = e instanceof Error ? e.message : String(e);
    allOk = false;
  }

  // Body MUST include the literal string "Healthy" when healthy — the
  // GCP uptime check matches on that string in addition to HTTP 200.
  // See terraform/apps/cfde_atlas/main.tf § content_matchers.
  return Response.json(
    { status: allOk ? "Healthy" : "Unhealthy", checks },
    { status: allOk ? 200 : 503 },
  );
}
