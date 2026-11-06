import type { Store, LoadedImage } from "./state/store";
import { defaultSettings } from "./state/store";
import { validateSettings, checkOutputSize, MAX_CANVAS_DIM } from "./core/settings";
import { setStatus, setBusy, showToast, setPager, rebuildSettings } from "./ui/app";
import type { Bridge } from "./worker/bridge";
import type { OrderEntry, LoadResult } from "./worker/protocol";

const ACCEPTED = new Set(["image/png", "image/jpeg"]);

export function createController(store: Store, bridge: Bridge) {
  const preview = document.querySelector<HTMLCanvasElement>("#preview")!;
  const empty = document.querySelector<HTMLElement>("#empty")!;
  let resetEpoch = 0;

  // Applies the image limit. Order is the store's persisted order, mutated by
  // drag-reorder and the shuffle action, so no render-time reshuffling.
  function selected(): LoadedImage[] {
    const { images, settings } = store.getState();
    if (settings.limit > 0 && settings.limit < images.length) return images.slice(0, settings.limit);
    return images;
  }

  function orderEntries(): OrderEntry[] {
    return selected().map((im) => ({ id: im.id, name: im.name, rotation: im.rotation ?? 0 }));
  }

  async function handleFiles(files: FileList): Promise<void> {
    const epoch = resetEpoch;
    // Read every file synchronously within this event turn. Files from a
    // native drag-and-drop are only reliably readable during the drop event;
    // postMessage clones the File data now, and createObjectURL pins the blob
    // for the thumbnail the same way.
    const items = Array.from(files).map((file) => {
      const accepted = ACCEPTED.has(file.type);
      return {
        file,
        accepted,
        id: crypto.randomUUID(),
        thumbUrl: accepted ? URL.createObjectURL(file) : "",
      };
    });
    for (const item of items) {
      if (!item.accepted) showToast("error", `Skipped ${item.file.name}: unsupported type`);
    }
    const toLoad = items.filter((i) => i.accepted);
    if (!toLoad.length) return;

    let results: LoadResult[];
    try {
      results = await bridge.load(
        toLoad.map((i) => ({ id: i.id, name: i.file.name, blob: i.file })),
      );
    } catch (e) {
      for (const item of toLoad) URL.revokeObjectURL(item.thumbUrl);
      if (epoch === resetEpoch) showToast("error", `Import failed: ${(e as Error).message}`);
      return;
    }
    if (epoch !== resetEpoch) {
      for (const item of toLoad) URL.revokeObjectURL(item.thumbUrl);
      void bridge.remove(results.filter((r) => r.ok).map((r) => r.id)).catch(() => undefined);
      return;
    }
    const byId = new Map(results.map((r) => [r.id, r]));
    const loaded: LoadedImage[] = [];
    for (const item of toLoad) {
      const r = byId.get(item.id);
      if (r?.ok) {
        loaded.push({ id: item.id, name: item.file.name, thumbUrl: item.thumbUrl, width: r.width, height: r.height });
      } else {
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

  function clearPreview(): void {
    preview.getContext("2d")?.clearRect(0, 0, preview.width, preview.height);
    preview.removeAttribute("width");
    preview.removeAttribute("height");
    setPager(0, 0);
  }

  async function renderPreview(): Promise<void> {
    const epoch = resetEpoch;
    const { images, settings } = store.getState();
    if (!images.length) { clearPreview(); setStatus("No images yet"); return; }
    const err = validateSettings(settings);
    if (err) { setStatus(err); setPager(0, 0); return; }

    const scale = Math.min(1, 700 / settings.gridWidth);
    try {
      const result = await bridge.preview(orderEntries(), settings, scale, previewIndex);
      if (!result) return; // superseded by a newer preview
      if (epoch !== resetEpoch) { result.bitmap.close(); return; }
      previewIndex = Math.max(0, Math.min(previewIndex, result.pageCount - 1));
      const ctx = preview.getContext("2d");
      if (!ctx) throw new Error("canvas 2d context unavailable");
      preview.width = result.bitmap.width;
      preview.height = result.bitmap.height;
      ctx.drawImage(result.bitmap, 0, 0);
      result.bitmap.close();

      setPager(previewIndex, result.pageCount);
      const used = orderEntries().length;
      const total = images.length;
      const imgLabel = used < total ? `${used} of ${total} images` : `${used} images`;
      const fileLabel = result.pageCount === 1 ? "1 file" : `${result.pageCount} files`;
      const base = `${imgLabel}  ·  ${fileLabel}  ·  ${result.trueWidth} × ${result.trueHeight}px`;
      const sizeWarn = checkOutputSize(result.trueWidth, result.trueHeight);
      setStatus(sizeWarn ? `${base}  ·  too large to export (max ${MAX_CANVAS_DIM}px)` : base);
    } catch (e) {
      if (epoch !== resetEpoch) return;
      setStatus(`Preview failed: ${(e as Error).message}`);
      setPager(0, 0);
    }
  }

  function shuffle(): void {
    previewIndex = 0;
    store.shuffle(Math.random);
  }

  function sortImages(direction: "asc" | "desc"): void {
    previewIndex = 0;
    store.sortByName(direction);
  }

  function removeImage(index: number): void {
    const im = store.getState().images[index];
    if (!im) return;
    URL.revokeObjectURL(im.thumbUrl);
    // worker teardown failures have no user-actionable surface
    void bridge.remove([im.id]).catch(() => undefined);
    store.removeImage(index);
  }

  function reset(): void {
    resetEpoch++;
    for (const im of store.getState().images) URL.revokeObjectURL(im.thumbUrl);
    // worker teardown failures have no user-actionable surface
    void bridge.reset().catch(() => undefined);
    previewIndex = 0;
    store.reset(defaultSettings());
    rebuildSettings(store);
  }

  function showPreviewFile(delta: number): void {
    previewIndex += delta;
    void renderPreview();
  }

  // encode() yields to the event loop, so a second Export click mid-run would
  // start an overlapping job (and a second concurrent navigator.share rejects).
  let exporting = false;

  async function exportComposite(): Promise<void> {
    if (exporting) return;
    const { images, settings } = store.getState();
    if (!images.length) { showToast("error", "No images loaded"); return; }
    const err = validateSettings(settings);
    if (err) { showToast("error", err); return; }

    exporting = true;
    setBusy(true, 0);
    try {
      const outputs = await bridge.exportAll(orderEntries(), settings, (done, total) =>
        setBusy(true, done / total),
      );
      await deliver(outputs);
    } catch (e) {
      const msg = (e as Error).message;
      const hint = /size of .*is zero|allocat/i.test(msg)
        ? ` (grid too large to render; keep width and height under ${MAX_CANVAS_DIM}px)`
        : "";
      showToast("error", `Export failed: ${msg}${hint}`);
    } finally {
      exporting = false;
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

  return { handleFiles, renderPreview, exportComposite, shuffle, sortImages, showPreviewFile, reset, removeImage };
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
