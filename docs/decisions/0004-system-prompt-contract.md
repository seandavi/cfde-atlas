# 0004 — System prompt as a versioned contract

- **Status:** Accepted
- **Date:** 2026-05-24
- **Deciders:** Sean Davis, Claude
- **Affects:** `app/lib/prompts/system.ts`, every chart / table / follow-up behavior the UI depends on

## Context

`app/lib/prompts/system.ts` ships a 71-line system prompt that encodes everything the model needs to know to do its job: who the user is, the four tools and their call order, the SQL guardrails, the ID-link templates, the figure-legend rules, the diagrams policy, output style, honesty rules, the data-freshness footer, schema scope, and the follow-up-question style. It is the single most load-bearing string in the application.

Several of the rules look like prose but are actually contracts the UI relies on. For example:

- "The legend MUST be the FIRST thing in the text part that follows the `render_chart` call." — the chat surface places the model's text *under* the figure, so any prose before the legend ends up between the chart and its caption.
- "Emit a complete Vega-Lite v5 spec object. Include the data INLINE in `spec.data.values` — do not reference external URLs..." — paired with ADR 0001, which makes `render_chart` a stateless function of the spec.
- ID-link templates — the chat surface does no post-hoc linkification; if the prompt drops a template, IDs render plain.

A future contributor editing the prompt has no record of why any particular rule exists. The result is that "small" prompt edits silently regress the user experience.

## Decision

**Treat `SYSTEM_PROMPT_BODY` as a versioned contract.**

Concretely:

1. Any PR that edits the body of the system prompt updates this ADR with a short note (one bullet per rule changed, naming the user-visible effect).
2. The five sections of the prompt are the canonical structure — `KEYING CONVENTION`, `TOOLS`, `IDS → LINKS`, `DIAGRAMS`, `OUTPUT STYLE`, `HONESTY`, `DATA FRESHNESS NOTICE`, `SCHEMA SCOPE`, `FOLLOW-UPS`. Add new sections; do not split existing ones without a note here.
3. The runtime step budget is appended by `buildSystemPrompt({ maxSteps })` at request time. The prompt body therefore must not name a literal step budget — the constant lives in the chat route.

The rationales below capture *why* each section exists, so future edits can judge tradeoffs.

## Section-by-section rationale

- **KEYING CONVENTION** — Every CFDE table joins through the NIH core project number. Resolving an entity (program name, mechanism, PI) to a core project number is the cheapest way to scope a query. Removing this section makes the model dereference shorter identifiers first and re-discover the join during `run_query`.
- **TOOLS** — The four tools are listed in the order the model should consider them: discover (`list_tables`), inspect (`describe_table`), query (`run_query`), visualize (`render_chart`). The order matters because skipping `describe_table` produces invented joins; this is the single biggest source of past regressions.
- **`describe_table` batching rule** — "Pass an array of every table you plan to join in a single call." Without this, the model chains one `describe_table` per table and burns the step budget before it can run a query.
- **`run_query` SELECT-only** — Mirrors the server-side guard in `enforceSelectOnly`. The prompt rule prevents the round-trip; the server rule is the real safety net.
- **`render_chart` rules** — Paired with ADR 0001 (inline `data.values`) and ADR 0002 (export pipeline). The "legend first" ordering rule is a UI contract, not a stylistic preference. The "never paste JSON for a chart" rule is what stops the model from "showing its work" inside a markdown code fence after it has already called `render_chart`.
- **IDS → LINKS** — The chat surface does no automated linkification of identifiers. Removing the templates makes every PMID / DOI / core project number render plain.
- **DIAGRAMS** — Mermaid blocks render inline. The "no prose inside the fence" rule is what keeps the renderer from failing on stray markdown.
- **OUTPUT STYLE** — "When you produce a figure, also produce the underlying table." Briefings reviewers audit numbers against the table, not the figure.
- **HONESTY** — The audience is non-technical NIH leadership. Wrong numbers in a briefing are worse than missing numbers. The "zero rows ≠ metric does not exist" rule prevents a misspelled core project number from being reported as "no funded work."
- **DATA FRESHNESS NOTICE** — The "`_notice`" footer is contractually wired into every tool response. The prompt rule turns it into a one-line footer on every numeric answer; removing it makes Council of Councils slides undatable.
- **SCHEMA SCOPE** — Documents the `analytics` schema search_path and the gap between what `BLUEPRINT.md` aspires to and what `list_tables` actually returns today. Removing this rule causes the model to invent tables.
- **FOLLOW-UPS** — Suggestions must be re-sendable verbatim and grounded in tables the model has inspected this turn. Without this constraint, the model produces generic "explore further" prose.

## Reasons

- **The prompt is production code.** Treating it as configuration without a changelog hides regressions in the conversational surface that no test can catch.
- **One ADR is cheaper than 71 inline comments.** The prompt itself stays terse and readable; the rationale lives here.
- **Lets the prompt evolve.** Future contributors can reason from "why was this rule added?" rather than guessing whether a clause is load-bearing.

## Costs we accept

- **Manual discipline.** There is no tooling that forces an ADR update when `system.ts` changes; the rule is enforced in review.
- **The ADR will drift if neglected.** Mitigated by linking from `CONTRIBUTING.md` §LLM-facing surfaces.

## Revisit triggers

Replace this ADR (or restructure the prompt) **when any of these holds:**

1. We move from a single in-process system prompt to a per-tool prompt or a router that chooses prompts by intent.
2. We switch models in a way that changes how the model interprets instructions (e.g. moving from Gemini to a model with different tool-call semantics).
3. The follow-up / chart / table rules become testable in a reproducible way (offline eval harness) — at that point this ADR becomes the spec the eval is written against.
4. A specific section grows past one screen and needs to become its own document.

## Out of scope

- Tool descriptions inside the tool schemas (those are separate strings in `app/lib/tools/index.ts`, also production-load-bearing, but governed by ADR 0001 and the inline comments on Vega-Lite key mangling).
- Per-turn user prompts. The contract here is only about the system message.
- Internationalization. The prompt is English-only; non-English UX is not in scope.
