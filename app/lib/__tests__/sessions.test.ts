import { describe, expect, it } from "vitest";

import {
  deriveTitle,
  isShareExpired,
  mintSessionCookie,
  shareUrl,
  verifySessionCookie,
} from "../sessions";

describe("session cookie signing", () => {
  it("round-trips a valid cookie", () => {
    const { value } = mintSessionCookie("abc123");
    expect(verifySessionCookie(value, "abc123")).toBe(true);
  });

  it("rejects a cookie for a different session id", () => {
    const { value } = mintSessionCookie("abc123");
    expect(verifySessionCookie(value, "different-id")).toBe(false);
  });

  it("rejects a tampered signature", () => {
    const { value } = mintSessionCookie("abc123");
    const tampered = value.replace(/.$/, "X");
    expect(verifySessionCookie(tampered, "abc123")).toBe(false);
  });

  it("rejects missing/malformed values", () => {
    expect(verifySessionCookie(undefined, "abc123")).toBe(false);
    expect(verifySessionCookie("", "abc123")).toBe(false);
    expect(verifySessionCookie("no-dot-separator", "abc123")).toBe(false);
  });
});

describe("isShareExpired", () => {
  it("treats null expiry as never-expires", () => {
    expect(isShareExpired({ share_expires_at: null })).toBe(false);
  });
  it("treats a past timestamp as expired", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isShareExpired({ share_expires_at: past })).toBe(true);
  });
  it("treats a future timestamp as live", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isShareExpired({ share_expires_at: future })).toBe(false);
  });
});

describe("shareUrl", () => {
  it("joins origin and code without doubled slashes", () => {
    expect(shareUrl("xyz", "https://example.org/")).toBe(
      "https://example.org/c/xyz",
    );
    expect(shareUrl("xyz", "https://example.org")).toBe(
      "https://example.org/c/xyz",
    );
  });
});

describe("deriveTitle", () => {
  it("returns null when no user message has text", () => {
    expect(deriveTitle([])).toBeNull();
    expect(
      deriveTitle([{ role: "assistant", parts: [{ type: "text", text: "hi" }] }]),
    ).toBeNull();
  });

  it("uses the first user message text, truncated to 60 chars", () => {
    const long = "a".repeat(80);
    const out = deriveTitle([
      { role: "user", parts: [{ type: "text", text: long }] },
    ]);
    expect(out).not.toBeNull();
    expect(out!.length).toBeLessThanOrEqual(61); // includes ellipsis
    expect(out!.endsWith("…")).toBe(true);
  });

  it("returns short text verbatim", () => {
    expect(
      deriveTitle([
        { role: "user", parts: [{ type: "text", text: "Hello world" }] },
      ]),
    ).toBe("Hello world");
  });
});
