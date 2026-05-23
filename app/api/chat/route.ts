import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { google } from "@ai-sdk/google";

import { buildSystemPrompt } from "@/app/lib/prompts/system";
import { cfdeTools } from "@/app/lib/tools";

// gemini-3.5-flash per BLUEPRINT §Model choice. Swap is one line.
const MODEL_ID = "gemini-3.5-flash";

// Step budget covers the explore → query → chart → narrate loop.
// Was 8; multi-table answers exhausted that before the model could
// write its closing prose (see #27). The system prompt is built from
// this same constant so the model knows the envelope it has to plan in.
const MAX_STEPS = 20;

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: google(MODEL_ID),
    system: buildSystemPrompt({ maxSteps: MAX_STEPS }),
    messages: await convertToModelMessages(messages),
    tools: cfdeTools,
    stopWhen: stepCountIs(MAX_STEPS),
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      if (error instanceof Error) return error.message;
      if (typeof error === "string") return error;
      return "An error occurred while generating a response.";
    },
  });
}
