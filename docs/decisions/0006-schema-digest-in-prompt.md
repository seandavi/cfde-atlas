# 0006 — Inline schema digest in the system prompt

- **Status:** Accepted
- **Date:** 2026-06-01
- **Deciders:** Sean Davis, Claude
- **Affects:** `app/lib/prompts/system.ts`, `app/lib/tools/schema.ts`, `app/api/chat/route.ts`, ADR 0004

## Context

Every substantive turn began with the model spending two tool-call round-trips on discovery before it could write any SQL: `list_tables` (table names + one-line descriptions), then `describe_table` (column-level schema). Each round-trip is a full model invocation, and each subsequent step re-ingests the prior tool outputs into context. The discovery steps are the cheapest part of the loop to eliminate because the `analytics` schema is small and changes only on ETL deploys — the model is re-discovering, every turn, a structure that is effectively static.

This is the first, reversible step toward the "code-mode schema digest" sketched in `BLUEPRINT.md` (the same artifact would seed a typed API a sandbox executes against). It is deliberately scoped down: inject the schema, keep the existing tool loop.

We considered three generation strategies (build-time codegen, request-time per-process cache, in-sandbox introspection) and three injection depths (table list only, full column digest, full digest + live sample rows). See "Alternatives" below.

## Decision

**Introspect the `analytics` schema once per process, format it as a compact `AVAILABLE SCHEMA` block, and inline it into the system prompt. Demote `list_tables` / `describe_table` to a stale-schema fallback.**

Concretely:

1. **`buildSchemaDigest()` / `formatSchemaDigest()` in `app/lib/tools/schema.ts`.** Two queries (tables, then all columns) — no per-table round-trips. The formatter is pure (no I/O) so it is unit-tested without a database. The digest carries table name, kind, description, and per-column name/type/nullability/notes (the FK annotations from Postgres comments). It does **not** carry row counts or live sample rows.
2. **Per-process cache (`getCachedSchemaDigest()`), not build-time codegen.** Cached on `globalThis` like the SQL client. Only successes are cached — a transient introspection failure falls through to an empty digest without poisoning the cache. The digest refreshes on every deploy/restart, and the build never needs a database connection (which matters for the future Cloudflare/OpenNext build path).
3. **`buildSystemPrompt({ maxSteps, schemaDigest })` composes the prompt from parts.** With a digest, the `AVAILABLE SCHEMA` block is declared authoritative and the discovery bullets tell the model to write SQL directly. Without one (introspection failed, or the legacy `SYSTEM_PROMPT` export), the prompt falls back to the original discover-first guidance and the `SCHEMA SCOPE` paragraph.
4. **The fallback trigger is concrete, not soft discouragement.** The prompt says to call `describe_table` *only* if a query fails with an unknown-table/unknown-column error (meaning the digest has drifted), or when a live sample row is specifically needed. This single mechanism is both the backup-tool guidance and the stale-digest recovery path.

## No live sample rows

`describe_table` returns a `sample_row` at runtime; the static digest deliberately omits it. Per the `BLUEPRINT.md` privacy gotcha, a real row can carry unpublished values, and baking one into a prompt artifact is a different (and more durable) exposure than returning one to the model on demand. Column metadata is safe; live data is not. The backup `describe_table` still provides a sample row when the model asks.

## Reasons

- **Latency.** Removes up to two model round-trips from the front of every turn. The digest rides in the cached system-prompt prefix, so the token cost is paid once.
- **Keeps the safety net.** The tools remain wired exactly so a drifted schema self-heals: the first failed query routes the model back to `describe_table`.
- **Decouples the build from the database.** Request-time caching means `next build` never connects to Postgres — a prerequisite for the edge-runtime migration.
- **Reversible and incremental.** If the digest proves a net negative, deleting the `getCachedSchemaDigest()` call restores the prior behavior; the discover-first prompt path is still present.

## Costs we accept

- **Staleness window.** Between an ETL schema change and the next app restart, the digest can lie. Mitigated by the unknown-column fallback trigger and by the digest refreshing on every deploy.
- **Prompt grows with the schema.** Fine while the schema is a handful of tables; if it grows large, switch to injecting only the relevant slice (a single up-front discovery step) — see revisit triggers.
- **Two prompt forms to reason about.** `buildSystemPrompt` now has a digest path and a fallback path. The fallback is exercised by tests so it cannot rot silently.

## Revisit triggers

1. The schema grows past what fits comfortably in a cached prefix → inject only the relevant slice via one up-front discovery step.
2. We adopt code-mode → this digest becomes the typed API surface exposed to the sandbox, and this ADR folds into that one.
3. Sample values turn out to be necessary for the model to write correct filters → add *curated, non-sensitive* example values to the digest rather than live rows.

## Alternatives considered

- **Table list only.** Kills the `list_tables` round-trip but not the more valuable `describe_table` one (the model still needs column names to write SQL). Rejected as half the win for the same plumbing.
- **Build-time static file.** Zero runtime cost, but needs DB access during `next build` and goes stale silently between rebuilds. Rejected for the edge-build coupling.
- **In-sandbox introspection only.** Defers rather than answers "how does the model know the columns to write the code." Reserved for code-mode, not this step.
- **Full digest + live sample rows.** Rejected on the privacy boundary above.
