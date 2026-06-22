import type { Store } from "../state/store";
import type { BorderScope, CropMode, LayoutMode, OutputFormat } from "../core/types";
import { icon } from "./icons";

let statusEl: HTMLElement;
let progressWrap: HTMLElement;
let progressBar: HTMLElement;

export function setStatus(text: string): void {
  if (statusEl) statusEl.textContent = text;
}

export function setBusy(busy: boolean, progress = 0): void {
  if (!progressWrap) return;
  progressWrap.style.display = busy ? "block" : "none";
  progressBar.style.width = `${Math.round(progress * 100)}%`;
}

export function setPager(index: number, total: number): void {
  const pager = document.querySelector<HTMLElement>("#pager");
  const label = document.querySelector<HTMLElement>("#pager-label");
  if (!pager || !label) return;
  if (total <= 1) { pager.hidden = true; return; }
  pager.hidden = false;
  label.textContent = `File ${index + 1} / ${total}`;
  document.querySelector<HTMLButtonElement>("#prev")!.disabled = index <= 0;
  document.querySelector<HTMLButtonElement>("#next")!.disabled = index >= total - 1;
}

export function showToast(kind: "error" | "success", msg: string): void {
  const t = document.createElement("div");
  t.className = `toast ${kind}`;
  t.textContent = msg;
  t.setAttribute("role", kind === "error" ? "alert" : "status");
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

export function mountApp(root: HTMLElement, store: Store, onExport: () => void): void {
  root.innerHTML = `
    <div class="layout">
      <header class="topbar">
        <div class="brand">
          <img class="logo" src="android-chrome-192x192.png" alt="Gridwall logo" width="18" height="18" />
          <h1>Gridwall</h1>
          <span class="tagline">Image Grids &amp; Masonry Walls</span>
        </div>
        <span class="spacer"></span>
        <button class="btn ghost" id="reset" type="button" aria-label="Reset" title="Reset"><span class="btn-label">Reset</span></button>
        <label class="btn secondary" id="add" for="files" aria-label="Add images" title="Add images"><span class="btn-label">Add images</span></label>
        <button class="btn primary" id="export" type="button" aria-label="Export" title="Export"><span class="btn-label">Export</span></button>
        <input id="files" type="file" accept="image/png,image/jpeg" multiple class="visually-hidden" />
      </header>

      <aside class="rail">
        <div class="rail-head">
          <h2>Images</h2>
          <span class="count-chip" id="count">0</span>
          <span class="spacer"></span>
          <button class="icon-btn" id="shuffle" type="button" title="Shuffle order" aria-label="Shuffle order"></button>
        </div>
        <ul class="thumbs" id="thumbs"></ul>
      </aside>

      <main class="canvas-host" id="canvas-host">
        <div class="empty" id="empty">
          <div class="empty-card">
            <span id="empty-icon"></span>
            <div class="empty-title">Drop images here</div>
            <label class="btn primary" id="browse" for="files">Browse files</label>
            <div class="empty-sub">PNG or JPEG, composed in your browser. Nothing is uploaded.</div>
          </div>
        </div>
        <canvas id="preview"></canvas>
        <div class="pager" id="pager" hidden>
          <button class="icon-btn" id="prev" type="button" aria-label="Previous file"></button>
          <span id="pager-label">File 1 / 1</span>
          <button class="icon-btn" id="next" type="button" aria-label="Next file"></button>
        </div>
        <div class="progress" id="progress" style="display:none"><span></span></div>
      </main>

      <aside class="settings" id="settings"></aside>
      <footer class="statusbar">
        <span id="status">No images yet</span>
        <span class="spacer"></span>
        <a class="repo-link" href="https://github.com/bradsec/gridwall" target="_blank" rel="noopener noreferrer">GitHub</a>
      </footer>
    </div>`;

  statusEl = root.querySelector("#status")!;
  progressWrap = root.querySelector("#progress")!;
  progressBar = progressWrap.querySelector("span")!;

  root.querySelector("#empty-icon")!.replaceWith(iconWrap("image", 44, "empty-icon"));
  prependIcon(root.querySelector<HTMLElement>("#reset")!, "rotate");
  prependIcon(root.querySelector<HTMLElement>("#add")!, "plus");
  prependIcon(root.querySelector<HTMLElement>("#export")!, "download");
  root.querySelector("#shuffle")!.appendChild(icon("shuffle"));
  root.querySelector("#prev")!.appendChild(icon("chevron-left"));
  root.querySelector("#next")!.appendChild(icon("chevron-right"));

  buildSettings(root.querySelector("#settings")!, store);

  root.querySelector<HTMLButtonElement>("#export")!.addEventListener("click", onExport);
  // Add images / Browse files are <label for="files">, so the browser opens the
  // file picker natively. No programmatic input.click(), which Chrome can drop.
}

function prependIcon(btn: HTMLElement, name: "plus" | "download" | "rotate"): void {
  btn.prepend(icon(name));
}

function iconWrap(name: "image", size: number, cls: string): HTMLElement {
  const span = document.createElement("span");
  span.id = cls;
  span.className = "empty-icon";
  span.appendChild(icon(name, size));
  return span;
}

// Repaints the settings panel from current store state (e.g. after Reset).
export function rebuildSettings(store: Store): void {
  const host = document.querySelector<HTMLElement>("#settings");
  if (host) buildSettings(host, store);
}

function buildSettings(host: HTMLElement, store: Store): void {
  const s = store.getState().settings;
  host.innerHTML = `
    <section class="group">
      <h3 class="group-title">Layout</h3>
      <div class="field">
        <span class="label">Arrangement</span>
        <div class="segmented" id="seg-layout">
          <button type="button" data-val="square">Square grid</button>
          <button type="button" data-val="masonry">Masonry</button>
        </div>
      </div>
      <label class="field"><span class="label">Columns</span>
        <input id="set-columns" type="number" min="1" value="${s.columns}" /></label>
      <label class="field square-only"><span class="label">Crop framing</span>
        <select id="set-crop">
          <option value="smart">Smart (saliency)</option>
          <option value="center">Center</option>
          <option value="top">Top</option>
        </select></label>
    </section>

    <section class="group">
      <h3 class="group-title">Sizing</h3>
      <label class="field"><span class="label">Grid width (px)</span>
        <input id="set-width" type="number" min="1" value="${s.gridWidth}" /></label>
      <label class="field square-only"><span class="label">Max height per file (px)</span>
        <input id="set-height" type="number" min="1" value="${s.maxGridHeight}" /></label>
      <label class="field masonry-only"><span class="label">Images per file (0 = all)</span>
        <input id="set-pergrid" type="number" min="0" value="${s.perGrid}" /></label>
      <label class="field"><span class="label">Use at most (0 = all)</span>
        <input id="set-limit" type="number" min="0" value="${s.limit}" /></label>
    </section>

    <section class="group">
      <h3 class="group-title">Options</h3>
      <label class="toggle">
        <input id="set-names" type="checkbox" /><span class="track"></span>
        <span class="label">Filename labels</span></label>
    </section>

    <section class="group">
      <h3 class="group-title">Border</h3>
      <label class="field"><span class="label">Thickness (px)</span>
        <div class="range-row">
          <input id="set-border-thickness" type="range" min="0" max="40" step="1" value="${s.borderThickness}" />
          <output id="set-border-thickness-out">${s.borderThickness}</output>
        </div></label>
      <label class="field"><span class="label">Apply to</span>
        <select id="set-border-scope">
          <option value="each">Each image</option>
          <option value="outside">Whole grid</option>
        </select></label>
      <div class="field"><span class="label">Color</span>
        <div class="color-row">
          <input id="set-border-color" type="color" value="${s.borderColor}" />
          <input id="set-border-hex" type="text" spellcheck="false" maxlength="7" value="${s.borderColor}" />
        </div></div>
    </section>

    <section class="group">
      <h3 class="group-title">Output</h3>
      <label class="field"><span class="label">Format</span>
        <select id="set-format">
          <option value="jpeg">JPEG</option>
          <option value="png">PNG</option>
        </select></label>
      <label class="field" id="field-quality"><span class="label">JPEG quality</span>
        <div class="range-row">
          <input id="set-quality" type="range" min="0.1" max="1" step="0.05" value="${s.quality}" />
          <output id="set-quality-out">${s.quality.toFixed(2)}</output>
        </div></label>
    </section>`;

  const num = (id: string, key: "columns" | "gridWidth" | "maxGridHeight" | "limit" | "perGrid") =>
    host.querySelector<HTMLInputElement>(id)!.addEventListener("input", (e) =>
      store.setSettings({ [key]: Number((e.target as HTMLInputElement).value) }));
  num("#set-columns", "columns");
  num("#set-width", "gridWidth");
  num("#set-height", "maxGridHeight");
  num("#set-limit", "limit");
  num("#set-pergrid", "perGrid");

  host.querySelector<HTMLSelectElement>("#set-crop")!.addEventListener("change", (e) =>
    store.setSettings({ cropMode: (e.target as HTMLSelectElement).value as CropMode }));
  const qualityField = host.querySelector<HTMLElement>("#field-quality")!;
  const syncQualityVisible = (fmt: OutputFormat) => qualityField.classList.toggle("hidden", fmt === "png");
  host.querySelector<HTMLSelectElement>("#set-format")!.addEventListener("change", (e) => {
    const fmt = (e.target as HTMLSelectElement).value as OutputFormat;
    store.setSettings({ format: fmt });
    syncQualityVisible(fmt);
  });
  syncQualityVisible(s.format);
  host.querySelector<HTMLInputElement>("#set-names")!.addEventListener("change", (e) =>
    store.setSettings({ addNames: (e.target as HTMLInputElement).checked }));

  const qualityInput = host.querySelector<HTMLInputElement>("#set-quality")!;
  const qualityOut = host.querySelector<HTMLOutputElement>("#set-quality-out")!;
  qualityInput.addEventListener("input", () => {
    const val = Number(qualityInput.value);
    qualityOut.textContent = val.toFixed(2);
    store.setSettings({ quality: val });
  });

  const thicknessInput = host.querySelector<HTMLInputElement>("#set-border-thickness")!;
  const thicknessOut = host.querySelector<HTMLOutputElement>("#set-border-thickness-out")!;
  thicknessInput.addEventListener("input", () => {
    const val = Number(thicknessInput.value);
    thicknessOut.textContent = String(val);
    store.setSettings({ borderThickness: val });
  });
  host.querySelector<HTMLSelectElement>("#set-border-scope")!.addEventListener("change", (e) =>
    store.setSettings({ borderScope: (e.target as HTMLSelectElement).value as BorderScope }));

  const colorInput = host.querySelector<HTMLInputElement>("#set-border-color")!;
  const hexInput = host.querySelector<HTMLInputElement>("#set-border-hex")!;
  colorInput.addEventListener("input", () => {
    hexInput.value = colorInput.value;
    store.setSettings({ borderColor: colorInput.value });
  });
  hexInput.addEventListener("input", () => {
    const m = hexInput.value.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{6}$/.test(m)) {
      const hex = "#" + m.toLowerCase();
      colorInput.value = hex;
      store.setSettings({ borderColor: hex });
    }
  });

  // Segmented layout control + mode-aware visibility of square/masonry-only fields.
  const seg = host.querySelector<HTMLElement>("#seg-layout")!;
  const applyMode = (layout: LayoutMode) => {
    host.querySelectorAll<HTMLElement>(".square-only")
      .forEach((el) => el.classList.toggle("hidden", layout !== "square"));
    host.querySelectorAll<HTMLElement>(".masonry-only")
      .forEach((el) => el.classList.toggle("hidden", layout !== "masonry"));
  };
  seg.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
    if (b.dataset.val === s.layout) b.classList.add("active");
    b.addEventListener("click", () => {
      const val = b.dataset.val as LayoutMode;
      seg.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
      store.setSettings({ layout: val });
      applyMode(val);
    });
  });
  applyMode(s.layout);
}
