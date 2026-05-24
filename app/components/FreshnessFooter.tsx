"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toIsoDate } from "@/app/lib/export/date";

export function FreshnessFooter() {
  const [refreshed, setRefreshed] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/freshness")
      .then((r) => (r.ok ? r.json() : { refreshed: null }))
      .then((data: { refreshed: string | null }) => {
        if (!cancelled) {
          setRefreshed(data.refreshed);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const date = loaded ? toIsoDate(refreshed) : null;
  const freshnessLine = !loaded
    ? null
    : date
      ? `Data last refreshed ${date} (UTC).`
      : "Data refresh timestamp unavailable.";

  return (
    <div className="text-[10px] text-foreground-faint mt-2 text-center flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
      <span>
        Built by Sean Davis · CFDE Evaluation Core
      </span>
      <span aria-hidden>·</span>
      <Link href="/about" className="hover:underline hover:text-foreground-muted">
        About
      </Link>
      <span aria-hidden>·</span>
      <a
        href="https://github.com/seandavi/cfde-atlas"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline hover:text-foreground-muted"
      >
        GitHub
      </a>
      {freshnessLine && (
        <>
          <span aria-hidden>·</span>
          <span>{freshnessLine}</span>
        </>
      )}
    </div>
  );
}
