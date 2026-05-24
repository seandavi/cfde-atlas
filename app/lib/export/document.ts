// Intermediate document model — see docs/decisions/0002-export-document-model.md
//
// Parse the markdown an assistant message emitted into a typed Block[]. The
// five export adapters (md, txt, clipboard, docx, pdf) each walk this same
// model, so adding a sixth format is one adapter, not one parser per format.

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { isToolUIPart, type UIMessage } from "ai";
import { toolNameOf } from "../tools/part-name";
import type {
  Root,
  RootContent,
  PhrasingContent,
  Heading,
  ListItem,
  BlockContent,
  DefinitionContent,
  TableRow,
} from "mdast";

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; inlines: Inline[] }
  | { kind: "em"; inlines: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "link"; href: string; inlines: Inline[] }
  | { kind: "break" };

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type Block =
  | { kind: "heading"; level: HeadingLevel; inlines: Inline[] }
  | { kind: "paragraph"; inlines: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] }
  | { kind: "table"; headers: Inline[][]; rows: Inline[][][] }
  | { kind: "code"; lang: string | null; text: string }
  | { kind: "blockquote"; blocks: Block[] }
  | { kind: "chart"; title: string; spec: unknown }
  | { kind: "rule" };

export type Document = Block[];

export function parseMarkdown(md: string): Block[] {
  if (!md.trim()) return [];
  const tree = unified().use(remarkParse).use(remarkGfm).parse(md) as Root;
  return tree.children.flatMap(walkBlock);
}

/**
 * Build a Document from a UIMessage. Text parts are parsed as markdown;
 * render_chart tool outputs become chart blocks carrying the spec (image
 * rendering is deferred to adapters that need it). All other tool parts
 * are dropped — they are agent breadcrumbs, not deliverable content.
 */
export function messageToDocument(message: UIMessage): Document {
  const blocks: Block[] = [];
  for (const part of message.parts) {
    if (part.type === "text") {
      blocks.push(...parseMarkdown(part.text));
      continue;
    }
    if (
      isToolUIPart(part) &&
      toolNameOf(part) === "render_chart" &&
      part.state === "output-available"
    ) {
      const out = part.output;
      if (isChartOutput(out)) {
        blocks.push({
          kind: "chart",
          title: out.title ?? "Figure",
          spec: out.vega_lite_spec,
        });
      }
    }
  }
  return blocks;
}

/**
 * The user's question for the conversation turn that produced `assistantId`.
 * Used for filename slugging and provenance footers.
 */
export function precedingUserPrompt(
  messages: readonly UIMessage[],
  assistantId: string,
): string {
  const idx = messages.findIndex((m) => m.id === assistantId);
  if (idx < 0) return "";
  for (let i = idx - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      return messages[i].parts
        .filter(
          (p): p is Extract<UIMessage["parts"][number], { type: "text" }> =>
            p.type === "text",
        )
        .map((p) => p.text)
        .join(" ")
        .trim();
    }
  }
  return "";
}

/* ---------------- mdast → Block walkers ---------------- */

function walkBlock(node: RootContent): Block[] {
  switch (node.type) {
    case "paragraph":
      return [
        { kind: "paragraph", inlines: node.children.flatMap(walkInline) },
      ];
    case "heading":
      return [
        {
          kind: "heading",
          level: clampHeading((node as Heading).depth),
          inlines: node.children.flatMap(walkInline),
        },
      ];
    case "list":
      return [
        {
          kind: "list",
          ordered: Boolean(node.ordered),
          items: (node.children as ListItem[]).map(walkListItem),
        },
      ];
    case "code":
      return [
        { kind: "code", lang: node.lang ?? null, text: node.value ?? "" },
      ];
    case "blockquote":
      return [
        {
          kind: "blockquote",
          blocks: (node.children as RootContent[]).flatMap(walkBlock),
        },
      ];
    case "thematicBreak":
      return [{ kind: "rule" }];
    case "table": {
      const rows = (node.children as TableRow[]).map((row) =>
        row.children.map((cell) => cell.children.flatMap(walkInline)),
      );
      const [headers, ...body] = rows;
      return [
        {
          kind: "table",
          headers: headers ?? [],
          rows: body,
        },
      ];
    }
    case "html":
    case "yaml":
      // Drop raw HTML / frontmatter. The model rarely emits these.
      return [];
    default:
      return [];
  }
}

function walkListItem(item: ListItem): Inline[] {
  // Most list items hold a single paragraph; lift its inlines. For nested
  // lists or code blocks inside an item, fall back to flat text.
  const inlines: Inline[] = [];
  for (const child of item.children as Array<BlockContent | DefinitionContent>) {
    if (child.type === "paragraph") {
      inlines.push(...child.children.flatMap(walkInline));
    } else {
      inlines.push({ kind: "text", text: textContentOf(child) });
    }
  }
  return inlines;
}

function walkInline(node: PhrasingContent): Inline[] {
  switch (node.type) {
    case "text":
      return [{ kind: "text", text: node.value }];
    case "strong":
      return [{ kind: "strong", inlines: node.children.flatMap(walkInline) }];
    case "emphasis":
      return [{ kind: "em", inlines: node.children.flatMap(walkInline) }];
    case "inlineCode":
      return [{ kind: "code", text: node.value }];
    case "link":
      return [
        {
          kind: "link",
          href: node.url,
          inlines: node.children.flatMap(walkInline),
        },
      ];
    case "break":
      return [{ kind: "break" }];
    case "delete":
      // GFM strikethrough — flatten to plain text. Adapters can opt in later.
      return node.children.flatMap(walkInline);
    case "image":
      return [
        {
          kind: "link",
          href: node.url,
          inlines: [{ kind: "text", text: node.alt ?? node.url }],
        },
      ];
    default:
      return [];
  }
}

function textContentOf(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { value?: unknown; children?: unknown };
  if (typeof n.value === "string") return n.value;
  if (Array.isArray(n.children)) return n.children.map(textContentOf).join("");
  return "";
}

function clampHeading(depth: number): HeadingLevel {
  if (depth < 1) return 1;
  if (depth > 6) return 6;
  return depth as HeadingLevel;
}

/* ---------------- Helpers exported for adapters ---------------- */

export function inlinesToPlain(inlines: Inline[]): string {
  return inlines
    .map((i) => {
      switch (i.kind) {
        case "text":
          return i.text;
        case "strong":
        case "em":
          return inlinesToPlain(i.inlines);
        case "code":
          return i.text;
        case "link":
          return inlinesToPlain(i.inlines);
        case "break":
          return "\n";
      }
    })
    .join("");
}

function isChartOutput(
  value: unknown,
): value is { vega_lite_spec: unknown; title?: string } {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    "vega_lite_spec" in v &&
    typeof v.vega_lite_spec === "object" &&
    v.vega_lite_spec !== null
  );
}
