export interface PixelView {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

function px(img: PixelView, x: number, y: number): [number, number, number] {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

// Sobel-free gradient magnitude map (matches the Go central-difference edges).
function detectEdges(img: PixelView): Float64Array {
  const { width: w, height: h } = img;
  const edge = new Float64Array(w * h);
  const diff = (a: [number, number, number], b: [number, number, number]) =>
    Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx = diff(px(img, x - 1, y), px(img, x + 1, y));
      const gy = diff(px(img, x, y - 1), px(img, x, y + 1));
      edge[y * w + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return edge;
}

function edgeScore(edge: Float64Array, w: number, sx: number, sy: number, size: number): number {
  let s = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) s += edge[(sy + y) * w + (sx + x)];
  }
  return s / (size * size);
}

function colorVariation(img: PixelView, sx: number, sy: number, size: number): number {
  let sr = 0, sg = 0, sb = 0, sr2 = 0, sg2 = 0, sb2 = 0;
  const n = size * size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = px(img, sx + x, sy + y);
      sr += r; sg += g; sb += b;
      sr2 += r * r; sg2 += g * g; sb2 += b * b;
    }
  }
  const vR = (sr2 - (sr * sr) / n) / n;
  const vG = (sg2 - (sg * sg) / n) / n;
  const vB = (sb2 - (sb * sb) / n) / n;
  return vR + vG + vB;
}

// Ports findMostInterestingArea. STRIDE trades accuracy for speed; 1 matches Go.
const STRIDE = 2;

export function findInterestingArea(img: PixelView, size: number): { x: number; y: number } {
  const { width: w, height: h } = img;
  if (w <= size || h <= size) return { x: 0, y: 0 };

  const edge = detectEdges(img);
  const cx = w / 2, cy = h / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  let maxScore = -1, bestX = 0, bestY = 0;
  for (let y = 0; y <= h - size; y += STRIDE) {
    for (let x = 0; x <= w - size; x += STRIDE) {
      const cv = colorVariation(img, x, y, size);
      const es = edgeScore(edge, w, x, y, size);
      const dx = x + size / 2 - cx;
      const dy = y + size / 2 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const centerWeight = maxDist > 0 ? 1 - dist / maxDist : 1;
      // Go also weighted a color-cluster term (clusterScore*0.2), dropped here:
      // keyed on exact RGBA it is near-useless after resampling and dominated runtime.
      const score = (cv * 0.3 + es * 0.3) * (1 + centerWeight);
      if (score > maxScore) {
        maxScore = score;
        bestX = x;
        bestY = y;
      }
    }
  }
  return { x: bestX, y: bestY };
}
