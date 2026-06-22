import type { BorderScope } from "./types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CellRect {
  dx: number;
  dy: number;
  w: number;
  h: number;
}

// Four fill rects (top, bottom, left, right) framing a region, drawn fully
// inside it so the border overlays the outer edge without growing the canvas.
// Thickness is clamped to half the shorter side so opposite sides never cross.
function frame(x: number, y: number, w: number, h: number, thickness: number): Rect[] {
  const t = Math.min(thickness, Math.floor(Math.min(w, h) / 2));
  if (t <= 0) return [];
  const innerH = h - 2 * t;
  const rects: Rect[] = [
    { x, y, w, h: t },
    { x, y: y + h - t, w, h: t },
  ];
  if (innerH > 0) {
    rects.push({ x, y: y + t, w: t, h: innerH });
    rects.push({ x: x + w - t, y: y + t, w: t, h: innerH });
  }
  return rects;
}

// Border fill rects for a composed grid. "each" frames every image cell;
// "outside" frames only the whole composite. Returns [] when thickness <= 0.
export function borderRects(
  cells: CellRect[],
  planWidth: number,
  planHeight: number,
  thickness: number,
  scope: BorderScope,
): Rect[] {
  if (thickness <= 0) return [];
  if (scope === "outside") return frame(0, 0, planWidth, planHeight, thickness);
  return cells.flatMap((c) => frame(c.dx, c.dy, c.w, c.h, thickness));
}
