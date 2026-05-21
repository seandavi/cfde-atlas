"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isToolUIPart,
  type DynamicToolUIPart,
  type ToolUIPart,
} from "ai";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const VegaChart = dynamic(() => import("./components/VegaChart"), {
  ssr: false,
  loading: () => (
    <div className="text-xs text-foreground-faint italic px-1 py-2">
      Loading chart…
    </div>
  ),
});

const ExportBar = dynamic(() => import("./components/ExportBar"), {
  ssr: false,
});

const EXAMPLE_PROMPTS = [
  {
    prompt: "What tables do you have?",
    hint: "Orient yourself in the available data.",
  },
  {
    prompt: "Show me the top 5 publications by citation count.",
    hint: "Joins publications across all CFDE programs.",
  },
  {
    prompt: "Plot total FY2024 funding by CFDE program.",
    hint: "Produces a horizontal bar chart and the underlying table.",
  },
  {
    prompt: "Which core projects sit behind the bridge2ai data portal repo?",
    hint: "Resolves a GitHub repo to its NIH core project numbers.",
  },
] as const;

const TOOL_LABEL: Record<string, string> = {
  list_tables: "Looking up available tables",
  describe_table: "Reading schema",
  run_query: "Running query",
  render_chart: "Building chart",
};

type UIMessage = ReturnType<typeof useChat>["messages"][number];
type Part = UIMessage["parts"][number];
type ToolPart = ToolUIPart | DynamicToolUIPart;

export default function Page() {
  const { messages, sendMessage, status, stop, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 240) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages, status]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
  };

  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto] bg-background text-foreground">
      <Header />

      <main
        ref={scrollRef}
        className="overflow-y-auto scroll-smooth"
        aria-live="polite"
      >
        <div className="mx-auto w-full max-w-3xl px-5 py-10 flex flex-col gap-8">
          {messages.length === 0 ? (
            <EmptyState onPick={(p) => setInput(p)} />
          ) : (
            messages.map((m, i) => (
              <Message
                key={m.id}
                message={m}
                allMessages={messages}
                inFlight={busy && i === messages.length - 1}
              />
            ))
          )}
          {error && <ErrorBanner message={error.message} />}
        </div>
      </main>

      <Composer
        input={input}
        setInput={setInput}
        onSubmit={() => submit(input)}
        onStop={stop}
        status={status}
        busy={busy}
      />
    </div>
  );
}

/* ---------------- Header ---------------- */

function Header() {
  return (
    <header className="border-b border-border bg-background/85 backdrop-blur px-5 py-3">
      <div className="mx-auto w-full max-w-3xl flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[13px] tracking-wider uppercase text-accent">
            cfde-atlas
          </span>
          <span className="text-xs text-foreground-muted hidden sm:block">
            CFDE evaluation metrics, conversationally
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-foreground-faint">
          mock backend
        </span>
      </div>
    </header>
  );
}

/* ---------------- Empty state ---------------- */

function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex flex-col gap-7 mt-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Ask the atlas.
        </h1>
        <p className="text-foreground-muted max-w-prose">
          Bibliometrics, grants, GitHub activity, and web traffic across CFDE programs,
          joined on NIH core project number (e.g.{" "}
          <span className="font-mono text-foreground">U54OD036472</span>). Built for
          Council of Councils preparation.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {EXAMPLE_PROMPTS.map(({ prompt, hint }) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPick(prompt)}
            className="text-left rounded-lg border border-border bg-surface hover:border-border-strong hover:bg-surface-muted transition-colors px-4 py-3 group"
          >
            <div className="text-sm text-foreground group-hover:text-foreground">
              {prompt}
            </div>
            <div className="text-xs text-foreground-muted mt-1">{hint}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Message ---------------- */

function Message({
  message,
  allMessages,
  inFlight,
}: {
  message: UIMessage;
  allMessages: readonly UIMessage[];
  inFlight: boolean;
}) {
  if (message.role === "user") {
    return <UserMessage message={message} />;
  }
  return (
    <AssistantMessage
      message={message}
      allMessages={allMessages}
      inFlight={inFlight}
    />
  );
}

function UserMessage({ message }: { message: UIMessage }) {
  const text = message.parts
    .filter((p): p is Extract<Part, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("\n");
  if (!text) return null;
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent-soft text-accent-soft-fg px-4 py-2.5 text-[14.5px] whitespace-pre-wrap cfde-fade-in">
        {text}
      </div>
    </div>
  );
}

function AssistantMessage({
  message,
  allMessages,
  inFlight,
}: {
  message: UIMessage;
  allMessages: readonly UIMessage[];
  inFlight: boolean;
}) {
  const toolParts = message.parts.filter(isToolUIPart);
  const hasContent = message.parts.some(
    (p) =>
      (p.type === "text" && p.text.trim().length > 0) ||
      (isToolUIPart(p) &&
        p.type === "tool-render_chart" &&
        p.state === "output-available"),
  );

  return (
    <div className="flex flex-col gap-3 cfde-fade-in">
      {inFlight ? (
        <InFlightTrail toolParts={toolParts} />
      ) : (
        toolParts.length > 0 && <CompletedTrail toolParts={toolParts} />
      )}

      {message.parts.map((part, i) => {
        if (part.type === "text") {
          return part.text ? <MarkdownText key={i} text={part.text} /> : null;
        }
        if (isToolUIPart(part)) {
          return <ChartFromTool key={i} part={part} />;
        }
        return null;
      })}

      {!inFlight && hasContent && (
        <ExportBar messages={allMessages} message={message} />
      )}
    </div>
  );
}

function ErrorBanner({ message }: { message?: string }) {
  return (
    <div className="rounded-lg border border-danger/40 bg-danger-soft text-danger text-sm px-4 py-3">
      {message ?? "Something went wrong."}
    </div>
  );
}

/* ---------------- Tool trail ---------------- */

function InFlightTrail({ toolParts }: { toolParts: ToolPart[] }) {
  const active = activeToolPart(toolParts);
  const label = active ? humaneLabel(toolNameOf(active)) : "Thinking";
  const stepCount = toolParts.length;
  return (
    <div className="inline-flex items-center gap-3 self-start rounded-full bg-accent-soft text-accent-soft-fg border border-accent/25 px-4 py-2 text-[13.5px] font-medium shadow-sm">
      <span className="relative inline-flex items-center justify-center w-3 h-3 shrink-0">
        <span className="absolute inline-block w-3 h-3 rounded-full bg-accent/30 cfde-pulse" />
        <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-accent" />
      </span>
      <span>
        {label}
        <DotDotDot />
      </span>
      {stepCount > 0 && (
        <span className="text-[11px] font-normal text-accent-soft-fg/70 border-l border-accent/25 pl-3 ml-1">
          step {stepCount}
        </span>
      )}
    </div>
  );
}

function DotDotDot() {
  // Renders an animated ellipsis without a layout shift.
  return (
    <span aria-hidden className="font-mono text-foreground-faint">
      <span className="cfde-pulse">.</span>
      <span className="cfde-pulse" style={{ animationDelay: "0.25s" }}>.</span>
      <span className="cfde-pulse" style={{ animationDelay: "0.5s" }}>.</span>
    </span>
  );
}

function CompletedTrail({ toolParts }: { toolParts: ToolPart[] }) {
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

function ChartFromTool({ part }: { part: ToolPart }) {
  if (toolNameOf(part) !== "render_chart") return null;
  if (part.state !== "output-available") return null;
  if (!isChartOutput(part.output)) return null;
  return (
    <figure className="my-1 rounded-lg border border-border bg-surface p-4">
      {part.output.title && (
        <figcaption className="text-sm font-medium mb-3 text-foreground">
          {part.output.title}
        </figcaption>
      )}
      <VegaChart spec={part.output.vega_lite_spec} />
    </figure>
  );
}

/* ---------------- Composer ---------------- */

function Composer({
  input,
  setInput,
  onSubmit,
  onStop,
  status,
  busy,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  status: "submitted" | "streaming" | "ready" | "error";
  busy: boolean;
}) {
  const dotClass =
    status === "error"
      ? "bg-danger"
      : busy
        ? "bg-accent cfde-pulse"
        : "bg-accent/60";

  return (
    <div className="border-t border-border bg-background/95 backdrop-blur shadow-[0_-1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_-1px_2px_rgba(0,0,0,0.4)]">
      <div className="mx-auto w-full max-w-3xl px-5 py-3">
        <form
          className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 focus-within:border-accent transition-colors"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <span
            className={`inline-block w-2 h-2 rounded-full shrink-0 ${dotClass}`}
            aria-label={`status: ${status}`}
            title={status}
          />
          <input
            className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-foreground-faint"
            placeholder="Ask about CFDE metrics…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
          {busy ? (
            <button
              type="button"
              onClick={onStop}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-surface-muted"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-accent text-accent-fg disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-95 transition-opacity"
            >
              Send
            </button>
          )}
        </form>
        <div className="text-[10px] text-foreground-faint mt-2 text-center">
          Mocked sample data. Verify against source systems before citing in any briefing.
        </div>
      </div>
    </div>
  );
}

/* ---------------- Markdown ---------------- */

const markdownComponents: Components = {
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
  pre: ({ children }) => (
    <pre className="my-2.5 overflow-x-auto rounded-md bg-surface-muted border border-border p-3 text-[12.5px] leading-snug font-mono">
      {children}
    </pre>
  ),
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

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="text-[14.5px] leading-relaxed text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

/* ---------------- Helpers ---------------- */

function toolNameOf(part: ToolPart): string {
  return part.type === "dynamic-tool"
    ? part.toolName
    : part.type.replace(/^tool-/, "");
}

function humaneLabel(toolName: string): string {
  return TOOL_LABEL[toolName] ?? `Calling ${toolName}`;
}

function activeToolPart(toolParts: ToolPart[]): ToolPart | null {
  // The "current step" is the most recent tool that hasn't yielded
  // output yet. If all tools have output, the model is either between
  // steps or generating text — caller falls back to "Thinking".
  for (let i = toolParts.length - 1; i >= 0; i--) {
    const p = toolParts[i];
    if (p.state === "input-streaming" || p.state === "input-available") {
      return p;
    }
  }
  return null;
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
