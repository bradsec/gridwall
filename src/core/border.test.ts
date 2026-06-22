import { describe, it, expect } from "vitest";
import { borderRects } from "./border";

const cells = [
  { dx: 0, dy: 0, w: 100, h: 100 },
  { dx: 100, dy: 0, w: 100, h: 100 },
];

describe("borderRects", () => {
  it("returns nothing when thickness is zero", () => {
    expect(borderRects(cells, 200, 100, 0, "each")).toEqual([]);
    expect(borderRects(cells, 200, 100, 0, "outside")).toEqual([]);
  });

  it("frames each cell with four rects", () => {
    const rects = borderRects(cells, 200, 100, 4, "each");
    expect(rects).toHaveLength(8);
    // First cell top edge spans its full width at its origin.
    expect(rects[0]).toEqual({ x: 0, y: 0, w: 100, h: 4 });
    // First cell right edge is inset by thickness from the cell's right side.
    expect(rects[3]).toEqual({ x: 96, y: 4, w: 4, h: 92 });
  });

  it("frames only the whole composite in outside mode", () => {
    const rects = borderRects(cells, 200, 100, 4, "outside");
    expect(rects).toHaveLength(4);
    expect(rects[0]).toEqual({ x: 0, y: 0, w: 200, h: 4 });
    expect(rects[1]).toEqual({ x: 0, y: 96, w: 200, h: 4 });
    expect(rects[3]).toEqual({ x: 196, y: 4, w: 4, h: 92 });
  });

  it("clamps thickness to half the shorter side", () => {
    const rects = borderRects([{ dx: 0, dy: 0, w: 20, h: 20 }], 20, 20, 100, "each");
    // Clamped to 10; side rects collapse (innerH = 0) leaving top and bottom.
    expect(rects).toEqual([
      { x: 0, y: 0, w: 20, h: 10 },
      { x: 0, y: 10, w: 20, h: 10 },
    ]);
  });
});
