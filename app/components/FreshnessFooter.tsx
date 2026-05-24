"use client";

import { useEffect, useState } from "react";
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

  if (!loaded) return null;
  const date = toIsoDate(refreshed);
  return (
    <div className="text-[10px] text-foreground-faint mt-2 text-center">
      {date
        ? `Data last refreshed ${date} (UTC).`
        : "Data refresh timestamp unavailable."}
    </div>
  );
}
