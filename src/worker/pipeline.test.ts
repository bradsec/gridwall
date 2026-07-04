import { describe, it, expect } from "vitest";
import { cellSignature, scalePlan, createPipeline } from "./pipeline";
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

  it("preserves shared edges after scaling (no seams)", () => {
    // 900px grid, 3 columns of 300 -> factor 700/900 used to open a 1px gap
    // before the third column (466 vs 467).
    const plan: GridPlan = {
      width: 900,
      height: 300,
      cells: [
        { srcIndex: 0, dx: 0, dy: 0, w: 300, h: 300 },
        { srcIndex: 1, dx: 300, dy: 0, w: 300, h: 300 },
        { srcIndex: 2, dx: 600, dy: 0, w: 300, h: 300 },
      ],
    } as GridPlan;
    const p = scalePlan(plan, 700 / 900);
    for (let i = 1; i < p.cells.length; i++) {
      expect(p.cells[i].dx).toBe(p.cells[i - 1].dx + p.cells[i - 1].w);
    }
    // Last cell reaches the scaled plan edge exactly.
    const last = p.cells[p.cells.length - 1];
    expect(last.dx + last.w).toBe(p.width);
    // Vertical: stacked cells share edges too.
    const col: GridPlan = {
      width: 300,
      height: 1000,
      cells: [
        { srcIndex: 0, dx: 0, dy: 0, w: 300, h: 433 },
        { srcIndex: 1, dx: 0, dy: 433, w: 300, h: 567 },
      ],
    } as GridPlan;
    const q = scalePlan(col, 700 / 900);
    expect(q.cells[1].dy).toBe(q.cells[0].dy + q.cells[0].h);
    expect(q.cells[1].dy + q.cells[1].h).toBe(q.height);
  });
});

describe("pipeline preview guards", () => {
  it("rejects cleanly when there are no images", async () => {
    await expect(createPipeline().preview([], defaultSettings(), 1, 0)).rejects.toThrow(
      "no images to preview",
    );
  });
});
