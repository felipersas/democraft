/**
 * Render-related types. The single source of truth, shared by both the
 * server-side queue (lib/render-queue.ts) and the client (lib/types.ts →
 * context → components). Previously these were duplicated across the two
 * modules and had drifted in comments.
 */

export type RenderJobStatus =
  | "pending"
  | "rendering"
  | "done"
  | "failed"
  | "cancelled";

export type RenderJobOptions = {
  width?: number;
  height?: number;
  scale?: number;
  crf?: number;
  /** Sub-range [startFrame, endFrame] (inclusive). Omit to render all frames. */
  frameRange?: [number, number];
  /**
   * Optional Remotion entry point override. When set, the render uses this
   * file instead of the built-in `@democraft/remotion/dist/entry.js`. Lets
   * users register custom visual components from their own entry file.
   */
  entryPath?: string;
};

/** Caption text overrides keyed by overlay id. */
export type CaptionOverrides = Record<string, string>;

/** A render-queue job. Mirrored across the SSE boundary (server → client). */
export type RenderJob = {
  id: string;
  status: RenderJobStatus;
  /** 0..1. Only meaningful while rendering (and the final 1 on done). */
  progress: number;
  options: RenderJobOptions;
  /**
   * Caption text overrides captured at enqueue time, so each job renders the
   * copy that was live when it was queued.
   */
  captionOverrides?: CaptionOverrides;
  outputPath?: string;
  error?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  progressDetail?: {
    renderedFrames?: number;
    totalFrames?: number;
    etaMs?: number;
    stage?: "encoding" | "muxing";
  };
};
