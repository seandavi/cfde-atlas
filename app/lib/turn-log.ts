import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Where the chat-turn JSONL stream is written. Vector tails this file
// and ships rows to ClickHouse. Mounted by the production compose file
// from /data/davsean/cfde_atlas_logs on the host.
//
// In dev the path likely does not exist; writes fall back to stderr
// via console.error so the developer still sees the event without
// needing to provision the bind mount.
const DEFAULT_LOG_PATH = "/var/log/cfde-atlas/turns.log";

function logPath(): string {
  return process.env.CFDE_ATLAS_TURN_LOG_PATH || DEFAULT_LOG_PATH;
}

export type TurnLogEvent = {
  // ISO-8601 UTC. Vector parses this into a DateTime64(3, 'UTC') column.
  timestamp: string;
  // Identifiers for join-back to the persisted session in Postgres.
  session_id: string | null;
  // The assistant UIMessage.id (matches the row the user rates via #36).
  message_id: string | null;
  // Caller cookie / IP-hash fingerprint mirrored from chat.sessions.
  client_fingerprint: string | null;
  // Which model the route handler used. Pulled from the same constant
  // the chat route uses to invoke streamText.
  model_id: string;
  // streamText finishReason: 'stop' | 'length' | 'tool-calls' | 'error' | …
  finish_reason: string | null;
  // Framework's reported step count (NOT the UI's tool-parts count).
  step_count: number | null;
  // Token usage. Some providers omit a field; null → not reported.
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  // Wall-clock duration from request start to stream finish.
  duration_ms: number | null;
  // Per-tool tally (e.g. { list_tables: 1, describe_table: 1, run_query: 4, render_chart: 1 }).
  // Free-form JSON so additions don't require a schema migration.
  tool_calls: Record<string, number>;
  // Total across all tools — denormalized for cheap aggregates.
  tool_call_total: number;
  // Rough output-size signal. Counts characters across all text parts
  // the assistant emitted; useful for plotting answer-length over time.
  response_text_chars: number | null;
  // Set if the stream ended in onError. Otherwise null.
  error: string | null;
};

// One-shot dirname memoization. We do not log the error from mkdir;
// EEXIST is fine, anything else (permission) will surface from
// appendFile on the first write attempt.
let dirEnsured = false;
async function ensureDir(): Promise<void> {
  if (dirEnsured) return;
  try {
    await mkdir(path.dirname(logPath()), { recursive: true });
  } catch {
    // Swallow — appendFile will report the real failure mode.
  }
  dirEnsured = true;
}

export async function appendTurnEvent(event: TurnLogEvent): Promise<void> {
  const line = `${JSON.stringify(event)}\n`;
  try {
    await ensureDir();
    await appendFile(logPath(), line, { encoding: "utf8" });
  } catch (err) {
    // Telemetry failures must not break the user request. Fall back to
    // stderr so the line is at least visible in container logs; Vector
    // can be wired to docker_logs later if the file path is unavailable.
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(`[turn-log] write failed (${msg}): ${line.trimEnd()}`);
  }
}

// ---------------------------------------------------------------------------
// Aggregation helpers — invoked from the chat route's onFinish callback.
// ---------------------------------------------------------------------------

type StreamTextStep = {
  toolCalls?: Array<{ toolName: string }> | undefined;
};

export function tallyToolCalls(
  steps: ReadonlyArray<StreamTextStep> | undefined,
): { perTool: Record<string, number>; total: number } {
  const perTool: Record<string, number> = {};
  let total = 0;
  for (const step of steps ?? []) {
    for (const call of step.toolCalls ?? []) {
      const name = call.toolName ?? "unknown";
      perTool[name] = (perTool[name] ?? 0) + 1;
      total += 1;
    }
  }
  return { perTool, total };
}

type StreamTextResponse = {
  messages?: ReadonlyArray<{
    content?: ReadonlyArray<{ type?: string; text?: string }>;
  }>;
};

export function responseTextCharCount(
  response: StreamTextResponse | undefined,
): number | null {
  if (!response?.messages) return null;
  let total = 0;
  for (const m of response.messages) {
    for (const c of m.content ?? []) {
      if (c.type === "text" && typeof c.text === "string") {
        total += c.text.length;
      }
    }
  }
  return total;
}
