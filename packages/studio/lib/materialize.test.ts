import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import {
  schemaVersion,
  type RecordedDemoManifest,
  type RenderTimeline,
  type StudioMeta,
} from "@democraft/schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { materializeStudioData, updateMetaAfterCapture } from "./materialize";

const tempDirs: string[] = [];
const OLD_DEFINITION_HASH = `definition-v1:sha256:${"a".repeat(64)}`;
const NEW_DEFINITION_HASH = `definition-v1:sha256:${"b".repeat(64)}`;
const OLD_CAPTURE_HASH = `capture-v1:sha256:${"c".repeat(64)}`;
const NEW_CAPTURE_HASH = `capture-v1:sha256:${"d".repeat(64)}`;

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

describe("studio capture metadata", () => {
  it("updates capture identity while preserving source provenance", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "democraft-meta-"));
    tempDirs.push(dataDir);
    const meta: StudioMeta = {
      demoPath: "/workspace/demo.ts",
      captureDir: "/workspace/.democraft/runs/old",
      workspaceRoot: "/workspace",
      demoId: "old",
      definitionHash: OLD_DEFINITION_HASH,
      captureHash: OLD_CAPTURE_HASH,
      capturedAt: 1,
    };
    await writeFile(join(dataDir, "meta.json"), JSON.stringify(meta));
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));

    const newCaptureDir = "/workspace/.democraft/runs/current/new-run";
    await updateMetaAfterCapture(
      dataDir,
      meta,
      {
        id: "current",
        definitionHash: NEW_DEFINITION_HASH,
        captureHash: NEW_CAPTURE_HASH,
      },
      newCaptureDir,
    );

    expect(
      JSON.parse(await readFile(join(dataDir, "meta.json"), "utf8")),
    ).toEqual({
      ...meta,
      schemaVersion: "1",
      captureDir: newCaptureDir,
      demoId: "current",
      definitionHash: NEW_DEFINITION_HASH,
      captureHash: NEW_CAPTURE_HASH,
      capturedAt: Date.now(),
    });
  });

  it.each([
    [
      "manifest",
      {
        manifest: { ...manifestFixture(), demoId: "" },
        timeline: timelineFixture(),
      },
    ],
    [
      "timeline",
      {
        manifest: manifestFixture(),
        timeline: { ...timelineFixture(), fps: 0 },
      },
    ],
  ])("validates %s before mutating studio data", async (_kind, patch) => {
    const dataDir = await mkdtemp(join(tmpdir(), "democraft-data-"));
    const captureDir = await mkdtemp(join(tmpdir(), "democraft-capture-"));
    tempDirs.push(dataDir, captureDir);

    await expect(
      materializeStudioData({
        dataDir,
        captureDir,
        manifest: patch.manifest,
        timeline: patch.timeline,
      }),
    ).rejects.toMatchObject({ issues: expect.any(Array) });
    await expect(readFile(join(dataDir, "manifest.json"))).rejects.toThrow();
    await expect(readFile(join(dataDir, "timeline.json"))).rejects.toThrow();
  });

  it("validates metadata before writing it", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "democraft-meta-"));
    tempDirs.push(dataDir);

    await expect(
      updateMetaAfterCapture(dataDir, metaFixture(), {
        id: "current",
        definitionHash: "definition-v1:sha256:short",
        captureHash: NEW_CAPTURE_HASH,
      }),
    ).rejects.toThrow("$.definitionHash");
    await expect(readFile(join(dataDir, "meta.json"))).rejects.toThrow();
  });

  it("keeps the previous generation when promotion fails", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "democraft-data-"));
    const captureDir = await mkdtemp(join(tmpdir(), "democraft-capture-"));
    tempDirs.push(dataDir, captureDir);
    await writeFile(join(dataDir, "manifest.json"), "previous-manifest");
    await writeFile(join(dataDir, "timeline.json"), "previous-timeline");
    await writeFile(join(dataDir, "meta.json"), "previous-meta");

    await expect(
      materializeStudioData({
        dataDir,
        captureDir,
        manifest: manifestFixture(),
        timeline: timelineFixture(),
        afterBackupRenamed: async () => {
          throw new Error("promotion fault");
        },
      }),
    ).rejects.toThrow("promotion fault");
    await expect(
      readFile(join(dataDir, "manifest.json"), "utf8"),
    ).resolves.toBe("previous-manifest");
    await expect(
      readFile(join(dataDir, "timeline.json"), "utf8"),
    ).resolves.toBe("previous-timeline");
    await expect(readFile(join(dataDir, "meta.json"), "utf8")).resolves.toBe(
      "previous-meta",
    );
    expect(
      (await readdir(join(dataDir, ".."))).filter((name) =>
        name.startsWith(`.${basename(dataDir)}.generation-`),
      ),
    ).toEqual([]);
    expect(
      (await readdir(join(dataDir, ".."))).filter((name) =>
        name.startsWith(`${basename(dataDir)}.previous-`),
      ),
    ).toEqual([]);
  });
});

function metaFixture(): StudioMeta {
  return {
    demoPath: "/workspace/demo.ts",
    captureDir: "/workspace/.democraft/runs/demo",
    workspaceRoot: "/workspace",
    demoId: "demo",
    capturedAt: 1,
  };
}

function manifestFixture(): RecordedDemoManifest {
  return {
    schemaVersion,
    demoId: "demo",
    steps: [],
    diagnostics: [],
  };
}

function timelineFixture(): RenderTimeline {
  return {
    schemaVersion,
    demoId: "demo",
    fps: 60,
    durationInFrames: 0,
    scenes: [],
    camera: [],
    cursor: [],
    overlays: [],
  };
}
