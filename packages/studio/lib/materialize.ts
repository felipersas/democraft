import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  RecordedDemoManifest,
  RenderTimeline,
  StudioMeta,
} from "@democraft/schema";
import { existsFile, existsDir } from "./fs";

/**
 * Copies capture artifacts (screenshots, recording) into studio-data and
 * writes manifest.json + timeline.json. Mirrors the CLI's
 * materializeStudioData so in-studio re-capture produces the same on-disk
 * layout. See packages/cli/src/studio.ts for the canonical implementation.
 */
export async function materializeStudioData(args: {
  dataDir: string;
  captureDir: string;
  manifest: RecordedDemoManifest;
  timeline: RenderTimeline;
}): Promise<void> {
  const screenshotsSrc = path.join(args.captureDir, "screenshots");
  const screenshotsDst = path.join(args.dataDir, "screenshots");
  await rm(screenshotsDst, { recursive: true, force: true });
  await mkdir(screenshotsDst, { recursive: true });

  if (await existsDir(screenshotsSrc)) {
    for (const step of args.manifest.steps) {
      const name = `${step.sceneId}-${step.stepId}.png`;
      const src = path.join(screenshotsSrc, name);
      if (await existsFile(src)) {
        await copyFile(src, path.join(screenshotsDst, name));
      }
    }
  }

  const recordingRaw = args.manifest.recording?.path;
  const recordingSrc = recordingRaw
    ? path.isAbsolute(recordingRaw)
      ? recordingRaw
      : path.resolve(args.captureDir, recordingRaw)
    : undefined;
  const recordingDst = path.join(args.dataDir, "recording.webm");
  if (recordingSrc && (await existsFile(recordingSrc))) {
    await copyFile(recordingSrc, recordingDst);
  }

  await Promise.all([
    writeFile(
      path.join(args.dataDir, "manifest.json"),
      `${JSON.stringify(args.manifest, null, 2)}\n`,
    ),
    writeFile(
      path.join(args.dataDir, "timeline.json"),
      `${JSON.stringify(args.timeline, null, 2)}\n`,
    ),
  ]);
}

/** Rewrites meta.json with an updated capturedAt timestamp. */
export async function updateMetaCapturedAt(
  dataDir: string,
  meta: StudioMeta,
): Promise<void> {
  await writeFile(
    path.join(dataDir, "meta.json"),
    `${JSON.stringify({ ...meta, capturedAt: Date.now() }, null, 2)}\n`,
  );
}
