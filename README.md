# cfde-atlas

Conversational interface for **NIH program officers** to explore Common Fund Data Ecosystem (CFDE) evaluation metrics — bibliometrics, grants, code activity, web analytics — keyed by NIH core project number (e.g. `U54OD036472`).

Primary use case: ad-hoc query support in preparation for the annual **Council of Councils** meeting. The deliverable is tables and figures, not chat.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Status

Early. The chat surface and four LLM-callable tools (`list_tables`, `describe_table`, `run_query`, `render_chart`) are wired against **mocked sample data** so the conversational layer can be tested before the ETL lands. Every assistant response includes a footer noting that figures are illustrative and must not be cited. See [BLUEPRINT.md](BLUEPRINT.md) for the data sources that will replace the mock.

## Quickstart

```bash
git clone https://github.com/seandavi/cfde-atlas.git
cd cfde-atlas
npm install
echo "GOOGLE_GENERATIVE_AI_API_KEY=…" > .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and try one of the example prompts (e.g. "Plot FY2024 funding by CFDE program, horizontal bar, sorted descending").

### Environment

| Variable | Required | Purpose |
|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | yes | Gemini API access via `@ai-sdk/google`. |
| `DATABASE_URL` | not yet | Postgres connection. Wiring tracked in the open issues. |

## Stack

- **Frontend:** Next.js 16 (App Router, Turbopack) + React 19 + Tailwind v4
- **Chat:** Vercel AI SDK v6 → `@ai-sdk/google` → `gemini-3.5-flash`
- **Charting:** Vega-Lite (lazy-loaded via `vega-embed`)
- **Markdown:** `react-markdown` + `remark-gfm` for GFM tables
- **Backend (planned):** Postgres via `postgres.js`. Host TBD — see open issues.

## Documentation

- **[BLUEPRINT.md](BLUEPRINT.md)** — durable design doc. Purpose, audience constraints, architecture, model choice, tool contract, deploy story, gotchas. Read this before changing anything structural.
- **[docs/decisions/](docs/decisions/)** — Architecture Decision Records (ADRs). One file per substantive technical decision, with revisit triggers.
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — dev setup, commit conventions, PR workflow.
- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** — contributor expectations.
- **[CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md)** — guidance for AI agents working in this repo. Both files declare project-specific quirks (e.g. "this is not the Next.js you know — read the local docs first").

## Related repositories

- [`icc-eval-core`](https://github.com/nih-cfde/icc-eval-core) — the underlying CFDE evaluation ETL. cfde-atlas is the view; that's the data layer.
- [`cfde-eval-protector`](https://github.com/cfde/cfde-eval-protector) — ORCID-OAuth reverse proxy. Reserved for if/when access control becomes a binary need (see BLUEPRINT §Auth).

## License

[MIT](LICENSE). Copyright (c) 2026 Sean Davis, NIH / CFDE Coordinating Center.
