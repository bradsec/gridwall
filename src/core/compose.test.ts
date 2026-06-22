import { describe, it, expect } from "vitest";
import { planSquareGrids, planMasonryGrids } from "./compose";
import type { Settings } from "./types";

function settings(over: Partial<Settings> = {}): Settings {
  return {
    layout: "square", gridWidth: 300, maxGridHeight: 300, columns: 3,
    cropMode: "center", addNames: false, limit: 0, perGrid: 0, format: "jpeg", quality: 0.9, ...over,
  };
}

describe("planSquareGrids", () => {
  it("places cells in row-major order and splits by height", () => {
    // cellSize = gridWidth/columns = 100. 7 cells, 3 cols -> 3 rows.
    // maxGridHeight 300, cellHeight 100 -> rowsPerGrid 3 -> 1 grid.
    const plans = planSquareGrids(7, 100, settings());
    expect(plans).toHaveLength(1);
    const p = plans[0];
    expect(p.width).toBe(300);
    expect(p.height).toBe(300);
    expect(p.cells[0]).toEqual({ srcIndex: 0, dx: 0, dy: 0, w: 100, h: 100 });
    expect(p.cells[3]).toEqual({ srcIndex: 3, dx: 0, dy: 100, w: 100, h: 100 });
    expect(p.cells).toHaveLength(7);
  });

  it("splits into multiple files when taller than maxGridHeight", () => {
    // 12 cells, 3 cols -> 4 rows; cellHeight 100; maxGridHeight 200 -> 2 rows/grid -> 2 grids.
    const plans = planSquareGrids(12, 100, settings({ maxGridHeight: 200 }));
    expect(plans).toHaveLength(2);
    expect(plans[0].height).toBe(200);
    expect(plans[1].height).toBe(200);
    expect(plans[1].cells[0].srcIndex).toBe(6); // first cell of grid 2 is row 2
  });
});

describe("planMasonryGrids", () => {
  it("paginates by perGrid and packs shortest column", () => {
    const heights = [100, 50, 30, 40, 200, 60];
    const plans = planMasonryGrids(heights, 100, settings({ layout: "masonry", columns: 3, perGrid: 3 }));
    expect(plans).toHaveLength(2);
    expect(plans[0].cells).toHaveLength(3);
    expect(plans[0].width).toBe(300);
    expect(plans[0].cells[0]).toEqual({ srcIndex: 0, dx: 0, dy: 0, w: 100, h: 100 });
  });
});
