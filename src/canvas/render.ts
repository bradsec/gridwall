import type { Settings } from "../core/types";
import type { GridPlan } from "../core/compose";
import { computeSquareScale, computeAspectResize, cropOffset } from "../core/resize";
import { findInterestingArea, type PixelView } from "../core/smartcrop";
import { truncateText } from "../core/label";
import { downscale } from "./resample";

const ANALYSIS_MAX = 256; // downsample cap for the saliency scan

export type ImageSource = ImageBitmap | OffscreenCanvas;

// Returns a source rotated by a multiple of 90 degrees (width/height swap for
// 90/270). Returns the original untouched for 0.
export function rotate(src: ImageSource, deg: number): ImageSource {
  const r = ((deg % 360) + 360) % 360;
  if (r === 0) return src;
  const swap = r === 90 || r === 270;
  const w = swap ? src.height : src.width;
  const h = swap ? src.width : src.height;
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext("2d")!;
  ctx.translate(w / 2, h / 2);
  ctx.rotate((r * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

export function renderCell(src: ImageSource, settings: Settings, cellSize: number): OffscreenCanvas {
  if (settings.layout === "masonry") {
    const { w, h } = computeAspectResize(src.width, src.height, cellSize);
    return downscale(src, w, h);
  }

  const scaled = computeSquareScale(src.width, src.height, cellSize);
  const scaledCanvas = downscale(src, scaled.w, scaled.h);

  let ox: number, oy: number;
  if (settings.cropMode === "smart") {
    const factor = Math.min(1, ANALYSIS_MAX / Math.max(scaled.w, scaled.h));
    const aw = Math.max(Math.round(scaled.w * factor), 1);
    const ah = Math.max(Math.round(scaled.h * factor), 1);
    const analysis = new OffscreenCanvas(aw, ah);
    const actx = analysis.getContext("2d")!;
    actx.imageSmoothingEnabled = true;
    actx.imageSmoothingQuality = "high";
    actx.drawImage(scaledCanvas, 0, 0, aw, ah);
    const view: PixelView = actx.getImageData(0, 0, aw, ah);
    const small = findInterestingArea(view, Math.round(cellSize * factor));
    ox = Math.min(Math.round(small.x / factor), scaled.w - cellSize);
    oy = Math.min(Math.round(small.y / factor), scaled.h - cellSize);
  } else {
    const off = cropOffset(scaled.w, scaled.h, cellSize, settings.cropMode);
    ox = off.x;
    oy = off.y;
  }

  const cell = new OffscreenCanvas(cellSize, cellSize);
  const cctx = cell.getContext("2d")!;
  cctx.drawImage(scaledCanvas, ox, oy, cellSize, cellSize, 0, 0, cellSize, cellSize);
  return cell;
}

export function renderPlan(
  plan: GridPlan,
  cells: OffscreenCanvas[],
  settings: Settings,
  names: string[],
): OffscreenCanvas {
  const out = new OffscreenCanvas(plan.width, plan.height);
  const ctx = out.getContext("2d")!;
  for (const c of plan.cells) {
    ctx.drawImage(cells[c.srcIndex], c.dx, c.dy, c.w, c.h);
    if (settings.addNames) drawLabel(ctx, c.dx, c.dy, c.w, c.h, names[c.srcIndex]);
  }
  return out;
}

function drawLabel(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  name: string,
): void {
  const barH = 20;
  ctx.font = "13px monospace";
  const text = truncateText(name, (t) => ctx.measureText(t).width, w - 10);
  ctx.fillStyle = "rgba(0,0,0,0.706)"; // 180/255
  ctx.fillRect(x, y + h - barH, w, barH);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + h - barH / 2);
}

export async function encode(
  canvas: OffscreenCanvas,
  format: "jpeg" | "png",
  quality: number,
): Promise<Blob> {
  return canvas.convertToBlob({
    type: format === "png" ? "image/png" : "image/jpeg",
    quality,
  });
}
