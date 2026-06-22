// High-quality downscale: halve repeatedly (browser box filter per step is
// clean) until within 2x of target, then a final smoothed draw to exact size.
export function downscale(src: ImageBitmap | OffscreenCanvas, targetW: number, targetH: number): OffscreenCanvas {
  let curW = src.width;
  let curH = src.height;
  let canvas = new OffscreenCanvas(curW, curH);
  let ctx = canvas.getContext("2d")!;
  ctx.drawImage(src, 0, 0);

  while (curW > targetW * 2 || curH > targetH * 2) {
    const nextW = Math.max(Math.floor(curW / 2), targetW);
    const nextH = Math.max(Math.floor(curH / 2), targetH);
    const next = new OffscreenCanvas(nextW, nextH);
    const nctx = next.getContext("2d")!;
    nctx.imageSmoothingEnabled = true;
    nctx.imageSmoothingQuality = "high";
    nctx.drawImage(canvas, 0, 0, curW, curH, 0, 0, nextW, nextH);
    canvas = next;
    ctx = nctx;
    curW = nextW;
    curH = nextH;
  }

  const out = new OffscreenCanvas(targetW, targetH);
  const octx = out.getContext("2d")!;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(canvas, 0, 0, curW, curH, 0, 0, targetW, targetH);
  return out;
}
