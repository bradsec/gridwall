export interface GridLayout {
  numRows: number;
  rowsPerGrid: number;
  numGrids: number;
}

export function computeGridLayout(
  numFiles: number,
  numColumns: number,
  cellHeight: number,
  maxGridHeight: number,
): GridLayout {
  let numRows = Math.floor(numFiles / numColumns);
  if (numFiles % numColumns !== 0) numRows++;

  const rowsPerGrid = Math.max(Math.floor(maxGridHeight / cellHeight), 1);

  let numGrids = Math.floor(numRows / rowsPerGrid);
  if (numRows % rowsPerGrid !== 0) numGrids++;

  return { numRows, rowsPerGrid, numGrids };
}
