import { createHash } from "node:crypto";
import { mkdir, opendir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  parseRenderArtifactMetadataJson,
  type RenderArtifactMetadata,
} from "@democraft/schema";
import type { RenderJob } from "./types/render";
import {
  resolveExistingPathWithin,
  resolveWritePathWithin,
} from "./path-boundary";

export function renderArtifactsDirectory(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".democraft", "renders");
}

export async function authorizedRenderArtifactsDirectory(
  workspaceRoot: string,
) {
  const artifactsRoot = await resolveWritePathWithin(
    workspaceRoot,
    path.join(workspaceRoot, ".democraft"),
    "Democraft artifacts root",
  );
  await mkdir(artifactsRoot, { recursive: true });
  return resolveWritePathWithin(
    artifactsRoot,
    path.join(artifactsRoot, "renders"),
    "Render artifacts root",
  );
}

type HistoryDirectoryEntry = { name: string; isDirectory: boolean };
type IterateDirectory = (
  directory: string,
) => AsyncIterable<HistoryDirectoryEntry>;

type ReadRenderHistoryOptions = {
  maxEntries?: number;
  maxArtifactsToScan?: number;
  dependencies?: {
    iterateDirectory?: IterateDirectory;
    readJob?: (directory: string) => Promise<RenderJob | undefined>;
  };
};

/** Rebuild a bounded set of terminal render jobs from durable artifacts. */
export async function readRenderHistory(
  rendersDirectory: string,
  options: ReadRenderHistoryOptions = {},
): Promise<RenderJob[]> {
  const maxEntries = boundedInteger(options.maxEntries, 200);
  const maxArtifactsToScan = boundedInteger(options.maxArtifactsToScan, 1_000);
  const iterateDirectory =
    options.dependencies?.iterateDirectory ?? iterateRealDirectory;
  const readJob = options.dependencies?.readJob ?? readHistoricalJob;
  const artifactDirectories: string[] = [];
  try {
    for await (const demo of iterateDirectory(rendersDirectory)) {
      if (!demo.isDirectory) continue;
      const demoDirectory = path.join(rendersDirectory, demo.name);
      try {
        for await (const artifact of iterateDirectory(demoDirectory)) {
          if (!artifact.isDirectory) continue;
          retainNewestDirectory(
            artifactDirectories,
            path.join(demoDirectory, artifact.name),
            maxArtifactsToScan,
          );
        }
      } catch {
        // A missing or unreadable demo contributes no history.
      }
    }
  } catch {
    // A missing or unreadable root contributes no history.
  }

  // Directory names begin with the render timestamp. Bound metadata reads
  // while preferring recent artifacts, then apply authoritative timestamps.
  artifactDirectories.sort(compareArtifactDirectories);

  const jobs: RenderJob[] = [];
  for (const directory of artifactDirectories.slice(0, maxArtifactsToScan)) {
    const job = await readJob(directory);
    if (job) jobs.push(job);
  }
  return maxEntries === 0 ? [] : jobs.sort(compareJobs).slice(-maxEntries);
}

/** Merge disk history with process-local jobs; live state wins collisions. */
export function mergeRenderJobs(
  existingJobs: Iterable<RenderJob>,
  historicalJobs: Iterable<RenderJob>,
  hiddenHistoricalJobs: ReadonlySet<string>,
): RenderJob[] {
  const merged = new Map<string, RenderJob>();
  for (const job of historicalJobs) {
    const identity = renderJobIdentity(job);
    if (!hiddenHistoricalJobs.has(identity)) merged.set(identity, job);
  }
  for (const job of existingJobs) merged.set(renderJobIdentity(job), job);
  return [...merged.values()].sort(compareJobs);
}

export function renderJobIdentity(job: RenderJob): string {
  return job.artifactDirectory ?? job.artifactId ?? job.id;
}

/** Small TTL cache plus single-flight prevents parallel GET scans. */
export function createRenderHistoryLoader(
  options: { read?: typeof readRenderHistory; ttlMs?: number } = {},
): (rendersDirectory: string) => Promise<RenderJob[]> {
  const read = options.read ?? readRenderHistory;
  const ttlMs = options.ttlMs ?? 1_000;
  let cached:
    | { rendersDirectory: string; expiresAt: number; jobs: RenderJob[] }
    | undefined;
  let inFlight:
    { rendersDirectory: string; promise: Promise<RenderJob[]> } | undefined;

  return async (rendersDirectory) => {
    if (
      cached?.rendersDirectory === rendersDirectory &&
      cached.expiresAt > Date.now()
    ) {
      return cached.jobs;
    }
    if (inFlight?.rendersDirectory === rendersDirectory)
      return inFlight.promise;

    const promise = read(rendersDirectory).then((jobs) => {
      cached = { rendersDirectory, expiresAt: Date.now() + ttlMs, jobs };
      return jobs;
    });
    inFlight = { rendersDirectory, promise };
    try {
      return await promise;
    } finally {
      if (inFlight?.promise === promise) inFlight = undefined;
    }
  };
}

async function readHistoricalJob(
  renderDirectory: string,
): Promise<RenderJob | undefined> {
  try {
    const metadataPath = await resolveExistingPathWithin(
      renderDirectory,
      path.join(renderDirectory, "metadata.json"),
      "Render history metadata",
    );
    const metadataFile = await stat(metadataPath);
    if (!metadataFile.isFile() || metadataFile.size > 128 * 1024)
      return undefined;
    const metadata = parseRenderArtifactMetadataJson(
      await readFile(metadataPath, "utf8"),
    );
    if (metadata.renderId.length > 512) return undefined;
    if (metadata.status === "rendering") return undefined;

    let outputPath = path.join(renderDirectory, metadata.output.video);
    if (metadata.status === "completed") {
      outputPath = await resolveExistingPathWithin(
        renderDirectory,
        outputPath,
        "Render history video",
      );
      const output = await stat(outputPath);
      if (!output.isFile()) return undefined;
    }
    return metadataToJob(metadata, renderDirectory, outputPath);
  } catch {
    return undefined;
  }
}

function metadataToJob(
  metadata: RenderArtifactMetadata,
  artifactDirectory: string,
  outputPath: string,
): RenderJob {
  return {
    id: historicalJobId(metadata.renderId, artifactDirectory),
    artifactId: metadata.renderId,
    artifactDirectory,
    status:
      metadata.status === "completed"
        ? "done"
        : metadata.status === "failed"
          ? "failed"
          : "cancelled",
    progress: metadata.status === "completed" ? 1 : 0,
    options: {
      width: metadata.render.width,
      height: metadata.render.height,
      scale: metadata.render.scale,
      crf: metadata.render.crf,
      frameRange: metadata.render.frameRange,
    },
    outputPath: metadata.status === "completed" ? outputPath : undefined,
    error: metadata.error?.message.slice(0, 2_000),
    createdAt: Date.parse(metadata.createdAt),
    startedAt: Date.parse(metadata.startedAt),
    finishedAt: Date.parse(metadata.finishedAt!),
  };
}

function retainNewestDirectory(
  directories: string[],
  candidate: string,
  limit: number,
): void {
  if (limit === 0) return;
  directories.push(candidate);
  if (directories.length <= limit * 2) return;
  directories.sort(compareArtifactDirectories);
  directories.length = limit;
}

function compareArtifactDirectories(left: string, right: string): number {
  return (
    path.basename(right).localeCompare(path.basename(left)) ||
    right.localeCompare(left)
  );
}

async function* iterateRealDirectory(
  directory: string,
): AsyncIterable<HistoryDirectoryEntry> {
  const handle = await opendir(directory);
  for await (const entry of handle) {
    yield { name: entry.name, isDirectory: entry.isDirectory() };
  }
}

function boundedInteger(value: number | undefined, fallback: number): number {
  return Math.max(0, Math.floor(value ?? fallback));
}

export function compareJobs(left: RenderJob, right: RenderJob): number {
  return left.createdAt - right.createdAt || left.id.localeCompare(right.id);
}

function historicalJobId(renderId: string, directory: string): string {
  const directoryDigest = createHash("sha256")
    .update(directory)
    .digest("hex")
    .slice(0, 12);
  const renderDigest = createHash("sha256")
    .update(renderId)
    .digest("hex")
    .slice(0, 12);
  return `history-${renderDigest}-${directoryDigest}`;
}
