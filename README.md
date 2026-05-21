# cfde-atlas

Conversational interface for NIH program officers to explore Common Fund Data Ecosystem (CFDE) evaluation metrics — bibliometrics, grants, code activity, analytics — keyed by NIH core project number.

Primary use case: ad hoc query support in preparation for the annual **Council of Councils** meeting. Outputs tables and figures, not just chat.

## What's here

- **`BLUEPRINT.md`** — design decisions, data sources, tool surface, deploy story. Start here.
- **`app/`** — Next.js (App Router) chat UI + API routes.
- **Issues** — open ETL work for additional data sources (datasets deposited, cross-program connectivity, training/workforce, derivative funding).

## Stack

- Next.js (App Router) + Vercel AI SDK
- `@ai-sdk/google` → `gemini-3.5-flash-preview`
- Postgres (host TBD: Cloud SQL / Supabase / Neon)

## Status

Pre-development. Scaffold in place; ETL adapters and tool-calling layer not yet built.

## Related

- [`icc-eval-core`](https://github.com/nih-cfde/icc-eval-core) — the underlying ETL pipeline
- [`cfde-eval-protector`](https://github.com/cfde/cfde-eval-protector) — ORCID auth gateway (reserved for if/when access control is needed)

## Local development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).
