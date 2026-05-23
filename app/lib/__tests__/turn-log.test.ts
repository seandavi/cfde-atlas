import { describe, expect, it } from "vitest";

import { responseTextCharCount, tallyToolCalls } from "../turn-log";

describe("tallyToolCalls", () => {
  it("returns zeros when no steps", () => {
    expect(tallyToolCalls(undefined)).toEqual({ perTool: {}, total: 0 });
    expect(tallyToolCalls([])).toEqual({ perTool: {}, total: 0 });
  });

  it("counts per tool across steps", () => {
    const out = tallyToolCalls([
      { toolCalls: [{ toolName: "list_tables" }] },
      {
        toolCalls: [
          { toolName: "describe_table" },
          { toolName: "describe_table" },
        ],
      },
      { toolCalls: [{ toolName: "run_query" }] },
      { toolCalls: undefined },
      { toolCalls: [{ toolName: "render_chart" }] },
    ]);
    expect(out.total).toBe(5);
    expect(out.perTool).toEqual({
      list_tables: 1,
      describe_table: 2,
      run_query: 1,
      render_chart: 1,
    });
  });
});

describe("responseTextCharCount", () => {
  it("returns null when no response", () => {
    expect(responseTextCharCount(undefined)).toBeNull();
    expect(responseTextCharCount({})).toBeNull();
  });

  it("sums character counts across text parts in all messages", () => {
    expect(
      responseTextCharCount({
        messages: [
          {
            content: [
              { type: "text", text: "hello " },
              { type: "tool-call" },
              { type: "text", text: "world" },
            ],
          },
          { content: [{ type: "text", text: "!" }] },
        ],
      }),
    ).toBe(12);
  });
});
