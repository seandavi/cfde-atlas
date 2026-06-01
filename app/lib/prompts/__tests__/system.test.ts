import { describe, expect, it } from "vitest";

import { buildSystemPrompt } from "../system";

const DIGEST = `### publications — table
Grant-associated publications.
- pmid: integer NOT NULL — PubMed identifier.`;

describe("buildSystemPrompt", () => {
  it("always appends the runtime step budget", () => {
    expect(buildSystemPrompt({ maxSteps: 12 })).toContain(
      "budget of 12 tool-call steps",
    );
  });

  describe("with a schema digest", () => {
    const prompt = buildSystemPrompt({ maxSteps: 40, schemaDigest: DIGEST });

    it("inlines the digest under an AVAILABLE SCHEMA heading", () => {
      expect(prompt).toContain("AVAILABLE SCHEMA");
      expect(prompt).toContain(DIGEST);
    });

    it("declares the schema authoritative and tells the model to write SQL directly", () => {
      expect(prompt).toContain("complete and authoritative");
      expect(prompt).toMatch(/without calling list_tables or describe_table first/);
    });

    it("demotes describe_table to a stale-schema fallback with a concrete trigger", () => {
      expect(prompt).toMatch(/Call describe_table ONLY if a query fails/);
      expect(prompt).toContain("unknown-table or unknown-column error");
    });

    it("drops the discover-first fallback guidance", () => {
      expect(prompt).not.toContain("trust list_tables for what is actually loaded");
      expect(prompt).not.toContain("call this first whenever you are unsure");
    });
  });

  describe("without a schema digest", () => {
    const prompt = buildSystemPrompt({ maxSteps: 40 });

    it("keeps the original discover-first SCHEMA SCOPE guidance", () => {
      expect(prompt).toContain("SCHEMA SCOPE");
      expect(prompt).toContain("trust list_tables for what is actually loaded");
      expect(prompt).toContain("call this first whenever you are unsure");
    });

    it("does not emit an AVAILABLE SCHEMA block", () => {
      expect(prompt).not.toContain("AVAILABLE SCHEMA");
    });
  });

  it("treats a whitespace-only digest as absent", () => {
    const prompt = buildSystemPrompt({ maxSteps: 40, schemaDigest: "   \n  " });
    expect(prompt).not.toContain("AVAILABLE SCHEMA");
    expect(prompt).toContain("SCHEMA SCOPE");
  });
});
