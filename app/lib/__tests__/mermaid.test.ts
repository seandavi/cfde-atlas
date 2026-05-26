import { describe, expect, it, vi } from "vitest";

import {
  mermaidConfig,
  renderMermaidSvg,
  sanitizeMermaidSource,
  type MermaidApi,
} from "../mermaid";

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

  it("passes <br>-bearing chart sources through the sanitizer", async () => {
    const container = { nodeType: 1 } as unknown as Element;
    const mermaid: MermaidApi = {
      initialize: vi.fn(),
      render: vi.fn(async () => ({ svg: "<svg></svg>" })),
    };

    await renderMermaidSvg({
      mermaid,
      id: "id2",
      chart: "graph TD\n  A[Foo<br>Bar]",
      container,
      theme: "default",
    });

    const [, passedChart] = (mermaid.render as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(passedChart).toContain('A["`Foo\nBar`"]');
  });
});

describe("sanitizeMermaidSource", () => {
  it("leaves sources without <br> untouched", () => {
    const src = "graph TD\n  A[Foo] --> B[Bar]";
    expect(sanitizeMermaidSource(src)).toBe(src);
  });

  it("rewrites unquoted square-bracket labels", () => {
    expect(sanitizeMermaidSource("A[OT2OD026675<br>Carnegie Mellon]")).toBe(
      'A["`OT2OD026675\nCarnegie Mellon`"]',
    );
  });

  it("rewrites double-quoted square-bracket labels", () => {
    expect(
      sanitizeMermaidSource('P1["Nature 2019<br>PMID: 31597973"]'),
    ).toBe('P1["`Nature 2019\nPMID: 31597973`"]');
  });

  it("handles multiple <br> in one label", () => {
    expect(
      sanitizeMermaidSource(
        'C1["Nat Aging 2022<br>PMID: 36936385<br>SenNet Consortium Paper"]',
      ),
    ).toBe(
      'C1["`Nat Aging 2022\nPMID: 36936385\nSenNet Consortium Paper`"]',
    );
  });

  it("handles self-closing <br/>", () => {
    expect(sanitizeMermaidSource("A[Foo<br/>Bar]")).toBe('A["`Foo\nBar`"]');
  });

  it("handles round-bracket labels", () => {
    expect(sanitizeMermaidSource("A(Foo<br>Bar)")).toBe('A("`Foo\nBar`")');
  });

  it("handles brace-bracket labels", () => {
    expect(sanitizeMermaidSource("A{Foo<br>Bar}")).toBe('A{"`Foo\nBar`"}');
  });

  it("leaves subgraph titles alone (they tolerate raw text)", () => {
    const src = "subgraph SenNet [SenNet Portal & Consortium Papers]";
    expect(sanitizeMermaidSource(src)).toBe(src);
  });

  it("rewrites every label in a multi-label source", () => {
    const src = `graph TD\n  G1[OT2OD026675<br>Carnegie Mellon]\n  P1["Nature 2019<br>PMID: 31597973"]`;
    const out = sanitizeMermaidSource(src);
    expect(out).toContain('G1["`OT2OD026675\nCarnegie Mellon`"]');
    expect(out).toContain('P1["`Nature 2019\nPMID: 31597973`"]');
  });
});

