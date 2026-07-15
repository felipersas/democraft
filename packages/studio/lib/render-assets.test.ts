import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { schemaVersion, type RecordedDemoManifest } from "@democraft/schema";
import { afterEach, describe, expect, it } from "vitest";
import { loadScreenshotDataUris } from "./render-assets";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

describe("render screenshot loading", () => {
  it("rejects a screenshot symlink that escapes studio data", async () => {
    const base = await mkdtemp(path.join(tmpdir(), "democraft-render-assets-"));
    tempDirs.push(base);
    const dataDir = path.join(base, "studio-data");
    const outside = path.join(base, "outside.png");
    await mkdir(path.join(dataDir, "screenshots"), { recursive: true });
    await writeFile(outside, "not-a-settled-screenshot");
    await symlink(outside, path.join(dataDir, "screenshots", "linked.png"));
    const manifest: RecordedDemoManifest = {
      schemaVersion,
      demoId: "demo",
      diagnostics: [],
      steps: [
        {
          stepId: "step-1",
          sceneId: "scene-1",
          kind: "browser.goto",
          startedAtMs: 0,
          endedAtMs: 1,
          screenshotPath: "screenshots/linked.png",
        },
      ],
    };

    await expect(loadScreenshotDataUris(manifest, dataDir)).rejects.toThrow(
      /Render screenshot for step step-1 escapes its allowed root/,
    );
  });
});
