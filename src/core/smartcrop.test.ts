import { describe, it, expect } from "vitest";
import { findInterestingArea, type PixelView } from "./smartcrop";

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
