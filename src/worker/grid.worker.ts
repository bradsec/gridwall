import { createPipeline } from "./pipeline";
import type { WorkerRequest, WorkerResponse } from "./protocol";

const pipeline = createPipeline();

function post(msg: WorkerResponse, transfer: Transferable[] = []): void {
  (self as unknown as Worker).postMessage(msg, transfer);
}

self.addEventListener("message", (ev: MessageEvent) => {
  const req = ev.data as WorkerRequest;
  void handle(req).catch((e: unknown) => {
    post({ op: "jobError", jobId: req.jobId, message: (e as Error).message });
  });
});

async function handle(req: WorkerRequest): Promise<void> {
  switch (req.op) {
    case "load": {
      const results = await pipeline.load(req.files);
      post({ op: "loaded", jobId: req.jobId, results });
      break;
    }
    case "preview": {
      const r = await pipeline.preview(req.order, req.settings, req.scale, req.previewIndex);
      post(
        { op: "previewDone", jobId: req.jobId, bitmap: r.bitmap, pageCount: r.pageCount, trueWidth: r.trueWidth, trueHeight: r.trueHeight },
        [r.bitmap],
      );
      break;
    }
    case "export": {
      const outputs = await pipeline.exportAll(req.order, req.settings, (done, total) =>
        post({ op: "exportProgress", jobId: req.jobId, done, total }),
      );
      post({ op: "exportDone", jobId: req.jobId, outputs });
      break;
    }
    case "remove":
      pipeline.remove(req.ids);
      post({ op: "done", jobId: req.jobId });
      break;
    case "resetWorker":
      pipeline.reset();
      post({ op: "done", jobId: req.jobId });
      break;
  }
}
