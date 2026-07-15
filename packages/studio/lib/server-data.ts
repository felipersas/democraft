import { readFile } from "node:fs/promises";
import { existsFile } from "./fs";
import { readMeta, computeStaleness } from "./staleness";
import path from "node:path";
import type { StudioData } from "./types";

export const DEFAULT_STUDIO_DATA_DIR = path.resolve(
  process.cwd(),
  "../.democraft/studio-data",
);

export function studioDataDir(): string {
  return process.env.DEMOCRAFT_STUDIO_DATA ?? DEFAULT_STUDIO_DATA_DIR;
}

export async function readJson<T>(filePath: string): Promise<T | undefined> {
  if (!(await existsFile(filePath))) return undefined;
  const text = await readFile(filePath, "utf8");
  return JSON.parse(text) as T;
}

export async function loadStudioData(): Promise<StudioData | undefined> {
  const dir = studioDataDir();
  // manifest + timeline + meta are independent reads — fetch them concurrently
  // rather than sequentially to avoid paying disk latency twice.
  const [manifest, timeline, meta] = await Promise.all([
    readJson<StudioData["manifest"]>(path.join(dir, "manifest.json")),
    readJson<StudioData["timeline"]>(path.join(dir, "timeline.json")),
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
