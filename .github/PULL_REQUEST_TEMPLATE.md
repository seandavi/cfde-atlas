## What

One paragraph on what changes. The *why* is more interesting than the *what* — well-named commits already cover what.

## Why

Why this, why now, and any tradeoff you accepted. Link the issue (`Closes #N`).

## How to verify

Concrete steps a reviewer can follow to see it work. Screenshots welcome for UI changes.

## Decision record

- [ ] No ADR needed (small / mechanical change)
- [ ] ADR added in `docs/decisions/` (link below)
- [ ] ADR updated (link below)

## Checklist

- [ ] `npx tsc --noEmit` is clean
- [ ] `npm run lint` is clean (or noise is explained)
- [ ] New dependencies justified in a commit message
- [ ] System prompt / tool surface changes considered for ADR
- [ ] No real, unpublished metrics added to mock data
