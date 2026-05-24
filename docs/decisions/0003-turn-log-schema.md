# 0003 — Turn-log event schema (`turns.log`)

- **Status:** Accepted
- **Date:** 2026-05-24
- **Deciders:** Sean Davis, Claude
- **Affects:** `app/lib/turn-log.ts`, `app/api/chat/route.ts`, deploy/compose mounts of `/data/davsean/cfde_atlas_logs`, downstream Vector → ClickHouse ingest

## Context

Every assistant turn writes one row of telemetry. The route handler emits the event in `onFinish` (success) and `onError` (failure). The row crosses a process boundary: it is appended to a JSONL file (`turns.log`) which a Vector daemon tails and ships to ClickHouse. The shape of `TurnLogEvent` is therefore a contract between three independent pieces of code — the Next.js route, the Vector parse config, and the ClickHouse table — without a schema registry between them.

The shape is currently encoded only as a TypeScript `type` in `app/lib/turn-log.ts`. A reader landing on Vector or ClickHouse has nothing to look at.

## Decision

**Adopt JSONL with the schema declared in `app/lib/turn-log.ts` as the contract**, and treat that file as the source of truth. Vector and ClickHouse configurations follow it; not the other way around.

Wire format:

- One JSON object per line (no concatenation, no envelopes, no JSON array).
- UTF-8.
- File path: `/var/log/cfde-atlas/turns.log` (overridable via `CFDE_ATLAS_TURN_LOG_PATH`).
- Newline-terminated.

Required fields (see `TurnLogEvent`):

- `timestamp` — ISO-8601 UTC string, parses as `DateTime64(3, 'UTC')` in ClickHouse.
- `session_id`, `message_id`, `client_fingerprint` — nullable; join keys back to Postgres `chat.sessions` and the UI message id.
- `model_id` — which model the chat route invoked (sourced from the same `MODEL_ID` constant the route uses).
- `finish_reason` — `streamText`'s reason, or `"error"` if the row was emitted from `onError`.
- `step_count`, `input_tokens`, `output_tokens`, `total_tokens` — nullable; some providers omit token counts.
- `duration_ms` — wall-clock from request start.
- `tool_calls` — free-form `Record<string, number>` keyed by tool name.
- `tool_call_total` — denormalized total across `tool_calls`.
- `response_text_chars` — character count across text parts emitted by the assistant.
- `error` — only set when the row is an error turn; otherwise null.

Failure mode for the writer: if `appendFile` fails (e.g. the mount is absent in dev), the event is mirrored to stderr via `console.error` and the user request is **not** affected.

## Reasons

- **JSONL is what Vector parses cheapest.** No envelope, no batching, every line independently consumable. A truncated last line at process kill costs one event, not the file.
- **Free-form `tool_calls` keeps schema additions out of the migration path.** When we add a fifth tool, the field shape doesn't change; only the keyspace inside the JSON object does. ClickHouse's `Map(String, UInt32)` ingests it without schema migration.
- **Denormalized `tool_call_total`.** Cheap aggregates ("calls per turn over time") don't have to sum over a JSON map at query time.
- **Telemetry must not break the user path.** The route's `onError` calls `appendTurnEvent(...).catch(() => undefined)` and the writer itself swallows `appendFile` failures. The route is the user's response; the log is best-effort.

## Costs we accept

- **Silent degradation in dev.** If the bind mount is missing, events go to stderr only — easy to miss while developing if `npm run dev` output is collapsed. Acceptable trade-off; the alternative (failing the user request on a missing log file) is worse.
- **Field-shape changes are unversioned.** Adding a nullable field is safe (existing consumers ignore unknown keys). Renaming or removing a field would break Vector / ClickHouse; we don't do that without coordinating with the ingest side.
- **No schema versioning.** A `schema_version` field could be added cheaply, but until we have a second producer or a renaming need, it would be cargo culture.

## Revisit triggers

Switch the schema, or introduce a versioning discipline, **when any of these holds:**

1. We add a second producer writing into the same log stream (e.g. background jobs, evals).
2. We rename or remove a field — the migration plan needs an ADR even if the change itself is small.
3. ClickHouse query patterns need a column the JSONL doesn't carry (e.g. trace IDs, per-tool latency).
4. The error-turn schema diverges from the success-turn schema enough that splitting into two streams becomes simpler than null fields.

## Out of scope

- The Vector and ClickHouse configurations themselves. Those follow this contract but live in the deploy repo.
- Rating / feedback events (issue #36). Those are a separate stream against `chat.sessions`, not turn-log lines.
- PII review. `client_fingerprint` is already hashed; no PII is intended to land in the log.
