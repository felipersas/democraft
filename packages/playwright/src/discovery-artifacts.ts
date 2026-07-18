/**
 * Discovery run lifecycle — the persistence layer for a single discovery run.
 *
 * Mirrors the proven capture run lifecycle in `./capture-artifacts.ts`:
 *   created → running → (completed | failed | cancelled)
 * with atomic writes, a `latest.json` pointer that only ever references a
 * completed run, and redaction of error messages. Reuses `writeFileAtomic`
 * and `redactCaptureErrorMessage` from `./capture-artifacts.ts` so the two
 * artifact families stay consistent and share their safety properties.
 *
 * On-disk layout (plan §5.10):
 *   .democraft/discovery/<application-id>/
 *     latest.json                                  ← LatestDiscoveryPointer
 *     runs/<discovery-run-id>/metadata.json        ← DiscoveryRunMetadata
 *     runs/<discovery-run-id>/application-map.json ← PageDiscovery
 *     runs/<discovery-run-id>/pages/
 *     runs/<discovery-run-id>/screenshots/
 */
import {
  access,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
} from "node:fs/promises";
import type { Dirent } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import {
  parseDiscoveryRunMetadata,
  parseDiscoveryRunMetadataJson,
  parseLatestDiscoveryPointerJson,
  type DiscoveryEnvironment,
  type DiscoveryRunMetadata,
  type LatestDiscoveryPointer,
} from "@democraft/schema";
import {
  redactCaptureErrorMessage,
  writeFileAtomic,
} from "./capture-artifacts";

const MAX_CREATE_ATTEMPTS = 16;

export type DiscoveryArtifact = {
  discoveryRunId: string;
  applicationId: string;
  origin: string;
  /** Absolute directory of this run. */
  directory: string;
  /** Absolute directory of the application namespace (holds latest.json). */
  applicationDirectory: string;
  metadataPath: string;
  applicationMapPath: string;
  pagesPath: string;
  screenshotsPath: string;
  metadata: DiscoveryRunMetadata;
  /** True when DemoCraft allocated the run under the managed discovery root. */
  managed: boolean;
};

export type CreateDiscoveryArtifactOptions = {
  rootDirectory: string;
  /** Origin URL — the basis for the application id. */
  origin: string;
  environment: DiscoveryEnvironment;
  hashes?: {
    environmentHash?: string;
    contentHash?: string;
  };
  /** Override the auto-allocated run directory (mirrors capture's outputDir). */
  outputDirectory?: string;
};

type ArtifactDependencies = {
  now?: () => Date;
  randomId?: () => string;
};

export async function createDiscoveryArtifact(
  options: CreateDiscoveryArtifactOptions,
  dependencies: ArtifactDependencies = {},
): Promise<DiscoveryArtifact> {
  const now = dependencies.now ?? (() => new Date());
  const randomId =
    dependencies.randomId ?? (() => randomBytes(6).toString("hex"));
  const applicationId = discoveryApplicationId(options.origin);
  const applicationDirectory = path.join(options.rootDirectory, applicationId);
  const runsDirectory = path.join(applicationDirectory, "runs");

  const createdAt = now().toISOString();
  const timestamp = createdAt.replace(/[:.]/g, "-");

  let directory: string | undefined;
  let discoveryRunId = "";
  if (options.outputDirectory) {
    directory = options.outputDirectory;
    discoveryRunId = `${applicationId}-${timestamp}-${randomId()}`;
    await mkdir(directory, { recursive: true });
    await rm(path.join(directory, "application-map.json"), {
      force: true,
    });
  } else {
    await mkdir(runsDirectory, { recursive: true });
    for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
      const suffix = `${timestamp}-${randomId()}`;
      const candidate = path.join(runsDirectory, suffix);
      try {
        await mkdir(candidate, { recursive: false });
        directory = candidate;
        discoveryRunId = `${applicationId}-${suffix}`;
        break;
      } catch (error) {
        if (!isNodeError(error, "EEXIST")) throw error;
      }
    }
  }

  if (!directory) {
    throw new Error(
      `Could not allocate a unique discovery directory after ${MAX_CREATE_ATTEMPTS} attempts.`,
    );
  }

  const metadata = buildInitialMetadata(
    {
      discoveryRunId,
      applicationId,
      origin: options.origin,
      environment: options.environment,
      hashes: options.hashes ?? {},
    },
    createdAt,
  );
  const artifact: DiscoveryArtifact = {
    discoveryRunId,
    applicationId,
    origin: options.origin,
    directory,
    applicationDirectory,
    metadataPath: path.join(directory, "metadata.json"),
    applicationMapPath: path.join(directory, "application-map.json"),
    pagesPath: path.join(directory, "pages"),
    screenshotsPath: path.join(directory, "screenshots"),
    metadata,
    managed: options.outputDirectory === undefined,
  };
  await mkdir(artifact.pagesPath, { recursive: true });
  await mkdir(artifact.screenshotsPath, { recursive: true });
  await writeDiscoveryMetadata(artifact, metadata);
  return artifact;
}

export async function startDiscoveryArtifact(
  artifact: DiscoveryArtifact,
  now = new Date(),
): Promise<void> {
  assertMutable(artifact);
  const timestamp = now.toISOString();
  await writeDiscoveryMetadata(artifact, {
    ...artifact.metadata,
    status: "running",
    startedAt: timestamp,
    updatedAt: timestamp,
  });
}

export async function completeDiscoveryArtifact(
  artifact: DiscoveryArtifact,
  options: { now?: Date; contentHash?: string } = {},
): Promise<void> {
  assertMutable(artifact);
  await access(artifact.applicationMapPath);
  const timestamp = (options.now ?? new Date()).toISOString();
  await writeDiscoveryMetadata(artifact, {
    ...artifact.metadata,
    status: "completed",
    updatedAt: timestamp,
    finishedAt: timestamp,
    hashes: {
      ...artifact.metadata.hashes,
      contentHash: options.contentHash ?? artifact.metadata.hashes.contentHash,
    },
  });
  if (artifact.managed) {
    // The pointer is a rebuildable index; a completed discovery is still valid if
    // updating it fails (mirrors capture's tolerance).
    await updateLatestDiscoveryPointer(artifact, timestamp).catch(
      () => undefined,
    );
  }
}

export async function failDiscoveryArtifact(
  artifact: DiscoveryArtifact,
  error: unknown,
  now = new Date(),
): Promise<void> {
  assertMutable(artifact);
  const timestamp = now.toISOString();
  await writeDiscoveryMetadata(artifact, {
    ...artifact.metadata,
    status: "failed",
    startedAt: artifact.metadata.startedAt ?? timestamp,
    updatedAt: timestamp,
    finishedAt: timestamp,
    error: {
      message: redactCaptureErrorMessage(error, artifact.directory),
    },
  });
}

export async function cancelDiscoveryArtifact(
  artifact: DiscoveryArtifact,
  now = new Date(),
): Promise<void> {
  assertMutable(artifact);
  const timestamp = now.toISOString();
  await writeDiscoveryMetadata(artifact, {
    ...artifact.metadata,
    status: "cancelled",
    startedAt: artifact.metadata.startedAt ?? timestamp,
    updatedAt: timestamp,
    finishedAt: timestamp,
  });
}

export async function writeDiscoveryArtifactAtomic(
  artifact: DiscoveryArtifact,
  json: string,
): Promise<void> {
  await writeFileAtomic(artifact.applicationMapPath, json);
}

/**
 * Resolve the latest completed discovery run directory for an application, if
 * any. Self-heals a missing/stale pointer by scanning completed runs (mirrors
 * capture's `resolveLatestCompletedCapture`).
 */
export async function resolveLatestCompletedDiscovery(
  rootDirectory: string,
  origin: string,
): Promise<
  | {
      discoveryDirectory: string;
      applicationMapPath: string;
      discoveryRunId?: string;
    }
  | undefined
> {
  const applicationId = discoveryApplicationId(origin);
  const applicationDirectory = path.join(rootDirectory, applicationId);
  const runsDirectory = path.join(applicationDirectory, "runs");

  // 1. Trust the pointer when it points at a still-valid completed run.
  try {
    const pointer = parseLatestDiscoveryPointerJson(
      await readFile(path.join(applicationDirectory, "latest.json"), "utf8"),
    );
    const candidate = path.join(runsDirectory, pointer.discoveryDirectory);
    if (await isCompletedRun(candidate)) {
      return {
        discoveryDirectory: pointer.discoveryDirectory,
        applicationMapPath: path.join(candidate, "application-map.json"),
        discoveryRunId: pointer.discoveryRunId,
      };
    }
  } catch {
    // Fall through to scan.
  }

  // 2. Scan completed runs and pick the newest by finishedAt.
  let canonicalRuns: string;
  try {
    canonicalRuns = await realpath(runsDirectory);
  } catch {
    return undefined;
  }
  let entries: Dirent[];
  try {
    entries = await readdir(canonicalRuns, { withFileTypes: true });
  } catch {
    return undefined;
  }
  const candidates: { directory: string; metadata: DiscoveryRunMetadata }[] =
    [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(runsDirectory, entry.name);
    try {
      const metadata = parseDiscoveryRunMetadataJson(
        await readFile(path.join(dir, "metadata.json"), "utf8"),
      );
      if (metadata.status === "completed") {
        candidates.push({ directory: dir, metadata });
      }
    } catch {
      // Skip malformed runs.
    }
  }
  if (candidates.length === 0) return undefined;
  candidates.sort(
    (a, b) =>
      (b.metadata.finishedAt ?? "").localeCompare(
        a.metadata.finishedAt ?? "",
      ) || b.metadata.discoveryRunId.localeCompare(a.metadata.discoveryRunId),
  );
  const newest = candidates[0]!;
  const dirName = path.basename(newest.directory);
  await updateLatestDiscoveryPointer(
    {
      applicationDirectory,
      discoveryRunId: newest.metadata.discoveryRunId,
      applicationId,
      directory: newest.directory,
      managed: true,
    } as DiscoveryArtifact,
    newest.metadata.finishedAt ?? newest.metadata.updatedAt,
  ).catch(() => undefined);
  return {
    discoveryDirectory: dirName,
    applicationMapPath: path.join(newest.directory, "application-map.json"),
    discoveryRunId: newest.metadata.discoveryRunId,
  };
}

async function isCompletedRun(directory: string): Promise<boolean> {
  try {
    const metadata = parseDiscoveryRunMetadataJson(
      await readFile(path.join(directory, "metadata.json"), "utf8"),
    );
    return metadata.status === "completed";
  } catch {
    return false;
  }
}

export class DiscoveryAbortError extends Error {
  constructor() {
    super("Discovery was cancelled.");
    this.name = "AbortError";
  }
}

export function isDiscoveryAbort(
  error: unknown,
  signal?: AbortSignal,
): boolean {
  return Boolean(signal?.aborted) || error instanceof DiscoveryAbortError;
}

/**
 * Stable application id derived from an origin (mirrors `captureNamespace`).
 * The id is **origin-based**: callers pass a normalized origin
 * (`normalizeDiscoveryOrigin`, e.g. `http://localhost:3000`), and any stray
 * path/query/fragment is dropped defensively so two pages of the same app
 * share a namespace.
 */
export function discoveryApplicationId(origin: string): string {
  // Reduce to the origin (scheme://host[:port]) using URL parsing; fall back
  // to the raw string for non-URL inputs so hashing stays stable.
  let originForSlug = origin;
  let originForHash = origin;
  try {
    const parsed = new URL(origin);
    originForSlug = parsed.host;
    originForHash = parsed.origin;
  } catch {
    // Keep the raw string; tests pass normalized origins so this is rare.
  }
  const slug = originForSlug
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const digest = createHash("sha256")
    .update(originForHash)
    .digest("hex")
    .slice(0, 12);
  return `${slug || "app"}-${digest}`;
}

/** Environment fingerprint hash for cache reuse decisions. */
export function discoveryEnvironmentHash(
  environment: DiscoveryEnvironment,
): string {
  const payload = JSON.stringify({
    v: 1,
    viewport: environment.viewport,
    deviceScaleFactor: environment.deviceScaleFactor,
    locale: environment.locale,
    timezone: environment.timezone,
  });
  return `discovery-env-v1:sha256:${createHash("sha256")
    .update(payload)
    .digest("hex")}`;
}

/** Content fingerprint hash (over the serialized PageDiscovery). */
export function discoveryContentHash(pageDiscoveryJson: string): string {
  return `discovery-content-v1:sha256:${createHash("sha256")
    .update(pageDiscoveryJson)
    .digest("hex")}`;
}

async function writeDiscoveryMetadata(
  artifact: DiscoveryArtifact,
  metadata: DiscoveryRunMetadata,
): Promise<void> {
  const validated = parseDiscoveryRunMetadata(metadata);
  await writeFileAtomic(
    artifact.metadataPath,
    `${JSON.stringify(validated, null, 2)}\n`,
  );
  artifact.metadata = validated;
}

async function updateLatestDiscoveryPointer(
  artifact: DiscoveryArtifact,
  completedAt: string,
): Promise<void> {
  const pointer: LatestDiscoveryPointer = {
    schemaVersion: 1,
    applicationId: artifact.applicationId,
    discoveryRunId: artifact.discoveryRunId,
    discoveryDirectory: path.basename(artifact.directory),
    completedAt,
  };
  await writeFileAtomic(
    path.join(artifact.applicationDirectory, "latest.json"),
    `${JSON.stringify(pointer, null, 2)}\n`,
  );
}

function buildInitialMetadata(
  args: {
    discoveryRunId: string;
    applicationId: string;
    origin: string;
    environment: DiscoveryEnvironment;
    hashes: { environmentHash?: string; contentHash?: string };
  },
  createdAt: string,
): DiscoveryRunMetadata {
  return parseDiscoveryRunMetadata({
    schemaVersion: 1,
    discoveryRunId: args.discoveryRunId,
    applicationId: args.applicationId,
    origin: args.origin,
    status: "created",
    createdAt,
    updatedAt: createdAt,
    paths: {
      applicationMap: "application-map.json",
      pages: "pages",
      screenshots: "screenshots",
    },
    environment: args.environment,
    hashes: args.hashes,
  });
}

function assertMutable(artifact: DiscoveryArtifact): void {
  if (["completed", "failed", "cancelled"].includes(artifact.metadata.status)) {
    throw new Error(
      `Discovery ${artifact.discoveryRunId} is already ${artifact.metadata.status}.`,
    );
  }
}

function isNodeError(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}
