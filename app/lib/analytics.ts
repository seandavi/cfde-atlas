"use client";

// Single GA4 event surface. Centralised so the privacy contract from
// BLUEPRINT.md §Gotchas (no prompt/response/result content in GA events)
// can be audited by grepping this one file.
//
// Every helper is safe to call when GA is not loaded — the runtime
// dataLayer check below short-circuits before sendGAEvent runs.

import { sendGAEvent } from "@next/third-parties/google";

type ExportFormat = "copy" | "md" | "txt" | "docx" | "pdf";

// Runtime check on window.dataLayer — NOT process.env.NEXT_PUBLIC_*.
// NEXT_PUBLIC_* is inlined into client bundles at build time; the Docker
// build does not have the GA ID set, so a process.env check would always
// disable events in production regardless of runtime config. The
// GoogleAnalytics tag in app/layout.tsx is the source of truth for
// whether gtag/dataLayer exist on the page.
function enabled(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as { dataLayer?: unknown[] }).dataLayer);
}

function emit(name: string, params: Record<string, unknown> = {}): void {
  if (!enabled()) return;
  sendGAEvent("event", name, params);
}

export function trackPromptSent(args: {
  prompt_length: number;
  prompt_word_count: number;
}): void {
  emit("prompt_sent", args);
}

export function trackToolCalled(args: { tool_name: string }): void {
  emit("tool_called", args);
}

export function trackAssistantCompleted(args: {
  step_count: number | null;
  total_tokens: number | null;
  had_chart: boolean;
  had_table: boolean;
}): void {
  emit("assistant_completed", args);
}

export function trackChartRendered(): void {
  emit("chart_rendered");
}

export function trackExportClicked(args: { format: ExportFormat }): void {
  emit("export_clicked", args);
}

export function trackShareCreated(): void {
  emit("share_created");
}

export function trackShareViewed(): void {
  emit("share_viewed");
}

export function trackStreamAborted(args: { reason: string }): void {
  emit("stream_aborted", args);
}

export function trackFeedbackSubmitted(args: {
  // rating: "up" | "down" | "cleared" — keep symbol-free for GA dashboards.
  rating: "up" | "down" | "cleared";
  had_note: boolean;
}): void {
  emit("feedback_submitted", args);
}
