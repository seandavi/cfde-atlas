// Render a Vega-Lite spec to a PNG data URL off-screen.
//
// Used by the PDF and DOCX adapters (which need an image), not by the
// markdown / text / clipboard adapters (which use a placeholder line).

import embed, { type VisualizationSpec } from "vega-embed";

export async function specToPngDataUrl(
  spec: unknown,
  opts: { width?: number; scaleFactor?: number } = {},
): Promise<string> {
  // Off-screen container; vega-embed needs a real DOM node to render into.
  const host = document.createElement("div");
  host.style.position = "absolute";
  host.style.left = "-99999px";
  host.style.top = "0";
  host.style.width = `${opts.width ?? 720}px`;
  document.body.appendChild(host);

  try {
    const result = await embed(host, spec as VisualizationSpec, {
      actions: false,
      renderer: "canvas",
    });
    const url = await result.view.toImageURL("png", opts.scaleFactor ?? 2);
    result.finalize();
    return url;
  } finally {
    host.remove();
  }
}

/** Convert a PNG data URL to a Uint8Array (for DOCX inline embedding). */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
