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
  return mermaid.render(id, sanitizeMermaidSource(chart), container);
}

// Strict securityLevel strips raw `<br>` (and `\n` in plain quoted labels)
// from node text, collapsing multi-line labels into a single concatenated
// string. Convert `<br>`-bearing labels into mermaid markdown-string labels
// (`["`line\nline`"]`), which strict mode renders as a paragraph with `<br>`
// — same visual result, no HTML reaching the DOM unescaped.
const LABEL_PATTERN =
  /(\[\[|\(\(|\{\{|\[|\(|\{)("?)([^\[\]\(\)\{\}\n]*?<br\s*\/?\s*>[^\[\]\(\)\{\}\n]*?)\2(\]\]|\)\)|\}\}|\]|\)|\})/gi;

export function sanitizeMermaidSource(src: string): string {
  if (!/<br\s*\/?\s*>/i.test(src)) return src;
  return src.replace(LABEL_PATTERN, (_full, open, _quote, body, close) => {
    const stripped = body.replace(/^`+|`+$/g, "").trim();
    const withNewlines = stripped.replace(/<br\s*\/?\s*>/gi, "\n");
    return `${open}"\`${withNewlines}\`"${close}`;
  });
}

