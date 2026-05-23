import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { google } from "@ai-sdk/google";

import { SYSTEM_PROMPT } from "@/app/lib/prompts/system";
import { cfdeTools } from "@/app/lib/tools";

// gemini-3.5-flash per BLUEPRINT §Model choice. Swap is one line.
const MODEL_ID = "gemini-3.5-flash";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: google(MODEL_ID),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: cfdeTools,
    // Step budget covers the explore → query → chart → narrate loop.
    // Was 8; multi-table answers exhausted that before the model could
    // write its closing prose (see #27). 20 leaves ample headroom for
    // describe_table + a few exploratory queries + the final summary.
    stopWhen: stepCountIs(20),
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      if (error instanceof Error) return error.message;
      if (typeof error === "string") return error;
      return "An error occurred while generating a response.";
    },
  });
}
