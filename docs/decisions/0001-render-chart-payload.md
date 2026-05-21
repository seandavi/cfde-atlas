# 0001 — `render_chart` data payload: inline vs. query reference

- **Status:** Accepted
- **Date:** 2026-05-21
- **Deciders:** Sean Davis, Claude
- **Affects:** `app/lib/tools/index.ts` (`render_chart`), `app/lib/prompts/system.ts`, `app/components/VegaChart.tsx`

## Context

The `render_chart` tool consumes a Vega-Lite spec from the LLM and surfaces a figure to the user. Vega-Lite specs need data — either inline in `data.values` or referenced via a URL / dataset name. Two payload shapes were on the table:

1. **Inline data.** The model embeds the rows it wants to plot directly in `data.values` inside the spec it passes to `render_chart`.
2. **Query reference.** `render_chart` accepts a `query_id` (or `query_hash`) referring back to a result the server already produced via `run_query`. The server resolves the reference and injects the rows into the spec before rendering.

## Decision

**Adopt the inline-data approach for v1.**

The chart is a stateless function of the spec the model emits. `render_chart` receives a complete Vega-Lite spec with `data.values` populated by the model and hands it to the client renderer unchanged.

## Reasons

- **Standard Vega-Lite idiom.** Inline `data.values` is what the LLM sees in nearly every Vega-Lite example in training; the model is most fluent here.
- **Stateless tool surface.** No server-side cache of prior query results, no IDs to invalidate, no concurrency questions. Matches the four-tools-no-more posture in BLUEPRINT.
- **Briefing-shaped data.** Council of Councils charts are summary-shaped: tens to low hundreds of rows. Token cost of embedding the rows in the spec is negligible at this size.
- **Auditability.** The full chart-input data appears in the assistant turn, alongside the table the model also surfaces. A reviewer can see exactly what was plotted without cross-referencing a prior tool call.

## Costs we accept

- **Token redundancy.** The same rows can appear twice in the same turn (once in `run_query` output, once embedded in the `render_chart` spec). Acceptable while row counts stay small.
- **No row-count enforcement at the tool boundary.** The model could in principle embed thousands of rows. Mitigated by prompt guidance ("summarize first, plot the summary") and the briefing-shaped reality of the use case.

## Revisit triggers

Switch to the query-reference approach (or add it alongside) **when any of these holds:**

1. A typical chart payload pushes `render_chart` calls above ~10K tokens of `data.values` content, or model token cost becomes a noticeable line item.
2. A real use case wants to plot a result set large enough that re-emitting it through the model is wasteful (e.g. >1K rows after summarization).
3. We add server-side caching of `run_query` results for other reasons (e.g. resume / share), which gives us the `query_id` infrastructure for free.
4. Latency on chart rendering becomes a complaint and the bottleneck is model output tokens.

When that happens, the proposed shape is `render_chart({ spec, data_source: { query_id } })` — the `spec` still arrives without `data.values`, the server injects the cached rows server-side, the client renders.

## Out of scope

- Choice of charting library — covered by sticking with Vega-Lite per `BLUEPRINT.md` §LLM tool surface.
- Server-side rendering of charts (PNG export). The inline-data path keeps that option open.
