import "./style.css";
import { Store, defaultSettings } from "./state/store";
import { loadSettings, saveSettings } from "./state/persist";
import { mountApp } from "./ui/app";
import { createController } from "./controller";
import { renderTray } from "./ui/tray";
import { createBridge, createInlineBridge, supportsWorkerPipeline } from "./worker/bridge";

const root = document.querySelector<HTMLDivElement>("#app")!;
const store = new Store(loadSettings() ?? defaultSettings());

const bridge = supportsWorkerPipeline()
  ? createBridge(new Worker(new URL("./worker/grid.worker.ts", import.meta.url), { type: "module" }))
  : createInlineBridge();

let controller: ReturnType<typeof createController>;
mountApp(root, store, () => void controller.exportComposite());
controller = createController(store, bridge);

const filesInput = root.querySelector<HTMLInputElement>("#files")!;
filesInput.addEventListener("change", (e) => {
  const input = e.target as HTMLInputElement;
  if (input.files) void controller.handleFiles(input.files);
  input.value = ""; // allow re-selecting the same file
});

root.querySelector<HTMLButtonElement>("#reset")!.addEventListener("click", () => controller.reset());
root.querySelector<HTMLButtonElement>("#shuffle")!.addEventListener("click", () => controller.shuffle());
root.querySelector<HTMLButtonElement>("#sort-asc")!.addEventListener("click", () => controller.sortImages("asc"));
root.querySelector<HTMLButtonElement>("#sort-desc")!.addEventListener("click", () => controller.sortImages("desc"));
root.querySelector<HTMLButtonElement>("#prev")!.addEventListener("click", () => controller.showPreviewFile(-1));
root.querySelector<HTMLButtonElement>("#next")!.addEventListener("click", () => controller.showPreviewFile(1));

// A drop outside the canvas drop zone would otherwise navigate the tab to the
// dropped file, discarding the whole in-memory session (nothing is persisted).
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

// Drag and drop onto the canvas.
const canvasHost = root.querySelector<HTMLElement>("#canvas-host")!;
const empty = root.querySelector<HTMLElement>("#empty")!;
let dragDepth = 0;
canvasHost.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragDepth++;
  canvasHost.classList.add("dragover");
});
canvasHost.addEventListener("dragover", (e) => e.preventDefault());
canvasHost.addEventListener("dragleave", () => {
  if (--dragDepth <= 0) { dragDepth = 0; canvasHost.classList.remove("dragover"); }
});
canvasHost.addEventListener("drop", (e) => {
  e.preventDefault();
  dragDepth = 0;
  canvasHost.classList.remove("dragover");
  if (e.dataTransfer?.files?.length) void controller.handleFiles(e.dataTransfer.files);
});

// Tray + empty-state visibility track the image list.
renderTray(store, (i) => controller.removeImage(i));
store.subscribe(() => {
  renderTray(store, (i) => controller.removeImage(i));
  empty.style.display = store.getState().images.length ? "none" : "";
});

function debounce(fn: () => void, ms: number): () => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return () => { if (t) clearTimeout(t); t = setTimeout(fn, ms); };
}
const schedulePreview = debounce(() => void controller.renderPreview(), 120);
store.subscribe(schedulePreview);

// Persist settings on every change (small payload; images stay memory-only).
// Reset writes defaults through this same path.
store.subscribe(() => saveSettings(store.getState().settings));
