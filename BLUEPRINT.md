# cfde-atlas — Blueprint

The durable design doc for `cfde-atlas`. The Next.js scaffold is incidental; the decisions here are the asset.

If you ever build a second instance of this app (different audience, different data backend), start from this blueprint, not from the source tree.

---

## Purpose

Ad hoc conversational interface for **NIH program officers** to query CFDE evaluation metrics — bibliometrics, grants, code activity, and analytics — keyed against **NIH core project numbers** (the unit they actually think in).

**Primary use case:** Council of Councils preparation, annually. Program officers need to produce tables and figures answering questions like "what came out of this core project?" without writing SQL or running notebooks.

**Audience constraints to respect:**
- Non-technical users. The interface must be conversational, not query-builder-shaped.
- High trust required. Numbers shown will end up in NIH leadership briefings — wrong answers are worse than no answer.
- Output is tables and figures, not just chat. The chat is the means, the artifacts are the deliverable.

---

## Data sources

### In scope (v1)

| Source | Shape | Status |
|---|---|---|
| Grant-associated publications (bibliometrics) | NIH RePORTER + PubMed cross-ref; per-pub citation counts, journals, years | **Live**: `analytics.publications` (~400 rows), loaded by `cfde-atlas-etl/flows/publications.py` from `nih-cfde/icc-eval-core` |
| NIH RePORTER grant data | Core project number, PI, mechanism, FY funding, NOFO/RFA | ETL planned in `cfde-atlas-etl#2` (blocked on upstream data shape) |
| GitHub activity across ~175 repos | Commits, contributors, releases, issues/PRs, languages | ETL planned in `cfde-atlas-etl#3` (blocked on upstream data) |
| Google Analytics across ~20 properties | Page views, unique users, traffic source, session duration | ETL planned in `cfde-atlas-etl#4` (blocked on upstream data) |
| (Optional v1) GitHub repo + core-project-level summaries | LLM-generated synopses, computed against repo + readme + recent activity | Planned |

### Worth adding (Council of Councils relevance)

These are filed as repo issues. ETL doesn't exist yet but the table-shape decisions belong here:

1. **Datasets deposited + access metrics** — GEO, dbGaP, Synapse, OSF, etc. Counts per core project, download counts, dataset-citation counts. This is the **single most defensible "CFDE works" metric** for the data-ecosystem thesis.
2. **Cross-program connectivity** — joint publications, shared datasets, shared working-group membership across CFDE programs (Bridge2AI, LINCS, GTEx, HuBMAP, MoTrPAC, 4DN, KidsFirst). Graph-shaped data.
3. **Training / workforce** — postdocs trained, courses delivered, downstream-PI rate. Usually in annual program reports; structured ingest possible.
4. **Derivative funding** — RePORTER queries for grants that cite CFDE outputs in their bibliographies. The strongest ROI metric NIH actually responds to.

### Keying convention

All tables join on **NIH core project number** (e.g., `U54OD036472`). This is the primary key program officers navigate by. Any data source that doesn't expose core project linkage needs a resolution step (e.g., GH repos → linked papers → grant numbers).

---

## Architecture

```
Next.js (App Router)
  ├─ UI: Vercel AI SDK chat surface
  ├─ API routes:
  │    /api/chat       → @ai-sdk/google → gemini-3.5-flash
  │    /api/tools/*    → schema-introspection + query tools (LLM-callable)
  └─ Postgres access via postgres.js (or Drizzle if schema gets complex)
       └─ pg_ducklake escape hatch if analytical workloads emerge

Deploy: Vercel or Netlify (single deploy, no Python sidecar)
```

No separate Python backend. No MCP server. Schema-introspection + query are LLM tools exposed via the AI SDK's `tools` API.

---

## Model choice

**Default:** `gemini-3.5-flash` via `@ai-sdk/google`.

- 1M token context (room for full schema + worked-example exchanges)
- Native function calling, structured output, code execution
- Benchmarked strong on agentic tool-call workflows
- Cost profile matches "many ad hoc queries from many program officers"

Reuses the Vertex AI pipeline established in `fda-approval-app`.

**Reserved alternative:** Claude Haiku 4.5 if Gemini tool-call reliability proves insufficient. Provider swap is one line via the AI SDK.

---

## LLM tool surface (the contract)

The LLM gets four tools. No more. Resist tool sprawl.

| Tool | Purpose | Returns |
|---|---|---|
| `list_tables()` | Discover what's available | Table names + one-line descriptions |
| `describe_table(name)` | Inspect schema for a table | Column names, types, sample row, row count |
| `run_query(sql)` | Execute a `SELECT` against Postgres | Result rows (capped at N) |
| `render_chart(spec)` | Produce a figure | URL or inline image (Vega-Lite or equivalent) |

**SQL safety stance (non-negotiable):** `run_query` accepts `SELECT` statements only. Parse the SQL before execution; reject anything that isn't a `SELECT` query (no `INSERT`/`UPDATE`/`DELETE`/`DROP`/`TRUNCATE`/`ALTER`/`CREATE`, no `EXEC`/`CALL`, no multi-statement). The LLM will eventually try a `DELETE FROM` — make it impossible by construction.

**Schema-introspection tone:** the descriptions returned by `list_tables` and `describe_table` should be **written for the LLM, not for humans**. Plain-English descriptions of what each table represents, what units, what the join keys are. This is where prompt-engineering effort pays off — the LLM is only as good as the schema metadata you give it.

---

## Auth

**v1: no auth.** Public read-only against published metrics.

**In reserve, two paths ready to drop in when audience-control becomes a real need:**

1. **Reverse-proxy gate** ([cfde-eval-protector](https://github.com/cfde/cfde-eval-protector) pattern) — ORCID OAuth in front of the whole app. Zero application changes; runs as deploy-layer config.
2. **In-app auth** — NextAuth with the ORCID provider. ~30 lines of config in `auth.ts`. Gates routes / tools per-user.

**Default to (1)** if access control becomes binary (allowed / not allowed). Use (2) only when per-user behavior matters (e.g., role-based tool access, query history per user).

---

## Prompt structure

The system prompt should cover:

1. **Role:** "You help NIH program officers explore CFDE metrics in preparation for Council of Councils."
2. **Keying convention:** "All data joins on NIH core project number."
3. **Tool guidance:** "Use `list_tables` first to discover, `describe_table` to inspect schema, `run_query` for SELECT-only SQL. Render figures with `render_chart` when the user asks for a figure or when a chart would clarify."
4. **Output style:** "Prefer concise tables with column headers. When producing figures, also produce the underlying table. When uncertain about a join, ask before guessing."
5. **Honesty pattern:** "If a question requires data we don't have, say so explicitly. Do not invent values. Do not extrapolate beyond the data."

Prompt template lives in `app/lib/prompts/system.ts` (or wherever the AI SDK's chat handler reads from). Treat it as a versioned artifact — log changes in `CHANGELOG.md` like a schema.

---

## Deploy story

**Single command target:** `pnpm deploy` (Vercel or Netlify CLI).

**Environment variables (`.env.local`, never committed):**
- `GOOGLE_GENERATIVE_AI_API_KEY` — Gemini API access (or Vertex service-account JSON if Vertex-routed)
- `DATABASE_URL` — Postgres connection string
- `(future)` `ORCID_CLIENT_ID` + `ORCID_CLIENT_SECRET` if auth lights up

**Backing Postgres:** plain Postgres 18 on `pg_ducklake_18` (onclappc02), reached via the `pg_ducklake_stack_default` docker bridge. Specifically NOT `pg_duckdb_18` — pg_duckdb's planner hooks would interfere with the LLM-driven `run_query` path. ETL writes via `cfde-atlas-etl`; the app holds a SELECT-only connection pinned to `search_path = analytics, public`.

---

## What this app is *not*

- Not a dashboard. Dashboards are for fixed questions; this is for ad hoc ones.
- Not a replacement for `icc-eval-core`. That's the data layer; this is the view.
- Not a general-purpose CFDE chatbot. The audience is program officers, the use case is metrics. Scope creep ("can it also answer policy questions?") should be deflected.
- Not a template. If a second instance is ever needed, fork this blueprint, not this scaffold.

---

## Gotchas to watch

- **LLM hallucinates joins.** When tables share semantically similar column names but aren't actually joinable, the LLM will join them anyway. Mitigate by making the `describe_table` output explicit about which columns are foreign keys to what.
- **NIH RePORTER rate limits.** ETL refresh cadence has to respect them. Cache aggressively.
- **GA scraping is fragile.** GA4 API changes break things. Keep the scraper isolated and well-tested.
- **Council of Councils prep is bursty.** Expect a spike in usage one to four weeks before the meeting. Make sure the deploy can scale (Vercel autoscale handles this; if self-hosted, plan for it).
- **"Wrong numbers in NIH briefings" risk.** Add a footer to every chat response: "All numbers reflect ETL last-refreshed at YYYY-MM-DD. Verify against source systems before citing in official materials."
- **GA4 event payloads are a privacy boundary.** All custom events are emitted through `app/lib/analytics.ts` and may carry only lengths, counts, tool names, export formats, and web-vital metric values. Never prompt text, never assistant response text, never tool inputs/outputs, never query result rows or cell values. A program officer's question about a specific CFDE program can contain unpublished numbers — those must stay in our event stream (Postgres `chat.sessions`), not Google's infrastructure. Privacy audit is `grep -n sendGAEvent app/lib/analytics.ts` plus call-site review for the eight `track*` helpers.

---

## Open questions

- Does the user-facing audience know how to operate a chatbot, or does the first interaction need a guided tour / example prompts?
- How fresh does the data need to be? (Council of Councils is annual — daily refresh is overkill; weekly is probably enough.)

Resolved:
- ~~Which Postgres host?~~ pg_ducklake_18 on onclappc02 (see Architecture).
- ~~Where does the deployed app live?~~ `cfde-atlas.cancerdatasci.org`, behind the shared Traefik on onclappc02. Wiring in `monode/infrastructure/compose/cfde_atlas/`.

These get answered as we build, not before.
