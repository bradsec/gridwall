import { describe, it, expect } from "vitest";
import { cellSignature, scalePlan } from "./pipeline";
import { defaultSettings } from "../state/store";
import type { GridPlan } from "../core/compose";

const order = [
  { id: "a", name: "a.jpg", rotation: 0 },
  { id: "b", name: "b.jpg", rotation: 90 },
];

describe("cellSignature", () => {
  it("is stable for cheap-setting changes", () => {
    const s1 = defaultSettings();
    const s2 = { ...s1, borderThickness: 20, quality: 0.5, addNames: true };
    expect(cellSignature(s1, 300, order)).toBe(cellSignature(s2, 300, order));
  });

  it("changes with rotation, crop mode, layout, and cell size", () => {
    const s = defaultSettings();
    const base = cellSignature(s, 300, order);
    expect(cellSignature(s, 300, [order[0], { ...order[1], rotation: 180 }])).not.toBe(base);
    expect(cellSignature({ ...s, cropMode: "top" }, 300, order)).not.toBe(base);
    expect(cellSignature({ ...s, layout: "masonry" }, 300, order)).not.toBe(base);
    expect(cellSignature(s, 299, order)).not.toBe(base);
  });
});

describe("scalePlan", () => {
  const plan: GridPlan = {
    width: 900,
    height: 600,
    cells: [
      { srcIndex: 0, dx: 0, dy: 0, w: 300, h: 300 },
      { srcIndex: 1, dx: 300, dy: 0, w: 300, h: 300 },
    ],
  } as GridPlan;

  it("scales dimensions and every cell rect", () => {
    const p = scalePlan(plan, 0.5);
    expect(p.width).toBe(450);
    expect(p.height).toBe(300);
    expect(p.cells[1]).toMatchObject({ srcIndex: 1, dx: 150, dy: 0, w: 150, h: 150 });
  });

  it("returns the same geometry object shape at factor 1", () => {
    expect(scalePlan(plan, 1)).toEqual(plan);
  });
});
