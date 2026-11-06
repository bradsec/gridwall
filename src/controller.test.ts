import { expect, it, vi } from "vitest";
import { createController } from "./controller";
import { Store, defaultSettings } from "./state/store";
import type { Bridge } from "./worker/bridge";
import type { LoadResult } from "./worker/protocol";
import { setStatus } from "./ui/app";

vi.mock("./ui/app", () => ({
  setStatus: vi.fn(), setBusy: vi.fn(), showToast: vi.fn(),
  setPager: vi.fn(), rebuildSettings: vi.fn(),
}));

it("discards an import completed after Reset and keeps later imports", async () => {
  const loads: { id: string; finish: (results: LoadResult[]) => void }[] = [];
  const bridge = {
    load: (files: { id: string }[]) => new Promise<LoadResult[]>((resolve) => {
      loads.push({ id: files[0].id, finish: resolve });
    }),
    reset: async () => undefined,
    remove: vi.fn(async () => undefined),
  } as unknown as Bridge;
  const store = new Store(defaultSettings());
  const preview = { width: 0, height: 0, getContext: () => null, removeAttribute: vi.fn() };
  const empty = { style: { display: "" } };
  vi.stubGlobal("document", { querySelector: (selector: string) => selector === "#preview" ? preview : empty });
  vi.spyOn(URL, "createObjectURL").mockReturnValueOnce("blob:old").mockReturnValueOnce("blob:new");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  const controller = createController(store, bridge);
  const file = { name: "a.png", type: "image/png" };
  const oldLoad = controller.handleFiles([file] as unknown as FileList);
  controller.reset();
  const newLoad = controller.handleFiles([file] as unknown as FileList);
  loads[0].finish([{ id: loads[0].id, ok: true, width: 10, height: 10 }]);
  await oldLoad;
  expect(store.getState().images).toEqual([]);
  expect(revoke).toHaveBeenCalledWith("blob:old");
  expect(bridge.remove).toHaveBeenCalledWith([loads[0].id]);
  loads[1].finish([{ id: loads[1].id, ok: true, width: 10, height: 10 }]);
  await newLoad;
  expect(store.getState().images.map((image) => image.id)).toEqual([loads[1].id]);
});

function pendingPreview() {
  let resolve!: (result: Awaited<ReturnType<Bridge["preview"]>>) => void;
  let reject!: (error: Error) => void;
  const preview = new Promise<Awaited<ReturnType<Bridge["preview"]>>>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  const bridge = {
    preview: () => preview,
    reset: async () => undefined,
  } as unknown as Bridge;
  const store = new Store(defaultSettings());
  store.addImages([{ id: "a", name: "a.png", thumbUrl: "blob:a", width: 10, height: 10 }]);
  const drawImage = vi.fn();
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({ drawImage, clearRect: vi.fn() }),
    removeAttribute: vi.fn(),
  };
  vi.stubGlobal("document", { querySelector: (selector: string) => selector === "#preview" ? canvas : { style: {} } });
  vi.clearAllMocks();
  return { controller: createController(store, bridge), resolve, reject, drawImage };
}

it("discards and closes a preview completed after Reset", async () => {
  const { controller, resolve, drawImage } = pendingPreview();
  const close = vi.fn();
  const rendering = controller.renderPreview();
  controller.reset();
  await controller.renderPreview();
  resolve({ bitmap: { width: 10, height: 10, close } as unknown as ImageBitmap, pageCount: 1, trueWidth: 10, trueHeight: 10 });
  await rendering;
  expect(drawImage).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledOnce();
  expect(setStatus).toHaveBeenLastCalledWith("No images yet");
});

it("ignores a preview error completed after Reset", async () => {
  const { controller, reject, drawImage } = pendingPreview();
  const rendering = controller.renderPreview();
  controller.reset();
  await controller.renderPreview();
  reject(new Error("old preview failed"));
  await rendering;
  expect(drawImage).not.toHaveBeenCalled();
  expect(setStatus).toHaveBeenLastCalledWith("No images yet");
});
