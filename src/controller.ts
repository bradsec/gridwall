import type { Store, LoadedImage } from "./state/store";
import { defaultSettings } from "./state/store";
import { validateSettings, checkOutputSize, MAX_CANVAS_DIM } from "./core/settings";
import { planSquareGrids, planMasonryGrids } from "./core/compose";
import { renderCell, renderPlan, encode, rotate } from "./canvas/render";
import { setStatus, setBusy, showToast, setPager, rebuildSettings } from "./ui/app";

const ACCEPTED = new Set(["image/png", "image/jpeg"]);

export function createController(store: Store) {
  const preview = document.querySelector<HTMLCanvasElement>("#preview")!;
  const empty = document.querySelector<HTMLElement>("#empty")!;

  async function handleFiles(files: FileList): Promise<void> {
    // Start every decode synchronously within this event turn. Files from a
    // native drag-and-drop are only reliably readable during the drop event; a
    // sequential `await` loop reads later files a turn too late, so a multi-file
    // drop imports only the first. createObjectURL pins the blob the same way.
    const items = Array.from(files).map((file) => {
      const accepted = ACCEPTED.has(file.type);
      return {
        file,
        accepted,
        thumbUrl: accepted ? URL.createObjectURL(file) : "",
        bitmap: accepted ? createImageBitmap(file) : null,
      };
    });

    const loaded: LoadedImage[] = [];
    for (const item of items) {
      if (!item.accepted) {
        showToast("error", `Skipped ${item.file.name}: unsupported type`);
        continue;
      }
      try {
        const bitmap = await item.bitmap!;
        loaded.push({ name: item.file.name, bitmap, thumbUrl: item.thumbUrl });
      } catch {
        URL.revokeObjectURL(item.thumbUrl);
        showToast("error", `Skipped ${item.file.name}: could not decode`);
      }
    }
    if (loaded.length) {
      store.addImages(loaded);
      empty.style.display = "none";
    }
  }

  // Which output file the preview is showing (square/masonry can span several).
  let previewIndex = 0;

  // Memoizes the last rendered cell set, keyed by the inputs that affect it.
  let cellCache: { sig: string; cells: OffscreenCanvas[] } | null = null;

  // Applies the image limit. Order is the store's persisted order, mutated by
  // drag-reorder and the shuffle action, so no render-time reshuffling.
  function selected(): LoadedImage[] {
    const { images, settings } = store.getState();
    if (settings.limit > 0 && settings.limit < images.length) return images.slice(0, settings.limit);
    return images;
  }

  async function buildPlansAndCells(scale: number) {
    const { settings } = store.getState();
    const imgs = selected();
    // Scale grid dimensions with the cells so preview width and height stay
    // consistent. perGrid/columns are counts and must not scale. scale === 1
    // leaves settings untouched (full-resolution export, Go parity preserved).
    const scaled = scale === 1 ? settings : {
      ...settings,
      gridWidth: Math.max(Math.round(settings.gridWidth * scale), 1),
      maxGridHeight: Math.max(Math.round(settings.maxGridHeight * scale), 1),
    };
    const cellSize = Math.max(Math.floor(scaled.gridWidth / settings.columns), 1);

    // Cell rendering (downscale + saliency crop) is the expensive step. It only
    // depends on the images, crop framing, layout, and cell size, so cache it
    // and reuse when cheap settings (border, labels, quality) change. This keeps
    // border-slider drags from re-running the per-image pipeline.
    const sig = [
      settings.layout,
      settings.cropMode,
      cellSize,
      imgs.map((im) => `${im.name}#${im.rotation ?? 0}`).join(","),
    ].join("|");
    let cells: OffscreenCanvas[];
    if (cellCache && cellCache.sig === sig) {
      cells = cellCache.cells;
    } else {
      cells = imgs.map((im) => renderCell(rotate(im.bitmap, im.rotation ?? 0), settings, cellSize));
      cellCache = { sig, cells };
    }
    const names = imgs.map((im) => im.name);

    const plans =
      settings.layout === "masonry"
        ? planMasonryGrids(cells.map((c) => c.height), cellSize, scaled)
        : planSquareGrids(cells.length, cellSize, scaled);
    return { plans, cells, names, settings };
  }

  function clearPreview(): void {
    preview.getContext("2d")?.clearRect(0, 0, preview.width, preview.height);
    preview.removeAttribute("width");
    preview.removeAttribute("height");
    setPager(0, 0);
  }

  async function renderPreview(): Promise<void> {
    const { images, settings } = store.getState();
    if (!images.length) { clearPreview(); setStatus("No images yet"); return; }
    const err = validateSettings(settings);
    if (err) { setStatus(err); setPager(0, 0); return; }

    // Preview scaled so the first grid fits a reasonable width.
    const scale = Math.min(1, 700 / settings.gridWidth);
    try {
      const { plans, cells, names } = await buildPlansAndCells(scale);

      previewIndex = Math.max(0, Math.min(previewIndex, plans.length - 1));
      const plan = plans[previewIndex];
      const canvas = renderPlan(plan, cells, settings, names);
      const ctx = preview.getContext("2d");
      if (!ctx) throw new Error("canvas 2d context unavailable");
      preview.width = canvas.width;
      preview.height = canvas.height;
      ctx.drawImage(canvas, 0, 0);

      // Pager lets the user see every output file; the preview is only one of them.
      setPager(previewIndex, plans.length);

      // Report the true export dimensions. The preview is rendered at a reduced
      // scale, so dividing the scaled plan back up loses a pixel to rounding
      // (e.g. 900 reported as 899). Re-plan at full scale for exact numbers.
      const trueCellSize = Math.max(Math.floor(settings.gridWidth / settings.columns), 1);
      const truePlans =
        settings.layout === "masonry"
          ? planMasonryGrids(
              cells.map((c) => Math.round((c.height / c.width) * trueCellSize)),
              trueCellSize,
              settings,
            )
          : planSquareGrids(cells.length, trueCellSize, settings);
      const truePlan = truePlans[previewIndex] ?? plan;
      const outW = truePlan.width;
      const outH = truePlan.height;
      const used = cells.length;
      const total = images.length;
      const imgLabel = used < total ? `${used} of ${total} images` : `${used} images`;
      const fileLabel = plans.length === 1 ? "1 file" : `${plans.length} files`;
      const base = `${imgLabel}  ·  ${fileLabel}  ·  ${outW} × ${outH}px`;
      const sizeWarn = checkOutputSize(outW, outH);
      setStatus(sizeWarn ? `${base}  ·  too large to export (max ${MAX_CANVAS_DIM}px)` : base);
    } catch (e) {
      setStatus(`Preview failed: ${(e as Error).message}`);
      setPager(0, 0);
    }
  }

  function shuffle(): void {
    previewIndex = 0;
    store.shuffle(Math.random);
  }

  function reset(): void {
    for (const im of store.getState().images) {
      im.bitmap.close();
      URL.revokeObjectURL(im.thumbUrl);
    }
    previewIndex = 0;
    cellCache = null;
    store.reset(defaultSettings());
    rebuildSettings(store);
  }

  function showPreviewFile(delta: number): void {
    previewIndex += delta;
    void renderPreview();
  }

  async function exportComposite(): Promise<void> {
    const { images, settings } = store.getState();
    if (!images.length) { showToast("error", "No images loaded"); return; }
    const err = validateSettings(settings);
    if (err) { showToast("error", err); return; }

    setBusy(true, 0);
    try {
      const { plans, cells, names } = await buildPlansAndCells(1);
      for (const p of plans) {
        const sizeErr = checkOutputSize(p.width, p.height);
        if (sizeErr) { showToast("error", sizeErr); return; }
      }
      const ext = settings.format === "png" ? "png" : "jpg";
      const outputs: { blob: Blob; name: string }[] = [];
      for (let i = 0; i < plans.length; i++) {
        const canvas = renderPlan(plans[i], cells, settings, names);
        const blob = await encode(canvas, settings.format, settings.quality);
        outputs.push({ blob, name: `grid_${String(i + 1).padStart(3, "0")}.${ext}` });
        setBusy(true, (i + 1) / plans.length);
      }
      await deliver(outputs);
    } catch (e) {
      const msg = (e as Error).message;
      // A zero-size canvas means the browser refused the allocation despite the
      // pre-check (e.g. memory pressure on a huge but in-range canvas). Add a
      // hint so the raw DOM error is actionable.
      const hint = /size of .*is zero|allocat/i.test(msg)
        ? ` (grid too large to render; keep width and height under ${MAX_CANVAS_DIM}px)`
        : "";
      showToast("error", `Export failed: ${msg}${hint}`);
    } finally {
      setBusy(false);
    }
  }

  // iOS Safari does not reliably honor <a download> for blobs; the Web Share
  // sheet ("Save to Photos / Files") is the working path there. Fall back to
  // anchor downloads elsewhere, or if sharing is unavailable or fails.
  async function deliver(outputs: { blob: Blob; name: string }[]): Promise<void> {
    const files = outputs.map((o) => new File([o.blob], o.name, { type: o.blob.type }));
    // Only use the share sheet on touch devices; desktop always downloads.
    const touch = navigator.maxTouchPoints > 0;
    if (touch && navigator.canShare && navigator.canShare({ files })) {
      try {
        await navigator.share({ files, title: "Gridwall export" });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // user cancelled the sheet
        // any other share failure falls through to download
      }
    }
    for (const o of outputs) downloadBlob(o.blob, o.name);
    showToast("success", `Exported ${outputs.length} file(s) to your downloads`);
  }

  return { handleFiles, renderPreview, exportComposite, shuffle, showPreviewFile, reset };
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
