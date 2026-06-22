import type { Settings } from "./types";
import { computeGridLayout } from "./layout/grid";
import { masonryPlacement } from "./layout/masonry";

export interface CellRender {
  srcIndex: number;
  dx: number;
  dy: number;
  w: number;
  h: number;
}

export interface GridPlan {
  width: number;
  height: number;
  cells: CellRender[];
}

export function planSquareGrids(count: number, cellSize: number, settings: Settings): GridPlan[] {
  const cols = settings.columns;
  const width = settings.gridWidth;
  const layout = computeGridLayout(count, cols, cellSize, settings.maxGridHeight);
  const plans: GridPlan[] = [];

  for (let g = 0; g < layout.numGrids; g++) {
    const startRow = g * layout.rowsPerGrid;
    const endRow = Math.min(startRow + layout.rowsPerGrid, layout.numRows);
    const gridHeight = (endRow - startRow) * cellSize;
    const cells: CellRender[] = [];

    for (let row = startRow; row < endRow; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        if (idx >= count) break;
        cells.push({
          srcIndex: idx,
          dx: col * cellSize,
          dy: (row - startRow) * cellSize,
          w: cellSize,
          h: cellSize,
        });
      }
    }
    plans.push({ width, height: gridHeight, cells });
  }
  return plans;
}

export function planMasonryGrids(
  cellHeights: number[],
  cellWidth: number,
  settings: Settings,
): GridPlan[] {
  const cols = settings.columns;
  const perGrid = settings.perGrid > 0 ? settings.perGrid : cellHeights.length;
  const plans: GridPlan[] = [];

  for (let start = 0; start < cellHeights.length; start += perGrid) {
    const end = Math.min(start + perGrid, cellHeights.length);
    const slice = cellHeights.slice(start, end);
    const { placements, canvasHeight } = masonryPlacement(slice, cols, cellWidth);
    const cells: CellRender[] = placements.map((p, i) => ({
      srcIndex: start + i,
      dx: p.x,
      dy: p.y,
      w: cellWidth,
      h: slice[i],
    }));
    plans.push({ width: cols * cellWidth, height: canvasHeight, cells });
  }
  return plans;
}
