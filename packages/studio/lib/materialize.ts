import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
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
  /** Internal hook used to verify rollback before the generation is promoted. */
  beforePromote?: () => Promise<void>;
  /** Internal hook used to verify rollback after the old generation moved. */
  afterBackupRenamed?: () => Promise<void>;
}): Promise<void> {
  const manifest = parseRecordedDemoManifest(args.manifest);
  const timeline = parseRenderTimeline(args.timeline);
  const parent = path.dirname(args.dataDir);
  const generation = path.join(
    parent,
    `.${path.basename(args.dataDir)}.generation-${process.pid}-${Date.now()}`,
  );
  const backup = `${args.dataDir}.previous-${process.pid}-${Date.now()}`;
  const screenshotsSrc = path.join(args.captureDir, "screenshots");
  const screenshotsDst = path.join(generation, "screenshots");
  await mkdir(generation, { recursive: false });
  await mkdir(screenshotsDst, { recursive: true });

  try {
    if (await existsDir(screenshotsSrc)) {
      for (const step of manifest.steps) {
        const src = resolveRecordedScreenshotPath(args.captureDir, step);
        if (src && (await existsFile(src))) {
          await copyFile(src, path.join(screenshotsDst, path.basename(src)));
        }
      }
    }

    const recordingRaw = manifest.recording?.path;
    const recordingSrc = recordingRaw
      ? await resolvePersistedPath(args.captureDir, recordingRaw)
      : undefined;
    const recordingDst = path.join(generation, "recording.webm");
    if (recordingSrc && (await existsFile(recordingSrc))) {
      await copyFile(recordingSrc, recordingDst);
    }

    await Promise.all([
      writeFile(
        path.join(generation, "manifest.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
      ),
      writeFile(
        path.join(generation, "timeline.json"),
        `${JSON.stringify(timeline, null, 2)}\n`,
      ),
      copyMetaIfPresent(args.dataDir, generation),
    ]);
    await args.beforePromote?.();

    await rename(args.dataDir, backup);
    try {
      await args.afterBackupRenamed?.();
      await rename(generation, args.dataDir);
    } catch (error) {
      await rename(backup, args.dataDir);
      throw error;
    }
    await rm(backup, { recursive: true, force: true }).catch(() => undefined);
  } catch (error) {
    await rm(generation, { recursive: true, force: true });
    throw error;
  }
}

async function resolvePersistedPath(captureDir: string, persisted: string) {
  if (path.isAbsolute(persisted)) return persisted;
  const cwdRelative = path.resolve(persisted);
  if (await existsFile(cwdRelative)) return cwdRelative;
  return path.resolve(captureDir, persisted);
}

async function copyMetaIfPresent(dataDir: string, generation: string) {
  try {
    await writeFile(
      path.join(generation, "meta.json"),
      await readFile(path.join(dataDir, "meta.json")),
    );
  } catch {
    // Initial materialization may not have metadata yet.
  }
}

/** Rewrites meta.json with the identity and timestamp of a completed capture. */
export async function updateMetaAfterCapture(
  dataDir: string,
  meta: StudioMeta,
  ir: Pick<DemoIR, "id" | "definitionHash" | "captureHash">,
  captureDir = meta.captureDir,
): Promise<void> {
  const nextMeta = parseStudioMeta({
    ...meta,
    schemaVersion,
    captureDir,
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
