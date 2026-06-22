import "./style.css";
import { Store, defaultSettings } from "./state/store";
import { mountApp } from "./ui/app";
import { createController } from "./controller";
import { renderTray } from "./ui/tray";

const root = document.querySelector<HTMLDivElement>("#app")!;
const store = new Store(defaultSettings());

let controller: ReturnType<typeof createController>;
mountApp(root, store, () => void controller.exportComposite());
controller = createController(store);

const filesInput = root.querySelector<HTMLInputElement>("#files")!;
filesInput.addEventListener("change", (e) => {
  const input = e.target as HTMLInputElement;
  if (input.files) void controller.handleFiles(input.files);
  input.value = ""; // allow re-selecting the same file
});

root.querySelector<HTMLButtonElement>("#reset")!.addEventListener("click", () => controller.reset());
root.querySelector<HTMLButtonElement>("#shuffle")!.addEventListener("click", () => controller.shuffle());
root.querySelector<HTMLButtonElement>("#prev")!.addEventListener("click", () => controller.showPreviewFile(-1));
root.querySelector<HTMLButtonElement>("#next")!.addEventListener("click", () => controller.showPreviewFile(1));

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
renderTray(store);
store.subscribe(() => {
  renderTray(store);
  empty.style.display = store.getState().images.length ? "none" : "";
});

function debounce(fn: () => void, ms: number): () => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return () => { if (t) clearTimeout(t); t = setTimeout(fn, ms); };
}
const schedulePreview = debounce(() => void controller.renderPreview(), 120);
store.subscribe(schedulePreview);
