export type MermaidRenderResult = {
  svg: string;
  bindFunctions?: (element: Element) => void;
};

export type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (
    id: string,
    src: string,
    container?: Element,
  ) => Promise<MermaidRenderResult>;
};

export function mermaidConfig(theme: "dark" | "default"): Record<string, unknown> {
  return {
    startOnLoad: false,
    theme,
    securityLevel: "strict",
    fontFamily: "inherit",
  };
}

export async function renderMermaidSvg({
  mermaid,
  id,
  chart,
  container,
  theme,
}: {
  mermaid: MermaidApi;
  id: string;
  chart: string;
  container: Element;
  theme: "dark" | "default";
}): Promise<MermaidRenderResult> {
  mermaid.initialize(mermaidConfig(theme));
  return mermaid.render(id, chart, container);
}

