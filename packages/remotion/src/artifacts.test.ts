import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { parseRenderArtifactMetadataJson } from "@democraft/schema";
import {
  cancelRenderArtifact,
  completeRenderArtifact,
  createRenderArtifact,
  failRenderArtifact,
  renderSlug,
} from "./artifacts";

const roots: string[] = [];
const fixedDate = new Date("2026-07-14T18:42:10.123Z");

afterEach(async () => {
  await Promise.all(
    roots.map((root) => rm(root, { recursive: true, force: true })),
  );
  roots.length = 0;
});

describe("render artifacts", () => {
  it("creates isolated directories even in the same millisecond", async () => {
    const parent = await temporaryRoot();
    const root = join(parent, "renders");
    const ids = ["a1b2c3d4", "e5f6a7b8"];
    const dependencies = {
      now: () => fixedDate,
      shortId: () => ids.shift()!,
    };

    const first = await createRenderArtifact(baseOptions(root), dependencies);
    const second = await createRenderArtifact(baseOptions(root), dependencies);

    expect(first.directory).not.toBe(second.directory);
    expect(first.metadata.renderId).toBe(
      "checkout-2026-07-14T18-42-10-123Z-a1b2c3d4",
    );
    expect(second.metadata.status).toBe("rendering");
    expect(second.metadata.definitionHash).toBe(
      `definition-v1:sha256:${"a".repeat(64)}`,
    );
    expect(second.metadata.captureHash).toBe(
      `capture-v1:sha256:${"b".repeat(64)}`,
    );
    await expect(access(first.metadataPath)).resolves.toBeUndefined();
  });

  it("retries a directory collision", async () => {
    const root = await temporaryRoot();
    const ids = ["duplicate", "duplicate", "unique"];
    const dependencies = {
      now: () => fixedDate,
      shortId: () => ids.shift()!,
    };

    await createRenderArtifact(baseOptions(root), dependencies);
    const artifact = await createRenderArtifact(
      baseOptions(root),
      dependencies,
    );

    expect(artifact.metadata.renderId).toContain("-unique");
  });

  it("promotes the video and completes metadata", async () => {
    const root = await temporaryRoot();
    const artifact = await createRenderArtifact(baseOptions(root));
    await writeFile(artifact.temporaryOutputFile, "video");

    await completeRenderArtifact(
      artifact,
      new Date("2026-07-14T18:43:00.000Z"),
    );

    expect(await readFile(artifact.outputFile, "utf8")).toBe("video");
    expect(
      parseRenderArtifactMetadataJson(
        await readFile(artifact.metadataPath, "utf8"),
      ),
    ).toMatchObject({
      status: "completed",
      finishedAt: "2026-07-14T18:43:00.000Z",
      output: { video: "video.mp4" },
    });
  });

  it("persists a failure without promoting a final video", async () => {
    const root = await temporaryRoot();
    const artifact = await createRenderArtifact(baseOptions(root));
    await writeFile(artifact.temporaryOutputFile, "partial");

    await failRenderArtifact(artifact, new Error("encoder exited"));

    const metadata = parseRenderArtifactMetadataJson(
      await readFile(artifact.metadataPath, "utf8"),
    );
    expect(metadata).toMatchObject({
      status: "failed",
      error: { message: "encoder exited" },
    });
    await expect(readFile(artifact.outputFile)).rejects.toThrow();
    await expect(readFile(artifact.temporaryOutputFile)).rejects.toThrow();
  });

  it("persists cancellation without an error payload", async () => {
    const root = await temporaryRoot();
    const artifact = await createRenderArtifact(baseOptions(root));

    await cancelRenderArtifact(artifact);

    const metadata = parseRenderArtifactMetadataJson(
      await readFile(artifact.metadataPath, "utf8"),
    );
    expect(metadata.status).toBe("cancelled");
    expect(metadata.error).toBeUndefined();
  });

  it("contains hostile and empty demo ids", () => {
    expect(renderSlug("../Á Demo / Checkout")).toBe("a-demo-checkout");
    expect(renderSlug("💥")).toBe("demo");
  });

  it("refuses to write metadata outside the public runtime contract", async () => {
    const parent = await temporaryRoot();
    const root = join(parent, "renders");

    await expect(
      createRenderArtifact({
        ...baseOptions(root),
        render: {
          ...baseOptions(root).render,
          crf: 52,
          frameRange: [100, 130],
        },
      }),
    ).rejects.toMatchObject({ kind: "render artifact metadata" });
    await expect(access(root)).rejects.toThrow();
  });
});

function baseOptions(rootDirectory: string) {
  return {
    rootDirectory,
    demoId: "checkout",
    definitionHash: `definition-v1:sha256:${"a".repeat(64)}`,
    captureHash: `capture-v1:sha256:${"b".repeat(64)}`,
    render: {
      fps: 60,
      durationInFrames: 120,
      mediaMode: "screenshots" as const,
    },
  };
}

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "democraft-artifacts-"));
  roots.push(root);
  return root;
}
