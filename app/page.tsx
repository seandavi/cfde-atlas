"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isToolUIPart,
  type DynamicToolUIPart,
  type ToolUIPart,
} from "ai";
import { useState } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const VegaChart = dynamic(() => import("./components/VegaChart"), {
  ssr: false,
  loading: () => (
    <div className="text-xs text-zinc-500 italic">Loading chart…</div>
  ),
});

const EXAMPLE_PROMPTS = [
  "What tables do you have?",
  "Show me the top 5 publications by citation count.",
  "Plot total FY2024 funding by CFDE program.",
  "Which core projects are connected to the bridge2ai data portal repo?",
];

export default function Page() {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");

  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="flex flex-col flex-1 w-full max-w-4xl mx-auto px-4 py-6 gap-4">
      <header className="flex items-baseline justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">cfde-atlas</h1>
          <p className="text-xs text-zinc-500">
            Conversational CFDE evaluation metrics. Mock backend — figures are illustrative.
          </p>
        </div>
        <span className="text-xs font-mono text-zinc-400">{status}</span>
      </header>

      <section className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
        {messages.length === 0 && <EmptyState onPick={(p) => setInput(p)} />}
        {messages.map((m) => (
          <Message key={m.id} message={m} />
        ))}
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 border border-red-400/30 rounded p-3">
            {error.message ?? "An error occurred."}
          </div>
        )}
      </section>

      <form
        className="flex gap-2 border-t border-zinc-200 dark:border-zinc-800 pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          const text = input.trim();
          if (!text || busy) return;
          sendMessage({ text });
          setInput("");
        }}
      >
        <input
          className="flex-1 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500"
          placeholder="Ask about CFDE metrics…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="text-sm text-zinc-500 flex flex-col gap-3">
      <p>
        Ask about grants, publications, GitHub activity, or web traffic across CFDE programs.
        All data joins on NIH core project number (e.g. <span className="font-mono">U54OD036472</span>).
      </p>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            className="text-xs rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

type UIMessage = ReturnType<typeof useChat>["messages"][number];

function Message({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] uppercase tracking-wider text-zinc-400">
        {message.role}
      </div>
      <div
        className={
          "rounded-lg px-3 py-2 text-sm " +
          (isUser
            ? "bg-zinc-100 dark:bg-zinc-900 self-end max-w-[85%] whitespace-pre-wrap"
            : "bg-transparent border border-zinc-200 dark:border-zinc-800 self-start max-w-[95%] w-full")
        }
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return isUser ? (
              <span key={i}>{part.text}</span>
            ) : (
              <MarkdownText key={i} text={part.text} />
            );
          }
          if (isToolUIPart(part)) {
            return <ToolCallPart key={i} part={part} />;
          }
          return null;
        })}
      </div>
    </div>
  );
}

type ToolPart = ToolUIPart | DynamicToolUIPart;

function ToolCallPart({ part }: { part: ToolPart }) {
  const toolName =
    part.type === "dynamic-tool"
      ? part.toolName
      : part.type.replace(/^tool-/, "");

  const chart =
    toolName === "render_chart" &&
    part.state === "output-available" &&
    isChartOutput(part.output) ? (
      <div className="my-3 rounded border border-zinc-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-950">
        {part.output.title && (
          <div className="text-xs font-medium mb-2">{part.output.title}</div>
        )}
        <VegaChart spec={part.output.vega_lite_spec} />
      </div>
    ) : null;

  return (
    <>
      {chart}
      <details className="my-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 text-xs">
        <summary className="cursor-pointer px-2 py-1.5 font-mono text-zinc-600 dark:text-zinc-400">
          <span className="text-zinc-400">tool · </span>
          <span className="text-zinc-700 dark:text-zinc-200">{toolName}</span>
          <span className="text-zinc-400"> · {part.state}</span>
        </summary>
        <div className="px-2 pb-2 flex flex-col gap-2">
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
    </>
  );
}

function PreBlock({ label, value }: { label: string; value: unknown }) {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-1">
        {label}
      </div>
      <pre className="text-[11px] overflow-x-auto bg-zinc-100 dark:bg-zinc-950 rounded p-2 leading-snug">
        {text}
      </pre>
    </div>
  );
}

const markdownComponents: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc pl-5 my-2 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 my-2 space-y-0.5">{children}</ol>
  ),
  h1: ({ children }) => (
    <h1 className="text-base font-semibold mt-3 mb-2">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-semibold mt-3 mb-1.5">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-zinc-400 underline-offset-2 hover:decoration-zinc-700 dark:hover:decoration-zinc-200"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return (
        <code className="font-mono text-[12px]">{children}</code>
      );
    }
    return (
      <code className="font-mono text-[12px] rounded bg-zinc-100 dark:bg-zinc-900 px-1 py-0.5">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded bg-zinc-100 dark:bg-zinc-950 p-2 text-[12px] leading-snug">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-zinc-300 dark:border-zinc-700 pl-3 text-zinc-600 dark:text-zinc-400">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-zinc-200 dark:border-zinc-800" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-zinc-100 dark:bg-zinc-900">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border border-zinc-200 dark:border-zinc-800 px-2 py-1 text-left font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-zinc-200 dark:border-zinc-800 px-2 py-1 align-top">
      {children}
    </td>
  ),
};

function MarkdownText({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {text}
    </ReactMarkdown>
  );
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
