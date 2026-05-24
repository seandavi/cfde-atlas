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
