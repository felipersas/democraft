import { randomBytes } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  parseRenderArtifactMetadata,
  type RenderArtifactMetadata,
  type RenderArtifactStatus,
} from "@democraft/schema";

export type {
  RenderArtifactMetadata,
  RenderArtifactStatus,
} from "@democraft/schema";

export type RenderArtifact = {
  directory: string;
  metadataPath: string;
  outputFile: string;
  temporaryOutputFile: string;
  metadata: RenderArtifactMetadata;
};

export type CreateRenderArtifactOptions = {
  rootDirectory: string;
  demoId: string;
  definitionHash?: string;
  captureHash?: string;
  captureEnvironmentHash?: string;
  render: RenderArtifactMetadata["render"];
  source?: RenderArtifactMetadata["source"];
};

type ArtifactDependencies = {
  now: () => Date;
  shortId: () => string;
};

const defaultDependencies: ArtifactDependencies = {
  now: () => new Date(),
  shortId: () => randomBytes(4).toString("hex"),
};

export async function createRenderArtifact(
  options: CreateRenderArtifactOptions,
  dependencies: ArtifactDependencies = defaultDependencies,
): Promise<RenderArtifact> {
  const slug = renderSlug(options.demoId);
  const demoDirectory = join(options.rootDirectory, slug);
  let demoDirectoryReady = false;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const now = dependencies.now();
    const suffix = `${renderTimestamp(now)}-${dependencies.shortId()}`;
    const renderId = `${slug}-${suffix}`;
    const directory = join(demoDirectory, suffix);

    const timestamp = now.toISOString();
    const metadata = parseRenderArtifactMetadata({
      schemaVersion: 1,
      renderId,
      demoId: options.demoId,
      definitionHash: options.definitionHash,
      captureHash: options.captureHash,
      captureEnvironmentHash: options.captureEnvironmentHash,
      status: "rendering",
      createdAt: timestamp,
      startedAt: timestamp,
      updatedAt: timestamp,
      output: { video: "video.mp4" },
      render: options.render,
      source: options.source,
    });
    const artifact: RenderArtifact = {
      directory,
      metadataPath: join(directory, "metadata.json"),
      outputFile: join(directory, "video.mp4"),
      temporaryOutputFile: join(directory, `.video-${renderId}.tmp.mp4`),
      metadata,
    };

    if (!demoDirectoryReady) {
      await mkdir(demoDirectory, { recursive: true });
      demoDirectoryReady = true;
    }

    try {
      await mkdir(directory);
    } catch (error) {
      if (isAlreadyExistsError(error)) continue;
      throw error;
    }

    try {
      await writeMetadata(artifact);
      return artifact;
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      throw error;
    }
  }

  throw new Error(
    `Could not allocate a unique render directory for "${options.demoId}".`,
  );
}

export async function completeRenderArtifact(
  artifact: RenderArtifact,
  now = new Date(),
): Promise<void> {
  assertActive(artifact);
  await rename(artifact.temporaryOutputFile, artifact.outputFile);
  try {
    await transitionArtifact(artifact, "completed", now);
  } catch (error) {
    artifact.metadata.status = "rendering";
    artifact.metadata.finishedAt = undefined;
    await rename(artifact.outputFile, artifact.temporaryOutputFile).catch(
      () => undefined,
    );
    throw error;
  }
}

export async function failRenderArtifact(
  artifact: RenderArtifact,
  error: unknown,
  now = new Date(),
): Promise<void> {
  await finishUnsuccessfulArtifact(artifact, "failed", error, now);
}

export async function cancelRenderArtifact(
  artifact: RenderArtifact,
  now = new Date(),
): Promise<void> {
  await finishUnsuccessfulArtifact(artifact, "cancelled", undefined, now);
}

export function renderSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "demo";
}

function renderTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

async function finishUnsuccessfulArtifact(
  artifact: RenderArtifact,
  status: "failed" | "cancelled",
  error: unknown,
  now: Date,
): Promise<void> {
  assertActive(artifact);
  await rm(artifact.temporaryOutputFile, { force: true });
  artifact.metadata.error =
    status === "failed" ? { message: errorMessage(error) } : undefined;
  await transitionArtifact(artifact, status, now);
}

async function transitionArtifact(
  artifact: RenderArtifact,
  status: Exclude<RenderArtifactStatus, "rendering">,
  now: Date,
): Promise<void> {
  const timestamp = now.toISOString();
  artifact.metadata.status = status;
  artifact.metadata.updatedAt = timestamp;
  artifact.metadata.finishedAt = timestamp;
  await writeMetadata(artifact);
}

async function writeMetadata(artifact: RenderArtifact): Promise<void> {
  parseRenderArtifactMetadata(artifact.metadata);
  const temporaryPath = `${artifact.metadataPath}.${randomBytes(4).toString("hex")}.tmp`;
  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify(artifact.metadata, null, 2)}\n`,
      {
        flag: "wx",
      },
    );
    await rename(temporaryPath, artifact.metadataPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

function assertActive(artifact: RenderArtifact): void {
  if (artifact.metadata.status !== "rendering") {
    throw new Error(
      `Render artifact "${artifact.metadata.renderId}" is already ${artifact.metadata.status}.`,
    );
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "EEXIST"
  );
}
