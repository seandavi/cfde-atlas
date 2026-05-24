import { describe, expect, it, vi } from "vitest";

import { mermaidConfig, renderMermaidSvg, type MermaidApi } from "../mermaid";

describe("mermaid helpers", () => {
  it("builds a stable config shape", () => {
    expect(mermaidConfig("default")).toMatchObject({
      startOnLoad: false,
      theme: "default",
      securityLevel: "strict",
      fontFamily: "inherit",
    });
  });

  it("initializes and renders into the provided container", async () => {
    const container = { nodeType: 1 } as unknown as Element;
    const renderResult = { svg: "<svg></svg>" };

    const mermaid: MermaidApi = {
      initialize: vi.fn(),
      render: vi.fn(async () => renderResult),
    };

    const result = await renderMermaidSvg({
      mermaid,
      id: "id1",
      chart: "graph TD;A-->B;",
      container,
      theme: "dark",
    });

    expect(mermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ theme: "dark" }),
    );
    expect(mermaid.render).toHaveBeenCalledWith(
      "id1",
      "graph TD;A-->B;",
      container,
    );
    expect(result).toEqual(renderResult);
  });
});

