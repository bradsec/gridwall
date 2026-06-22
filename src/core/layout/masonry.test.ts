import { describe, it, expect } from "vitest";
import { masonryPlacement } from "./masonry";

describe("masonryPlacement", () => {
  it("packs each cell into the shortest column, ties leftmost", () => {
    const heights = [100, 50, 30, 40, 200];
    const cols = 3, cellWidth = 100;
    const { placements, canvasHeight } = masonryPlacement(heights, cols, cellWidth);

    expect(placements).toHaveLength(heights.length);
    for (let i = 0; i < cols; i++) {
      expect(placements[i]).toEqual({ x: i * cellWidth, y: 0 });
    }
    // Cell 3 (h=40) -> shortest col 2 (h=30) at x=200, y=30.
    expect(placements[3]).toEqual({ x: 200, y: 30 });
    // col0=100, col1=50, col2=70; cell4 h=200 lands on col1 (50) -> 250.
    expect(canvasHeight).toBe(250);
    for (let i = 0; i < placements.length; i++) {
      expect(placements[i].y + heights[i]).toBeLessThanOrEqual(canvasHeight);
    }
  });
});
