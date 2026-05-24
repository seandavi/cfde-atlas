"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { isToolUIPart } from "ai";

import { CopyButton } from "./CopyButton";
import { toolNameOf, type ToolPart } from "@/app/lib/tools/part-name";
import { trackChartRendered } from "@/app/lib/analytics";

export { toolNameOf, type ToolPart };

const VegaChart = dynamic(() => import("./VegaChart"), {
  ssr: false,
  loading: () => (
    <div className="text-xs text-foreground-faint italic px-1 py-2">
      Loading chart…
    </div>
  ),
});

const Mermaid = dynamic(() => import("./Mermaid"), {
  ssr: false,
  loading: () => (
    <div className="text-xs text-foreground-faint italic px-1 py-2">
      Loading diagram…
    </div>
  ),
});

type MermaidProbe = {
  className?: string;
  children?: unknown;
};

function extractCodeText(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.map(extractCodeText).join("");
  if (raw && typeof raw === "object") {
    const node = raw as { props?: { children?: unknown } };
    if (node.props && "children" in node.props) {
      return extractCodeText(node.props.children);
    }
  }
  return "";
}

function findCodeChild(children: unknown):
  | { className: string | undefined; raw: unknown }
  | null {
  if (!children || typeof children !== "object") return null;
  const arr = Array.isArray(children) ? children : [children];
  for (const child of arr) {
    if (!child || typeof child !== "object") continue;
    const node = child as { props?: MermaidProbe };
    if (!node.props) continue;
    return {
      className:
        typeof node.props.className === "string"
          ? node.props.className
          : undefined,
      raw: node.props.children,
    };
  }
  return null;
}

function extractMermaidSource(children: unknown): string | null {
  const found = findCodeChild(children);
  if (!found?.className) return null;
  if (!/(^|\s)language-mermaid(\s|$)/.test(found.className)) return null;
  return extractCodeText(found.raw).replace(/\n$/, "");
}

/* ---------------- Markdown ---------------- */

export const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="my-2.5 first:mt-0 last:mb-0 text-[14.5px] leading-relaxed">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 my-2 space-y-1 text-[14.5px]">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 my-2 space-y-1 text-[14.5px]">
      {children}
    </ol>
  ),
  h1: ({ children }) => (
    <h1 className="text-lg font-semibold mt-4 mb-2 tracking-tight">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-semibold mt-4 mb-2 tracking-tight">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold mt-3 mb-1.5 tracking-tight text-foreground">
      {children}
    </h3>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent transition-colors"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return <code className="font-mono text-[12.5px]">{children}</code>;
    }
    return (
      <code className="font-mono text-[12.5px] rounded bg-surface-muted px-1 py-0.5">
        {children}
      </code>
    );
  },
  pre: ({ children }) => {
    const src = extractMermaidSource(children);
    if (src) return <Mermaid chart={src} />;
    const found = findCodeChild(children);
    const copyText = found ? extractCodeText(found.raw).replace(/\n$/, "") : "";
    return (
      <div className="relative group my-2.5">
        <pre className="overflow-x-auto rounded-md bg-surface-muted border border-border p-3 text-[12.5px] leading-snug font-mono">
          {children}
        </pre>
        {copyText && <CopyButton text={copyText} />}
      </div>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="my-2.5 border-l-2 border-accent/40 pl-3 text-foreground-muted italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-border" />,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-surface-muted text-foreground-muted text-[11px] uppercase tracking-wider">
      {children}
    </thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-medium border-b border-border">
      {children}
    </th>
  ),
  tr: ({ children }) => (
    <tr className="border-b border-border last:border-b-0">{children}</tr>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 align-top text-foreground">{children}</td>
  ),
};

export function MarkdownText({ text }: { text: string }) {
  return (
    <div className="text-[14.5px] leading-relaxed text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

/* ---------------- Chart ---------------- */

export function isChartOutput(
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

export function ChartFromTool({ part }: { part: ToolPart }) {
  if (toolNameOf(part) !== "render_chart") return null;
  if (part.state !== "output-available") return null;
  if (!isChartOutput(part.output)) return null;
  return <Chart spec={part.output.vega_lite_spec} title={part.output.title} />;
}

function Chart({ spec, title }: { spec: unknown; title?: string }) {
  // Fires once per spec — re-renders during streaming reuse the same
  // identity, so the dependency keeps the count honest.
  useEffect(() => {
    trackChartRendered();
  }, [spec]);
  return (
    <figure className="my-1 rounded-lg border border-border bg-surface p-4">
      {title && (
        <figcaption className="text-sm font-medium mb-3 text-foreground">
          {title}
        </figcaption>
      )}
      <VegaChart spec={spec} />
    </figure>
  );
}

/* ---------------- Tool trail ---------------- */

export function CompletedTrail({ toolParts }: { toolParts: ToolPart[] }) {
  const count = toolParts.length;
  return (
    <details className="group rounded-md border border-border bg-surface-muted text-xs">
      <summary className="cursor-pointer list-none px-3 py-1.5 flex items-center gap-2 text-foreground-muted hover:text-foreground min-w-0">
        <Chevron />
        <span className="shrink-0 whitespace-nowrap">
          <span className="font-medium text-foreground">{count}</span>{" "}
          reasoning step{count === 1 ? "" : "s"}
        </span>
        <span className="shrink-0 text-foreground-faint">·</span>
        <span className="font-mono truncate min-w-0 flex-1">
          {toolParts.map((p) => toolNameOf(p)).join(" → ")}
        </span>
      </summary>
      <div className="px-3 pb-3 pt-1 flex flex-col gap-2 border-t border-border">
        {toolParts.map((p, i) => (
          <ToolDetail key={i} part={p} />
        ))}
      </div>
    </details>
  );
}

function Chevron() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className="text-foreground-faint transition-transform group-open:rotate-90"
      aria-hidden
    >
      <path
        d="M3 1.5 L7 5 L3 8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ToolDetail({ part }: { part: ToolPart }) {
  const name = toolNameOf(part);
  const stateLabel = part.state.replace(/-/g, " ");
  return (
    <details className="rounded border border-border bg-surface">
      <summary className="cursor-pointer list-none px-2.5 py-1.5 font-mono text-[11px] text-foreground-muted hover:text-foreground flex items-center gap-2">
        <Chevron />
        <span className="text-foreground">{name}</span>
        <span className="text-foreground-faint">· {stateLabel}</span>
      </summary>
      <div className="px-2.5 pb-2.5 pt-1 flex flex-col gap-2 border-t border-border">
        {"input" in part && part.input !== undefined && (
          <PreBlock label="input" value={part.input} />
        )}
        {part.state === "output-available" && "output" in part && (
          <PreBlock label="output" value={part.output} />
        )}
        {part.state === "output-error" && "errorText" in part && (
          <PreBlock label="error" value={part.errorText} />
        )}
      </div>
    </details>
  );
}

function PreBlock({ label, value }: { label: string; value: unknown }) {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-foreground-faint mb-1">
        {label}
      </div>
      <pre className="text-[11px] overflow-x-auto bg-background rounded p-2 leading-snug font-mono text-foreground-muted">
        {text}
      </pre>
    </div>
  );
}

/* ---------------- Whole-message rendering ---------------- */

type AnyUIMessage = {
  id: string;
  role: string;
  parts: Array<Record<string, unknown>>;
};

type RenderableMessage = {
  id: string;
  role: string;
  parts: ReadonlyArray<unknown>;
};

export function StaticUserMessage({ message }: { message: RenderableMessage }) {
  const text = message.parts
    .filter(
      (p): p is { type: "text"; text: string } =>
        !!p &&
        typeof p === "object" &&
        (p as Record<string, unknown>).type === "text" &&
        typeof (p as Record<string, unknown>).text === "string",
    )
    .map((p) => p.text)
    .join("\n");
  if (!text) return null;
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent-soft text-accent-soft-fg px-4 py-2.5 text-[14.5px] whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}

export function StaticAssistantMessage({
  message,
}: {
  message: RenderableMessage;
}) {
  // Persisted JSONB shape — same SDK UIMessage parts, but typed loosely here
  // since the JSONB round-trip strips literal types.
  const partsArr = message.parts as ReadonlyArray<{
    type: string;
    text?: unknown;
  }>;
  const toolParts: ToolPart[] = [];
  for (const p of partsArr) {
    if (isToolUIPart(p as unknown as ToolPart)) {
      toolParts.push(p as unknown as ToolPart);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {toolParts.length > 0 && <CompletedTrail toolParts={toolParts} />}
      {partsArr.map((part, i) => {
        if (part.type === "text" && typeof part.text === "string") {
          return part.text ? <MarkdownText key={i} text={part.text} /> : null;
        }
        if (isToolUIPart(part as unknown as ToolPart)) {
          return <ChartFromTool key={i} part={part as unknown as ToolPart} />;
        }
        return null;
      })}
    </div>
  );
}

export function StaticTranscript({
  messages,
}: {
  messages: ReadonlyArray<AnyUIMessage>;
}) {
  return (
    <div className="flex flex-col gap-8">
      {messages.map((m) =>
        m.role === "user" ? (
          <StaticUserMessage
            key={m.id}
            message={m as unknown as RenderableMessage}
          />
        ) : (
          <StaticAssistantMessage
            key={m.id}
            message={m as unknown as RenderableMessage}
          />
        ),
      )}
    </div>
  );
}
