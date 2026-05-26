import { describe, expect, it } from "vitest";
import { validateVegaLiteSpec } from "../index";

function validSpec() {
  return {
    mark: "bar",
    data: {
      values: [
        { program: "CFDE", funding: 5_140_000 },
        { program: "LINCS", funding: 4_220_000 },
      ],
    },
    encoding: {
      x: { field: "program", type: "nominal" },
      y: { field: "funding", type: "quantitative" },
    },
  };
}

function expectOk(spec: unknown, rows: number) {
  const r = validateVegaLiteSpec(spec);
  if (!r.ok) throw new Error(`expected ok, got: ${r.reason}`);
  expect(r.rowCount).toBe(rows);
}

function expectRejection(spec: unknown, fragment: string) {
  const r = validateVegaLiteSpec(spec);
  if (r.ok) throw new Error("expected rejection, got ok");
  expect(r.reason.toLowerCase()).toContain(fragment.toLowerCase());
}

describe("validateVegaLiteSpec", () => {
  it("accepts a minimal valid spec", () => {
    expectOk(validSpec(), 2);
  });

  it("accepts layered specs (no top-level mark)", () => {
    expectOk(
      {
        layer: [{ mark: "bar" }, { mark: "line" }],
        data: { values: [{ x: 1, y: 2 }] },
      },
      1,
    );
  });

  it("rejects null / non-object", () => {
    expectRejection(null, "json object");
    expectRejection("a string", "json object");
    expectRejection([], "json object");
  });

  it("rejects when no chart shape is declared", () => {
    expectRejection(
      { data: { values: [{ x: 1 }] } },
      "mark, layer",
    );
  });

  it("rejects missing data", () => {
    expectRejection({ mark: "bar" }, "spec.data");
  });

  it("rejects data.url (external data)", () => {
    expectRejection(
      { mark: "bar", data: { url: "https://example.com/x.csv" } },
      "url",
    );
  });

  it("rejects empty data.values", () => {
    expectRejection(
      { mark: "bar", data: { values: [] } },
      "empty",
    );
  });

  it("rejects non-array data.values", () => {
    expectRejection(
      { mark: "bar", data: { values: "not an array" } },
      "array of row objects",
    );
  });

  it("rejects row that is not an object", () => {
    expectRejection(
      { mark: "bar", data: { values: [{ x: 1 }, "broken"] } },
      "must be an object",
    );
  });

  it("catches the Gemini key-mangling pathology (keys containing quotes)", () => {
    // The bug we saw in practice: Gemini emitted '"data"' instead of 'data'.
    const mangled = {
      '"mark"': "bar",
      '"data"': {
        '"values"': [{ '"x"': 1 }],
      },
    };
    expectRejection(mangled, "literal quote");
  });

  it("rejects encoding that references a field not present in rows", () => {
    const spec = validSpec() as Record<string, unknown> & {
      encoding: { y: { field: string } };
    };
    spec.encoding.y.field = "missing_field";
    expectRejection(spec, 'field "missing_field"');
  });

  it("rejects bar mark combined with a log scale on a positional channel", () => {
    // The HuBMAP-footprint regression: bars + log x renders empty axes.
    const spec = {
      mark: "bar",
      data: {
        values: [
          { assay: "CODEX", files: 9_775_039 },
          { assay: "DESI-MS", files: 413 },
        ],
      },
      encoding: {
        x: {
          type: "quantitative",
          field: "files",
          scale: { type: "log" },
        },
        y: { type: "nominal", field: "assay" },
      },
    };
    expectRejection(spec, "log scale");
  });

  it("rejects area mark combined with a symlog scale on y", () => {
    const spec = {
      mark: "area",
      data: { values: [{ t: 1, v: 10 }, { t: 2, v: 100 }] },
      encoding: {
        x: { type: "quantitative", field: "t" },
        y: {
          type: "quantitative",
          field: "v",
          scale: { type: "symlog" },
        },
      },
    };
    expectRejection(spec, "symlog scale");
  });

  it("accepts bar mark with a log scale when an explicit x2 baseline is supplied", () => {
    const spec = {
      mark: "bar",
      data: {
        values: [
          { assay: "CODEX", lo: 1, files: 9_775_039 },
          { assay: "DESI-MS", lo: 1, files: 413 },
        ],
      },
      encoding: {
        x: {
          type: "quantitative",
          field: "lo",
          scale: { type: "log" },
        },
        x2: { field: "files" },
        y: { type: "nominal", field: "assay" },
      },
    };
    expectOk(spec, 2);
  });

  it("accepts point mark with a log scale on x", () => {
    const spec = {
      mark: "point",
      data: {
        values: [
          { assay: "CODEX", files: 9_775_039 },
          { assay: "DESI-MS", files: 413 },
        ],
      },
      encoding: {
        x: {
          type: "quantitative",
          field: "files",
          scale: { type: "log" },
        },
        y: { type: "nominal", field: "assay" },
      },
    };
    expectOk(spec, 2);
  });

  it("accepts bar mark with a linear scale", () => {
    expectOk(validSpec(), 2);
  });
});
