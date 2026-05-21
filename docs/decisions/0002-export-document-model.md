# 0002 — Export pipeline: shared intermediate document model

- **Status:** Accepted
- **Date:** 2026-05-21
- **Deciders:** Sean Davis, Claude
- **Affects:** `app/lib/export/`, `app/components/ExportBar.tsx`
- **Related issue:** [#6](https://github.com/seandavi/cfde-atlas/issues/6)

## Context

We need to ship five export formats from each completed assistant response: clipboard (Markdown), `.md`, `.txt`, `.docx`, `.pdf`. The shape of an assistant response is a stream of `parts` — interleaved markdown text and tool calls. The chart from `render_chart` is the only tool-call output that survives into the export; everything else is agent breadcrumbs.

Two architectures were on the table:

1. **N × M:** for each (response, format) pair, write a serializer that walks the parts directly.
2. **N → 1 → M:** parse the response once into an intermediate Document model, then write five thin adapters that walk the Document.

## Decision

**Adopt option 2 — an intermediate Document model.**

Layout:

```
parts (text + tool-calls)
      │
      ▼  (markdown parsed via unified + remark-gfm; chart spec → rendered PNG)
Document = Block[]
      │
      ├─► Markdown serializer       → string
      ├─► Plain text serializer     → string
      ├─► Clipboard writer          → navigator.clipboard.writeText(md)
      ├─► DOCX serializer           → Blob via `docx`
      └─► PDF serializer            → Blob via `pdfmake`
```

`Block` is a discriminated union: `heading`, `paragraph`, `list`, `table`, `code`, `image`, `rule`. `paragraph` and list items hold `Inline[]` (text / strong / em / code / link).

Tool-call parts are skipped during document assembly, **except** `render_chart` outputs — those become `image` blocks (PNG data URL produced by re-running the spec through `vega-embed` off-screen).

## Reasons

- **Five formats reuse one parser.** The markdown parsing, the chart-to-image step, and the tool-call filtering live in one place. Adding a sixth format later (e.g. NIH-branded PDF template, plain HTML, email) costs one adapter, not one parser + one serializer.
- **Tests at the right seam.** Each adapter has predictable input (a `Block[]`) and predictable output (a string or a Blob). Parser tests live separately from serializer tests.
- **Round-trip discipline.** Markdown in → Document → Markdown out should be a fixed point on the supported subset (paragraphs, lists, tables, code, headings, inline emphasis, links, images, hr). The first format we ship is also the test harness for the parser.
- **Cost of the abstraction is small.** Block union is ~10 cases; the parser is a single mdast walk. We are not building a CMS.

## Costs we accept

- **Lossy on edge cases.** Footnotes, definition lists, custom directives, raw HTML — the model rarely emits these, and they will be flattened or dropped. Acceptable for the audience and the format set.
- **Chart-to-PNG is a moment of asymmetry.** Markdown / text / clipboard exports skip the chart (link to spec instead). DOCX / PDF embed the PNG. This is fine — text-only formats genuinely cannot render a Vega chart — but it means the document blocks include an `image` entry that some adapters render and some elide.
- **Bundle size of pdfmake / docx.** Both are heavy. Mitigated by lazy-loading via `await import(...)` on click, not at page load.

## Revisit triggers

Switch the architecture (or significantly expand the Document model) **when any of these holds:**

1. We add a real CMS-shaped export (templated NIH briefing PDF with cover, TOC, page numbers tied to sections). At that point a higher-level document model with explicit sectioning makes sense.
2. The model starts producing block types we want to preserve that the current `Block` union does not capture (e.g. callout boxes, multi-column layouts).
3. We move exports server-side (e.g. for headless PDF generation against a real renderer) — the Document model becomes the wire format, and we'd want to firm up its schema.
4. Round-trip fidelity becomes a complaint — a user reports content lost between view and export.

## Out of scope

- Conversation-level export (the whole chat). Per-message is the v1 contract from issue #6.
- Branded NIH / CFDE templates for any format — separate decision when a template arrives.
- Shareable URLs / persistence. Exports are local downloads.
- Server-side rendering of PDFs. Possible later; not blocking v1.
