import { afterEach, describe, expect, it, vi } from "vitest";
import { Store, defaultSettings } from "../state/store";
import { renderTray } from "./tray";

class ElementStub extends EventTarget {
  children: ElementStub[] = [];
  className = "";
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  textContent = "";
  title = "";
  type = "";
  src = "";
  alt = "";
  attributes = new Map<string, string>();
  get firstElementChild(): ElementStub | null { return this.children[0] ?? null; }

  constructor(private doc: DocumentStub) { super(); }
  appendChild(child: ElementStub): void { this.children.push(child); }
  append(...children: ElementStub[]): void { this.children.push(...children); }
  replaceChildren(): void { this.children = []; this.doc.activeElement = null; }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  focus(): void { this.doc.activeElement = this; }
}

class DocumentStub {
  activeElement: ElementStub | null = null;
  thumbs = new ElementStub(this);
  count = new ElementStub(this);
  querySelector(selector: string): ElementStub | null {
    return selector === "#thumbs" ? this.thumbs : selector === "#count" ? this.count : null;
  }
  createElement(): ElementStub { return new ElementStub(this); }
  createElementNS(): ElementStub { return new ElementStub(this); }
}

afterEach(() => vi.unstubAllGlobals());

describe("tray keyboard reorder", () => {
  it("moves an image right, announces its position, and keeps focus on its grip", () => {
    const doc = new DocumentStub();
    vi.stubGlobal("document", doc);
    const store = new Store(defaultSettings());
    store.addImages([
      { id: "a", name: "a.jpg", thumbUrl: "a", width: 1, height: 1 },
      { id: "b", name: "b.jpg", thumbUrl: "b", width: 1, height: 1 },
    ]);
    const render = () => renderTray(store, () => undefined);
    store.subscribe(render);
    render();

    const grip = doc.thumbs.children[0].children[0];
    grip.focus();
    const key = new Event("keydown", { cancelable: true });
    Object.defineProperty(key, "key", { value: "ArrowRight" });
    grip.dispatchEvent(key);

    expect(key.defaultPrevented).toBe(true);
    expect(store.getState().images.map((image) => image.id)).toEqual(["b", "a"]);
    expect(doc.activeElement).toBe(doc.thumbs.children[1].children[0]);
    expect(doc.activeElement?.attributes.get("aria-label")).toContain("2 of 2");

    const lastGrip = doc.activeElement;
    const right = new Event("keydown", { cancelable: true });
    Object.defineProperty(right, "key", { value: "ArrowRight" });
    lastGrip?.dispatchEvent(right);
    expect(store.getState().images.map((image) => image.id)).toEqual(["b", "a"]);
    expect(doc.activeElement).toBe(lastGrip);

    const left = new Event("keydown", { cancelable: true });
    Object.defineProperty(left, "key", { value: "ArrowLeft" });
    lastGrip?.dispatchEvent(left);
    expect(store.getState().images.map((image) => image.id)).toEqual(["a", "b"]);
    expect(doc.activeElement).toBe(doc.thumbs.children[0].children[0]);
  });
});
