"use client";

import { useEffect, useRef, useState } from "react";
import embed, { type Result, type VisualizationSpec } from "vega-embed";

type Props = {
  spec: unknown;
  className?: string;
};

export default function VegaChart({ spec, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let viewResult: Result | null = null;
    let cancelled = false;
    setError(null);

    embed(node, spec as VisualizationSpec, {
      actions: false,
      renderer: "svg",
      // Let vega-lite pick a sensible width if the spec did not.
      defaultStyle: true,
    })
      .then((result) => {
        if (cancelled) {
          result.finalize();
          return;
        }
        viewResult = result;
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
      viewResult?.finalize();
    };
  }, [spec]);

  if (error) {
    return (
      <div className="text-xs text-red-600 dark:text-red-400 border border-red-400/30 rounded p-2">
        Chart render failed: {error}
      </div>
    );
  }

  return <div ref={ref} className={className ?? "w-full overflow-x-auto"} />;
}
