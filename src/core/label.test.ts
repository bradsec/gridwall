import { describe, it, expect } from "vitest";
import { truncateText } from "./label";

// Fake monospace: every character is 7px wide.
const measure = (t: string) => t.length * 7;

describe("truncateText", () => {
  it("fits within maxWidth and stays non-empty when room exists", () => {
    const long = "this_is_a_very_long_filename_that_will_not_fit.png";
    const out = truncateText(long, measure, 60);
    expect(measure(out)).toBeLessThanOrEqual(60);
    expect(out).not.toBe("");
    expect(out.endsWith("...")).toBe(true);
  });
  it("returns empty when even the ellipsis does not fit", () => {
    expect(truncateText("abc", measure, 10)).toBe("");
  });
});
