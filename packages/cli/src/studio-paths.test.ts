import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  schemaVersion,
  type RecordedDemoManifest,
  type RenderTimeline,
} from "@democraft/schema";
import { afterEach, describe, expect, it } from "vitest";
import {
  materializeStudioData,
  prepareManagedStudioDirectory,
  studioServerEnvironment,
} from "./studio";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("CLI Studio path boundaries", () => {
  it("rejects a managed directory symlink outside the workspace", async () => {
    const workspace = await mkdtemp(
      path.join(tmpdir(), "democraft-workspace-"),
    );
    const outside = await mkdtemp(path.join(tmpdir(), "democraft-outside-"));
    roots.push(workspace, outside);
    await mkdir(path.join(workspace, ".democraft"));
    await symlink(outside, path.join(workspace, ".democraft", "runs"));

    await expect(
      prepareManagedStudioDirectory(
        path.join(workspace, ".democraft"),
        path.join(workspace, ".democraft", "runs"),
        "Managed capture directory",
      ),
    ).rejects.toThrow(/escapes its output directory/);
  });

  it("passes canonical launch authority through process-owned environment", () => {
    const env = studioServerEnvironment(
      {
        dataDir: "/workspace/.democraft/studio-data",
        workspaceRoot: "/workspace",
        demoPath: "/external/demo.ts",
        explicitCaptureDir: "/captures/exact",
        captureHeadless: true,
        captureEnvironmentHash: `capture-env-v1:sha256:${"a".repeat(64)}`,
      },
      "secret",
    );

    expect(env).toMatchObject({
      DEMOCRAFT_STUDIO_DATA: "/workspace/.democraft/studio-data",
      DEMOCRAFT_STUDIO_WORKSPACE_ROOT: "/workspace",
      DEMOCRAFT_STUDIO_DEMO_PATH: "/external/demo.ts",
      DEMOCRAFT_STUDIO_EXPLICIT_CAPTURE_DIR: "/captures/exact",
      DEMOCRAFT_STUDIO_CAPTURE_HEADLESS: "true",
      DEMOCRAFT_STUDIO_CAPTURE_ENVIRONMENT_HASH: `capture-env-v1:sha256:${"a".repeat(64)}`,
      DEMOCRAFT_STUDIO_SESSION_TOKEN: "secret",
    });
  });

  it("rejects a screenshot symlink outside the capture directory", async () => {
    const { captureDir, dataDir, root } = await fixture();
    const outside = path.join(root, "outside.png");
    await writeFile(outside, "outside");
    await symlink(outside, path.join(captureDir, "screenshots", "linked.png"));
    const manifest = manifestFixture();
    manifest.steps.push({
      stepId: "step-1",
      sceneId: "scene-1",
      kind: "browser.goto",
      startedAtMs: 0,
      endedAtMs: 1,
      screenshotPath: "screenshots/linked.png",
    });

    await expect(
      materializeStudioData({
        dataDir,
        captureDir,
        manifest,
        timeline: timelineFixture(),
      }),
    ).rejects.toThrow(/Screenshot for step step-1 escapes/);
  });

  it("rejects an absolute recording path outside the capture directory", async () => {
    const { captureDir, dataDir, root } = await fixture();
    const outside = path.join(root, "outside.webm");
    await writeFile(outside, "outside");
    const manifest = manifestFixture();
    manifest.recording = { path: outside, width: 100, height: 100 };

    await expect(
      materializeStudioData({
        dataDir,
        captureDir,
        manifest,
        timeline: timelineFixture(),
      }),
    ).rejects.toThrow(/Capture recording escapes/);
  });

  it("replaces an old destination symlink without touching its target", async () => {
    const { captureDir, dataDir, root } = await fixture();
    const source = path.join(captureDir, "source.webm");
    const outside = path.join(root, "outside-target.webm");
    await Promise.all([
      writeFile(source, "recording"),
      writeFile(outside, "OUTSIDE_UNCHANGED"),
    ]);
    await symlink(outside, path.join(dataDir, "recording.webm"));
    const manifest = manifestFixture();
    manifest.recording = { path: source, width: 100, height: 100 };

    await materializeStudioData({
      dataDir,
      captureDir,
      manifest,
      timeline: timelineFixture(),
    });
    await expect(readFile(outside, "utf8")).resolves.toBe("OUTSIDE_UNCHANGED");
    await expect(
      readFile(path.join(dataDir, "recording.webm"), "utf8"),
    ).resolves.toBe("recording");
  });

  it("restores the complete previous generation when promotion fails", async () => {
    const { captureDir, dataDir } = await fixture();
    await Promise.all([
      writeFile(path.join(dataDir, "manifest.json"), "previous-manifest"),
      writeFile(path.join(dataDir, "timeline.json"), "previous-timeline"),
      writeFile(path.join(dataDir, "meta.json"), "previous-meta"),
    ]);

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
      readFile(path.join(dataDir, "manifest.json"), "utf8"),
    ).resolves.toBe("previous-manifest");
    await expect(
      readFile(path.join(dataDir, "timeline.json"), "utf8"),
    ).resolves.toBe("previous-timeline");
    await expect(
      readFile(path.join(dataDir, "meta.json"), "utf8"),
    ).resolves.toBe("previous-meta");
  });
});

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "democraft-cli-studio-"));
  roots.push(root);
  const captureDir = path.join(root, "capture");
  const dataDir = path.join(root, "studio-data");
  await Promise.all([
    mkdir(path.join(captureDir, "screenshots"), { recursive: true }),
    mkdir(dataDir),
  ]);
  return { captureDir, dataDir, root };
}

function manifestFixture(): RecordedDemoManifest {
  return { schemaVersion, demoId: "demo", steps: [], diagnostics: [] };
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
