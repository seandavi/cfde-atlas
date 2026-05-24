"use client";

import { useReportWebVitals } from "next/web-vitals";
import { sendGAEvent } from "@next/third-parties/google";

// Forwards Core Web Vitals into GA4 as `web_vital` events. Mounted once
// from the root layout. No-op when NEXT_PUBLIC_GA_MEASUREMENT_ID is unset
// (sendGAEvent warns silently; useReportWebVitals still runs but nothing
// reaches gtag).

// Stable reference per docs — passing a new function each render would
// double-report.
function handle(metric: {
  id: string;
  name: string;
  value: number;
  rating?: string;
}) {
  if (!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) return;
  if (typeof window === "undefined") return;
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
