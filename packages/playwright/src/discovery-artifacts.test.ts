import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseDiscoveryRunMetadataJson,
  parseLatestDiscoveryPointerJson,
  type DiscoveryEnvironment,
} from "@democraft/schema";
import {
  cancelDiscoveryArtifact,
  completeDiscoveryArtifact,
  createDiscoveryArtifact,
  discoveryApplicationId,
  discoveryContentHash,
  discoveryEnvironmentHash,
  DiscoveryAbortError,
  failDiscoveryArtifact,
  isDiscoveryAbort,
  resolveLatestCompletedDiscovery,
  startDiscoveryArtifact,
  writeDiscoveryArtifactAtomic,
} from "./discovery-artifacts";

const tempDirs: string[] = [];
const environment: DiscoveryEnvironment = {
  headless: true,
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
  locale: "en-US",
  timezone: "UTC",
  timeoutMs: 8000,
};

afterEach(async () => {
  await Promise.all(
    tempDirs.map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
  tempDirs.length = 0;
});

async function temporaryDirectory(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "democraft-discovery-"));
  tempDirs.push(dir);
  return dir;
}

const ORIGIN = "http://localhost:3000";

describe("discovery artifacts", () => {
  it("creates a run directory under an origin-derived application id", async () => {
    const root = await temporaryDirectory();
    const artifact = await createDiscoveryArtifact({
      rootDirectory: root,
      origin: ORIGIN,
      environment,
    });
    expect(artifact.applicationId).toBe(discoveryApplicationId(ORIGIN));
    expect(artifact.directory).toBe(
      path.join(
        root,
        artifact.applicationId,
        "runs",
        path.basename(artifact.directory),
      ),
    );
    expect(artifact.metadata.status).toBe("created");
    expect(artifact.metadata.origin).toBe(ORIGIN);
    expect(artifact.metadata.hashes.environmentHash).toBeUndefined();
    expect(artifact.managed).toBe(true);
  });

  it("uses an explicit output directory when supplied", async () => {
    const root = await temporaryDirectory();
    const outputDirectory = path.join(root, "explicit-discovery");
    const artifact = await createDiscoveryArtifact({
      rootDirectory: path.join(root, "managed-root"),
      outputDirectory,
      origin: ORIGIN,
      environment,
    });
    expect(artifact.directory).toBe(outputDirectory);
    expect(artifact.managed).toBe(false);
    expect(artifact.applicationDirectory).toBe(
      path.join(root, "managed-root", discoveryApplicationId(ORIGIN)),
    );
  });

  it("attaches an environment hash when supplied", async () => {
    const root = await temporaryDirectory();
    const environmentHash = discoveryEnvironmentHash(environment);
    const artifact = await createDiscoveryArtifact({
      rootDirectory: root,
      origin: ORIGIN,
      environment,
      hashes: { environmentHash },
    });
    expect(artifact.metadata.hashes.environmentHash).toBe(environmentHash);
  });

  it("walks the created -> running -> completed lifecycle and writes latest.json", async () => {
    const root = await temporaryDirectory();
    const artifact = await createDiscoveryArtifact({
      rootDirectory: root,
      origin: ORIGIN,
      environment,
    });
    await startDiscoveryArtifact(artifact);
    expect(artifact.metadata.status).toBe("running");
    expect(artifact.metadata.startedAt).toBeDefined();

    // Completion requires the application-map to exist (mirrors capture's
    // manifest gate).
    await expect(completeDiscoveryArtifact(artifact)).rejects.toThrow();

    const json = JSON.stringify({
      schemaVersion: 1,
      generatedAt: "2026-07-17T18:00:00.000Z",
      page: {
        url: ORIGIN,
        pathname: "/",
        viewport: { width: 1920, height: 1080, deviceScaleFactor: 2 },
      },
      regions: [],
      elements: [],
      collections: [],
      warnings: [],
    });
    await writeDiscoveryArtifactAtomic(artifact, json);
    const contentHash = discoveryContentHash(json);
    await completeDiscoveryArtifact(artifact, { contentHash });
    expect(artifact.metadata.status).toBe("completed");
    expect(artifact.metadata.finishedAt).toBeDefined();
    expect(artifact.metadata.hashes.contentHash).toBe(contentHash);

    const pointer = parseLatestDiscoveryPointerJson(
      await readFile(
        path.join(artifact.applicationDirectory, "latest.json"),
        "utf8",
      ),
    );
    expect(pointer.discoveryRunId).toBe(artifact.discoveryRunId);
    expect(pointer.applicationId).toBe(artifact.applicationId);
  });

  it("does not write latest.json for an explicit output directory", async () => {
    const root = await temporaryDirectory();
    const artifact = await createDiscoveryArtifact({
      rootDirectory: path.join(root, "managed-root"),
      outputDirectory: path.join(root, "explicit-discovery"),
      origin: ORIGIN,
      environment,
    });
    await startDiscoveryArtifact(artifact);
    await writeDiscoveryArtifactAtomic(
      artifact,
      JSON.stringify(minimalDiscovery()),
    );
    await completeDiscoveryArtifact(artifact);

    await expect(
      readFile(path.join(artifact.applicationDirectory, "latest.json"), "utf8"),
    ).rejects.toThrow();
  });

  it("records a redacted error message on failure", async () => {
    const root = await temporaryDirectory();
    const artifact = await createDiscoveryArtifact({
      rootDirectory: root,
      origin: ORIGIN,
      environment,
    });
    await startDiscoveryArtifact(artifact);
    // The absolute run directory must be redacted to a placeholder in the
    // persisted error message (never leaks the on-disk path). Mirrors capture.
    await failDiscoveryArtifact(
      artifact,
      new Error(`boom at ${artifact.directory}`),
    );
    expect(artifact.metadata.status).toBe("failed");
    expect(artifact.metadata.error?.message).toContain("[capture]");
    expect(artifact.metadata.error?.message).not.toContain(artifact.directory);
  });

  it("reaches a clean cancelled terminal state", async () => {
    const root = await temporaryDirectory();
    const artifact = await createDiscoveryArtifact({
      rootDirectory: root,
      origin: ORIGIN,
      environment,
    });
    await startDiscoveryArtifact(artifact);
    await cancelDiscoveryArtifact(artifact);
    expect(artifact.metadata.status).toBe("cancelled");
    expect(artifact.metadata.error).toBeUndefined();
  });

  it("refuses transitions once terminal", async () => {
    const root = await temporaryDirectory();
    const artifact = await createDiscoveryArtifact({
      rootDirectory: root,
      origin: ORIGIN,
      environment,
    });
    await startDiscoveryArtifact(artifact);
    await cancelDiscoveryArtifact(artifact);
    await expect(startDiscoveryArtifact(artifact)).rejects.toThrow(
      /already cancelled/,
    );
  });

  it("resolves the latest completed run and self-heals a missing pointer", async () => {
    const root = await temporaryDirectory();
    const artifact = await createDiscoveryArtifact({
      rootDirectory: root,
      origin: ORIGIN,
      environment,
    });
    await startDiscoveryArtifact(artifact);
    await writeDiscoveryArtifactAtomic(
      artifact,
      JSON.stringify(minimalDiscovery()),
    );
    await completeDiscoveryArtifact(artifact);

    const resolved = await resolveLatestCompletedDiscovery(root, ORIGIN);
    expect(resolved?.discoveryRunId).toBe(artifact.discoveryRunId);
    expect(resolved?.discoveryDirectory).toBe(
      path.basename(artifact.directory),
    );

    // Drop the pointer; the scan path still finds the completed run.
    await rm(path.join(artifact.applicationDirectory, "latest.json"), {
      force: true,
    });
    const healed = await resolveLatestCompletedDiscovery(root, ORIGIN);
    expect(healed?.discoveryRunId).toBe(artifact.discoveryRunId);
  });

  it("classifies abort via signal or DiscoveryAbortError", () => {
    expect(isDiscoveryAbort(new DiscoveryAbortError())).toBe(true);
    const controller = new AbortController();
    controller.abort();
    expect(isDiscoveryAbort(new Error("x"), controller.signal)).toBe(true);
    expect(isDiscoveryAbort(new Error("x"))).toBe(false);
  });

  it("writes deterministic application ids for an origin", () => {
    const a = discoveryApplicationId("http://localhost:3000");
    const b = discoveryApplicationId("http://localhost:3000/dashboard");
    const c = discoveryApplicationId("http://localhost:3000/projects/1");
    expect(a).toBe(b); // origin-based, path-independent
    expect(a).toBe(c);
    expect(a).not.toBe(discoveryApplicationId("http://localhost:3001"));
  });

  it("persists metadata that round-trips through the schema parser", async () => {
    const root = await temporaryDirectory();
    const artifact = await createDiscoveryArtifact({
      rootDirectory: root,
      origin: ORIGIN,
      environment,
    });
    await startDiscoveryArtifact(artifact);
    await writeDiscoveryArtifactAtomic(
      artifact,
      JSON.stringify(minimalDiscovery()),
    );
    await completeDiscoveryArtifact(artifact);
    const reparsed = parseDiscoveryRunMetadataJson(
      await readFile(artifact.metadataPath, "utf8"),
    );
    expect(reparsed).toEqual(artifact.metadata);
  });
});

function minimalDiscovery() {
  return {
    schemaVersion: 1,
    generatedAt: "2026-07-17T18:00:00.000Z",
    page: {
      url: ORIGIN,
      pathname: "/",
      viewport: { width: 1920, height: 1080, deviceScaleFactor: 2 },
    },
    regions: [],
    elements: [],
    collections: [],
    warnings: [],
  };
}
