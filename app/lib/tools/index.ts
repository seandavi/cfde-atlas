import { tool } from "ai";
import { z } from "zod";
import { TABLE_NAMES, TABLES, type TableName } from "./mock-data";

const MOCK_NOTICE =
  "Backend is mocked — values illustrative only, do not cite in NIH briefings.";

const list_tables = tool({
  description:
    "Discover what tables are available. Returns each table's name with a one-line description written for the LLM. Call this first when you do not know the schema.",
  inputSchema: z.object({}),
  execute: async () => {
    return {
      tables: TABLE_NAMES.map((name) => ({
        name,
        description: TABLES[name].description,
      })),
      _notice: MOCK_NOTICE,
    };
  },
});

const describe_table = tool({
  description:
    "Inspect the schema for a single table. Returns column names, types, foreign-key annotations, a sample row, and the row count. Trust the foreign-key annotations — they declare which joins are real.",
  inputSchema: z.object({
    name: z
      .string()
      .describe(
        "Table name from list_tables, e.g. grants, publications, github_activity, ga_pageviews.",
      ),
  }),
  execute: async ({ name }) => {
    if (!isKnownTable(name)) {
      return {
        error: `Unknown table "${name}". Known tables: ${TABLE_NAMES.join(", ")}.`,
      };
    }
    const t = TABLES[name];
    return {
      name: t.name,
      description: t.description,
      row_count: t.row_count,
      columns: t.columns,
      sample_row: t.rows[0],
      _notice: MOCK_NOTICE,
    };
  },
});

const run_query = tool({
  description:
    "Execute a SELECT statement against the CFDE evaluation database. SELECT only — INSERT/UPDATE/DELETE/DROP/etc. are rejected by the server. Cap exploratory queries with LIMIT. The current backend returns mocked rows filtered from the FROM table.",
  inputSchema: z.object({
    sql: z.string().describe("A single SELECT statement."),
  }),
  execute: async ({ sql }) => {
    const guard = enforceSelectOnly(sql);
    if (!guard.ok) {
      return { error: guard.reason, sql };
    }

    const table = guessFromTable(sql);
    if (!table) {
      return {
        error:
          "Could not identify a FROM <table> in the query. The mock backend matches one table at a time; rewrite the query to read from a single known table.",
        known_tables: TABLE_NAMES,
        sql,
      };
    }

    const limit = parseLimit(sql) ?? 50;
    const rows = TABLES[table].rows.slice(0, limit);

    return {
      rows,
      row_count: rows.length,
      truncated: TABLES[table].rows.length > rows.length,
      from_table: table,
      _notice: MOCK_NOTICE,
    };
  },
});

const render_chart = tool({
  description:
    "Produce a figure from a Vega-Lite spec. Pass a valid Vega-Lite v5 spec. Use this when the user asks for a chart or when a chart clarifies a numeric story. Always surface the underlying table alongside the figure.",
  // NOTE: spec is intentionally typed `unknown` (not z.record / z.object).
  // Gemini's tool-arg generation mangles keys ("\"data\"" instead of "data")
  // when given a z.record(...) schema converted through Google's OpenAPI shape.
  // unknown means "any JSON" with no per-property schema, which Gemini handles
  // correctly and lets Vega-Lite specs round-trip.
  inputSchema: z.object({
    title: z.string().describe("Short human-readable title for the figure."),
    spec: z
      .unknown()
      .describe(
        "Vega-Lite v5 spec object (any valid VL spec). Include data.values inline; do not reference external URLs.",
      ),
  }),
  execute: async ({ title, spec }) => {
    return {
      title,
      vega_lite_spec: spec,
      _notice: MOCK_NOTICE,
    };
  },
});

export const cfdeTools = {
  list_tables,
  describe_table,
  run_query,
  render_chart,
};

// ---------- SQL guard helpers ----------

function isKnownTable(name: string): name is TableName {
  return (TABLE_NAMES as string[]).includes(name);
}

function stripSqlComments(sql: string): string {
  // /* ... */ block comments
  let out = sql.replace(/\/\*[\s\S]*?\*\//g, " ");
  // -- to end of line
  out = out.replace(/--[^\n]*/g, " ");
  return out;
}

export function enforceSelectOnly(sql: string): { ok: true } | { ok: false; reason: string } {
  const stripped = stripSqlComments(sql).trim();
  if (!stripped) {
    return { ok: false, reason: "Empty query." };
  }

  // Reject multiple statements. A trailing semicolon is fine.
  const withoutTrailing = stripped.replace(/;\s*$/, "");
  if (withoutTrailing.includes(";")) {
    return { ok: false, reason: "Multiple statements are not allowed; submit one SELECT." };
  }

  const firstToken = withoutTrailing.split(/\s+/, 1)[0]?.toUpperCase();
  if (firstToken !== "SELECT" && firstToken !== "WITH") {
    return {
      ok: false,
      reason: `Only SELECT (or WITH ... SELECT) is allowed. First token was "${firstToken}".`,
    };
  }

  // Forbidden keywords — scanned outside of string literals.
  const FORBIDDEN = [
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "TRUNCATE",
    "ALTER",
    "CREATE",
    "GRANT",
    "REVOKE",
    "EXEC",
    "EXECUTE",
    "CALL",
    "MERGE",
    "COPY",
    "ATTACH",
    "DETACH",
    "VACUUM",
    "REINDEX",
    "CLUSTER",
  ];
  const dequoted = withoutTrailing.replace(/'(?:[^']|'')*'/g, "''");
  const upper = dequoted.toUpperCase();
  for (const kw of FORBIDDEN) {
    const re = new RegExp(`\\b${kw}\\b`);
    if (re.test(upper)) {
      return { ok: false, reason: `Forbidden keyword "${kw}" — SELECT-only.` };
    }
  }

  return { ok: true };
}

function guessFromTable(sql: string): TableName | null {
  const stripped = stripSqlComments(sql);
  const match = stripped.match(/\bFROM\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?/i);
  const candidate = match?.[1];
  if (candidate && isKnownTable(candidate)) return candidate;
  return null;
}

function parseLimit(sql: string): number | null {
  const m = sql.match(/\bLIMIT\s+(\d+)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}
