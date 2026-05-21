# Cloudflare deployment (placeholder)

This directory is **reserved** for a future Cloudflare Workers + Hyperdrive deployment path. Nothing here builds or deploys today — see [`../docker/`](../docker/) for the current production target.

## Why this slot exists

The campus firewall on `onclappc02` (which hosts the Docker deployment) blocks outbound UDP/7844 and TCP/7844 — both Cloudflare Tunnel data-plane ports. An IT ticket is open to open those ports to Cloudflare's tunnel edge ranges; if granted, the deployment can move to Workers + Hyperdrive, with the database reachable through a Tunnel rather than directly from the same host.

See `monode/infrastructure/compose/NETWORK_CONSTRAINTS.md` for the full constraint inventory.

## What goes here, when it goes here

If/when the move happens, this directory will contain:

- `wrangler.toml` — Workers project config (name, account ID, route, bindings).
- `open-next.config.ts` — [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) adapter config.
- A Hyperdrive binding for the Postgres connection (configured in the Cloudflare dashboard; the binding name appears in `wrangler.toml`).
- An `env.example` documenting Worker secrets (`GOOGLE_GENERATIVE_AI_API_KEY`, etc.).

The application code in `app/` should not need to change. The DB access module should already be the one swap-point that picks up the Hyperdrive `env.HYPERDRIVE.connectionString` instead of `process.env.DATABASE_URL`.

## Why two deployment targets coexist

- **`deploy/docker/`** is what runs today, in the trust boundary we control (campus network → Traefik → container → Postgres on the same host).
- **`deploy/cloudflare/`** is the eventual production target if/when CF Tunnel becomes available, with Worker isolates close to users, Hyperdrive pooling and caching, and no operational coupling to the campus host.

Keeping the deployment artifacts side-by-side makes the migration a deliberate, side-by-side change rather than a destructive rewrite.
