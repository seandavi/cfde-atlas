import { getSql } from "@/app/lib/db";

const ANALYTICS_SCHEMA = "analytics";

export type AnalyticsTable = {
  name: string;
  description: string | null;
  kind: "table" | "view" | "materialized_view";
};

export type AnalyticsColumn = {
  name: string;
  type: string;
  notes: string | null;
  nullable: boolean;
};

export type DescribeResult = {
  name: string;
  description: string | null;
  kind: AnalyticsTable["kind"];
  row_count: number;
  columns: AnalyticsColumn[];
  sample_row: Record<string, unknown> | null;
};

const KIND_MAP: Record<string, AnalyticsTable["kind"]> = {
  r: "table",
  v: "view",
  m: "materialized_view",
};

export async function listAnalyticsTables(): Promise<AnalyticsTable[]> {
  const sql = getSql();
  const rows = await sql<
    { name: string; description: string | null; relkind: string }[]
  >`
    SELECT
      c.relname AS name,
      obj_description(c.oid, 'pg_class') AS description,
      c.relkind::text AS relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ${ANALYTICS_SCHEMA}
      AND c.relkind IN ('r', 'v', 'm')
    ORDER BY c.relname
  `;
  return rows.map((r) => ({
    name: r.name,
    description: r.description,
    kind: KIND_MAP[r.relkind] ?? "table",
  }));
}

function stripSchemaPrefix(name: string): string {
  // accept "publications" or "analytics.publications"
  const dot = name.indexOf(".");
  return dot === -1 ? name : name.slice(dot + 1);
}

export async function describeAnalyticsTable(
  rawName: string,
): Promise<DescribeResult | null> {
  const sql = getSql();
  const name = stripSchemaPrefix(rawName);

  const meta = await sql<
    { name: string; description: string | null; relkind: string }[]
  >`
    SELECT
      c.relname AS name,
      obj_description(c.oid, 'pg_class') AS description,
      c.relkind::text AS relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ${ANALYTICS_SCHEMA}
      AND c.relname = ${name}
      AND c.relkind IN ('r', 'v', 'm')
    LIMIT 1
  `;
  if (meta.length === 0) return null;

  const columns = await sql<AnalyticsColumn[]>`
    SELECT
      a.attname AS name,
      pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
      col_description(a.attrelid, a.attnum) AS notes,
      NOT a.attnotnull AS nullable
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ${ANALYTICS_SCHEMA}
      AND c.relname = ${name}
      AND a.attnum > 0
      AND NOT a.attisdropped
    ORDER BY a.attnum
  `;

  // Row count + sample. Use unsafe() for the identifier — `name` was just
  // matched against pg_class so it is a real object we already trust.
  const [countRow] = await sql.unsafe<{ count: string }[]>(
    `SELECT count(*)::text AS count FROM ${ANALYTICS_SCHEMA}."${name.replace(/"/g, '""')}"`,
  );
  const sampleRows = await sql.unsafe<Record<string, unknown>[]>(
    `SELECT * FROM ${ANALYTICS_SCHEMA}."${name.replace(/"/g, '""')}" LIMIT 1`,
  );

  return {
    name: meta[0].name,
    description: meta[0].description,
    kind: KIND_MAP[meta[0].relkind] ?? "table",
    row_count: Number(countRow?.count ?? 0),
    columns,
    sample_row: sampleRows[0] ?? null,
  };
}

export type RunSelectResult = {
  rows: Record<string, unknown>[];
  row_count: number;
  truncated: boolean;
};

const MAX_ROWS = 500;

export async function runSelect(rawSql: string): Promise<RunSelectResult> {
  const sql = getSql();
  // Per-statement guardrails: bounded time, read-only.
  return await sql.begin(async (tx) => {
    await tx.unsafe("SET LOCAL statement_timeout = '10s'");
    await tx.unsafe("SET LOCAL transaction_read_only = on");
    const rows = await tx.unsafe<Record<string, unknown>[]>(rawSql);
    const truncated = rows.length > MAX_ROWS;
    const out = truncated ? rows.slice(0, MAX_ROWS) : rows;
    return { rows: out, row_count: out.length, truncated };
  });
}

export async function getDataRefreshedAt(): Promise<string | null> {
  const sql = getSql();
  try {
    const [row] = await sql<{ refreshed: string | null }[]>`
      SELECT max(data_refreshed_at)::text AS refreshed
      FROM analytics.publications
    `;
    return row?.refreshed ?? null;
  } catch {
    return null;
  }
}

// ---------- Static schema digest ----------
//
// The same metadata describe_table surfaces at runtime (table list +
// column-level schema, sourced from Postgres comments), formatted as a
// compact text block for injection into the system prompt. The schema is
// small and changes only on ETL deploys, so we hoist discovery out of the
// per-turn tool loop. NO live sample rows: those can carry unpublished
// values (see BLUEPRINT §privacy), and baking a real row into the prompt is
// a different exposure than returning one to the model on demand. The backup
// describe_table tool still provides a live sample row when asked.

export type DigestColumn = {
  table_name: string;
  name: string;
  type: string;
  notes: string | null;
  nullable: boolean;
};

/**
 * Format the table list + columns into the AVAILABLE SCHEMA block. Pure
 * (no I/O) so it can be unit-tested without a database.
 */
export function formatSchemaDigest(
  tables: AnalyticsTable[],
  columns: DigestColumn[],
): string {
  if (tables.length === 0) return "";

  const byTable = new Map<string, DigestColumn[]>();
  for (const col of columns) {
    const list = byTable.get(col.table_name) ?? [];
    list.push(col);
    byTable.set(col.table_name, list);
  }

  const blocks = tables.map((t) => {
    const header = `### ${t.name} — ${t.kind}${
      t.description ? `\n${t.description}` : ""
    }`;
    const cols = byTable.get(t.name) ?? [];
    const lines = cols.map((c) => {
      const nullable = c.nullable ? "" : " NOT NULL";
      const notes = c.notes ? ` — ${c.notes}` : "";
      return `- ${c.name}: ${c.type}${nullable}${notes}`;
    });
    return [header, ...lines].join("\n");
  });

  return blocks.join("\n\n");
}

/**
 * Introspect the analytics schema and build the digest string. One query
 * for tables, one for all columns — no per-table round-trips, no sample
 * rows, no row counts.
 */
export async function buildSchemaDigest(): Promise<string> {
  const tables = await listAnalyticsTables();
  if (tables.length === 0) return "";

  const sql = getSql();
  const columns = await sql<DigestColumn[]>`
    SELECT
      c.relname AS table_name,
      a.attname AS name,
      pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
      col_description(a.attrelid, a.attnum) AS notes,
      NOT a.attnotnull AS nullable
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ${ANALYTICS_SCHEMA}
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND c.relkind IN ('r', 'v', 'm')
    ORDER BY c.relname, a.attnum
  `;

  return formatSchemaDigest(tables, columns);
}

// Cache the digest for the life of the process. Next.js dev HMR reloads
// modules, so hoist onto globalThis like the SQL client does. Only successes
// are cached — a transient introspection failure falls through to the prompt
// fallback (and the backup tools) without permanently disabling the digest.
declare global {
  // eslint-disable-next-line no-var
  var __cfde_atlas_schema_digest: string | undefined;
}

export async function getCachedSchemaDigest(): Promise<string> {
  if (globalThis.__cfde_atlas_schema_digest === undefined) {
    globalThis.__cfde_atlas_schema_digest = await buildSchemaDigest();
  }
  return globalThis.__cfde_atlas_schema_digest;
}
