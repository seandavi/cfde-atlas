"use client";

import { useCallback, useState } from "react";

export function CopyButton({
  text,
  label = "Copy code",
}: {
  text: string;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");

  const onCopy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setState("ok");
    } catch {
      setState("err");
    } finally {
      window.setTimeout(() => setState("idle"), 1500);
    }
  }, [text]);

  const text_ = state === "ok" ? "Copied" : state === "err" ? "Failed" : "Copy";
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={label}
      aria-live="polite"
      className="absolute top-1.5 right-1.5 text-[10.5px] font-medium px-1.5 py-0.5 rounded border border-border bg-background text-foreground-muted opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:text-foreground"
    >
      {text_}
    </button>
  );
}
