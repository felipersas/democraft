/**
 * In-memory render queue. Serializes renders (one at a time) so the studio
 * can enqueue several jobs without blocking, and surfaces per-job status +
 * live progress to the browser via the event bus.
 *
 * Not persisted: jobs live only for the lifetime of the server process. This
 * matches the studio's local-dev-tool scope (see docs/architecture/studio-roadmap.md,
 * "Render queue" — Phase 2 item).
 */

import { makeCancelSignal, type CancelSignal } from "@remotion/renderer";
import { renderDemoVideo } from "@democraft/remotion/server";
import { loadStudioData } from "./server-data";
import { publish } from "./event-bus";
import { applyCaptionOverrides } from "./captions";
import { makeId } from "./id";
import { loadScreenshotDataUris } from "./render-assets";
import { findRemotionEntry } from "./remotion-entry";
import path from "node:path";
import { mkdir } from "node:fs/promises";

// Render types come from the single source of truth in types/render.ts,
// shared with the client. Re-export for backward compatibility with anything
// importing from this module.
export type {
  CaptionOverrides,
  RenderJob,
  RenderJobOptions,
  RenderJobStatus,
} from "./types/render";
import type {
  CaptionOverrides,
  RenderJob,
  RenderJobOptions,
} from "./types/render";

export type EnqueueRequest = RenderJobOptions & {
  captionOverrides?: CaptionOverrides;
};

const jobs = new Map<string, RenderJob>();
const jobOrder: string[] = [];

/** Holds the cancel() handle for the currently rendering job. */
let activeCancel: (() => void) | null = null;
let processing = false;

const RENDERS_DIR = () => path.resolve(process.cwd(), "../.democraft/renders");

function emit(job: RenderJob): void {
  publish("render-job-update", serializeJob(job));
}

/** Jobs cross the SSE boundary as plain objects; strip nothing sensitive. */
export function serializeJob(job: RenderJob): RenderJob {
  return { ...job, progressDetail: { ...job.progressDetail } };
}

export function listJobs(): RenderJob[] {
  return jobOrder.map((id) => jobs.get(id)!).filter(Boolean);
}

export function getJob(id: string): RenderJob | undefined {
  return jobs.get(id);
}

export function clearFinished(): void {
  for (const id of [...jobOrder]) {
    const job = jobs.get(id);
    if (!job) continue;
    if (
      job.status === "done" ||
      job.status === "failed" ||
      job.status === "cancelled"
    ) {
      jobs.delete(id);
      const i = jobOrder.indexOf(id);
      if (i >= 0) jobOrder.splice(i, 1);
    }
  }
  publish("render-jobs-cleared", {});
}

export function enqueue(request: EnqueueRequest): RenderJob {
  const job: RenderJob = {
    id: makeId("job"),
    status: "pending",
    progress: 0,
    options: {
      width: request.width,
      height: request.height,
      scale: request.scale,
      crf: request.crf,
      frameRange: request.frameRange,
      entryPath: request.entryPath,
    },
    captionOverrides: request.captionOverrides,
    createdAt: Date.now(),
  };
  jobs.set(job.id, job);
  jobOrder.push(job.id);
  emit(job);
  void processQueue();
  return job;
}

/** Cancels a job. Pending jobs are dropped; the active job is signalled. */
export function cancelJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job) return false;
  if (job.status === "rendering") {
    if (activeCancel) {
      activeCancel();
      // The render promise rejects → the runner flips status to "cancelled".
      return true;
    }
    return false;
  }
  if (job.status === "pending") {
    job.status = "cancelled";
    job.finishedAt = Date.now();
    emit(job);
    return true;
  }
  return false;
}

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    while (true) {
      const next = jobOrder
        .map((id) => jobs.get(id)!)
        .find((j) => j && j.status === "pending");
      if (!next) break;
      await runJob(next);
    }
  } finally {
    processing = false;
  }
}

async function runJob(job: RenderJob): Promise<void> {
  const data = await loadStudioData();
  if (!data) {
    job.status = "failed";
    job.error = "Studio data not loaded. Capture a demo first.";
    job.finishedAt = Date.now();
    emit(job);
    return;
  }

  // Build a derived timeline with caption overrides applied (hybrid render path).
  const captionOverrides = job.captionOverrides;
  const timeline =
    captionOverrides && Object.keys(captionOverrides).length > 0
      ? {
          ...data.timeline,
          overlays: applyCaptionOverrides(
            data.timeline.overlays,
            captionOverrides,
          ),
        }
      : data.timeline;

  const screenshotSrcByStepId = await loadScreenshotDataUris(
    data.manifest,
    data.dataDir,
  );

  const outputDir = RENDERS_DIR();
  await mkdir(outputDir, { recursive: true });
  const outputFile = path.join(
    outputDir,
    `${data.timeline.demoId}-${Date.now()}.mp4`,
  );

  const { cancelSignal, cancel } = makeCancelSignal();
  activeCancel = cancel;

  // The entry.js path is resolved by the route layer historically; resolve it
  // here too so the queue is self-contained. Pass the job's entryPath override
  // (from --entry or the enqueue request) to support custom visual registries.
  const entryPath = findRemotionEntry(job.options.entryPath);

  job.status = "rendering";
  job.startedAt = Date.now();
  job.outputPath = outputFile;
  emit(job);

  publish("render-progress", {
    progress: 0,
    message: "Bundling composition…",
  });

  let cancelled = false;
  const cancelGuard: CancelSignal = (cb: () => void) => {
    // Track whether cancel fired so we can classify the rejection without
    // relying on @remotion/renderer's private isUserCancelledRender export.
    const wrap = () => {
      cancelled = true;
      cb();
    };
    cancelSignal(wrap);
  };

  const frameRange = job.options.frameRange;
  // Effective frame count drives the "x/y frames" display. When a sub-range
  // is set, show only the frames actually being rendered.
  const totalFrames = frameRange
    ? frameRange[1] - frameRange[0] + 1
    : timeline.durationInFrames;

  try {
    await renderDemoVideo({
      manifest: data.manifest,
      mediaMode: "screenshots",
      timeline,
      screenshotSrcByStepId,
      outputFile,
      entryPath,
      width: job.options.width,
      height: job.options.height,
      scale: job.options.scale,
      crf: job.options.crf,
      cancelSignal: cancelGuard,
      frameRange,
      onProgress: (p) => {
        job.progress = p.progress;
        job.progressDetail = {
          renderedFrames: p.renderedFrames,
          totalFrames,
          etaMs: Math.max(0, p.renderEstimatedTime - Date.now()),
          stage: p.stitchStage,
        };
        emit(job);
      },
    });
    job.status = "done";
    job.progress = 1;
    job.finishedAt = Date.now();
    emit(job);
    publish("render-progress", { progress: 1, message: "Done" });
  } catch (err) {
    if (cancelled) {
      job.status = "cancelled";
    } else {
      job.status = "failed";
      job.error = err instanceof Error ? err.message : "Render failed.";
    }
    job.finishedAt = Date.now();
    emit(job);
  } finally {
    activeCancel = null;
  }
}
