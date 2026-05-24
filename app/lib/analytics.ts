"use client";

// Single GA4 event surface. Centralised so the privacy contract from
// BLUEPRINT.md §Gotchas (no prompt/response/result content in GA events)
// can be audited by grepping this one file.
//
// Every helper is safe to call when NEXT_PUBLIC_GA_MEASUREMENT_ID is unset:
// sendGAEvent silently warns in that case rather than throwing.

import { sendGAEvent } from "@next/third-parties/google";

type ExportFormat = "copy" | "md" | "txt" | "docx" | "pdf";

function enabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
}

function emit(name: string, params: Record<string, unknown> = {}): void {
  if (!enabled()) return;
  if (typeof window === "undefined") return;
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
