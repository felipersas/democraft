import { mkdir, readFile, rename, rm } from "node:fs/promises";
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
import { resolveRecordedScreenshotPath } from "@democraft/playwright";
import {
  resolveExistingPathWithin,
  resolveWritePathWithin,
} from "./path-boundary";
import {
  copyFileContainedAtomic,
  writeFileContainedAtomic,
} from "./safe-write";

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
  /** When supplied, metadata is promoted in the same generation. */
  meta?: StudioMeta;
  /** Internal hook used to verify rollback before the generation is promoted. */
  beforePromote?: () => Promise<void>;
  /** Internal hook used to verify rollback after the old generation moved. */
  afterBackupRenamed?: () => Promise<void>;
}): Promise<void> {
  const manifest = parseRecordedDemoManifest(args.manifest);
  const timeline = parseRenderTimeline(args.timeline);
  const dataDir = await resolveExistingPathWithin(
    args.dataDir,
    args.dataDir,
    "Studio data directory",
  );
  const parent = path.dirname(dataDir);
  const generation = await resolveWritePathWithin(
    parent,
    path.join(
      parent,
      `.${path.basename(dataDir)}.generation-${process.pid}-${Date.now()}`,
    ),
    "Studio generation directory",
  );
  const backup = await resolveWritePathWithin(
    parent,
    `${dataDir}.previous-${process.pid}-${Date.now()}`,
    "Studio backup directory",
  );
  const screenshotsSrc = path.join(args.captureDir, "screenshots");
  const screenshotsDst = path.join(generation, "screenshots");
  await mkdir(generation, { recursive: false });
  await mkdir(screenshotsDst, { recursive: true });

  try {
    if (await existsDir(screenshotsSrc)) {
      for (const step of manifest.steps) {
        const src = resolveRecordedScreenshotPath(args.captureDir, step);
        if (src && (await existsFile(src))) {
          const safeSrc = await resolveExistingPathWithin(
            args.captureDir,
            src,
            `Screenshot for step ${step.stepId}`,
          );
          await copyFileContainedAtomic(
            generation,
            safeSrc,
            path.join(screenshotsDst, path.basename(src)),
            `Materialized screenshot for step ${step.stepId}`,
          );
        }
      }
    }

    const recordingRaw = manifest.recording?.path;
    const recordingSrc = recordingRaw
      ? await resolvePersistedPath(args.captureDir, recordingRaw)
      : undefined;
    const recordingDst = path.join(generation, "recording.webm");
    if (recordingSrc && (await existsFile(recordingSrc))) {
      await copyFileContainedAtomic(
        generation,
        recordingSrc,
        recordingDst,
        "Materialized recording",
      );
    }

    await Promise.all([
      writeFileContainedAtomic(
        generation,
        path.join(generation, "manifest.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
        "Materialized manifest",
      ),
      writeFileContainedAtomic(
        generation,
        path.join(generation, "timeline.json"),
        `${JSON.stringify(timeline, null, 2)}\n`,
        "Materialized timeline",
      ),
      args.meta
        ? writeFileContainedAtomic(
            generation,
            path.join(generation, "meta.json"),
            `${JSON.stringify(parseStudioMeta(args.meta), null, 2)}\n`,
            "Materialized metadata",
          )
        : copyMetaIfPresent(dataDir, generation),
    ]);
    await args.beforePromote?.();

    await rename(dataDir, backup);
    try {
      await args.afterBackupRenamed?.();
      await rename(generation, dataDir);
    } catch (error) {
      await rename(backup, dataDir);
      throw error;
    }
    await rm(backup, { recursive: true, force: true }).catch(() => undefined);
  } catch (error) {
    await rm(generation, { recursive: true, force: true });
    throw error;
  }
}

async function resolvePersistedPath(captureDir: string, persisted: string) {
  const captureRelative = path.isAbsolute(persisted)
    ? persisted
    : path.resolve(captureDir, persisted);
  if (await existsFile(captureRelative)) {
    return resolveExistingPathWithin(
      captureDir,
      captureRelative,
      "Capture recording",
    );
  }

  // Older manifests sometimes stored a cwd-relative path. Keep supporting it
  // when it still resolves to the same authorized capture tree.
  const legacyCwdRelative = path.resolve(persisted);
  if (await existsFile(legacyCwdRelative)) {
    return resolveExistingPathWithin(
      captureDir,
      legacyCwdRelative,
      "Legacy capture recording",
    );
  }
  return undefined;
}

async function copyMetaIfPresent(dataDir: string, generation: string) {
  const metaPath = path.join(dataDir, "meta.json");
  if (!(await existsFile(metaPath))) return;
  const safeMetaPath = await resolveExistingPathWithin(
    dataDir,
    metaPath,
    "Studio metadata",
  );
  await writeFileContainedAtomic(
    generation,
    path.join(generation, "meta.json"),
    await readFile(safeMetaPath),
    "Materialized metadata",
  );
}

/** Rewrites meta.json with the identity and timestamp of a completed capture. */
export async function updateMetaAfterCapture(
  dataDir: string,
  meta: StudioMeta,
  ir: Pick<DemoIR, "id" | "definitionHash" | "captureHash">,
  captureDir = meta.captureDir,
): Promise<void> {
  const nextMeta = buildMetaAfterCapture(meta, ir, captureDir);
  await writeFileContainedAtomic(
    dataDir,
    path.join(dataDir, "meta.json"),
    `${JSON.stringify(nextMeta, null, 2)}\n`,
    "Studio metadata",
  );
}

export function buildMetaAfterCapture(
  meta: StudioMeta,
  ir: Pick<DemoIR, "id" | "definitionHash" | "captureHash">,
  captureDir = meta.captureDir,
): StudioMeta {
  return parseStudioMeta({
    ...meta,
    schemaVersion,
    captureDir,
    demoId: ir.id,
    definitionHash: ir.definitionHash,
    captureHash: ir.captureHash,
    capturedAt: Date.now(),
  });
}
