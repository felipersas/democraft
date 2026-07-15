import { mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RenderArtifactMetadata } from "@democraft/schema";
import type { RenderJob } from "./types/render";
import { trustedWorkspaceRoot } from "./studio-path-authority";
import {
  authorizedRenderArtifactsDirectory,
  createRenderHistoryLoader,
  mergeRenderJobs,
  readRenderHistory,
  renderArtifactsDirectory,
} from "./render-history";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("render history reconstruction", () => {
  it("reconstructs terminal jobs after a restart in chronological order", async () => {
    const root = await makeRoot();
    await writeArtifact(
      root,
      "demo-a",
      "new",
      metadata("render-new", "completed", 2),
      true,
    );
    await writeArtifact(
      root,
      "demo-b",
      "old",
      metadata("render-old", "failed", 1),
    );
    await writeArtifact(
      root,
      "demo-b",
      "cancelled",
      metadata("render-cancelled", "cancelled", 3),
    );

    const jobs = await readRenderHistory(root);

    expect(
      jobs.map(({ artifactId, status }) => ({ artifactId, status })),
    ).toEqual([
      { artifactId: "render-old", status: "failed" },
      { artifactId: "render-new", status: "done" },
      { artifactId: "render-cancelled", status: "cancelled" },
    ]);
    expect(jobs[0]?.error).toBe("render failed");
    expect(jobs[1]).toMatchObject({
      progress: 1,
      outputPath: expect.stringMatching(/video\.mp4$/),
    });
  });

  it("ignores corrupt, active, and incomplete completed artifacts", async () => {
    const root = await makeRoot();
    const corrupt = path.join(root, "demo", "corrupt");
    await mkdir(corrupt, { recursive: true });
    await writeFile(path.join(corrupt, "metadata.json"), "{");
    await writeArtifact(
      root,
      "demo",
      "active",
      metadata("active", "rendering", 1),
    );
    await writeArtifact(
      root,
      "demo",
      "missing-video",
      metadata("missing-video", "completed", 2),
    );
    await writeArtifact(
      root,
      "demo",
      "valid",
      metadata("valid", "completed", 3),
      true,
    );

    await expect(readRenderHistory(root)).resolves.toMatchObject([
      { artifactId: "valid" },
    ]);
  });

  it("keeps copied artifacts with a crafted duplicate render id as distinct rows", async () => {
    const root = await makeRoot();
    await writeArtifact(
      root,
      "demo-a",
      "copy-one",
      metadata("same-id", "failed", 1),
    );
    await writeArtifact(
      root,
      "demo-b",
      "copy-two",
      metadata("same-id", "cancelled", 2),
    );

    const jobs = await readRenderHistory(root);
    expect(jobs).toHaveLength(2);
    expect(jobs.map((job) => job.artifactId)).toEqual(["same-id", "same-id"]);
    expect(new Set(jobs.map((job) => job.id))).toHaveLength(2);
  });

  it("ignores completed artifacts whose video symlink escapes the render directory", async () => {
    const root = await makeRoot();
    await writeArtifact(
      root,
      "demo",
      "escaped-video",
      metadata("escaped-video", "completed", 1),
    );
    const artifact = path.join(root, "demo", "escaped-video");
    const outside = path.join(root, "outside.mp4");
    await writeFile(outside, "outside");
    await symlink(outside, path.join(artifact, "video.mp4"));

    await expect(readRenderHistory(root)).resolves.toEqual([]);
  });

  it("ignores metadata symlinks that escape the render directory", async () => {
    const root = await makeRoot();
    const artifact = path.join(root, "demo", "escaped-metadata");
    await mkdir(artifact, { recursive: true });
    const outside = path.join(root, "outside-metadata.json");
    await writeFile(
      outside,
      JSON.stringify(metadata("escaped-metadata", "failed", 1)),
    );
    await symlink(outside, path.join(artifact, "metadata.json"));

    await expect(readRenderHistory(root)).resolves.toEqual([]);
  });

  it("keeps live state on id collision and honors session-scoped clearing", () => {
    const directory = "/workspace/.democraft/renders/demo/run";
    const historical = {
      ...job("history-row", "done", 1),
      artifactId: "durable-render-id",
      artifactDirectory: directory,
    };
    const live = {
      ...job("job-process-id", "rendering", 2),
      artifactId: "durable-render-id",
      artifactDirectory: directory,
    };

    expect(mergeRenderJobs([live], [historical], new Set())).toEqual([live]);
    expect(mergeRenderJobs([], [historical], new Set([directory]))).toEqual([]);

    const legacyHistorical = {
      ...job("history-other-id", "done", 1),
      artifactId: "artifact-without-directory",
    };
    const legacyLive = {
      ...job("job-other-id", "rendering", 2),
      artifactId: "artifact-without-directory",
    };
    expect(
      mergeRenderJobs([legacyLive], [legacyHistorical], new Set()),
    ).toEqual([legacyLive]);
  });

  it("bounds returned history to the deterministic newest entries", async () => {
    const root = await makeRoot();
    for (let hour = 1; hour <= 4; hour += 1) {
      await writeArtifact(
        root,
        "demo",
        `2026-01-01T0${hour}-run`,
        metadata(`render-${hour}`, "completed", hour),
        true,
      );
    }

    const jobs = await readRenderHistory(root, { maxEntries: 2 });
    expect(jobs.map((job) => job.artifactId)).toEqual(["render-3", "render-4"]);
  });

  it("collapses concurrent scans and serves a short-lived cached result", async () => {
    let reads = 0;
    const expected = [job("history", "done", 1)];
    const load = createRenderHistoryLoader({
      ttlMs: 10_000,
      read: async () => {
        reads += 1;
        await Promise.resolve();
        return expected;
      },
    });

    const results = await Promise.all([load("/renders"), load("/renders")]);
    expect(results).toEqual([expected, expected]);
    expect(await load("/renders")).toBe(expected);
    expect(reads).toBe(1);
  });

  it("bounds retained candidates while still selecting the newest directories", async () => {
    let enumerated = 0;
    let metadataReads = 0;
    const directoriesRead: string[] = [];
    const iterateDirectory = async function* (directory: string) {
      const count = directory === "/renders" ? 3 : 30;
      for (let index = 0; index < count; index += 1) {
        enumerated += 1;
        yield {
          name: `entry-${String(index).padStart(5, "0")}`,
          isDirectory: true,
        };
      }
    };

    const jobs = await readRenderHistory("/renders", {
      maxArtifactsToScan: 5,
      maxEntries: 2,
      dependencies: {
        iterateDirectory,
        readJob: async (directory) => {
          metadataReads += 1;
          directoriesRead.push(directory);
          return {
            ...job(`history-${metadataReads}`, "done", metadataReads),
            artifactDirectory: directory,
          };
        },
      },
    });

    expect(jobs).toHaveLength(2);
    expect(enumerated).toBe(93);
    expect(metadataReads).toBe(5);
    expect(
      directoriesRead.every((directory) =>
        /entry-000(?:28|29)$/.test(directory),
      ),
    ).toBe(true);
    expect(
      directoriesRead.some((directory) => directory.endsWith("entry-00029")),
    ).toBe(true);
  });

  it("derives the render root from the canonical environment workspace", async () => {
    const workspace = await realpath(await makeRoot());
    const previous = process.env.DEMOCRAFT_STUDIO_WORKSPACE_ROOT;
    process.env.DEMOCRAFT_STUDIO_WORKSPACE_ROOT = workspace;
    try {
      expect(renderArtifactsDirectory(await trustedWorkspaceRoot())).toBe(
        path.join(workspace, ".democraft", "renders"),
      );
    } finally {
      if (previous === undefined)
        delete process.env.DEMOCRAFT_STUDIO_WORKSPACE_ROOT;
      else process.env.DEMOCRAFT_STUDIO_WORKSPACE_ROOT = previous;
    }
  });

  it("rejects a renders root symlink outside the trusted artifacts directory", async () => {
    const workspace = await makeRoot();
    const outside = await makeRoot();
    await mkdir(path.join(workspace, ".democraft"));
    await symlink(outside, path.join(workspace, ".democraft", "renders"));

    await expect(
      authorizedRenderArtifactsDirectory(await realpath(workspace)),
    ).rejects.toThrow(/Render artifacts root escapes its allowed root/);
  });
});

async function makeRoot(): Promise<string> {
  const root = path.join(
    tmpdir(),
    `democraft-render-history-${process.pid}-${Math.random().toString(16).slice(2)}`,
  );
  roots.push(root);
  await mkdir(root, { recursive: true });
  return root;
}

async function writeArtifact(
  root: string,
  demo: string,
  directory: string,
  value: RenderArtifactMetadata,
  withVideo = false,
): Promise<void> {
  const artifactDirectory = path.join(root, demo, directory);
  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(
    path.join(artifactDirectory, "metadata.json"),
    JSON.stringify(value),
  );
  if (withVideo)
    await writeFile(path.join(artifactDirectory, "video.mp4"), "video");
}

function metadata(
  renderId: string,
  status: RenderArtifactMetadata["status"],
  hour: number,
): RenderArtifactMetadata {
  const createdAt = `2026-01-01T0${hour}:00:00.000Z`;
  const terminal = status !== "rendering";
  return {
    schemaVersion: 1,
    renderId,
    demoId: "demo",
    status,
    createdAt,
    startedAt: createdAt,
    updatedAt: createdAt,
    finishedAt: terminal ? createdAt : undefined,
    output: { video: "video.mp4" },
    render: { fps: 30, durationInFrames: 60, mediaMode: "screenshots" },
    error: status === "failed" ? { message: "render failed" } : undefined,
  };
}

function job(
  id: string,
  status: RenderJob["status"],
  createdAt: number,
): RenderJob {
  return { id, status, createdAt, progress: 0, options: {} };
}
