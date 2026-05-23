import { cookies } from "next/headers";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { google } from "@ai-sdk/google";

import { getOrCreateCachedContent } from "@/app/lib/cache/gemini-cache";
import { buildSystemPrompt } from "@/app/lib/prompts/system";
import { sessionCookieName } from "@/app/lib/sessions";
import { cfdeTools } from "@/app/lib/tools";
import {
  appendTurnEvent,
  responseTextCharCount,
  tallyToolCalls,
} from "@/app/lib/turn-log";

// gemini-3.5-flash per BLUEPRINT §Model choice. Swap is one line.
const MODEL_ID = "gemini-3.5-flash";

// Step budget covers the explore → query → chart → narrate loop.
// Was 8; multi-table answers exhausted that before the model could
// write its closing prose (see #27). The system prompt is built from
// this same constant so the model knows the envelope it has to plan in.
const MAX_STEPS = 40;

export const maxDuration = 60;

function extractSessionIdFromCookie(rawCookie: string | undefined): string | null {
  // The session cookie is `<session_id>.<hmac>`. Telemetry just needs
  // the id for join-back to chat.sessions; signature verification is
  // the write path's job (PUT /api/sessions/[id]), not telemetry's.
  if (!rawCookie) return null;
  const dot = rawCookie.indexOf(".");
  if (dot <= 0) return null;
  return rawCookie.slice(0, dot);
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const cookieStore = await cookies();
  const sessionId = extractSessionIdFromCookie(
    cookieStore.get(sessionCookieName())?.value,
  );
  const startedAt = Date.now();

  const systemPrompt = buildSystemPrompt({ maxSteps: MAX_STEPS });

  // Best-effort: when caching is enabled we attach the cache resource
  // name via providerOptions. A miss / disabled flag returns null and
  // we fall through to the uncached path; never block the turn on it.
  let cachedContent: string | null = null;
  try {
    cachedContent = await getOrCreateCachedContent({
      modelId: MODEL_ID,
      systemPrompt,
    });
  } catch (e) {
    console.warn("[gemini-cache] getOrCreateCachedContent threw", e);
  }

  const result = streamText({
    model: google(MODEL_ID),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: cfdeTools,
    stopWhen: stepCountIs(MAX_STEPS),
    providerOptions: cachedContent
      ? { google: { cachedContent } }
      : undefined,
    onFinish: async (event) => {
      const e = event as {
        finishReason?: string;
        usage?: {
          inputTokens?: number;
          outputTokens?: number;
          totalTokens?: number;
          cachedInputTokens?: number;
        };
        totalUsage?: {
          inputTokens?: number;
          outputTokens?: number;
          totalTokens?: number;
          cachedInputTokens?: number;
        };
        providerMetadata?: {
          google?: {
            usageMetadata?: { cachedContentTokenCount?: number | null };
          };
        };
        steps?: ReadonlyArray<{ toolCalls?: Array<{ toolName: string }> }>;
        response?: {
          messages?: ReadonlyArray<{
            id?: string;
            content?: ReadonlyArray<{ type?: string; text?: string }>;
          }>;
        };
      };
      const usage = e.totalUsage ?? e.usage ?? {};
      const cachedTokens =
        usage.cachedInputTokens ??
        e.providerMetadata?.google?.usageMetadata?.cachedContentTokenCount ??
        null;
      const { perTool, total } = tallyToolCalls(e.steps);
      const lastMessageId =
        e.response?.messages?.[e.response.messages.length - 1]?.id ?? null;
      await appendTurnEvent({
        timestamp: new Date().toISOString(),
        session_id: sessionId,
        message_id: lastMessageId,
        client_fingerprint: null,
        model_id: MODEL_ID,
        finish_reason: e.finishReason ?? null,
        step_count: e.steps?.length ?? null,
        input_tokens: usage.inputTokens ?? null,
        output_tokens: usage.outputTokens ?? null,
        total_tokens: usage.totalTokens ?? null,
        duration_ms: Date.now() - startedAt,
        tool_calls: perTool,
        tool_call_total: total,
        response_text_chars: responseTextCharCount(e.response),
        cached_input_tokens: cachedTokens,
        error: null,
      });
    },
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      // Mirror the error into the telemetry stream too. onFinish does
      // NOT fire when the stream aborts on error, so this path is the
      // only place an error turn ever gets logged.
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "An error occurred while generating a response.";
      appendTurnEvent({
        timestamp: new Date().toISOString(),
        session_id: sessionId,
        message_id: null,
        client_fingerprint: null,
        model_id: MODEL_ID,
        finish_reason: "error",
        step_count: null,
        input_tokens: null,
        output_tokens: null,
        total_tokens: null,
        duration_ms: Date.now() - startedAt,
        tool_calls: {},
        tool_call_total: 0,
        response_text_chars: null,
        cached_input_tokens: null,
        error: message,
      }).catch(() => undefined);
      return message;
    },
  });
}
