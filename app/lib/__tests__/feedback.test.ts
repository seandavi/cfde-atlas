import { describe, expect, it } from "vitest";

import { isValidRating } from "../feedback";

describe("isValidRating", () => {
  it("accepts the three legal values", () => {
    expect(isValidRating(1)).toBe(true);
    expect(isValidRating(-1)).toBe(true);
    expect(isValidRating(null)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(2)).toBe(false);
    expect(isValidRating("1")).toBe(false);
    expect(isValidRating(undefined)).toBe(false);
    expect(isValidRating({})).toBe(false);
  });
});
