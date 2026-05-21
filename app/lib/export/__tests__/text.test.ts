import { describe, expect, it } from "vitest";
import { documentToPlainText } from "../text";
import type { Block } from "../document";

describe("documentToPlainText", () => {
  it("uppercases headings", () => {
    const out = documentToPlainText([
      { kind: "heading", level: 2, inlines: [{ kind: "text", text: "Results" }] },
    ]);
    expect(out).toContain("RESULTS");
  });

  it("flattens a table to aligned monospace columns", () => {
    const block: Block = {
      kind: "table",
      headers: [
        [{ kind: "text", text: "Program" }],
        [{ kind: "text", text: "Funding" }],
      ],
      rows: [
        [
          [{ kind: "text", text: "CFDE Coordinating Center" }],
          [{ kind: "text", text: "$5,140,000" }],
        ],
        [
          [{ kind: "text", text: "LINCS" }],
          [{ kind: "text", text: "$4,220,000" }],
        ],
      ],
    };
    const out = documentToPlainText([block]);
    const lines = out.split("\n");
    // Header row, separator row, two data rows.
    expect(lines.length).toBeGreaterThanOrEqual(4);
    // Column alignment: the header "Program" and the first cell of each row
    // should start at the same character index.
    const programCol = lines[0].indexOf("Program");
    expect(lines[2].slice(programCol, programCol + 4)).toBe("CFDE");
    expect(lines[3].slice(programCol, programCol + 5)).toBe("LINCS");
    // Funding column right-padded to its widest value width.
    const fundingCol = lines[0].indexOf("Funding");
    expect(lines[2].slice(fundingCol, fundingCol + 1)).toBe("$");
  });

  it("emits a chart placeholder line for chart blocks", () => {
    const out = documentToPlainText([
      { kind: "chart", title: "Total Funding", spec: {} },
    ]);
    expect(out).toContain("Total Funding");
    expect(out.toLowerCase()).toContain("chart");
  });

  it("strips emphasis", () => {
    const out = documentToPlainText([
      {
        kind: "paragraph",
        inlines: [
          { kind: "text", text: "see " },
          { kind: "strong", inlines: [{ kind: "text", text: "important" }] },
          { kind: "text", text: " note" },
        ],
      },
    ]);
    expect(out).toContain("see important note");
    expect(out).not.toContain("**");
  });

  it("renders an ordered list with numbers", () => {
    const out = documentToPlainText([
      {
        kind: "list",
        ordered: true,
        items: [
          [{ kind: "text", text: "first" }],
          [{ kind: "text", text: "second" }],
        ],
      },
    ]);
    expect(out).toContain("1. first");
    expect(out).toContain("2. second");
  });
});
