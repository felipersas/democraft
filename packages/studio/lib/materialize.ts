import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  parseRecordedDemoManifest,
  parseRenderTimeline,
  parseStudioMeta,
  schemaVersion,
  type DemoIR,
  type RecordedDemoManifest,
  type RenderTimeline,
  type StudioMeta,
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
  const manifest = parseRecordedDemoManifest(args.manifest);
  const timeline = parseRenderTimeline(args.timeline);
  const screenshotsSrc = path.join(args.captureDir, "screenshots");
  const screenshotsDst = path.join(args.dataDir, "screenshots");
  await rm(screenshotsDst, { recursive: true, force: true });
  await mkdir(screenshotsDst, { recursive: true });

  if (await existsDir(screenshotsSrc)) {
    for (const step of manifest.steps) {
      const name = `${step.sceneId}-${step.stepId}.png`;
      const src = path.join(screenshotsSrc, name);
      if (await existsFile(src)) {
        await copyFile(src, path.join(screenshotsDst, name));
      }
    }
  }

  const recordingRaw = manifest.recording?.path;
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
      `${JSON.stringify(manifest, null, 2)}\n`,
    ),
    writeFile(
      path.join(args.dataDir, "timeline.json"),
      `${JSON.stringify(timeline, null, 2)}\n`,
    ),
  ]);
}

/** Rewrites meta.json with the identity and timestamp of a completed capture. */
export async function updateMetaAfterCapture(
  dataDir: string,
  meta: StudioMeta,
  ir: Pick<DemoIR, "id" | "definitionHash" | "captureHash">,
): Promise<void> {
  const nextMeta = parseStudioMeta({
    ...meta,
    schemaVersion,
    demoId: ir.id,
    definitionHash: ir.definitionHash,
    captureHash: ir.captureHash,
    capturedAt: Date.now(),
  });
  await writeFile(
    path.join(dataDir, "meta.json"),
    `${JSON.stringify(nextMeta, null, 2)}\n`,
  );
}
