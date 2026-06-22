export interface CellPlacement {
  x: number;
  y: number;
}

export function masonryPlacement(
  heights: number[],
  numColumns: number,
  cellWidth: number,
): { placements: CellPlacement[]; canvasHeight: number } {
  const colHeights = new Array<number>(numColumns).fill(0);
  const placements: CellPlacement[] = new Array(heights.length);

  for (let i = 0; i < heights.length; i++) {
    let best = 0;
    for (let c = 1; c < numColumns; c++) {
      if (colHeights[c] < colHeights[best]) best = c;
    }
    placements[i] = { x: best * cellWidth, y: colHeights[best] };
    colHeights[best] += heights[i];
  }

  let canvasHeight = 0;
  for (const ch of colHeights) if (ch > canvasHeight) canvasHeight = ch;

  return { placements, canvasHeight };
}
