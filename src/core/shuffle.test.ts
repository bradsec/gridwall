import { describe, it, expect } from "vitest";
import { makeRng, shuffleInPlace } from "./shuffle";

describe("shuffleInPlace", () => {
  it("keeps alignment between paired arrays and stays a permutation", () => {
    const n = 8;
    const tags = Array.from({ length: n }, (_, i) => i);
    const names = Array.from({ length: n }, (_, i) => String.fromCharCode(97 + i));
    const rng = makeRng(42);
    // Shuffle indices, then apply the same permutation to both arrays.
    const order = Array.from({ length: n }, (_, i) => i);
    shuffleInPlace(order, rng);
    const tags2 = order.map((i) => tags[i]);
    const names2 = order.map((i) => names[i]);
    const seen = new Set<string>();
    for (let i = 0; i < n; i++) {
      expect(names2[i]).toBe(String.fromCharCode(97 + tags2[i]));
      expect(seen.has(names2[i])).toBe(false);
      seen.add(names2[i]);
    }
    expect(seen.size).toBe(n);
  });

  it("same seed gives same order", () => {
    const run = () => {
      const a = [0, 1, 2, 3, 4, 5];
      shuffleInPlace(a, makeRng(7));
      return a;
    };
    expect(run()).toEqual(run());
  });

  it("different seeds usually differ", () => {
    const a = [0, 1, 2, 3, 4, 5, 6, 7];
    const b = [...a];
    shuffleInPlace(a, makeRng(1));
    shuffleInPlace(b, makeRng(2));
    expect(a).not.toEqual(b);
  });
});
