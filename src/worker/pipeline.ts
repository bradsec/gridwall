import type { Settings } from "../core/types";
import type { OrderEntry, LoadResult } from "./protocol";
import { planSquareGrids, planMasonryGrids, type GridPlan } from "../core/compose";
import { computeAspectResize } from "../core/resize";
import { validateSettings, checkOutputSize } from "../core/settings";
import { renderCell, renderPlan, encode, rotate } from "../canvas/render";

export interface PreviewResult {
  bitmap: ImageBitmap;
  pageCount: number;
  trueWidth: number;
  trueHeight: number;
}

export function cellSignature(settings: Settings, cellSize: number, order: OrderEntry[]): string {
  return [
    settings.layout,
    settings.cropMode,
    cellSize,
    order.map((o) => `${o.id}#${o.rotation}`).join(","),
  ].join("|");
}

export function scalePlan(plan: GridPlan, factor: number): GridPlan {
  if (factor === 1) return plan;
  return {
    ...plan,
    width: Math.max(Math.round(plan.width * factor), 1),
    height: Math.max(Math.round(plan.height * factor), 1),
    cells: plan.cells.map((c) => ({
      ...c,
      dx: Math.round(c.dx * factor),
      dy: Math.round(c.dy * factor),
      w: Math.max(Math.round(c.w * factor), 1),
      h: Math.max(Math.round(c.h * factor), 1),
    })),
  };
}

export interface Pipeline {
  load(files: { id: string; name: string; blob: Blob }[]): Promise<LoadResult[]>;
  preview(order: OrderEntry[], settings: Settings, scale: number, previewIndex: number): Promise<PreviewResult>;
  exportAll(
    order: OrderEntry[],
    settings: Settings,
    onProgress: (done: number, total: number) => void,
  ): Promise<{ blob: Blob; name: string }[]>;
  remove(ids: string[]): void;
  reset(): void;
}

export function createPipeline(): Pipeline {
  const bitmaps = new Map<string, ImageBitmap>();
  let cellCache: { sig: string; cells: OffscreenCanvas[] } | null = null;

  // Rotated source dimensions for an order entry (90/270 swap w/h).
  function rotatedDims(entry: OrderEntry): { w: number; h: number } {
    const bm = bitmaps.get(entry.id);
    if (!bm) throw new Error(`image ${entry.name} is not loaded`);
    const r = ((entry.rotation % 360) + 360) % 360;
    const swap = r === 90 || r === 270;
    return { w: swap ? bm.height : bm.width, h: swap ? bm.width : bm.height };
  }

  // Full-scale plans from bitmap aspect ratios; no cell rendering involved.
  function planFull(order: OrderEntry[], settings: Settings): { plans: GridPlan[]; trueCellSize: number } {
    const trueCellSize = Math.max(Math.floor(settings.gridWidth / settings.columns), 1);
    const plans =
      settings.layout === "masonry"
        ? planMasonryGrids(
            order.map((o) => {
              const d = rotatedDims(o);
              return computeAspectResize(d.w, d.h, trueCellSize).h;
            }),
            trueCellSize,
            settings,
          )
        : planSquareGrids(order.length, trueCellSize, settings);
    return { plans, trueCellSize };
  }

  // Cells at the drawn size, cached on the same signature as before the move.
  function cellsFor(order: OrderEntry[], settings: Settings, cellSize: number): OffscreenCanvas[] {
    const sig = cellSignature(settings, cellSize, order);
    if (cellCache && cellCache.sig === sig) return cellCache.cells;
    const cells = order.map((o) => {
      const bm = bitmaps.get(o.id);
      if (!bm) throw new Error(`image ${o.name} is not loaded`);
      return renderCell(rotate(bm, o.rotation), settings, cellSize);
    });
    cellCache = { sig, cells };
    return cells;
  }

  return {
    async load(files) {
      const results: LoadResult[] = [];
      for (const f of files) {
        try {
          const bm = await createImageBitmap(f.blob);
          bitmaps.set(f.id, bm);
          results.push({ id: f.id, ok: true, width: bm.width, height: bm.height });
        } catch {
          results.push({ id: f.id, ok: false, width: 0, height: 0 });
        }
      }
      return results;
    },

    async preview(order, settings, scale, previewIndex) {
      const err = validateSettings(settings);
      if (err) throw new Error(err);
      const { plans, trueCellSize } = planFull(order, settings);
      if (plans.length === 0) throw new Error("no images to preview");
      const index = Math.max(0, Math.min(previewIndex, plans.length - 1));
      const fullPlan = plans[index];
      const previewPlan = scalePlan(fullPlan, scale);
      const cellSize = Math.max(Math.round(trueCellSize * scale), 1);
      const cells = cellsFor(order, settings, cellSize);
      const names = order.map((o) => o.name);
      const canvas = renderPlan(previewPlan, cells, settings, names);
      return {
        bitmap: await createImageBitmap(canvas),
        pageCount: plans.length,
        trueWidth: fullPlan.width,
        trueHeight: fullPlan.height,
      };
    },

    async exportAll(order, settings, onProgress) {
      const err = validateSettings(settings);
      if (err) throw new Error(err);
      const { plans, trueCellSize } = planFull(order, settings);
      for (const p of plans) {
        const sizeErr = checkOutputSize(p.width, p.height);
        if (sizeErr) throw new Error(sizeErr);
      }
      const cells = cellsFor(order, settings, trueCellSize);
      const names = order.map((o) => o.name);
      const ext = settings.format === "png" ? "png" : "jpg";
      const outputs: { blob: Blob; name: string }[] = [];
      for (let i = 0; i < plans.length; i++) {
        const canvas = renderPlan(plans[i], cells, settings, names);
        const blob = await encode(canvas, settings.format, settings.quality);
        outputs.push({ blob, name: `grid_${String(i + 1).padStart(3, "0")}.${ext}` });
        onProgress(i + 1, plans.length);
      }
      return outputs;
    },

    remove(ids) {
      for (const id of ids) {
        bitmaps.get(id)?.close();
        bitmaps.delete(id);
      }
      cellCache = null;
    },

    reset() {
      for (const bm of bitmaps.values()) bm.close();
      bitmaps.clear();
      cellCache = null;
    },
  };
}
