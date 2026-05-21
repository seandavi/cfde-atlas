// Plain-text serializer. Tables flattened to aligned monospace columns;
// emphasis stripped; chart placeholder line.

import type { Block, Document, Inline } from "./document";
import { inlinesToPlain } from "./document";

export function documentToPlainText(doc: Document): string {
  return doc.map(blockToText).join("\n\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function blockToText(block: Block): string {
  switch (block.kind) {
    case "heading":
      return inlinesToPlain(block.inlines).toUpperCase();
    case "paragraph":
      return wrap(inlinesToPlain(block.inlines), 78);
    case "list": {
      const marker = (i: number) => (block.ordered ? `${i + 1}. ` : "  - ");
      return block.items
        .map((item, i) => marker(i) + inlinesToPlain(item))
        .join("\n");
    }
    case "table":
      return tableToText(block.headers, block.rows);
    case "code":
      return block.text;
    case "blockquote":
      return block.blocks
        .map(blockToText)
        .join("\n\n")
        .split("\n")
        .map((line) => "  " + line)
        .join("\n");
    case "chart":
      return `[Chart: ${block.title} — rendered in PDF / DOCX exports]`;
    case "rule":
      return "─".repeat(60);
  }
}

function tableToText(headers: Inline[][], rows: Inline[][][]): string {
  const headerStrs = headers.map(inlinesToPlain);
  const rowStrs = rows.map((row) => row.map(inlinesToPlain));
  const widths = headerStrs.map((h, c) =>
    Math.max(h.length, ...rowStrs.map((r) => (r[c] ?? "").length)),
  );
  const fmt = (cells: string[]) =>
    cells.map((cell, c) => cell.padEnd(widths[c])).join("  ");
  const lines: string[] = [];
  lines.push(fmt(headerStrs));
  lines.push(widths.map((w) => "─".repeat(w)).join("  "));
  for (const row of rowStrs) {
    // Backfill short rows.
    const padded = widths.map((_, c) => row[c] ?? "");
    lines.push(fmt(padded));
  }
  return lines.join("\n");
}

function wrap(text: string, width: number): string {
  if (text.length <= width) return text;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (current.length + 1 + word.length > width) {
      lines.push(current);
      current = word;
    } else {
      current += " " + word;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}
