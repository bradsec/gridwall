import { describe, it, expect } from "vitest";
import { Store, defaultSettings } from "./store";
import type { LoadedImage } from "./store";

function img(name: string): LoadedImage {
  return { name, bitmap: {} as unknown as ImageBitmap, thumbUrl: "blob:" + name };
}

describe("Store", () => {
  it("adds, reorders, removes images and notifies subscribers", () => {
    const store = new Store(defaultSettings());
    let calls = 0;
    const unsub = store.subscribe(() => calls++);

    store.addImages([img("a"), img("b"), img("c")]);
    expect(store.getState().images.map((i) => i.name)).toEqual(["a", "b", "c"]);

    store.reorder(0, 2);
    expect(store.getState().images.map((i) => i.name)).toEqual(["b", "c", "a"]);

    store.removeImage(1);
    expect(store.getState().images.map((i) => i.name)).toEqual(["b", "a"]);

    expect(calls).toBe(3);
    unsub();
    store.setSettings({ columns: 5 });
    expect(calls).toBe(3); // no notify after unsubscribe
    expect(store.getState().settings.columns).toBe(5);
  });
});
