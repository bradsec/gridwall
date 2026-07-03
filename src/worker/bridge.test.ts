import { describe, it, expect } from "vitest";
import { createBridge, type WorkerLike } from "./bridge";
import type { WorkerRequest, WorkerResponse } from "./protocol";
import { defaultSettings } from "../state/store";

// Fake worker: captures requests, lets the test emit responses.
function fakeWorker() {
  const sent: WorkerRequest[] = [];
  let listener: ((ev: MessageEvent) => void) | null = null;
  const worker: WorkerLike = {
    postMessage: (msg) => void sent.push(msg as WorkerRequest),
    addEventListener: (_type, fn) => void (listener = fn),
  };
  const emit = (msg: WorkerResponse) => listener!({ data: msg } as MessageEvent);
  return { worker, sent, emit };
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

  it("resolves remove and reset acks", async () => {
    const { worker, sent, emit } = fakeWorker();
    const bridge = createBridge(worker);
    const p = bridge.remove(["a"]);
    emit({ op: "done", jobId: sent[0].jobId });
    await expect(p).resolves.toBeUndefined();
  });
});
