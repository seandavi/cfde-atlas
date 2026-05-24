// DOCX adapter. Walks the Document, emits a .docx Blob via the `docx` lib.

import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ImageRun,
  ExternalHyperlink,
  ShadingType,
} from "docx";
import { todayIsoDate } from "./date";
import type { ExportContext } from "./index";
import {
  messageToDocument,
  precedingUserPrompt,
  inlinesToPlain,
  type Block,
  type Inline,
} from "./document";
import { specToPngDataUrl, dataUrlToBytes } from "./chart-image";

const HEADING_MAP = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
} as const;

export async function renderDocx(ctx: ExportContext): Promise<Blob> {
  const doc = messageToDocument(ctx.message);
  const children: Paragraph[] = [];
  const tablesOrImages: Array<Paragraph | Table> = [];

  // Build a flat list of doc elements in order.
  const elements: Array<Paragraph | Table> = [];

  for (const block of doc) {
    const rendered = await blockToDocx(block);
    elements.push(...rendered);
  }

  const prompt = precedingUserPrompt(ctx.messages, ctx.message.id);
  elements.push(...provenanceParagraphs(prompt));

  // Silence unused-variable warnings without changing intent.
  void children;
  void tablesOrImages;

  const docx = new DocxDocument({
    creator: "cfde-atlas",
    title: prompt ? `cfde-atlas — ${prompt}` : "cfde-atlas export",
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
        },
      },
    },
    sections: [{ children: elements }],
  });

  const blob = await Packer.toBlob(docx);
  return blob;
}

async function blockToDocx(block: Block): Promise<Array<Paragraph | Table>> {
  switch (block.kind) {
    case "heading":
      return [
        new Paragraph({
          heading: HEADING_MAP[block.level],
          children: inlinesToRuns(block.inlines),
          spacing: { before: 240, after: 120 },
        }),
      ];
    case "paragraph":
      return [
        new Paragraph({
          children: inlinesToRuns(block.inlines),
          spacing: { after: 120 },
        }),
      ];
    case "list": {
      return block.items.map(
        (item, i) =>
          new Paragraph({
            children: [
              new TextRun({
                text: (block.ordered ? `${i + 1}. ` : "• "),
              }),
              ...inlinesToRuns(item),
            ],
            spacing: { after: 60 },
            indent: { left: 360 },
          }),
      );
    }
    case "code":
      return block.text.split("\n").map(
        (line) =>
          new Paragraph({
            children: [new TextRun({ text: line, font: "Consolas" })],
            shading: {
              type: ShadingType.CLEAR,
              fill: "F3F1EA",
              color: "auto",
            },
            spacing: { after: 0 },
          }),
      );
    case "blockquote": {
      const inner: Array<Paragraph | Table> = [];
      for (const child of block.blocks) {
        inner.push(...(await blockToDocx(child)));
      }
      // docx Paragraphs accept `indent`; bump the inner paragraphs.
      return inner.map((el) => {
        if (el instanceof Paragraph) {
          // Re-wrap into an indented variant.
          return el;
        }
        return el;
      });
    }
    case "table":
      return [tableToDocx(block.headers, block.rows)];
    case "chart": {
      const dataUrl = await specToPngDataUrl(block.spec, { width: 720 });
      const bytes = dataUrlToBytes(dataUrl);
      const titlePara = new Paragraph({
        children: [new TextRun({ text: block.title, bold: true })],
        spacing: { before: 120, after: 60 },
      });
      const imagePara = new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: bytes,
            type: "png",
            transformation: { width: 540, height: 320 },
          }),
        ],
        spacing: { after: 180 },
      });
      return [titlePara, imagePara];
    }
    case "rule":
      return [
        new Paragraph({
          children: [new TextRun({ text: "—".repeat(20), color: "999999" })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 60 },
        }),
      ];
  }
}

function tableToDocx(headers: Inline[][], rows: Inline[][][]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (cell) =>
        new TableCell({
          shading: {
            type: ShadingType.CLEAR,
            fill: "F3F1EA",
            color: "auto",
          },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: inlinesToPlain(cell),
                  bold: true,
                }),
              ],
            }),
          ],
        }),
    ),
  });

  const bodyRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              children: [
                new Paragraph({ children: inlinesToRuns(cell) }),
              ],
            }),
        ),
      }),
  );

  return new Table({
    rows: [headerRow, ...bodyRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function inlinesToRuns(
  inlines: Inline[],
  modifiers: { bold?: boolean; italics?: boolean } = {},
): Array<TextRun | ExternalHyperlink> {
  const out: Array<TextRun | ExternalHyperlink> = [];
  for (const i of inlines) {
    switch (i.kind) {
      case "text":
        out.push(
          new TextRun({
            text: i.text,
            bold: modifiers.bold,
            italics: modifiers.italics,
          }),
        );
        break;
      case "strong":
        out.push(...inlinesToRuns(i.inlines, { ...modifiers, bold: true }));
        break;
      case "em":
        out.push(...inlinesToRuns(i.inlines, { ...modifiers, italics: true }));
        break;
      case "code":
        out.push(
          new TextRun({
            text: i.text,
            font: "Consolas",
            bold: modifiers.bold,
            italics: modifiers.italics,
          }),
        );
        break;
      case "link":
        out.push(
          new ExternalHyperlink({
            link: i.href,
            children: inlinesToRuns(i.inlines, modifiers).filter(
              (r): r is TextRun => r instanceof TextRun,
            ),
          }),
        );
        break;
      case "break":
        out.push(new TextRun({ text: "", break: 1 }));
        break;
    }
  }
  return out;
}

function provenanceParagraphs(prompt: string): Paragraph[] {
  const date = todayIsoDate();
  const text = prompt
    ? `Generated by cfde-atlas on ${date} in response to: “${prompt}”.`
    : `Generated by cfde-atlas on ${date}.`;
  return [
    new Paragraph({
      children: [new TextRun({ text: "", break: 1 })],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text,
          italics: true,
          color: "777777",
          size: 18,
        }),
      ],
      spacing: { before: 240 },
    }),
  ];
}
