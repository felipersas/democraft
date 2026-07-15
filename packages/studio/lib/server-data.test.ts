import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadStudioData } from "./server-data";

const directories: string[] = [];
const previousDataDir = process.env.DEMOCRAFT_STUDIO_DATA;

afterEach(async () => {
  if (previousDataDir === undefined) delete process.env.DEMOCRAFT_STUDIO_DATA;
  else process.env.DEMOCRAFT_STUDIO_DATA = previousDataDir;
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("Studio artifact loading", () => {
  it("rejects malformed persisted data instead of exposing it to preview", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "democraft-studio-"));
    directories.push(directory);
    process.env.DEMOCRAFT_STUDIO_DATA = directory;
    await Promise.all([
      writeFile(
        path.join(directory, "manifest.json"),
        JSON.stringify({
          schemaVersion: "1",
          demoId: "demo",
          steps: "not-an-array",
          diagnostics: [],
        }),
      ),
      writeFile(
        path.join(directory, "timeline.json"),
        JSON.stringify({
          schemaVersion: "1",
          demoId: "demo",
          fps: 60,
          durationInFrames: 0,
          scenes: [],
          camera: [],
          cursor: [],
          overlays: [],
        }),
      ),
    ]);

    await expect(loadStudioData()).rejects.toMatchObject({
      kind: "recorded demo manifest",
      issues: [expect.objectContaining({ path: "$.steps" })],
    });
  });
});
