import { describe, it, expect } from "vitest";
import { computeAspectResize, computeSquareScale, cropOffset } from "./resize";

describe("computeAspectResize", () => {
  it("keeps width exact and preserves ratio", () => {
    const width = 200;
    for (const [w, h] of [[2000, 1000], [800, 1200], [300, 300], [1500, 500]]) {
      const out = computeAspectResize(w, h, width);
      expect(out.w).toBe(width);
      expect(out.h).toBe(Math.floor((h * width + Math.floor(w / 2)) / w)); // round(h*width/w)
    }
  });
});

describe("computeSquareScale", () => {
  it("scaled dimensions are at least the square size", () => {
    const size = 100;
    for (const [w, h] of [[1500, 1500], [2000, 1000], [800, 1200], [300, 300]]) {
      const s = computeSquareScale(w, h, size);
      expect(s.w).toBeGreaterThanOrEqual(size);
      expect(s.h).toBeGreaterThanOrEqual(size);
    }
  });
});

describe("cropOffset", () => {
  it("center centers the window, top anchors y=0", () => {
    expect(cropOffset(300, 200, 100, "center")).toEqual({ x: 100, y: 50 });
    expect(cropOffset(300, 200, 100, "top")).toEqual({ x: 100, y: 0 });
  });
});
