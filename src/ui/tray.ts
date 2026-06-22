import type { Store } from "../state/store";
import { icon } from "./icons";

// Rebuilds the source-image tray (#thumbs) and the count chip (#count) from store
// state. Reordering uses Pointer Events on a grip handle so it works with touch
// (HTML5 drag-and-drop does not fire on touchscreens) and a mouse, and leaves the
// rest of the tile free for scrolling the strip on mobile.
export function renderTray(store: Store): void {
  const host = document.querySelector<HTMLElement>("#thumbs");
  const countEl = document.querySelector<HTMLElement>("#count");
  if (!host) return;

  const { images } = store.getState();
  if (countEl) countEl.textContent = String(images.length);

  host.replaceChildren();

  let dragFrom: number | null = null;
  const clearTargets = () =>
    host.querySelectorAll(".thumb.drop-target").forEach((t) => t.classList.remove("drop-target"));

  for (let i = 0; i < images.length; i++) {
    const image = images[i];

    const thumb = document.createElement("li");
    thumb.className = "thumb";
    thumb.dataset.index = String(i);

    const grip = document.createElement("button");
    grip.className = "thumb-grip";
    grip.type = "button";
    grip.title = "Drag to reorder";
    grip.setAttribute("aria-label", "Drag to reorder " + image.name);
    grip.appendChild(icon("grip", 14));

    grip.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      dragFrom = i;
      thumb.classList.add("dragging");
      grip.setPointerCapture(e.pointerId);
    });
    grip.addEventListener("pointermove", (e) => {
      if (dragFrom === null) return;
      const over = elementThumb(e.clientX, e.clientY);
      clearTargets();
      if (over && over !== thumb) over.classList.add("drop-target");
    });
    grip.addEventListener("pointerup", (e) => {
      if (dragFrom === null) return;
      const over = elementThumb(e.clientX, e.clientY);
      const from = dragFrom;
      dragFrom = null;
      thumb.classList.remove("dragging");
      clearTargets();
      if (over) {
        const to = Number(over.dataset.index);
        if (!Number.isNaN(to) && to !== from) store.reorder(from, to);
      }
    });
    grip.addEventListener("pointercancel", () => {
      dragFrom = null;
      thumb.classList.remove("dragging");
      clearTargets();
    });

    const img = document.createElement("img");
    img.className = "thumb-img";
    img.src = image.thumbUrl;
    img.alt = "";
    const rot = image.rotation ?? 0;
    if (rot) img.style.transform = `rotate(${rot}deg)`;

    const name = document.createElement("span");
    name.className = "thumb-name";
    name.textContent = image.name;

    const rotateBtn = document.createElement("button");
    rotateBtn.className = "thumb-rotate";
    rotateBtn.type = "button";
    rotateBtn.title = "Rotate 90 degrees";
    rotateBtn.setAttribute("aria-label", "Rotate " + image.name);
    rotateBtn.appendChild(icon("rotate", 13));
    rotateBtn.addEventListener("click", () => store.rotateImage(i));

    const removeBtn = document.createElement("button");
    removeBtn.className = "thumb-remove";
    removeBtn.type = "button";
    removeBtn.setAttribute("aria-label", "Remove " + image.name);
    removeBtn.appendChild(icon("x", 13));
    removeBtn.addEventListener("click", () => {
      image.bitmap.close();
      URL.revokeObjectURL(image.thumbUrl);
      store.removeImage(i);
    });

    thumb.append(grip, img, name, rotateBtn, removeBtn);
    host.appendChild(thumb);
  }
}

function elementThumb(x: number, y: number): HTMLElement | null {
  const el = document.elementFromPoint(x, y);
  return el ? (el.closest(".thumb") as HTMLElement | null) : null;
}
