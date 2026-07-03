export interface PixelView {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

// Summed-area table with a zero top row and left column: sat has dimensions
// (w+1) x (h+1) flattened row-major; sat[(y+1)*(w+1)+(x+1)] is the inclusive
// prefix sum of values[0..y][0..x].
export function buildSat(values: Float64Array, w: number, h: number): Float64Array {
  const sw = w + 1;
  const sat = new Float64Array(sw * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += values[y * w + x];
      sat[(y + 1) * sw + (x + 1)] = sat[y * sw + (x + 1)] + rowSum;
    }
  }
  return sat;
}

// Sum of the size x size window whose top-left corner is (x, y).
export function satSum(sat: Float64Array, w: number, x: number, y: number, size: number): number {
  const sw = w + 1;
  const x1 = x + size, y1 = y + size;
  return sat[y1 * sw + x1] - sat[y * sw + x1] - sat[y1 * sw + x] + sat[y * sw + x];
}

function channelPlanes(img: PixelView): {
  r: Float64Array; g: Float64Array; b: Float64Array;
  r2: Float64Array; g2: Float64Array; b2: Float64Array;
} {
  const n = img.width * img.height;
  const r = new Float64Array(n), g = new Float64Array(n), b = new Float64Array(n);
  const r2 = new Float64Array(n), g2 = new Float64Array(n), b2 = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    const rv = img.data[j], gv = img.data[j + 1], bv = img.data[j + 2];
    r[i] = rv; g[i] = gv; b[i] = bv;
    r2[i] = rv * rv; g2[i] = gv * gv; b2[i] = bv * bv;
  }
  return { r, g, b, r2, g2, b2 };
}

// Central-difference gradient magnitude (matches the Go edges); unchanged math,
// emitted as a plane for the edge SAT.
function detectEdges(img: PixelView): Float64Array {
  const { width: w, height: h } = img;
  const edge = new Float64Array(w * h);
  const at = (x: number, y: number): [number, number, number] => {
    const i = (y * w + x) * 4;
    return [img.data[i], img.data[i + 1], img.data[i + 2]];
  };
  const diff = (a: [number, number, number], b: [number, number, number]) =>
    Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx = diff(at(x - 1, y), at(x + 1, y));
      const gy = diff(at(x, y - 1), at(x, y + 1));
      edge[y * w + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return edge;
}

// Ports findMostInterestingArea. STRIDE trades accuracy for speed; 1 matches Go.
// Window sums come from summed-area tables, so each candidate window scores in
// O(1) instead of O(size^2).
const STRIDE = 2;

export function findInterestingArea(img: PixelView, size: number): { x: number; y: number } {
  const { width: w, height: h } = img;
  if (w <= size || h <= size) return { x: 0, y: 0 };

  const planes = channelPlanes(img);
  const sats = {
    r: buildSat(planes.r, w, h), g: buildSat(planes.g, w, h), b: buildSat(planes.b, w, h),
    r2: buildSat(planes.r2, w, h), g2: buildSat(planes.g2, w, h), b2: buildSat(planes.b2, w, h),
    edge: buildSat(detectEdges(img), w, h),
  };

  const cx = w / 2, cy = h / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);
  const n = size * size;

  let maxScore = -1, bestX = 0, bestY = 0;
  for (let y = 0; y <= h - size; y += STRIDE) {
    for (let x = 0; x <= w - size; x += STRIDE) {
      const sr = satSum(sats.r, w, x, y, size);
      const sg = satSum(sats.g, w, x, y, size);
      const sb = satSum(sats.b, w, x, y, size);
      const cv =
        (satSum(sats.r2, w, x, y, size) - (sr * sr) / n) / n +
        (satSum(sats.g2, w, x, y, size) - (sg * sg) / n) / n +
        (satSum(sats.b2, w, x, y, size) - (sb * sb) / n) / n;
      const es = satSum(sats.edge, w, x, y, size) / n;
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
