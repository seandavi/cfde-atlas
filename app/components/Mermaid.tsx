"use client";

import { useEffect, useId, useRef, useState } from "react";

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, src: string) => Promise<{ svg: string }>;
};

let mermaidPromise: Promise<MermaidApi> | null = null;
function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => m.default as MermaidApi);
  }
  return mermaidPromise;
}

function prefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export default function Mermaid({ chart }: { chart: string }) {
  const baseId = useId().replace(/:/g, "_");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    const dark = prefersDark();
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onChange = () => setRenderKey((k) => k + 1);
    mq?.addEventListener?.("change", onChange);
    let cancelled = false;
    (async () => {
      try {
        const mermaid = await loadMermaid();
        mermaid.initialize({
          startOnLoad: false,
          theme: dark ? "dark" : "default",
          securityLevel: "strict",
          fontFamily: "inherit",
        });
        const { svg } = await mermaid.render(
          `mermaid-${baseId}-${renderKey}`,
          chart,
        );
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
      mq?.removeEventListener?.("change", onChange);
    };
  }, [chart, baseId, renderKey]);

  if (error) {
    return (
      <div className="my-2.5 rounded-md border border-border bg-surface-muted p-3 text-[12.5px]">
        <div className="text-foreground-muted mb-1.5">
          Could not render mermaid diagram.
        </div>
        <pre className="overflow-x-auto font-mono text-[12px] text-foreground-faint whitespace-pre-wrap">
          {chart}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Mermaid diagram"
      className="my-2.5 overflow-x-auto rounded-md border border-border bg-surface-muted p-3"
    />
  );
}
