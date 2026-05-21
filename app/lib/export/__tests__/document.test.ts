import { describe, expect, it } from "vitest";
import { parseMarkdown, inlinesToPlain } from "../document";
import { documentToMarkdown } from "../markdown";

describe("parseMarkdown", () => {
  it("parses a single paragraph", () => {
    const blocks = parseMarkdown("Hello world");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: "paragraph" });
    if (blocks[0].kind === "paragraph") {
      expect(inlinesToPlain(blocks[0].inlines)).toBe("Hello world");
    }
  });

  it("parses heading levels", () => {
    const blocks = parseMarkdown("# h1\n\n## h2\n\n### h3");
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ kind: "heading", level: 1 });
    expect(blocks[1]).toMatchObject({ kind: "heading", level: 2 });
    expect(blocks[2]).toMatchObject({ kind: "heading", level: 3 });
  });

  it("parses bold + italic inlines", () => {
    const blocks = parseMarkdown("This is **bold** and *italic* and `code`.");
    expect(blocks).toHaveLength(1);
    if (blocks[0].kind !== "paragraph") throw new Error("expected paragraph");
    const kinds = blocks[0].inlines.map((i) => i.kind);
    expect(kinds).toContain("strong");
    expect(kinds).toContain("em");
    expect(kinds).toContain("code");
  });

  it("parses GFM tables", () => {
    const md = `| Program | Funding |
| --- | --- |
| CFDE | $5.1M |
| LINCS | $4.2M |`;
    const blocks = parseMarkdown(md);
    expect(blocks).toHaveLength(1);
    if (blocks[0].kind !== "table") throw new Error("expected table");
    expect(blocks[0].headers).toHaveLength(2);
    expect(blocks[0].rows).toHaveLength(2);
    expect(inlinesToPlain(blocks[0].rows[0][0])).toBe("CFDE");
    expect(inlinesToPlain(blocks[0].rows[1][1])).toBe("$4.2M");
  });

  it("parses bulleted lists", () => {
    const blocks = parseMarkdown("- one\n- two\n- three");
    expect(blocks).toHaveLength(1);
    if (blocks[0].kind !== "list") throw new Error("expected list");
    expect(blocks[0].ordered).toBe(false);
    expect(blocks[0].items).toHaveLength(3);
    expect(inlinesToPlain(blocks[0].items[0])).toBe("one");
  });

  it("parses ordered lists", () => {
    const blocks = parseMarkdown("1. one\n2. two");
    expect(blocks).toHaveLength(1);
    if (blocks[0].kind !== "list") throw new Error("expected list");
    expect(blocks[0].ordered).toBe(true);
  });

  it("parses links", () => {
    const blocks = parseMarkdown("See [the docs](https://example.com).");
    if (blocks[0].kind !== "paragraph") throw new Error("expected paragraph");
    const link = blocks[0].inlines.find((i) => i.kind === "link");
    expect(link).toBeDefined();
    if (link?.kind === "link") {
      expect(link.href).toBe("https://example.com");
      expect(inlinesToPlain(link.inlines)).toBe("the docs");
    }
  });

  it("parses fenced code blocks with language hint", () => {
    const md = "```sql\nSELECT 1\n```";
    const blocks = parseMarkdown(md);
    expect(blocks[0]).toMatchObject({
      kind: "code",
      lang: "sql",
      text: "SELECT 1",
    });
  });

  it("parses horizontal rule", () => {
    expect(parseMarkdown("---")).toEqual([{ kind: "rule" }]);
  });

  it("handles empty input gracefully", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown("   \n  ")).toEqual([]);
  });
});

describe("documentToMarkdown (round-trip canonical form)", () => {
  it("round-trips a paragraph", () => {
    const md = "Hello world.";
    expect(documentToMarkdown(parseMarkdown(md)).trim()).toBe(md);
  });

  it("round-trips a heading", () => {
    expect(documentToMarkdown(parseMarkdown("## a heading")).trim()).toBe(
      "## a heading",
    );
  });

  it("round-trips a table to canonical pipe form", () => {
    const md = `| A | B |
| --- | --- |
| 1 | 2 |`;
    const out = documentToMarkdown(parseMarkdown(md)).trim();
    expect(out).toContain("| A | B |");
    expect(out).toContain("| 1 | 2 |");
  });

  it("emits a placeholder for chart blocks", () => {
    const out = documentToMarkdown([
      { kind: "chart", title: "My chart", spec: {} },
    ]);
    expect(out).toContain("My chart");
    expect(out.toLowerCase()).toContain("chart");
  });
});
