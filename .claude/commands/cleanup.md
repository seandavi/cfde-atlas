# Repo Cleanup & Convention Hardening

Audit the cfde-atlas codebase for accumulated ad-hoc code. Simplify, unify, and document the conventions we want to enforce going forward. Run at **high effort** — depth over speed.

## Ground rules

- Read `AGENTS.md` and `CONTRIBUTING.md` first. They define our existing rules; this pass enforces and extends them, never contradicts them.
- This is a **Next.js with breaking changes from training data** — consult `node_modules/next/dist/docs/` before assuming any API shape.
- Style baseline already in `CONTRIBUTING.md` §Code: no `any` without justification, `'use client'` only when needed, no comments restating code, no defensive checks except at system boundaries.
- **Do not invent abstractions.** Three similar lines is fine; premature DRY is the bug we are removing, not adding.
- **Do not expand scope.** Cleanup, not feature work. If a refactor reveals a missing feature, file an issue — don't build it.
- Preserve behavior. Every change either has a test proving equivalence, or is a pure rename/move verified by `npx tsc --noEmit` + `npm run lint` + `npm run build`.

## Phase 1 — Inventory (read-only, parallel agents)

Launch four `Explore` agents concurrently. Each writes findings to a scratch file under `$CLAUDE_JOB_DIR`. Each finding cites `path:line`.

### Agent A — Duplication & near-duplication
- Functions/components doing the same job under different names.
- Copy-pasted blocks with minor variation across `app/`, `app/lib/`, `app/components/`, `app/api/`.
- Parallel type definitions for the same conceptual shape (turn log, chart payload, tool input/output, session row).
- Multiple ways of doing the same side-effect (fetching, logging, formatting dates, building URLs, parsing IDs).

### Agent B — Convention drift
- Mixed import styles (relative vs `@/`), mixed quote/semi style escaping ESLint.
- Naming inconsistency for the same concept (`turnId` vs `turn_id` vs `messageId`; `Chart` vs `VegaChart` vs `ChartPayload`).
- Inconsistent error handling: some routes throw, some return `{ ok: false }`, some return `Response.json({ error })`.
- Mixed validation: some boundaries use Zod, some hand-roll checks, some skip.
- Stringly-typed values where a union or const map exists elsewhere (tool names, roles, status fields).
- `'use client'` on components that don't need it; client components doing work that belongs on the server.

### Agent C — Dead, vestigial, or misplaced code
- Unused exports, unused props, unreachable branches, commented-out blocks, `TODO`s older than 30 days.
- Files in the wrong directory (utilities in components, components in lib).
- Feature flags / branches that always take one path.
- Mock data leaking into production paths (cross-check `CONTRIBUTING.md` §Mock data).

### Agent D — Maintainability hazards
- Functions >60 lines or with >3 levels of nesting.
- Modules with mixed responsibilities (one file owning UI + data fetch + parsing + types).
- Implicit coupling: components reading globals, hidden ordering requirements between calls.
- Tests missing for code paths where a regression would not type-check away (LLM prompt construction, tool schema round-trip, turn log shape).
- ADR-worthy decisions made in code without a corresponding `docs/decisions/NNNN-*.md`.

## Phase 2 — Synthesize

Aggregate findings into one report at `$CLAUDE_JOB_DIR/cleanup-report.md` with three sections:

1. **Fix now** — low-risk, high-value, behavior-preserving. Renames, deletions of dead code, consolidating duplicates with no semantic change, moving files, tightening types.
2. **Propose** — anything that changes a contract, an API shape, or a user-visible behavior. List the option, the tradeoff, the affected files. Stop here for these — do not fix without confirmation.
3. **Enforce going forward** — patterns worth codifying as rules (lint rules, CONTRIBUTING additions, ADRs).

Print this report to the conversation before fixing anything.

## Phase 3 — Fix (Section 1 only)

For each "Fix now" item:
- One logical change per commit (per `CONTRIBUTING.md` §Commit messages).
- Subject line sentence-cased, imperative, ≤70 chars. Body explains *why*, not *what*.
- After each commit: `npx tsc --noEmit` and `npm run lint` must be clean.
- After the full batch: `npm run build` must succeed and `npx vitest run` (if tests exist) must pass.
- Never `--no-verify`. Never rebase. Never force-push. (Per `CONTRIBUTING.md` §Git policy.)

## Phase 4 — Document

For each "Enforce going forward" item that survives review:

- If it's a coding rule → append to `CONTRIBUTING.md` §Code or a new sub-section. One sentence rule, one sentence rationale.
- If it's a decision with tradeoffs → new ADR at `docs/decisions/NNNN-slug.md` following the format of `0001-render-chart-payload.md`. Status `Accepted`.
- If it's mechanically enforceable → add an ESLint rule in `eslint.config.mjs` and note it in `CONTRIBUTING.md`. Prefer lint over prose; rules the linter enforces never rot.

## Phase 5 — Wrap

Final message includes:
- Count of fixes applied, files touched, LOC delta.
- Each new ADR and CONTRIBUTING change, by path.
- The "Propose" list, unchanged, waiting for direction.
- Any finding skipped as false-positive, one line each.

## Out of scope

- Dependency upgrades.
- Adding new features, tests for features that don't exist, or speculative abstractions.
- Reformatting that the linter doesn't already want.
- Touching `node_modules/`, `.next/`, build output.
- Changing the system prompt, tool schemas, or mock-data shape without an ADR (per `CONTRIBUTING.md` §LLM-facing surfaces).
