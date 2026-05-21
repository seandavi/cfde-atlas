// Markdown serializer — walks our Document and produces GFM markdown.
//
// This is intentionally NOT a round-trip-of-the-input-bytes serializer.
// The input markdown can vary in whitespace and quoting; we re-emit a
// canonical GFM rendering that all five adapters share as a baseline.

import type { Block, Document, Inline } from "./document";
import { inlinesToPlain } from "./document";

export type MarkdownOptions = {
  /** Chart blocks emit a placeholder line — md cannot embed Vega-Lite specs. */
  chartPlaceholder?: (title: string) => string;
};

const defaultChartPlaceholder = (title: string) =>
  `_[Chart: ${title} — rendered in PDF / DOCX exports, omitted in text export.]_`;

export function documentToMarkdown(
  doc: Document,
  opts: MarkdownOptions = {},
): string {
  const chartLine = opts.chartPlaceholder ?? defaultChartPlaceholder;
  return doc.map((b) => blockToMarkdown(b, chartLine)).join("\n\n").trim() + "\n";
}

function blockToMarkdown(
  block: Block,
  chartLine: (title: string) => string,
): string {
  switch (block.kind) {
    case "heading":
      return "#".repeat(block.level) + " " + inlinesToMd(block.inlines);
    case "paragraph":
      return inlinesToMd(block.inlines);
    case "list": {
      const marker = (i: number) => (block.ordered ? `${i + 1}.` : "-");
      return block.items
        .map((item, i) => `${marker(i)} ${inlinesToMd(item)}`)
        .join("\n");
    }
    case "table":
      return tableToMarkdown(block.headers, block.rows);
    case "code":
      return "```" + (block.lang ?? "") + "\n" + block.text + "\n```";
    case "blockquote":
      return block.blocks
        .map((b) => blockToMarkdown(b, chartLine))
        .join("\n\n")
        .split("\n")
        .map((line) => "> " + line)
        .join("\n");
    case "chart":
      return chartLine(block.title);
    case "rule":
      return "---";
  }
}

function tableToMarkdown(headers: Inline[][], rows: Inline[][][]): string {
  if (headers.length === 0) return "";
  const headerLine = "| " + headers.map(inlinesToMd).join(" | ") + " |";
  const separator = "| " + headers.map(() => "---").join(" | ") + " |";
  const rowLines = rows.map(
    (row) => "| " + row.map(inlinesToMd).join(" | ") + " |",
  );
  return [headerLine, separator, ...rowLines].join("\n");
}

function inlinesToMd(inlines: Inline[]): string {
  return inlines
    .map((i) => {
      switch (i.kind) {
        case "text":
          return i.text;
        case "strong":
          return `**${inlinesToMd(i.inlines)}**`;
        case "em":
          return `*${inlinesToMd(i.inlines)}*`;
        case "code":
          return `\`${i.text}\``;
        case "link":
          return `[${inlinesToMd(i.inlines)}](${i.href})`;
        case "break":
          return "  \n";
      }
    })
    .join("");
}

/** Re-export for adapters that want the plain-text projection. */
export { inlinesToPlain };
