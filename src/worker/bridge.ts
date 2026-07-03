import type { Settings } from "../core/types";
import type { OrderEntry, LoadResult, WorkerRequest, WorkerResponse } from "./protocol";
import { createPipeline, type Pipeline, type PreviewResult } from "./pipeline";

export interface WorkerLike {
  postMessage(msg: unknown, transfer?: Transferable[]): void;
  addEventListener(type: "message" | "error" | "messageerror", fn: (ev: MessageEvent | ErrorEvent) => void): void;
}

export interface Bridge {
  load(files: { id: string; name: string; blob: Blob }[]): Promise<LoadResult[]>;
  preview(
    order: OrderEntry[],
    settings: Settings,
    scale: number,
    previewIndex: number,
  ): Promise<PreviewResult | null>;
  exportAll(
    order: OrderEntry[],
    settings: Settings,
    onProgress: (done: number, total: number) => void,
  ): Promise<{ blob: Blob; name: string }[]>;
  remove(ids: string[]): Promise<void>;
  reset(): Promise<void>;
}

export function supportsWorkerPipeline(): boolean {
  return typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined";
}

export function createBridge(worker: WorkerLike): Bridge {
  let nextJobId = 1;
  interface Pending {
    resolve: (value: never) => void;
    reject: (err: Error) => void;
    onProgress?: (done: number, total: number) => void;
  }
  const pending = new Map<number, Pending>();
  // Latest preview wins; older previews resolve null and their bitmaps close.
  let latestPreviewJob = 0;

  // If the worker script fails to load/evaluate, or a message fails to
  // deserialize, no "message" response ever arrives: fail every pending job
  // instead of leaving its promise (and any awaiting UI state) hanging.
  function failAllPending(err: Error): void {
    for (const job of pending.values()) job.reject(err);
    pending.clear();
    latestPreviewJob = 0;
  }

  worker.addEventListener("error", (ev) => {
    const message = "message" in ev && typeof ev.message === "string" ? ev.message : undefined;
    failAllPending(new Error("image worker failed" + (message ? ": " + message : "")));
  });

  worker.addEventListener("messageerror", () => {
    failAllPending(new Error("image worker failed"));
  });

  worker.addEventListener("message", (ev) => {
    const msg = (ev as MessageEvent).data as WorkerResponse;
    const job = pending.get(msg.jobId);
    if (!job) return;
    switch (msg.op) {
      case "loaded":
        pending.delete(msg.jobId);
        job.resolve(msg.results as never);
        break;
      case "previewDone":
        pending.delete(msg.jobId);
        if (msg.jobId !== latestPreviewJob) {
          msg.bitmap.close();
          job.resolve(null as never);
        } else {
          job.resolve({
            bitmap: msg.bitmap,
            pageCount: msg.pageCount,
            trueWidth: msg.trueWidth,
            trueHeight: msg.trueHeight,
          } as never);
        }
        break;
      case "exportProgress":
        job.onProgress?.(msg.done, msg.total);
        break;
      case "exportDone":
        pending.delete(msg.jobId);
        job.resolve(msg.outputs as never);
        break;
      case "done":
        pending.delete(msg.jobId);
        job.resolve(undefined as never);
        break;
      case "jobError":
        pending.delete(msg.jobId);
        job.reject(new Error(msg.message));
        break;
    }
  });

  function send<T>(req: WorkerRequest, onProgress?: (done: number, total: number) => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      pending.set(req.jobId, { resolve: resolve as never, reject, onProgress });
      worker.postMessage(req);
    });
  }

  return {
    load: (files) => send({ op: "load", jobId: nextJobId++, files }),
    preview: (order, settings, scale, previewIndex) => {
      const jobId = nextJobId++;
      latestPreviewJob = jobId;
      return send({ op: "preview", jobId, order, settings, scale, previewIndex });
    },
    exportAll: (order, settings, onProgress) =>
      send({ op: "export", jobId: nextJobId++, order, settings }, onProgress),
    remove: (ids) => send({ op: "remove", jobId: nextJobId++, ids }),
    reset: () => send({ op: "resetWorker", jobId: nextJobId++ }),
  };
}

// Main-thread fallback for environments without Worker/OffscreenCanvas
// support: same Bridge surface, same pipeline module, no message hop.
export function createInlineBridge(pipeline: Pipeline = createPipeline()): Bridge {
  let latestPreview = 0;
  return {
    load: (files) => pipeline.load(files),
    preview: async (order, settings, scale, previewIndex) => {
      const ticket = ++latestPreview;
      const result = await pipeline.preview(order, settings, scale, previewIndex);
      if (ticket !== latestPreview) {
        result.bitmap.close();
        return null;
      }
      return result;
    },
    exportAll: (order, settings, onProgress) => pipeline.exportAll(order, settings, onProgress),
    remove: async (ids) => void pipeline.remove(ids),
    reset: async () => void pipeline.reset(),
  };
}
