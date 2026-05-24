# Contributing to cfde-atlas

Thanks for considering a contribution. cfde-atlas is a small, focused project — a conversational metrics interface for NIH program officers preparing for Council of Councils. Scope is deliberate and narrow (see [BLUEPRINT.md](BLUEPRINT.md) §"What this app is *not*").

This document covers how to set up the project, the conventions we follow, and what to expect from a pull request.

## Development setup

```bash
git clone https://github.com/seandavi/cfde-atlas.git
cd cfde-atlas
npm install
cp .env.example .env.local   # then fill in GOOGLE_GENERATIVE_AI_API_KEY
npm run dev
```

Requirements:

- **Node 20+**
- **npm** (the lockfile is `package-lock.json`; we standardized on npm)
- A Google Generative AI API key (Gemini)

The backend is currently mocked. Once Postgres is wired up, `DATABASE_URL` will be required as well.

### Useful commands

```bash
npm run dev          # next dev (Turbopack)
npm run build        # production build
npm run lint         # eslint
npx tsc --noEmit     # type check
```

## How to propose a change

1. **Open an issue first** for anything non-trivial — a bug report, a feature idea, a question about scope. This keeps the design conversation on the issue, not buried in PR comments.
2. **Branch off `main`.** Branch name should describe the change (e.g. `pin-composer-to-bottom`, not `feature/wip`).
3. **Commit thoroughly and often.** Prefer many small, well-described commits over one large unreviewable one. See *Commit messages* below.
4. **Open a PR** referencing the issue (`Closes #N`) with a short description focused on the *why*.
5. **Expect review.** Small PRs that touch one concern merge fastest.

### Commit messages

We use plain prose, no conventional-commits prefix. Match the existing log style:

- Subject line: sentence-cased, imperative, ≤ 70 characters. Describes the change at a glance ("Render Vega-Lite charts in the chat surface", not "feat: charts").
- Body: explain the *why* and any non-obvious tradeoffs. Wrap at ~75 columns. Reference issues with `#N`.
- One logical change per commit. If your branch ends up with a sprawling commit, split it before opening the PR.

### Git policy

- **Never rebase.** Always preserve history with merge commits. `git pull` merges; `git merge origin/main` brings in upstream changes. (Rationale: rebase rewrites history and can silently drop commits when stash interactions go wrong.)
- **Don't force-push.**
- **Don't skip hooks** (`--no-verify`). If a pre-commit hook fails, fix the underlying issue.

### Pre-PR checklist

- [ ] `npx tsc --noEmit` is clean.
- [ ] `npm run lint` is clean (or warnings are explained).
- [ ] If you added a dependency, you said *why* in the commit message.
- [ ] If you changed UI, you described how to reproduce the behavior locally (or attached a screenshot).
- [ ] If you changed the system prompt, the chat tool surface, or the data shape, you considered whether to record an ADR (see below).

## Architecture decisions

Substantive technical decisions — anything a future contributor would reasonably ask "why was this done this way?" about — live as Architecture Decision Records (ADRs) in [`docs/decisions/`](docs/decisions/).

When to write one:

- Choosing a library when multiple were plausible.
- Choosing a data / payload shape that constrains how features work later.
- Accepting a tradeoff that we know we'll revisit (with explicit revisit triggers).

Pattern: `docs/decisions/NNNN-slug.md`. See [`0001-render-chart-payload.md`](docs/decisions/0001-render-chart-payload.md) for the format. Status fields (`Accepted`, `Superseded by ADR-NNNN`) make the trail explicit.

ADRs are **part of the PR**, not a follow-up. If you're introducing a decision worth recording, the ADR is part of the change.

## Style

### Code

- TypeScript throughout. No `any` unless there is a comment explaining why.
- React: function components. `'use client'` only where the component genuinely needs the browser.
- Default to writing no comments. Add a comment when the *why* is non-obvious — a workaround for a third-party bug, a non-obvious invariant. Don't restate what the code already says.
- Don't add error handling, fallbacks, or validation for scenarios that can't happen. Only validate at system boundaries (user input, external APIs, LLM tool inputs).
- Imports inside `app/` use the `@/` alias. Parent-relative imports (`../...`) are reserved for files under `__tests__/` and are flagged by ESLint elsewhere.
- Date stamps in exports, the freshness footer, and any "as of today" string go through `app/lib/export/date.ts` (`todayIsoDate()` / `toIsoDate(iso)`). Don't inline `new Date().toISOString().slice(0, 10)`.

### LLM-facing surfaces

If your change touches the system prompt or the tool schemas / descriptions:

- Treat the prompt and the tool description text as **production strings** the model reads to decide what to do. Test that Gemini still uses the tools correctly after your change.
- Tool input schemas need to round-trip through Google's OpenAPI conversion. Stick to plain Zod types; nested `z.record(...)` schemas have been observed to cause Gemini to mangle keys. See ADR 0001 and the inline comment in `app/lib/tools/index.ts`.

### Mock data

`app/lib/tools/mock-data.ts` contains illustrative rows shaped like the real CFDE data. Keep it real-shaped (real-looking core project numbers, real CFDE programs) but **never put real, unpublished metrics in mock data** — anyone reading the repo will assume they are real until told otherwise.

## Reporting bugs

Use the bug template in [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/). At minimum:

- What you did (the prompt / action).
- What you expected.
- What actually happened (with a screenshot if relevant).
- Any visible error from the chat surface, the browser console, or `npm run dev` output.

## Reporting a security issue

**Do not file a public issue for security reports.** Email Sean Davis (see git history) with the details. We'll triage and coordinate disclosure.

## Code of Conduct

Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md). Be kind, be specific, assume good faith.

## License

By contributing, you agree that your contributions are licensed under the same MIT license that covers the project ([LICENSE](LICENSE)).
