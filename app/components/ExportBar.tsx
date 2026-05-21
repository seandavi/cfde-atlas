"use client";

import { useState } from "react";
import type { UIMessage } from "ai";
import {
  copyAsMarkdown,
  exportMarkdown,
  exportPlainText,
  exportDocx,
  exportPdf,
} from "../lib/export";

type Props = {
  messages: readonly UIMessage[];
  message: UIMessage;
};

type Action = {
  key: string;
  label: string;
  run: () => Promise<void> | void;
};

export default function ExportBar({ messages, message }: Props) {
  const ctx = { messages, message };
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const actions: Action[] = [
    {
      key: "copy",
      label: copied ? "Copied" : "Copy",
      run: async () => {
        await copyAsMarkdown(ctx);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
    },
    { key: "md", label: "Markdown", run: () => exportMarkdown(ctx) },
    { key: "txt", label: "Plain text", run: () => exportPlainText(ctx) },
    { key: "docx", label: "Word", run: () => exportDocx(ctx) },
    { key: "pdf", label: "PDF", run: () => exportPdf(ctx) },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs">
      <span className="text-foreground-faint mr-1">Export:</span>
      {actions.map((action) => {
        const isBusy = busyKey === action.key;
        return (
          <button
            key={action.key}
            type="button"
            disabled={busyKey !== null}
            onClick={async () => {
              setBusyKey(action.key);
              try {
                await action.run();
              } catch (err) {
                console.error(`[export:${action.key}]`, err);
                window.alert(
                  `Export failed (${action.key}): ${
                    err instanceof Error ? err.message : String(err)
                  }`,
                );
              } finally {
                setBusyKey(null);
              }
            }}
            className="px-2.5 py-1 rounded-md border border-border text-foreground-muted hover:text-foreground hover:bg-surface-muted hover:border-border-strong disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isBusy ? "…" : action.label}
          </button>
        );
      })}
    </div>
  );
}
