import type { Settings } from "../core/types";

export interface OrderEntry { id: string; name: string; rotation: number }

export type WorkerRequest =
  | { op: "load"; jobId: number; files: { id: string; name: string; blob: Blob }[] }
  | { op: "preview"; jobId: number; order: OrderEntry[]; settings: Settings; scale: number; previewIndex: number }
  | { op: "export"; jobId: number; order: OrderEntry[]; settings: Settings }
  | { op: "remove"; jobId: number; ids: string[] }
  | { op: "resetWorker"; jobId: number };

export interface LoadResult { id: string; ok: boolean; width: number; height: number }

export type WorkerResponse =
  | { op: "loaded"; jobId: number; results: LoadResult[] }
  | { op: "previewDone"; jobId: number; bitmap: ImageBitmap; pageCount: number; trueWidth: number; trueHeight: number }
  | { op: "exportProgress"; jobId: number; done: number; total: number }
  | { op: "exportDone"; jobId: number; outputs: { blob: Blob; name: string }[] }
  | { op: "done"; jobId: number }
  | { op: "jobError"; jobId: number; message: string };
