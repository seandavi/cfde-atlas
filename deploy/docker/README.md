# Docker deployment

Self-hosted target for cfde-atlas: a single Next.js container running on `onclappc02` behind the shared Traefik instance.

Companion deployment dir for the eventual Cloudflare Workers path lives at [`../cloudflare/`](../cloudflare/).

## Build

From the **repo root** (not this directory — the build context is the whole app):

```bash
docker build -f deploy/docker/Dockerfile -t monode/cfde-atlas:local .
```

The image is ~200 MB based on `node:22-alpine` + Next.js standalone output. It runs as non-root user `nextjs` and exposes `:3000`.

## Run (standalone test)

```bash
docker run --rm -it -p 3000:3000 \
  -e GOOGLE_GENERATIVE_AI_API_KEY="…" \
  monode/cfde-atlas:local
```

Then `curl http://localhost:3000`. Until `DATABASE_URL` is wired (per BLUEPRINT, the chat tools currently run against mocked sample data) no Postgres connection is needed.

## Run (production, via Traefik)

The production compose entry that wires this image into the shared Traefik instance lives in the infrastructure repo at:

```
monode/infrastructure/compose/cfde_atlas/
```

It expects the `monode/cfde-atlas:local` tag to exist on the host. Build there first, then `docker compose up -d` in that directory.

## What this Dockerfile assumes

- `next.config.ts` has `output: 'standalone'` (it does).
- Repository root is the build context (the `-f deploy/docker/Dockerfile .` invocation).
- `public/` and `.next/static/` are not part of the standalone bundle and must be copied separately. (Already wired.)
- `package-lock.json` exists and is the source of truth for installs (`npm ci`).

## What this Dockerfile does NOT do

- It is not OpenNext / Cloudflare Workers. That's [`../cloudflare/`](../cloudflare/) — different build process, different runtime.
- It is not Vercel. Vercel doesn't use Dockerfiles.
- It does not bake secrets in. `GOOGLE_GENERATIVE_AI_API_KEY` (and any future `DATABASE_URL`) come from the compose env or a `.env` file at runtime, never the image.
