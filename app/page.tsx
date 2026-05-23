"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isToolUIPart,
  type DynamicToolUIPart,
  type ToolUIPart,
  type UIMessage as SdkUIMessage,
} from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

import { useChatSession } from "./components/useChatSession";
import {
  ChartFromTool,
  CompletedTrail,
  MarkdownText,
  toolNameOf,
} from "./components/MessageView";

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
  const { messages, sendMessage, setMessages, status, stop, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  const onSeedMessages = useCallback(
    (seeded: unknown[]) => {
      setMessages(seeded as SdkUIMessage[]);
    },
    [setMessages],
  );
  const { sessionId, share } = useChatSession({
    messages,
    status,
    onSeedMessages,
  });

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
      <Header
        sessionReady={Boolean(sessionId)}
        canShare={messages.length > 0 && !busy}
        onShare={share}
      />

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

function Header({
  sessionReady,
  canShare,
  onShare,
}: {
  sessionReady: boolean;
  canShare: boolean;
  onShare: () => Promise<{ share_url: string }>;
}) {
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
        <ShareButton
          disabled={!sessionReady || !canShare}
          onShare={onShare}
        />
      </div>
    </header>
  );
}

function ShareButton({
  disabled,
  onShare,
}: {
  disabled: boolean;
  onShare: () => Promise<{ share_url: string }>;
}) {
  const [status, setStatus] = useState<"idle" | "working" | "copied" | "error">(
    "idle",
  );
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const click = async () => {
    if (disabled || status === "working") return;
    setStatus("working");
    setErrMsg(null);
    try {
      const { share_url } = await onShare();
      try {
        if (
          typeof navigator !== "undefined" &&
          navigator.clipboard?.writeText
        ) {
          await navigator.clipboard.writeText(share_url);
        }
      } catch {
        // Clipboard may be denied — toast still shows the URL.
      }
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err) {
      setStatus("error");
      setErrMsg(err instanceof Error ? err.message : "share failed");
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  const label =
    status === "working"
      ? "Sharing…"
      : status === "copied"
        ? "Link copied"
        : status === "error"
          ? errMsg ?? "Share failed"
          : "Share";

  return (
    <button
      type="button"
      onClick={click}
      disabled={disabled || status === "working"}
      title={
        disabled
          ? "Send a message first to create a shareable transcript."
          : "Copy a read-only link to this conversation."
      }
      className="text-xs font-medium px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {label}
    </button>
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

/* ---------------- Helpers ---------------- */

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

