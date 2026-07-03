import { describe, it, expect } from "vitest";
import { createBridge, createInlineBridge, type WorkerLike } from "./bridge";
import type { WorkerRequest, WorkerResponse } from "./protocol";
import type { Pipeline } from "./pipeline";
import { defaultSettings } from "../state/store";

// Fake worker: captures requests, lets the test emit responses or failures.
function fakeWorker() {
  const sent: WorkerRequest[] = [];
  const listeners: Partial<Record<"message" | "error" | "messageerror", (ev: MessageEvent | ErrorEvent) => void>> = {};
  const worker: WorkerLike = {
    postMessage: (msg) => void sent.push(msg as WorkerRequest),
    addEventListener: (type, fn) => void (listeners[type] = fn),
  };
  const emit = (msg: WorkerResponse) => listeners.message!({ data: msg } as MessageEvent);
  const emitError = (message?: string) =>
    listeners.error!((message ? { message } : {}) as ErrorEvent);
  const emitMessageError = () => listeners.messageerror!({} as MessageEvent);
  return { worker, sent, emit, emitError, emitMessageError };
}

const order = [{ id: "a", name: "a.jpg", rotation: 0 }];
const fakeBitmap = () => ({ close: () => undefined }) as unknown as ImageBitmap;

describe("bridge", () => {
  it("resolves load with the worker's results", async () => {
    const { worker, sent, emit } = fakeWorker();
    const bridge = createBridge(worker);
    const p = bridge.load([{ id: "a", name: "a.jpg", blob: new Blob() }]);
    const req = sent[0];
    expect(req.op).toBe("load");
    emit({ op: "loaded", jobId: req.jobId, results: [{ id: "a", ok: true, width: 10, height: 5 }] });
    await expect(p).resolves.toEqual([{ id: "a", ok: true, width: 10, height: 5 }]);
  });

  it("rejects on jobError", async () => {
    const { worker, sent, emit } = fakeWorker();
    const bridge = createBridge(worker);
    const p = bridge.exportAll(order, defaultSettings(), () => undefined);
    emit({ op: "jobError", jobId: sent[0].jobId, message: "boom" });
    await expect(p).rejects.toThrow("boom");
  });

  it("streams export progress then resolves outputs", async () => {
    const { worker, sent, emit } = fakeWorker();
    const bridge = createBridge(worker);
    const progress: number[] = [];
    const p = bridge.exportAll(order, defaultSettings(), (done) => void progress.push(done));
    const id = sent[0].jobId;
    emit({ op: "exportProgress", jobId: id, done: 1, total: 2 });
    emit({ op: "exportProgress", jobId: id, done: 2, total: 2 });
    emit({ op: "exportDone", jobId: id, outputs: [] });
    await expect(p).resolves.toEqual([]);
    expect(progress).toEqual([1, 2]);
  });

  it("discards stale previews: only the latest preview job resolves with a bitmap", async () => {
    const { worker, sent, emit } = fakeWorker();
    const bridge = createBridge(worker);
    const first = bridge.preview(order, defaultSettings(), 1, 0);
    const second = bridge.preview(order, defaultSettings(), 1, 0);
    const [j1, j2] = [sent[0].jobId, sent[1].jobId];
    // Old job completes after being superseded: resolves null.
    emit({ op: "previewDone", jobId: j1, bitmap: fakeBitmap(), pageCount: 1, trueWidth: 9, trueHeight: 9 });
    emit({ op: "previewDone", jobId: j2, bitmap: fakeBitmap(), pageCount: 2, trueWidth: 9, trueHeight: 9 });
    await expect(first).resolves.toBeNull();
    await expect(second).resolves.toMatchObject({ pageCount: 2 });
  });

  it("fails all pending jobs when the worker errors, and drains the pending map", async () => {
    const { worker, sent, emit, emitError } = fakeWorker();
    const bridge = createBridge(worker);
    const loadP = bridge.load([{ id: "a", name: "a.jpg", blob: new Blob() }]);
    const exportP = bridge.exportAll(order, defaultSettings(), () => undefined);
    const staleJobId = sent[0].jobId;

    emitError("boom");

    await expect(loadP).rejects.toThrow(/image worker failed/);
    await expect(exportP).rejects.toThrow(/image worker failed/);

    // Pending map was drained: a late response for an already-failed job is a no-op.
    expect(() => emit({ op: "done", jobId: staleJobId })).not.toThrow();
  });

  it("resolves remove and reset acks", async () => {
    const { worker, sent, emit } = fakeWorker();
    const bridge = createBridge(worker);
    const removeP = bridge.remove(["a"]);
    emit({ op: "done", jobId: sent[0].jobId });
    await expect(removeP).resolves.toBeUndefined();

    const resetP = bridge.reset();
    emit({ op: "done", jobId: sent[1].jobId });
    await expect(resetP).resolves.toBeUndefined();
  });
});

describe("inline bridge", () => {
  function fakePipeline() {
    const closed: number[] = [];
    let previewCount = 0;
    const resolvers: ((r: unknown) => void)[] = [];
    const pipeline = {
      load: async () => [],
      preview: () =>
        new Promise((resolve) => {
          const n = ++previewCount;
          resolvers.push((r) =>
            resolve(
              r ?? {
                bitmap: { close: () => void closed.push(n) },
                pageCount: n,
                trueWidth: 1,
                trueHeight: 1,
              }
            )
          );
        }),
      exportAll: async () => [],
      remove: () => undefined,
      reset: () => undefined,
    } as unknown as Pipeline;
    return { pipeline, resolvers, closed };
  }

  it("discards a superseded preview and closes its bitmap", async () => {
    const { pipeline, resolvers, closed } = fakePipeline();
    const bridge = createInlineBridge(pipeline);
    const first = bridge.preview(order, defaultSettings(), 1, 0);
    const second = bridge.preview(order, defaultSettings(), 1, 0);
    resolvers[0](undefined); // first finishes after being superseded
    resolvers[1](undefined);
    await expect(first).resolves.toBeNull();
    await expect(second).resolves.toMatchObject({ pageCount: 2 });
    expect(closed).toEqual([1]);
  });

  it("remove and reset resolve", async () => {
    const { pipeline } = fakePipeline();
    const bridge = createInlineBridge(pipeline);
    await expect(bridge.remove(["a"])).resolves.toBeUndefined();
    await expect(bridge.reset()).resolves.toBeUndefined();
  });
});
