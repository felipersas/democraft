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
import {
  createRenderArtifact,
  renderDemoVideo,
} from "@democraft/remotion/server";
import { loadStudioData } from "./server-data";
import { publish } from "./event-bus";
import { applyCaptionOverrides } from "./captions";
import { makeId } from "./id";
import { loadScreenshotDataUris } from "./render-assets";
import { findRemotionEntry } from "./remotion-entry";
import { assertRenderArtifactsCompatible } from "./render-identity";
import { runRenderArtifactLifecycle } from "./render-lifecycle";
import {
  createRenderHistoryLoader,
  authorizedRenderArtifactsDirectory,
  mergeRenderJobs,
  renderJobIdentity,
} from "./render-history";
import path from "node:path";
import type { StudioRenderRequest } from "@democraft/schema";
import { trustedWorkspaceRoot } from "./studio-path-authority";

// Render types come from the single source of truth in types/render.ts,
// shared with the client. Re-export for backward compatibility with anything
// importing from this module.
export type {
  CaptionOverrides,
  RenderJob,
  RenderJobOptions,
  RenderJobStatus,
} from "./types/render";
import type { RenderJob } from "./types/render";

export type EnqueueRequest = StudioRenderRequest;

const jobs = new Map<string, RenderJob>();
const jobOrder: string[] = [];
// Clear is intentionally session-scoped: durable artifacts are never deleted,
// and become visible again after the Studio process restarts.
const hiddenHistoricalJobs = new Set<string>();

/** Holds the cancel() handle for the currently rendering job. */
let activeCancel: (() => void) | null = null;
let processing = false;

export const rendersDirectory = async () =>
  authorizedRenderArtifactsDirectory(await trustedWorkspaceRoot());
const loadRenderHistory = createRenderHistoryLoader();

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

/** Refresh terminal history from disk before serving a queue snapshot. */
export async function refreshRenderHistory(directory?: string): Promise<void> {
  const historicalJobs = await loadRenderHistory(
    directory ?? (await rendersDirectory()),
  );
  const mergedJobs = mergeRenderJobs(
    jobs.values(),
    historicalJobs,
    hiddenHistoricalJobs,
  );
  jobs.clear();
  for (const job of mergedJobs) jobs.set(job.id, job);
  jobOrder.splice(0, jobOrder.length, ...mergedJobs.map((job) => job.id));
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
      hiddenHistoricalJobs.add(renderJobIdentity(job));
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
      try {
        await runJob(next);
      } catch (error) {
        next.status = "failed";
        next.error =
          error instanceof Error ? error.message : "Render preparation failed.";
        next.finishedAt = Date.now();
        emit(next);
      }
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

  try {
    assertRenderArtifactsCompatible(data.manifest, data.timeline);
  } catch (error) {
    job.status = "failed";
    job.error =
      error instanceof Error
        ? error.message
        : "Render inputs are incompatible.";
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

  let artifact: Awaited<ReturnType<typeof createRenderArtifact>>;
  try {
    artifact = await createRenderArtifact({
      rootDirectory: await rendersDirectory(),
      demoId: data.timeline.demoId,
      definitionHash:
        data.timeline.definitionHash ?? data.manifest.definitionHash,
      captureHash: data.timeline.captureHash ?? data.manifest.captureHash,
      render: {
        fps: data.timeline.fps,
        durationInFrames: data.timeline.durationInFrames,
        mediaMode: "screenshots",
        width: job.options.width,
        height: job.options.height,
        scale: job.options.scale,
        crf: job.options.crf,
        frameRange: job.options.frameRange,
      },
      source: {
        manifestPath: path.join(data.dataDir, "manifest.json"),
        timelinePath: path.join(data.dataDir, "timeline.json"),
      },
    });
  } catch (error) {
    job.status = "failed";
    job.error =
      error instanceof Error
        ? error.message
        : "Could not create the render artifact.";
    job.finishedAt = Date.now();
    emit(job);
    return;
  }

  job.status = "rendering";
  job.artifactId = artifact.metadata.renderId;
  job.artifactDirectory = artifact.directory;
  job.startedAt = Date.now();
  job.outputPath = artifact.outputFile;
  emit(job);

  publish("render-progress", {
    progress: 0,
    message: "Bundling composition…",
  });

  let cancelled = false;
  const frameRange = job.options.frameRange;
  // Effective frame count drives the "x/y frames" display. When a sub-range
  // is set, show only the frames actually being rendered.
  const totalFrames = frameRange
    ? frameRange[1] - frameRange[0] + 1
    : timeline.durationInFrames;

  try {
    await runRenderArtifactLifecycle({
      artifact,
      isCancelled: () => cancelled,
      prepare: async () => {
        const { cancelSignal, cancel } = makeCancelSignal();
        activeCancel = cancel;
        const cancelGuard: CancelSignal = (cb: () => void) => {
          cancelSignal(() => {
            cancelled = true;
            cb();
          });
        };
        return {
          screenshotSrcByStepId: await loadScreenshotDataUris(
            data.manifest,
            data.dataDir,
          ),
          // Resolve inside the managed lifecycle: a bad custom entry now leaves
          // terminal metadata instead of an orphaned "rendering" artifact.
          entryPath: await findRemotionEntry(
            job.options.entryPath,
            await trustedWorkspaceRoot(),
          ),
          cancelGuard,
        };
      },
      render: async ({ screenshotSrcByStepId, entryPath, cancelGuard }) => {
        await renderDemoVideo({
          manifest: data.manifest,
          mediaMode: "screenshots",
          timeline,
          screenshotSrcByStepId,
          outputFile: artifact.temporaryOutputFile,
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
