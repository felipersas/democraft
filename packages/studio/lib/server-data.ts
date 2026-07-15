import { readFile } from "node:fs/promises";
import { readMeta, computeStaleness } from "./staleness";
import path from "node:path";
import type { StudioData } from "./types";
import {
  parseRecordedDemoManifestJson,
  parseRenderTimelineJson,
} from "@democraft/schema";
import { PathBoundaryError, resolveExistingPathWithin } from "./path-boundary";

export const DEFAULT_STUDIO_DATA_DIR = path.resolve(
  process.cwd(),
  "../.democraft/studio-data",
);

export function studioDataDir(): string {
  return process.env.DEMOCRAFT_STUDIO_DATA ?? DEFAULT_STUDIO_DATA_DIR;
}

export async function readJson<T>(
  filePath: string,
  parse: (json: string) => T,
  allowedRoot = path.dirname(filePath),
): Promise<T | undefined> {
  let safePath: string;
  try {
    safePath = await resolveExistingPathWithin(
      allowedRoot,
      filePath,
      "Studio JSON file",
    );
  } catch (error) {
    if (error instanceof PathBoundaryError) return undefined;
    throw error;
  }
  const text = await readFile(safePath, "utf8");
  return parse(text);
}

export async function loadStudioData(): Promise<StudioData | undefined> {
  const dir = studioDataDir();
  // manifest + timeline + meta are independent reads — fetch them concurrently
  // rather than sequentially to avoid paying disk latency twice.
  const [manifest, timeline, meta] = await Promise.all([
    readJson(
      path.join(dir, "manifest.json"),
      parseRecordedDemoManifestJson,
      dir,
    ),
    readJson(path.join(dir, "timeline.json"), parseRenderTimelineJson, dir),
    readMeta(dir),
  ]);
  if (!manifest || !timeline) return undefined;
  // Staleness requires re-compiling demo.ts, which is heavier — compute it
  // only when we have meta pointing at a demo source.
  const staleness = meta
    ? await computeStaleness({ meta, manifest, dataDir: dir })
    : undefined;
  return {
    manifest,
    timeline,
    screenshotBaseUrl: "/data/screenshots",
    dataDir: dir,
    meta,
    staleness,
  };
}
