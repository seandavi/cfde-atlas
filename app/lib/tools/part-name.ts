import type { DynamicToolUIPart, ToolUIPart } from "ai";

export type ToolPart = ToolUIPart | DynamicToolUIPart;

export function toolNameOf(part: ToolPart): string {
  return part.type === "dynamic-tool"
    ? part.toolName
    : part.type.replace(/^tool-/, "");
}
