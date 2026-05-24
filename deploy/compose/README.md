# cfde-atlas — compose deployment

This directory holds the production docker-compose wiring for cfde-atlas. It lives in the app repo (rather than in [`monode`](https://github.com/seandavi/monode)) so a code change and its deployment change ship in the same PR.

monode still owns the *shared* infra that this compose file consumes — Traefik, the `proxy` and `pg_ducklake_stack_default` networks, the Vector container that tails this app's telemetry, the ClickHouse table the telemetry lands in, and the GCP terraform that manages the DNS record + uptime check. Anything mono-app stays here; anything genuinely shared stays in monode.

## What this provides

- One Next.js container exposing `:3000` internally.
- Public hostname `cfde-atlas.cancerdatasci.org` (Cloudflare DNS-only A record → 140.226.4.71, managed by `monode/infrastructure/terraform/apps/cfde_atlas/`).
- TLS via Traefik using the Cloudflare Origin Cert fallback in `monode/infrastructure/compose/traefik/config/tls.yml` (Cloudflare is in proxy mode, so LE TLS-ALPN-01 cannot complete; the origin cert is valid through 2041).
- No authentication. BLUEPRINT §Auth defers gating; the surface is public.

## First-time setup on a host

```bash
# 1. Clone the app repo
cd ~/Documents/git
git clone https://github.com/seandavi/cfde-atlas.git
cd cfde-atlas/deploy/compose

# 2. Configure environment
cp .env.example .env
# Fill in GOOGLE_GENERATIVE_AI_API_KEY, DATABASE_URL, SESSION_SIGNING_SECRET.
# (DATABASE_URL password lives in GSM — see .env.example for the gcloud invocation.)

# 3. Ensure shared infra is up (monode owns these)
docker network ls | grep -E 'proxy|pg_ducklake_stack_default'

# 4. Create the telemetry log directory (owned by the container's uid)
sudo install -d -o 1001 -g 1001 /data/davsean/cfde_atlas_logs

# 5. Bring up the service
docker compose up -d
docker compose logs -f cfde-atlas
```

## Routine updates

```bash
cd ~/Documents/git/cfde-atlas
git pull
cd deploy/compose
docker compose pull
docker compose up -d
```

The image is published to GHCR by the `Publish container image` workflow on every push to `main`. `:latest` tracks main HEAD; pin to a specific commit with `ghcr.io/seandavi/cfde-atlas:sha-<short>` when needed.

## Related artifacts

- App + Dockerfile: this repo (`../docker/Dockerfile`).
- Shared infra: [`seandavi/monode`](https://github.com/seandavi/monode) — Traefik, Vector, ClickHouse, networks, terraform.
- DNS record: `monode/infrastructure/terraform/apps/cfde_atlas/`.
- Telemetry sink: `monode/infrastructure/compose/vector/vector.yaml` + `monode/infrastructure/compose/clickhouse/migrations/002_cfde_atlas_chat_turns.sql`.

## Why no Cloudflare Access yet

Cloudflare Access *is* available on this hostname — proxy mode is verified. It is not wired in yet because:

1. The CF API token in GSM doesn't have `Account → Access: Apps and Policies : Edit` / `Service Tokens : Edit` scope, so Tofu cannot manage `cloudflare_zero_trust_access_application` resources today. Needs a scope expansion + secret-version rotation.
2. BLUEPRINT §Auth defers gating; cfde-atlas is intentionally public during early use.

When (1) is fixed and (2) flips, add `cloudflare_zero_trust_access_application` + `cloudflare_zero_trust_access_policy` to `monode/.../terraform/apps/cfde_atlas/main.tf`.
