"use client";

import { useReportWebVitals } from "next/web-vitals";
import { sendGAEvent } from "@next/third-parties/google";

// Forwards Core Web Vitals into GA4 as `web_vital` events. Mounted once
// from the root layout. No-op when gtag never loaded (the GoogleAnalytics
// tag in layout.tsx is the source of truth for whether GA is active).

// Runtime check on window.dataLayer — NOT process.env.NEXT_PUBLIC_*. The
// latter is inlined into the client bundle at build time; in the Docker
// build the value is absent, so a process.env check would always disable
// the beacon in production regardless of runtime config.
function handle(metric: {
  id: string;
  name: string;
  value: number;
  rating?: string;
}) {
  if (typeof window === "undefined") return;
  if (!(window as { dataLayer?: unknown[] }).dataLayer) return;
  sendGAEvent("event", "web_vital", {
    name: metric.name,
    value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
    id: metric.id,
    rating: metric.rating ?? null,
    non_interaction: true,
  });
}

export function WebVitalsBeacon() {
  useReportWebVitals(handle);
  return null;
}
