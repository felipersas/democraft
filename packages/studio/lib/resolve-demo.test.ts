import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { compileDemo } from "@democraft/compiler";
import type { RecordedDemoManifest, StudioMeta } from "@democraft/schema";
import { schemaVersion } from "@democraft/schema";
import { afterEach, describe, expect, it } from "vitest";
import { reResolveTimeline } from "./resolve-demo";
import { loadDemo } from "./staleness";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

describe("studio timeline re-resolution", () => {
  it("rewrites the timeline for presentation-only changes", async () => {
    const fixture = await createCapturedFixture();
    await writeDemo(fixture.meta.demoPath, { title: "New title" });

    const result = await reResolveTimeline({
      meta: fixture.meta,
      dataDir: fixture.dataDir,
    });

    expect(result).toMatchObject({ structural: false });
    if (!result || result.structural) throw new Error("Expected a timeline");
    expect(result.timeline.captureHash).toBe(fixture.manifest.captureHash);
    expect(result.timeline.definitionHash).not.toBe(
      fixture.manifest.definitionHash,
    );
    expect(
      JSON.parse(await readFile(fixture.timelinePath, "utf8")),
    ).toMatchObject({ definitionHash: result.timeline.definitionHash });
  });

  it("does not rewrite the timeline for incompatible capture changes", async () => {
    const fixture = await createCapturedFixture();
    await writeDemo(fixture.meta.demoPath, { path: "/changed" });

    const result = await reResolveTimeline({
      meta: fixture.meta,
      dataDir: fixture.dataDir,
    });

    expect(result).toMatchObject({ structural: true });
    expect(await readFile(fixture.timelinePath, "utf8")).toBe(
      fixture.originalTimeline,
    );
  });

  it("does not rewrite a legacy capture with unknown compatibility", async () => {
    const fixture = await createCapturedFixture();
    fixture.manifest.captureHash = undefined;
    await writeFile(
      join(fixture.dataDir, "manifest.json"),
      JSON.stringify(fixture.manifest),
    );

    const result = await reResolveTimeline({
      meta: fixture.meta,
      dataDir: fixture.dataDir,
    });

    expect(result).toMatchObject({
      structural: true,
      detail: expect.stringContaining("predates compatibility hashes"),
    });
    expect(await readFile(fixture.timelinePath, "utf8")).toBe(
      fixture.originalTimeline,
    );
  });

  it("does not write a timeline when compilation has errors", async () => {
    const fixture = await createCapturedFixture();
    await writeDemo(fixture.meta.demoPath, { invalid: true });

    await expect(
      reResolveTimeline({ meta: fixture.meta, dataDir: fixture.dataDir }),
    ).rejects.toThrow("Cannot re-resolve an invalid demo");
    expect(await readFile(fixture.timelinePath, "utf8")).toBe(
      fixture.originalTimeline,
    );
  });
});

async function createCapturedFixture() {
  const dataDir = await mkdtemp(join(tmpdir(), "democraft-resolve-"));
  tempDirs.push(dataDir);
  const demoPath = join(dataDir, "demo.mjs");
  await writeDemo(demoPath, {});
  const compilation = await compileDemo(
    await loadDemo(demoPath, { version: "baseline" }),
  );
  const manifest: RecordedDemoManifest = {
    schemaVersion,
    demoId: compilation.ir.id,
    definitionHash: compilation.ir.definitionHash,
    captureHash: compilation.ir.captureHash,
    steps: [],
    diagnostics: [],
  };
  const meta: StudioMeta = {
    demoPath,
    captureDir: dataDir,
    workspaceRoot: dataDir,
    demoId: compilation.ir.id,
    capturedAt: Date.now(),
  };
  const timelinePath = join(dataDir, "timeline.json");
  const originalTimeline = '{"sentinel":true}\n';
  await Promise.all([
    writeFile(join(dataDir, "manifest.json"), JSON.stringify(manifest)),
    writeFile(timelinePath, originalTimeline),
  ]);
  return { dataDir, manifest, meta, originalTimeline, timelinePath };
}

async function writeDemo(
  demoPath: string,
  options: { title?: string; path?: string; invalid?: boolean },
): Promise<void> {
  await writeFile(
    demoPath,
    `export default {
  id: "demo",
  title: ${JSON.stringify(options.title ?? "Demo")},
  source: {baseUrl: "http://localhost:3000"},
  targets: {button: {id: "button", locators: [{kind: "testId", id: "button"}]}},
  async run({demo}) {
    await demo.scene("intro", async (scene) => {
      await scene.goto(${JSON.stringify(options.path ?? "/dashboard")});
      ${options.invalid ? 'await scene.click("missing");' : ""}
    });
  }
};\n`,
  );
}
