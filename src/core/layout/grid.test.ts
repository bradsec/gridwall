import { describe, it, expect } from "vitest";
import { computeGridLayout } from "./grid";

const cases = [
  { numFiles: 175, numColumns: 3, cellHeight: 300, maxGridHeight: 900 },
  { numFiles: 10, numColumns: 2, cellHeight: 500, maxGridHeight: 900 },
  { numFiles: 7, numColumns: 3, cellHeight: 400, maxGridHeight: 900 },
  { numFiles: 1, numColumns: 1, cellHeight: 900, maxGridHeight: 900 },
  { numFiles: 100, numColumns: 4, cellHeight: 250, maxGridHeight: 1000 },
  { numFiles: 5, numColumns: 2, cellHeight: 1000, maxGridHeight: 900 },
];

describe("computeGridLayout", () => {
  it("covers every row exactly once", () => {
    for (const tc of cases) {
      const l = computeGridLayout(tc.numFiles, tc.numColumns, tc.cellHeight, tc.maxGridHeight);
      const drawn = new Array<boolean>(l.numRows).fill(false);
      for (let g = 0; g < l.numGrids; g++) {
        const start = g * l.rowsPerGrid;
        const end = Math.min(start + l.rowsPerGrid, l.numRows);
        for (let r = start; r < end; r++) {
          expect(drawn[r], `row ${r} drawn twice`).toBe(false);
          drawn[r] = true;
        }
      }
      expect(drawn.every(Boolean), `a row was never drawn for ${JSON.stringify(tc)}`).toBe(true);
    }
  });
});
