import { describe, expect, it } from "vitest";

import { formatSchemaDigest, type DigestColumn } from "../schema";
import type { AnalyticsTable } from "../schema";

const tables: AnalyticsTable[] = [
  { name: "publications", description: "Grant-associated publications.", kind: "table" },
  { name: "journals", description: null, kind: "view" },
];

const columns: DigestColumn[] = [
  {
    table_name: "publications",
    name: "pmid",
    type: "integer",
    notes: "PubMed identifier.",
    nullable: false,
  },
  {
    table_name: "publications",
    name: "core_project_number",
    type: "text",
    notes: "FK to grants.core_project_number.",
    nullable: true,
  },
  {
    table_name: "journals",
    name: "issn",
    type: "text",
    notes: null,
    nullable: true,
  },
];

describe("formatSchemaDigest", () => {
  it("returns empty string when there are no tables", () => {
    expect(formatSchemaDigest([], columns)).toBe("");
  });

  it("renders a header per table with its kind and description", () => {
    const out = formatSchemaDigest(tables, columns);
    expect(out).toContain("### publications — table\nGrant-associated publications.");
    // No description → header without a trailing description line.
    expect(out).toContain("### journals — view");
    expect(out).not.toContain("### journals — view\nnull");
  });

  it("marks NOT NULL columns and omits the marker for nullable ones", () => {
    const out = formatSchemaDigest(tables, columns);
    expect(out).toContain("- pmid: integer NOT NULL — PubMed identifier.");
    expect(out).toContain("- core_project_number: text — FK to grants.core_project_number.");
  });

  it("renders columns without notes cleanly (no trailing dash)", () => {
    const out = formatSchemaDigest(tables, columns);
    expect(out).toContain("- issn: text");
    expect(out).not.toContain("- issn: text —");
  });

  it("groups columns under their own table only", () => {
    const out = formatSchemaDigest(tables, columns);
    const journalsBlock = out.slice(out.indexOf("### journals"));
    expect(journalsBlock).toContain("issn");
    expect(journalsBlock).not.toContain("pmid");
  });
});
