// PDF adapter. Walks the Document, emits a .pdf Blob via pdfmake.
//
// pdfmake takes a JSON document definition (`content: []`) which is a
// good fit for our Block-walking architecture. The font bundle is heavy;
// this module is only imported on demand from app/lib/export/index.ts.

import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

import type { Content, TDocumentDefinitions, TableCell } from "pdfmake/interfaces";

import type { ExportContext } from "./index";
import {
  messageToDocument,
  precedingUserPrompt,
  inlinesToPlain,
  type Block,
  type Inline,
} from "./document";
import { specToPngDataUrl } from "./chart-image";

// pdfmake's browser bundle ships its fonts via a virtualfs blob.
// Different builds expose it slightly differently — handle both shapes.
type VfsBundle = { pdfMake?: { vfs?: Record<string, string> }; vfs?: Record<string, string> };
function installFonts() {
  const bundle = pdfFonts as VfsBundle;
  const vfs = bundle.vfs ?? bundle.pdfMake?.vfs;
  if (vfs) {
    (pdfMake as { vfs?: Record<string, string> }).vfs = vfs;
  }
}

export async function renderPdf(ctx: ExportContext): Promise<Blob> {
  installFonts();

  const doc = messageToDocument(ctx.message);
  const content: Content[] = [];
  for (const block of doc) {
    const rendered = await blockToPdf(block);
    if (Array.isArray(rendered)) {
      content.push(...rendered);
    } else {
      content.push(rendered);
    }
  }

  const prompt = precedingUserPrompt(ctx.messages, ctx.message.id);
  content.push(provenanceLine(prompt));

  const definition: TDocumentDefinitions = {
    pageSize: "LETTER",
    pageMargins: [54, 54, 54, 60],
    defaultStyle: {
      font: "Roboto",
      fontSize: 10.5,
      lineHeight: 1.35,
      color: "#1a1c20",
    },
    styles: {
      h1: { fontSize: 18, bold: true, margin: [0, 12, 0, 6] },
      h2: { fontSize: 15, bold: true, margin: [0, 10, 0, 5] },
      h3: { fontSize: 12.5, bold: true, margin: [0, 8, 0, 4] },
      h4: { fontSize: 11.5, bold: true, margin: [0, 6, 0, 3] },
      h5: { fontSize: 11, bold: true, margin: [0, 6, 0, 3] },
      h6: { fontSize: 10.5, bold: true, margin: [0, 6, 0, 3] },
      tableHeader: { bold: true, fillColor: "#f3f1ea" },
      provenance: { italics: true, color: "#6b6e74", fontSize: 9 },
      chartTitle: { bold: true, margin: [0, 6, 0, 4] },
      mono: { fontSize: 9.5 },
    },
    content,
  };

  return pdfMake.createPdf(definition).getBlob();
}

async function blockToPdf(block: Block): Promise<Content | Content[]> {
  switch (block.kind) {
    case "heading":
      return {
        text: inlinesToPdfText(block.inlines),
        style: `h${block.level}` as "h1",
      };
    case "paragraph":
      return {
        text: inlinesToPdfText(block.inlines),
        margin: [0, 0, 0, 6],
      };
    case "list":
      return block.ordered
        ? { ol: block.items.map((item) => inlinesToPdfText(item)) }
        : { ul: block.items.map((item) => inlinesToPdfText(item)) };
    case "table":
      return tableToPdf(block.headers, block.rows);
    case "code":
      return {
        text: block.text,
        style: "mono",
        margin: [0, 0, 0, 6],
        preserveLeadingSpaces: true,
      };
    case "blockquote": {
      const inner: Content[] = [];
      for (const child of block.blocks) {
        const r = await blockToPdf(child);
        if (Array.isArray(r)) inner.push(...r);
        else inner.push(r);
      }
      return {
        stack: inner,
        margin: [12, 0, 0, 6],
      };
    }
    case "chart": {
      const dataUrl = await specToPngDataUrl(block.spec, { width: 720 });
      return [
        { text: block.title, style: "chartTitle" },
        {
          image: dataUrl,
          width: 480,
          margin: [0, 0, 0, 12],
        },
      ];
    }
    case "rule":
      return {
        canvas: [
          { type: "line", x1: 0, y1: 4, x2: 500, y2: 4, lineColor: "#cccccc" },
        ],
        margin: [0, 4, 0, 8],
      };
  }
}

function tableToPdf(headers: Inline[][], rows: Inline[][][]): Content {
  const headerRow: TableCell[] = headers.map((cell) => ({
    text: inlinesToPdfText(cell),
    style: "tableHeader",
  }));
  const bodyRows: TableCell[][] = rows.map((row) =>
    row.map((cell): TableCell => ({ text: inlinesToPdfText(cell) })),
  );
  return {
    table: {
      headerRows: 1,
      widths: headers.map(() => "*"),
      body: [headerRow, ...bodyRows],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#e6e2d6",
      vLineColor: () => "#e6e2d6",
      paddingTop: () => 4,
      paddingBottom: () => 4,
      paddingLeft: () => 6,
      paddingRight: () => 6,
    },
    margin: [0, 4, 0, 10],
  };
}

type PdfTextRun =
  | string
  | {
      text: string;
      bold?: boolean;
      italics?: boolean;
      link?: string;
      style?: string;
    };

function inlinesToPdfText(
  inlines: Inline[],
  modifiers: { bold?: boolean; italics?: boolean; href?: string; style?: string } = {},
): PdfTextRun[] {
  const out: PdfTextRun[] = [];
  for (const i of inlines) {
    switch (i.kind) {
      case "text":
        out.push({
          text: i.text,
          bold: modifiers.bold,
          italics: modifiers.italics,
          link: modifiers.href,
          style: modifiers.style,
        });
        break;
      case "strong":
        out.push(
          ...inlinesToPdfText(i.inlines, { ...modifiers, bold: true }),
        );
        break;
      case "em":
        out.push(
          ...inlinesToPdfText(i.inlines, { ...modifiers, italics: true }),
        );
        break;
      case "code":
        out.push({
          text: i.text,
          style: "mono",
          bold: modifiers.bold,
          italics: modifiers.italics,
        });
        break;
      case "link":
        out.push(
          ...inlinesToPdfText(i.inlines, {
            ...modifiers,
            href: i.href,
          }),
        );
        break;
      case "break":
        out.push("\n");
        break;
    }
  }
  return out;
}

function provenanceLine(prompt: string): Content {
  const date = new Date().toISOString().slice(0, 10);
  const text = prompt
    ? `Generated by cfde-atlas on ${date} in response to: “${prompt}”.`
    : `Generated by cfde-atlas on ${date}.`;
  return {
    text,
    style: "provenance",
    margin: [0, 24, 0, 0],
  };
}

// Silence unused-import warnings for re-exports above.
void inlinesToPlain;
