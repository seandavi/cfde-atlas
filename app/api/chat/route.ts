import { cookies } from "next/headers";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { google } from "@ai-sdk/google";

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

// Shape of the streamText onFinish event we care about. Captured into
// a closure so the UI-stream onFinish (which knows the UIMessage id)
// can stitch it together with the framework-level usage/steps/response.
type FinishCapture = {
  finishReason?: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  totalUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  steps?: ReadonlyArray<{ toolCalls?: Array<{ toolName: string }> }>;
  response?: {
    messages?: ReadonlyArray<{
      content?: ReadonlyArray<{ type?: string; text?: string }>;
    }>;
  };
};

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const cookieStore = await cookies();
  const sessionId = extractSessionIdFromCookie(
    cookieStore.get(sessionCookieName())?.value,
  );
  const startedAt = Date.now();
  // Closure that the UI-stream onFinish reads to stitch the model-level
  // event (usage, steps, finishReason) with the UI-level UIMessage id.
  let finishCapture: FinishCapture | null = null;

  const result = streamText({
    model: google(MODEL_ID),
    system: buildSystemPrompt({ maxSteps: MAX_STEPS }),
    messages: await convertToModelMessages(messages),
    tools: cfdeTools,
    stopWhen: stepCountIs(MAX_STEPS),
    // streamText's onFinish does NOT carry the UIMessage id — its
    // `response.messages[].id` is undefined because AssistantModelMessage
    // has no id field (only role + content). Capture the event here;
    // the UI-stream onFinish below has the id and does the write.
    onFinish: (event) => {
      finishCapture = event as FinishCapture;
    },
  });

  return result.toUIMessageStreamResponse({
    onFinish: async ({ responseMessage, isAborted }) => {
      // isAborted → fall through to onError below for the write.
      if (isAborted) return;
      const e = finishCapture ?? {};
      const usage = e.totalUsage ?? e.usage ?? {};
      const { perTool, total } = tallyToolCalls(e.steps);
      await appendTurnEvent({
        timestamp: new Date().toISOString(),
        session_id: sessionId,
        message_id: responseMessage?.id ?? null,
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
        error: null,
      });
    },
    onError: (error) => {
      // Mirror the error into the telemetry stream too. The UI-stream
      // onFinish does fire on abort but with no message metadata; this
      // path is what surfaces the error string itself.
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
        error: message,
      }).catch(() => undefined);
      return message;
    },
  });
}
