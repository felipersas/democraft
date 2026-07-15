import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRenderArtifact } from "@democraft/remotion/server";
import { parseRenderArtifactMetadataJson } from "@democraft/schema";
import { afterEach, describe, expect, it } from "vitest";
import { runRenderArtifactLifecycle } from "./render-lifecycle";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

describe("studio render artifact lifecycle", () => {
  it("records asset preparation failures as terminal metadata", async () => {
    const artifact = await createArtifact();

    await expect(
      runRenderArtifactLifecycle({
        artifact,
        prepare: async () => {
          throw new Error("screenshot asset is unreadable");
        },
        render: async () => undefined,
        isCancelled: () => false,
      }),
    ).rejects.toThrow("screenshot asset is unreadable");

    await expect(readMetadata(artifact.metadataPath)).resolves.toMatchObject({
      status: "failed",
      error: { message: "screenshot asset is unreadable" },
    });
  });

  it("records cancellation during preparation as cancelled", async () => {
    const artifact = await createArtifact();

    await expect(
      runRenderArtifactLifecycle({
        artifact,
        prepare: async () => {
          throw new Error("cancelled while preparing entry");
        },
        render: async () => undefined,
        isCancelled: () => true,
      }),
    ).rejects.toThrow("cancelled while preparing entry");

    await expect(readMetadata(artifact.metadataPath)).resolves.toMatchObject({
      status: "cancelled",
    });
  });
});

async function createArtifact() {
  const rootDirectory = await mkdtemp(join(tmpdir(), "democraft-lifecycle-"));
  tempDirs.push(rootDirectory);
  return createRenderArtifact({
    rootDirectory,
    demoId: "demo",
    render: {
      fps: 60,
      durationInFrames: 60,
      mediaMode: "screenshots",
    },
  });
}

async function readMetadata(metadataPath: string) {
  return parseRenderArtifactMetadataJson(await readFile(metadataPath, "utf8"));
}
