import type { Settings } from "../core/types";
import { shuffleInPlace } from "../core/shuffle";

export interface LoadedImage {
  name: string;
  bitmap: ImageBitmap;
  thumbUrl: string;
  rotation?: number; // degrees clockwise, multiple of 90; undefined === 0
}

export interface AppState {
  images: LoadedImage[];
  settings: Settings;
}

export function defaultSettings(): Settings {
  return {
    layout: "square",
    gridWidth: 900,
    maxGridHeight: 900,
    columns: 3,
    cropMode: "smart",
    addNames: false,
    limit: 0,
    perGrid: 0,
    format: "jpeg",
    quality: 0.9,
    borderThickness: 0,
    borderColor: "#ffffff",
    borderScope: "each",
  };
}

export class Store {
  private images: LoadedImage[] = [];
  private settings: Settings;
  private subs = new Set<() => void>();

  constructor(settings: Settings) {
    this.settings = settings;
  }

  getState(): AppState {
    return { images: [...this.images], settings: this.settings };
  }

  subscribe(fn: () => void): () => void {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  private notify(): void {
    for (const fn of this.subs) fn();
  }

  setSettings(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    this.notify();
  }

  addImages(imgs: LoadedImage[]): void {
    this.images = [...this.images, ...imgs];
    this.notify();
  }

  removeImage(index: number): void {
    this.images = this.images.filter((_, i) => i !== index);
    this.notify();
  }

  reorder(from: number, to: number): void {
    const next = [...this.images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    this.images = next;
    this.notify();
  }

  // Clears all images and replaces settings (used by Reset). Callers revoke any
  // thumbnail object URLs before calling, since the store does not own the DOM.
  reset(settings: Settings): void {
    this.images = [];
    this.settings = settings;
    this.notify();
  }

  // Rotates one image 90 degrees clockwise (cycles 0 -> 90 -> 180 -> 270 -> 0).
  rotateImage(index: number): void {
    this.images = this.images.map((im, i) =>
      i === index ? { ...im, rotation: (((im.rotation ?? 0) + 90) % 360) } : im);
    this.notify();
  }

  // Permutes the image order. The new order is the persisted order, so the tray
  // and the composite both reflect it (shuffle is an action, not a render-time
  // transform that would re-roll on every settings change).
  shuffle(rng: () => number): void {
    const next = [...this.images];
    shuffleInPlace(next, rng);
    this.images = next;
    this.notify();
  }
}
