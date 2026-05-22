import postgres from "postgres";

// One pooled client per process. Next.js dev mode reloads modules — hoist onto
// globalThis so HMR does not leak connections across reloads.
declare global {
  // eslint-disable-next-line no-var
  var __cfde_atlas_sql: ReturnType<typeof postgres> | undefined;
}

function makeClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. The chat tools require a Postgres backend. " +
        "See .env.example for the expected shape.",
    );
  }
  return postgres(url, {
    // Pin search_path so the LLM (and our introspection queries) can refer to
    // `publications` instead of `analytics.publications`. Schema-qualified names
    // still work too.
    connection: { search_path: "analytics, public" },
    max: 10,
    idle_timeout: 30,
  });
}

export function getSql() {
  if (!globalThis.__cfde_atlas_sql) {
    globalThis.__cfde_atlas_sql = makeClient();
  }
  return globalThis.__cfde_atlas_sql;
}
