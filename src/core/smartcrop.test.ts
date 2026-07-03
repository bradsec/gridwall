import { describe, it, expect } from "vitest";
import { findInterestingArea, buildSat, satSum, type PixelView } from "./smartcrop";

function makeView(w: number, h: number, fill: (x: number, y: number) => [number, number, number]): PixelView {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const [r, g, b] = fill(x, y);
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

describe("findInterestingArea", () => {
  it("is deterministic and in-bounds", () => {
    const v = makeView(120, 80, (x, y) => [x % 256, y % 256, 128]);
    const a = findInterestingArea(v, 40);
    const b = findInterestingArea(v, 40);
    expect(a).toEqual(b);
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.y).toBeGreaterThanOrEqual(0);
    expect(a.x).toBeLessThanOrEqual(120 - 40);
    expect(a.y).toBeLessThanOrEqual(80 - 40);
  });

  it("prefers a high-variance patch over a flat field", () => {
    // Flat gray everywhere except a noisy 40x40 block at the right side.
    const v = makeView(120, 60, (x, y) => {
      if (x >= 75 && x < 115 && y >= 10 && y < 50) {
        return [(x * 37 + y * 17) % 256, (x * 91) % 256, (y * 53) % 256];
      }
      return [128, 128, 128];
    });
    const a = findInterestingArea(v, 40);
    expect(a.x).toBeGreaterThan(40); // window shifted toward the noisy block
  });
});

// Deterministic LCG so the property test is reproducible.
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function randomImage(w: number, h: number, seed: number): PixelView {
  const rnd = lcg(seed);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.floor(rnd() * 256);
    data[i + 1] = Math.floor(rnd() * 256);
    data[i + 2] = Math.floor(rnd() * 256);
    data[i + 3] = 255;
  }
  return { data, width: w, height: h };
}

// Brute-force reference copies of the pre-SAT math (kept test-only).
function refColorVariation(img: PixelView, sx: number, sy: number, size: number): number {
  let sr = 0, sg = 0, sb = 0, sr2 = 0, sg2 = 0, sb2 = 0;
  const n = size * size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = ((sy + y) * img.width + (sx + x)) * 4;
      const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
      sr += r; sg += g; sb += b;
      sr2 += r * r; sg2 += g * g; sb2 += b * b;
    }
  }
  return (sr2 - (sr * sr) / n) / n + (sg2 - (sg * sg) / n) / n + (sb2 - (sb * sb) / n) / n;
}

describe("smartcrop SAT equivalence", () => {
  it("satSum equals brute-force window sums on random rasters", () => {
    for (const seed of [1, 2, 3]) {
      const w = 37, h = 29;
      const rnd = lcg(seed + 100);
      const values = new Float64Array(w * h);
      for (let i = 0; i < values.length; i++) values[i] = rnd() * 255;
      const sat = buildSat(values, w, h);
      for (const [x, y, size] of [[0, 0, 5], [3, 7, 10], [20, 12, 9], [w - 8, h - 8, 8]] as const) {
        let ref = 0;
        for (let yy = 0; yy < size; yy++) {
          for (let xx = 0; xx < size; xx++) ref += values[(y + yy) * w + (x + xx)];
        }
        expect(Math.abs(satSum(sat, w, x, y, size) - ref)).toBeLessThan(1e-6 * Math.max(1, ref));
      }
    }
  });

  it("window color variation via SAT matches brute force within epsilon", () => {
    // Indirect check through findInterestingArea determinism is too coarse;
    // compare full scores by re-deriving from exported helpers is overkill —
    // instead assert the end result: the chosen crop matches a brute-force
    // reimplementation of the ORIGINAL algorithm on random images.
    for (const seed of [11, 22, 33, 44]) {
      const img = randomImage(48, 40, seed);
      const size = 24;
      // Brute-force original algorithm (reference).
      const edge = refDetectEdges(img);
      const cx = img.width / 2, cy = img.height / 2;
      const maxDist = Math.sqrt(cx * cx + cy * cy);
      let maxScore = -1, bx = 0, by = 0;
      for (let y = 0; y <= img.height - size; y += 2) {
        for (let x = 0; x <= img.width - size; x += 2) {
          const cv = refColorVariation(img, x, y, size);
          let es = 0;
          for (let yy = 0; yy < size; yy++) {
            for (let xx = 0; xx < size; xx++) es += edge[(y + yy) * img.width + (x + xx)];
          }
          es /= size * size;
          const dx = x + size / 2 - cx, dy = y + size / 2 - cy;
          const centerWeight = maxDist > 0 ? 1 - Math.sqrt(dx * dx + dy * dy) / maxDist : 1;
          const score = (cv * 0.3 + es * 0.3) * (1 + centerWeight);
          if (score > maxScore) { maxScore = score; bx = x; by = y; }
        }
      }
      expect(findInterestingArea(img, size)).toEqual({ x: bx, y: by });
    }
  });
});

// Reference copy of the original central-difference edge map.
function refDetectEdges(img: PixelView): Float64Array {
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
