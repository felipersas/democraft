/**
 * In-memory publish/subscribe bus used to push server-side events to the
 * browser over a single SSE stream (see app/api/events/route.ts).
 *
 * Event names are plain strings; the browser subscribes by name. Today the
 * meaningful events are:
 *  - "reload"                 — studio data changed on disk (file-watcher)
 *  - "render-progress"        — legacy single-render progress (kept for the
 *                               non-queued path). Superseded by render-job-update.
 *  - "render-job-update"      — a render-queue job changed status/progress.
 */

export type RenderProgressPayload = {
  /** 0..1 fraction complete. */
  progress: number;
  /** Human-readable phase label, e.g. "Bundling…", "Rendering frames…". */
  message?: string;
  /** Frames written to disk so far (render phase). */
  renderedFrames?: number;
  /** Total frames in the composition (denominator for renderedFrames). */
  totalFrames?: number;
  /** Estimated milliseconds remaining until completion. */
  etaMs?: number;
  /** Remotion stitch stage. */
  stage?: "encoding" | "muxing";
};

type Listener = (event: string, data: unknown) => void;

const listeners = new Set<Listener>();

export function publish(event: string, data: unknown): void {
  for (const l of listeners) l(event, data);
}

/** Legacy single-render progress event (still used by the non-queued path). */
export function publishRenderProgress(payload: RenderProgressPayload): void;
export function publishRenderProgress(
  progress: number,
  message?: string,
): void;
export function publishRenderProgress(
  arg: number | RenderProgressPayload,
  message?: string,
): void {
  const payload: RenderProgressPayload =
    typeof arg === "number" ? { progress: arg, message } : arg;
  publish("render-progress", payload);
}

export function publishReload(): void {
  publish("reload", {});
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
