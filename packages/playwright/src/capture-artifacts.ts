import { createHash, randomBytes } from "node:crypto";
import {
  access,
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import {
  parseCaptureArtifactMetadata,
  parseCaptureArtifactMetadataJson,
  parseLatestCapturePointer,
  parseLatestCapturePointerJson,
  parseRecordedDemoManifestJson,
  type CaptureArtifactMetadata,
  type LatestCapturePointer,
} from "@democraft/schema";

const MAX_CREATE_ATTEMPTS = 16;
const LATEST_LOCK_ATTEMPTS = 200;
const LOCK_LEASE_MS = 30_000;
const LOCK_RETRY_MS = 10;

export type CaptureArtifact = {
  captureRunId: string;
  demoId: string;
  directory: string;
  metadataPath: string;
  manifestPath: string;
  screenshotsPath: string;
  tracePath: string;
  metadata: CaptureArtifactMetadata;
  managed: boolean;
  demoDirectory?: string;
  releaseLock?: () => Promise<void>;
};

export type CaptureEnvironmentMetadata = CaptureArtifactMetadata["environment"];

export type CreateCaptureArtifactOptions = {
  rootDirectory: string;
  outputDirectory?: string;
  demoId: string;
  definitionHash?: string;
  captureHash?: string;
  captureEnvironmentHash?: string;
  environment: CaptureEnvironmentMetadata;
  /** Internal/test tuning; production defaults use a 30s renewable lease. */
  lockOptions?: CaptureLeaseOptions;
};

type ArtifactDependencies = {
  now?: () => Date;
  randomId?: () => string;
};

export async function createCaptureArtifact(
  options: CreateCaptureArtifactOptions,
  dependencies: ArtifactDependencies = {},
): Promise<CaptureArtifact> {
  const now = dependencies.now ?? (() => new Date());
  const randomId =
    dependencies.randomId ?? (() => randomBytes(6).toString("hex"));
  const slug = captureSlug(options.demoId);
  const namespace = captureNamespace(options.demoId);
  const createdAt = now().toISOString();
  const timestamp = createdAt.replace(/[:.]/g, "-");
  // Validate the complete environment before creating even the namespace root.
  buildInitialMetadata(options, `${slug}-${timestamp}-validation`, createdAt);
  let directory: string | undefined;
  let captureRunId = "";
  let demoDirectory: string | undefined;

  let metadata: CaptureArtifactMetadata | undefined;
  let releaseLock: (() => Promise<void>) | undefined;
  if (options.outputDirectory) {
    directory = options.outputDirectory;
    captureRunId = `${slug}-${timestamp}-${randomId()}`;
    metadata = buildInitialMetadata(options, captureRunId, createdAt);
    await mkdir(directory, { recursive: true });
    releaseLock = await acquireCaptureLeaseLock(
      path.join(directory, ".capture.lock"),
      options.lockOptions,
    );
    try {
      await rm(path.join(directory, "manifest.json"), { force: true });
    } catch (error) {
      await releaseLock();
      throw error;
    }
  } else {
    demoDirectory = path.join(options.rootDirectory, namespace);
    await mkdir(demoDirectory, { recursive: true });
    for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
      const suffix = `${timestamp}-${randomId()}`;
      const candidate = path.join(demoDirectory, suffix);
      const candidateRunId = `${slug}-${suffix}`;
      const candidateMetadata = buildInitialMetadata(
        options,
        candidateRunId,
        createdAt,
      );
      try {
        await mkdir(candidate, { recursive: false });
        directory = candidate;
        captureRunId = candidateRunId;
        metadata = candidateMetadata;
        break;
      } catch (error) {
        if (!isNodeError(error, "EEXIST")) throw error;
      }
    }
  }

  if (!directory) {
    throw new Error(
      `Could not allocate a unique capture directory after ${MAX_CREATE_ATTEMPTS} attempts.`,
    );
  }

  if (!metadata) throw new Error("Capture metadata was not initialized.");
  const artifact: CaptureArtifact = {
    captureRunId,
    demoId: options.demoId,
    directory,
    metadataPath: path.join(directory, "metadata.json"),
    manifestPath: path.join(directory, "manifest.json"),
    screenshotsPath: path.join(directory, "screenshots"),
    tracePath: path.join(directory, "trace.zip"),
    metadata,
    managed: options.outputDirectory === undefined,
    demoDirectory,
    releaseLock,
  };
  try {
    await writeCaptureMetadata(artifact, metadata);
  } catch (error) {
    await releaseLock?.();
    if (artifact.managed) {
      await rm(artifact.directory, { recursive: true, force: true });
    }
    throw error;
  }
  return artifact;
}

export async function startCaptureArtifact(
  artifact: CaptureArtifact,
  now = new Date(),
): Promise<void> {
  assertMutable(artifact);
  const timestamp = now.toISOString();
  await writeCaptureMetadata(artifact, {
    ...artifact.metadata,
    status: "running",
    startedAt: timestamp,
    updatedAt: timestamp,
  });
}

export async function completeCaptureArtifact(
  artifact: CaptureArtifact,
  options: {
    recordingPath?: string;
    traceAvailable?: boolean;
    now?: Date;
  } = {},
): Promise<void> {
  assertMutable(artifact);
  await access(artifact.manifestPath);
  const timestamp = (options.now ?? new Date()).toISOString();
  const relativeRecording = options.recordingPath
    ? relativeArtifactPath(artifact.directory, options.recordingPath)
    : undefined;
  await writeCaptureMetadata(artifact, {
    ...artifact.metadata,
    status: "completed",
    updatedAt: timestamp,
    finishedAt: timestamp,
    paths: {
      ...artifact.metadata.paths,
      trace: options.traceAvailable ? "trace.zip" : undefined,
      recording: relativeRecording,
    },
  });
  if (artifact.managed && artifact.demoDirectory) {
    // The pointer is a rebuildable index. A completed capture remains valid if
    // updating that index fails; a later successful capture or doctor can heal it.
    await updateLatestCapturePointer(artifact, timestamp).catch(
      () => undefined,
    );
  }
}

export async function failCaptureArtifact(
  artifact: CaptureArtifact,
  error: unknown,
  now = new Date(),
): Promise<void> {
  assertMutable(artifact);
  const timestamp = now.toISOString();
  await writeCaptureMetadata(artifact, {
    ...artifact.metadata,
    status: "failed",
    startedAt: artifact.metadata.startedAt ?? timestamp,
    updatedAt: timestamp,
    finishedAt: timestamp,
    error: { message: redactCaptureErrorMessage(error, artifact.directory) },
  });
}

export async function cancelCaptureArtifact(
  artifact: CaptureArtifact,
  now = new Date(),
): Promise<void> {
  assertMutable(artifact);
  const timestamp = now.toISOString();
  await writeCaptureMetadata(artifact, {
    ...artifact.metadata,
    status: "cancelled",
    startedAt: artifact.metadata.startedAt ?? timestamp,
    updatedAt: timestamp,
    finishedAt: timestamp,
  });
}

export async function writeCaptureManifestAtomic(
  artifact: CaptureArtifact,
  json: string,
): Promise<void> {
  await writeFileAtomic(artifact.manifestPath, json);
}

export async function resolveLatestCompletedCapture(
  rootDirectory: string,
  demoId: string,
): Promise<
  | {
      captureDir: string;
      manifestPath: string;
      captureRunId?: string;
      legacy: boolean;
    }
  | undefined
> {
  let canonicalRoot: string;
  try {
    canonicalRoot = await realpath(rootDirectory);
  } catch {
    return undefined;
  }
  const directories = [
    path.join(rootDirectory, captureNamespace(demoId)),
    path.join(rootDirectory, captureSlug(demoId)),
  ];
  const scanned = (
    await Promise.all(
      directories.map((dir) =>
        scanCompletedCaptures(canonicalRoot, dir, demoId),
      ),
    )
  )
    .flat()
    .sort(compareCompletedCaptures)[0];
  if (scanned) {
    await repairPointer(scanned).catch(() => undefined);
    return {
      captureDir: scanned.directory,
      manifestPath: path.join(scanned.directory, "manifest.json"),
      captureRunId: scanned.metadata.captureRunId,
      legacy: false,
    };
  }

  if (path.basename(demoId) !== demoId || demoId === "." || demoId === "..") {
    return undefined;
  }
  const legacyDir = path.join(rootDirectory, demoId);
  const safeLegacyDir = await canonicalContained(canonicalRoot, legacyDir);
  if (
    safeLegacyDir &&
    (await isReusableCaptureDirectory(safeLegacyDir, demoId))
  ) {
    return {
      captureDir: legacyDir,
      manifestPath: path.join(legacyDir, "manifest.json"),
      legacy: true,
    };
  }
  return undefined;
}

export async function isReusableCaptureDirectory(
  directory: string,
  demoId: string,
): Promise<boolean> {
  try {
    const canonicalDirectory = await realpath(directory);
    const manifestPath = await canonicalContained(
      canonicalDirectory,
      path.join(directory, "manifest.json"),
    );
    if (!manifestPath) return false;
    const manifest = parseRecordedDemoManifestJson(
      await readFile(manifestPath, "utf8"),
    );
    if (manifest.demoId !== demoId) return false;
    try {
      const metadataCandidate = path.join(directory, "metadata.json");
      const metadataPath = await canonicalContained(
        canonicalDirectory,
        metadataCandidate,
      );
      if (!metadataPath) {
        try {
          await lstat(metadataCandidate);
          return false;
        } catch (error) {
          return isNodeError(error, "ENOENT");
        }
      }
      const metadata = parseCaptureArtifactMetadataJson(
        await readFile(metadataPath, "utf8"),
      );
      return (
        metadata.status === "completed" &&
        metadata.demoId === demoId &&
        metadata.captureRunId === manifest.captureRunId &&
        metadata.captureEnvironmentHash === manifest.captureEnvironmentHash
      );
    } catch (error) {
      return isNodeError(error, "ENOENT");
    }
  } catch {
    return false;
  }
}

export function captureSlug(demoId: string): string {
  const slug = demoId
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "demo";
}

export function captureNamespace(demoId: string): string {
  const digest = createHash("sha256").update(demoId).digest("hex").slice(0, 12);
  return `${captureSlug(demoId)}-${digest}`;
}

export function isCaptureAbort(error: unknown, signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted) || error instanceof CaptureAbortError;
}

export class CaptureAbortError extends Error {
  constructor() {
    super("Capture was cancelled.");
    this.name = "AbortError";
  }
}

async function writeCaptureMetadata(
  artifact: CaptureArtifact,
  metadata: CaptureArtifactMetadata,
): Promise<void> {
  const validated = parseCaptureArtifactMetadata(metadata);
  await writeFileAtomic(
    artifact.metadataPath,
    `${JSON.stringify(validated, null, 2)}\n`,
  );
  artifact.metadata = validated;
}

async function updateLatestCapturePointer(
  artifact: CaptureArtifact,
  completedAt: string,
  force = false,
): Promise<void> {
  const demoDirectory = artifact.demoDirectory!;
  const lockPath = path.join(demoDirectory, ".latest.lock");
  const releaseLock = await acquireCaptureLeaseLock(lockPath);

  try {
    const pointerPath = path.join(demoDirectory, "latest.json");
    let current: LatestCapturePointer | undefined;
    try {
      current = parseLatestCapturePointerJson(
        await readFile(pointerPath, "utf8"),
      );
    } catch {
      current = undefined;
    }
    const next = parseLatestCapturePointer({
      schemaVersion: 1,
      demoId: artifact.demoId,
      captureRunId: artifact.captureRunId,
      captureDirectory: path.basename(artifact.directory),
      completedAt,
    });
    if (force || !current || comparePointers(next, current) > 0) {
      await writeFileAtomic(pointerPath, `${JSON.stringify(next, null, 2)}\n`);
    }
  } finally {
    await releaseLock();
  }
}

type CompletedCapture = {
  directory: string;
  demoDirectory: string;
  metadata: CaptureArtifactMetadata;
  finishedAt?: string;
};

function compareCompletedCaptures(
  left: CompletedCapture,
  right: CompletedCapture,
): number {
  const byFinishedAt = (right.finishedAt ?? "").localeCompare(
    left.finishedAt ?? "",
  );
  return (
    byFinishedAt ||
    right.metadata.captureRunId.localeCompare(left.metadata.captureRunId)
  );
}

async function scanCompletedCaptures(
  rootDirectory: string,
  demoDirectory: string,
  demoId: string,
): Promise<CompletedCapture[]> {
  const publicDemoDirectory = demoDirectory;
  const safeDemoDirectory = await canonicalContained(
    rootDirectory,
    demoDirectory,
  );
  if (!safeDemoDirectory) return [];
  demoDirectory = safeDemoDirectory;
  let entries;
  try {
    entries = await readdir(demoDirectory, { withFileTypes: true });
  } catch {
    return [];
  }
  const candidates = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry): Promise<CompletedCapture | undefined> => {
        const directory = path.join(demoDirectory, entry.name);
        const publicDirectory = path.join(publicDemoDirectory, entry.name);
        try {
          const metadataPath = await canonicalContained(
            directory,
            path.join(directory, "metadata.json"),
          );
          if (!metadataPath) return undefined;
          const metadata = parseCaptureArtifactMetadataJson(
            await readFile(metadataPath, "utf8"),
          );
          if (
            metadata.status !== "completed" ||
            metadata.demoId !== demoId ||
            !(await isReusableCaptureDirectory(directory, demoId))
          ) {
            return undefined;
          }
          return {
            directory: publicDirectory,
            demoDirectory: publicDemoDirectory,
            metadata,
            finishedAt: metadata.finishedAt,
          };
        } catch {
          return undefined;
        }
      }),
  );
  return candidates.filter((item): item is CompletedCapture => Boolean(item));
}

async function canonicalContained(root: string, candidate: string) {
  try {
    const canonical = await realpath(candidate);
    const relative = path.relative(root, canonical);
    return relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
      ? canonical
      : undefined;
  } catch {
    return undefined;
  }
}

async function repairPointer(capture: CompletedCapture): Promise<void> {
  const artifact = {
    captureRunId: capture.metadata.captureRunId,
    demoId: capture.metadata.demoId,
    directory: capture.directory,
    demoDirectory: capture.demoDirectory,
  } as CaptureArtifact;
  await updateLatestCapturePointer(
    artifact,
    capture.finishedAt ?? capture.metadata.updatedAt,
    true,
  );
}

function comparePointers(
  left: LatestCapturePointer,
  right: LatestCapturePointer,
): number {
  const byTime = left.completedAt.localeCompare(right.completedAt);
  return byTime || left.captureRunId.localeCompare(right.captureRunId);
}

function buildInitialMetadata(
  options: CreateCaptureArtifactOptions,
  captureRunId: string,
  createdAt: string,
): CaptureArtifactMetadata {
  return parseCaptureArtifactMetadata({
    schemaVersion: 1,
    captureRunId,
    demoId: options.demoId,
    definitionHash: options.definitionHash,
    captureHash: options.captureHash,
    captureEnvironmentHash: options.captureEnvironmentHash,
    status: "created",
    createdAt,
    updatedAt: createdAt,
    paths: { manifest: "manifest.json", screenshots: "screenshots" },
    environment: options.environment,
  });
}

export type CaptureLeaseOptions = {
  leaseMs?: number;
  retryMs?: number;
  maxAttempts?: number;
  malformedStaleMs?: number;
  insideReleaseGuard?: () => void | Promise<void>;
  insideRecoveryGuard?: () => void | Promise<void>;
};

export type CaptureLeaseRelease = (() => Promise<void>) & {
  refresh: () => Promise<boolean>;
};

export async function acquireCaptureLeaseLock(
  lockPath: string,
  options: CaptureLeaseOptions = {},
): Promise<CaptureLeaseRelease> {
  const token = randomBytes(16).toString("hex");
  const leaseMs = options.leaseMs ?? LOCK_LEASE_MS;
  const retryMs = options.retryMs ?? LOCK_RETRY_MS;
  const maxAttempts = options.maxAttempts ?? LATEST_LOCK_ATTEMPTS;
  const malformedStaleMs = options.malformedStaleMs ?? leaseMs;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const acquired = await withOperationGuard(
      lockPath,
      malformedStaleMs,
      async () => {
        await cleanupLegacyRecoveryMarker(lockPath, malformedStaleMs);
        const exists = await fileExists(lockPath);
        const current = exists ? await readLock(lockPath) : undefined;
        if (!exists) {
          const now = Date.now();
          await writeFile(
            lockPath,
            lockContents(token, process.pid, now, leaseMs),
            { flag: "wx" },
          );
          return true;
        }
        const malformedOld = current
          ? false
          : await existsOldMalformed(lockPath, malformedStaleMs);
        if (!malformedOld && (!current || isProcessAlive(current.pid))) {
          return false;
        }
        await options.insideRecoveryGuard?.();
        const confirmed = await readLock(lockPath);
        const confirmedMalformedOld = confirmed
          ? false
          : await existsOldMalformed(lockPath, malformedStaleMs);
        if (
          !confirmedMalformedOld &&
          (!confirmed || isProcessAlive(confirmed.pid))
        ) {
          return false;
        }
        await rm(lockPath, { force: true });
        const now = Date.now();
        await writeFile(
          lockPath,
          lockContents(token, process.pid, now, leaseMs),
          { flag: "wx" },
        );
        return true;
      },
    );
    if (acquired) {
      let released = false;
      const refresh = async () => {
        if (released) return false;
        return awaitOperationGuard(
          lockPath,
          malformedStaleMs,
          retryMs,
          maxAttempts,
          async () => {
            const current = await readLock(lockPath);
            return current?.token === token && current.pid === process.pid;
          },
        );
      };
      let releasePromise: Promise<void> | undefined;
      const release = Object.assign(
        async () => {
          if (!releasePromise) {
            released = true;
            releasePromise = awaitOperationGuard(
              lockPath,
              malformedStaleMs,
              retryMs,
              maxAttempts,
              async () => {
                await options.insideReleaseGuard?.();
                const current = await readLock(lockPath);
                if (current?.token === token) {
                  await rm(lockPath, { force: true });
                }
                return true;
              },
            ).then(() => undefined);
          }
          await releasePromise;
        },
        { refresh },
      ) as CaptureLeaseRelease;
      return release;
    }
    if (attempt + 1 < maxAttempts) await delay(retryMs);
  }
  throw new Error(
    `Timed out acquiring capture lock ${path.basename(lockPath)}.`,
  );
}

async function awaitOperationGuard<T>(
  lockPath: string,
  malformedStaleMs: number,
  retryMs: number,
  maxAttempts: number,
  operation: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await withOperationGuard(
      lockPath,
      malformedStaleMs,
      operation,
    );
    if (result !== undefined) return result;
    if (attempt + 1 < maxAttempts) await delay(retryMs);
  }
  throw new Error(
    `Timed out entering capture lock operation guard ${path.basename(lockPath)}.`,
  );
}

type LockRecord = {
  token: string;
  pid: number;
  createdAt: number;
  expiresAt: number;
};

function lockContents(
  token: string,
  pid: number,
  createdAt: number,
  leaseMs: number,
) {
  return `${JSON.stringify({ token, pid, createdAt, expiresAt: Date.now() + leaseMs })}\n`;
}

async function readLock(lockPath: string): Promise<LockRecord | undefined> {
  try {
    const value = JSON.parse(await readFile(lockPath, "utf8")) as LockRecord;
    if (
      typeof value.token !== "string" ||
      !Number.isInteger(value.pid) ||
      !Number.isFinite(value.createdAt) ||
      !Number.isFinite(value.expiresAt)
    ) {
      return undefined;
    }
    return value;
  } catch {
    return undefined;
  }
}

async function withOperationGuard<T>(
  lockPath: string,
  malformedStaleMs: number,
  operation: () => Promise<T>,
): Promise<T | undefined> {
  const guardPath = `${lockPath}.operation`;
  const recoveryPath = `${guardPath}.recovery`;
  const token = randomBytes(16).toString("hex");
  await cleanupOrphanGuardRecovery(recoveryPath, malformedStaleMs);
  if (await fileExists(recoveryPath)) return undefined;
  try {
    const now = Date.now();
    await writeFile(
      guardPath,
      lockContents(token, process.pid, now, Math.max(malformedStaleMs, 100)),
      { flag: "wx" },
    );
  } catch (error) {
    if (!isNodeError(error, "EEXIST")) throw error;
    const guard = await readLock(guardPath);
    const malformedOld = guard
      ? false
      : await existsOldMalformed(guardPath, malformedStaleMs);
    if (!malformedOld && (!guard || isProcessAlive(guard.pid)))
      return undefined;
    if (!(await claimGuardRecovery(recoveryPath, malformedStaleMs))) {
      return undefined;
    }
    let recovered = false;
    try {
      const confirmed = await readLock(guardPath);
      const confirmedMalformedOld = confirmed
        ? false
        : await existsOldMalformed(guardPath, malformedStaleMs);
      if (
        confirmedMalformedOld ||
        (confirmed && !isProcessAlive(confirmed.pid))
      ) {
        await rm(guardPath, { force: true });
        const now = Date.now();
        await writeFile(
          guardPath,
          lockContents(
            token,
            process.pid,
            now,
            Math.max(malformedStaleMs, 100),
          ),
          { flag: "wx" },
        );
        recovered = true;
      }
    } finally {
      await rm(recoveryPath, { force: true });
    }
    if (!recovered) return undefined;
  }
  try {
    return await operation();
  } finally {
    const guard = await readLock(guardPath);
    if (guard?.token === token) await rm(guardPath, { force: true });
  }
}

async function claimGuardRecovery(
  recoveryPath: string,
  malformedStaleMs: number,
): Promise<boolean> {
  await cleanupOrphanGuardRecovery(recoveryPath, malformedStaleMs);
  const now = Date.now();
  try {
    await writeFile(
      recoveryPath,
      lockContents(
        randomBytes(16).toString("hex"),
        process.pid,
        now,
        Math.max(malformedStaleMs, 100),
      ),
      { flag: "wx" },
    );
    return true;
  } catch {
    return false;
  }
}

async function cleanupOrphanGuardRecovery(
  recoveryPath: string,
  malformedStaleMs: number,
): Promise<void> {
  const marker = await readLock(recoveryPath);
  const malformedOld = marker
    ? false
    : await existsOldMalformed(recoveryPath, malformedStaleMs);
  if (malformedOld || (marker && !isProcessAlive(marker.pid))) {
    await rm(recoveryPath, { force: true });
  }
}

async function cleanupLegacyRecoveryMarker(
  lockPath: string,
  malformedStaleMs: number,
): Promise<void> {
  await cleanupOrphanGuardRecovery(`${lockPath}.recovery`, malformedStaleMs);
}

async function fileExists(file: string): Promise<boolean> {
  return access(file)
    .then(() => true)
    .catch(() => false);
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return isNodeError(error, "EPERM");
  }
}

async function existsOldMalformed(
  file: string,
  ageMs: number,
): Promise<boolean> {
  return stat(file)
    .then((value) => Date.now() - value.mtimeMs > ageMs)
    .catch(() => false);
}

async function writeFileAtomic(file: string, contents: string): Promise<void> {
  const temporary = `${file}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    await writeFile(temporary, contents, { flag: "wx" });
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

function relativeArtifactPath(directory: string, target: string): string {
  const relative = path.relative(directory, path.resolve(target));
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return relative;
  }
  return path.basename(target);
}

export function redactCaptureErrorMessage(
  error: unknown,
  directory?: string,
): string {
  const raw = error instanceof Error ? error.message : String(error);
  const paths = [
    [directory ? path.resolve(directory) : "", "[capture]"],
    [process.cwd(), "[workspace]"],
    [homedir(), "[home]"],
  ] as const;
  const pathRedacted = paths.reduce(
    (message, [sensitive, replacement]) =>
      sensitive ? message.split(sensitive).join(replacement) : message,
    raw,
  );
  return pathRedacted
    .replace(
      /\b(Proxy-Authorization|Authorization|Set-Cookie|Cookie)\s*:\s*[^\r\n]*/gi,
      "$1: [redacted]",
    )
    .replace(/:\/\/[^\s/@:]+(?::[^\s/@]*)?@/g, "://[redacted]@")
    .replace(
      /([?&](?:access_?token|token|code|api_?key|key|secret|password|passwd|auth|authorization|signature|sig)=)[^&#\s]*/gi,
      "$1[redacted]",
    )
    .replace(
      /\b((?:access_?token|token|api_?key|secret|password|passwd|authorization|signature)\s*[=:]\s*)[^\s,;&#/?]+/gi,
      "$1[redacted]",
    );
}

function assertMutable(artifact: CaptureArtifact): void {
  if (["completed", "failed", "cancelled"].includes(artifact.metadata.status)) {
    throw new Error(
      `Capture ${artifact.captureRunId} is already ${artifact.metadata.status}.`,
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

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}
