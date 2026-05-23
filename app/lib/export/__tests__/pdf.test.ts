import { describe, expect, it, vi } from "vitest";

const { getBlobMock, createPdfMock } = vi.hoisted(() => {
  const getBlobMock = vi.fn(async () => new Blob(["pdf"]));
  // Typed arg-tuple so `mock.calls[0][0]` resolves to the captured
  // document definition instead of an empty tuple.
  const createPdfMock = vi.fn<(definition: unknown) => { getBlob: typeof getBlobMock }>(
    () => ({ getBlob: getBlobMock }),
  );
  return { getBlobMock, createPdfMock };
});

vi.mock("pdfmake/build/pdfmake", () => ({
  default: { createPdf: createPdfMock },
}));

vi.mock("pdfmake/build/vfs_fonts", () => ({
  default: {
    vfs: {
      "Roboto-Regular.ttf": "stub",
    },
  },
}));

import { renderPdf } from "../pdf";

describe("renderPdf", () => {
  it("does not require an undefined Courier font for code blocks", async () => {
    const ctx = {
      messages: [
        {
          id: "u1",
          role: "user",
          parts: [{ type: "text", text: "Show SQL" }],
        },
        {
          id: "a1",
          role: "assistant",
          parts: [{ type: "text", text: "```sql\nSELECT 1;\n```" }],
        },
      ],
      message: {
        id: "a1",
        role: "assistant",
        parts: [{ type: "text", text: "```sql\nSELECT 1;\n```" }],
      },
    } as const;

    await renderPdf(ctx as never);

    expect(createPdfMock).toHaveBeenCalledTimes(1);
    expect(getBlobMock).toHaveBeenCalledTimes(1);
    const definition = createPdfMock.mock.calls[0][0] as {
      styles?: { mono?: { font?: string } };
    };
    expect(definition.styles?.mono?.font).toBeUndefined();
  });
});
