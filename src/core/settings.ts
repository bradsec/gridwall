import type { Settings } from "./types";

export function validateSettings(s: Settings): string | null {
  if (s.columns < 1) return `columns must be >= 1, got ${s.columns}`;
  if (s.gridWidth < 1) return `grid width must be >= 1, got ${s.gridWidth}`;
  if (s.maxGridHeight < 1) return `grid height must be >= 1, got ${s.maxGridHeight}`;
  if (Math.floor(s.gridWidth / s.columns) < 1)
    return `grid width ${s.gridWidth} too small for ${s.columns} columns (cell width would be 0)`;
  if (s.cropMode !== "smart" && s.cropMode !== "center" && s.cropMode !== "top")
    return `crop mode must be smart, center, or top, got ${s.cropMode}`;
  if (s.limit < 0) return `limit must be >= 0, got ${s.limit}`;
  if (s.perGrid < 0) return `per-grid must be >= 0, got ${s.perGrid}`;
  if (s.borderThickness < 0) return `border thickness must be >= 0, got ${s.borderThickness}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(s.borderColor))
    return `border color must be a 6-digit hex like #000000, got ${s.borderColor}`;
  if (s.borderScope !== "each" && s.borderScope !== "outside")
    return `border scope must be each or outside, got ${s.borderScope}`;
  return null;
}
