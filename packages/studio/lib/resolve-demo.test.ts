import {
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
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
  delete process.env.DEMOCRAFT_STUDIO_DATA;
  delete process.env.DEMOCRAFT_STUDIO_WORKSPACE_ROOT;
  delete process.env.DEMOCRAFT_STUDIO_DEMO_PATH;
  delete process.env.DEMOCRAFT_STUDIO_CAPTURE_ENVIRONMENT_HASH;
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

  it("uses definition fps unless the launch options override it", async () => {
    const fixture = await createCapturedFixture();
    await writeDemo(fixture.meta.demoPath, { fps: 24 });

    const configured = await reResolveTimeline({
      meta: fixture.meta,
      dataDir: fixture.dataDir,
    });
    const overridden = await reResolveTimeline({
      meta: fixture.meta,
      dataDir: fixture.dataDir,
      fps: 30,
    });

    expect(configured).toMatchObject({
      structural: false,
      timeline: { fps: 24 },
    });
    expect(overridden).toMatchObject({
      structural: false,
      timeline: { fps: 30 },
    });
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

  it("ignores mutable metadata paths and imports the launch-authorized demo", async () => {
    const fixture = await createCapturedFixture();
    fixture.meta.demoPath = "/tmp/untrusted-demo.mjs";
    fixture.meta.workspaceRoot = "/tmp";

    const result = await reResolveTimeline({
      meta: fixture.meta,
      dataDir: fixture.dataDir,
    });

    expect(result).toMatchObject({ structural: false });
  });

  it("rejects a timeline write redirected through an escaping symlink", async () => {
    const fixture = await createCapturedFixture();
    const outsideDir = await mkdtemp(
      join(tmpdir(), "democraft-timeline-outside-"),
    );
    tempDirs.push(outsideDir);
    const outside = join(outsideDir, "timeline.json");
    await writeFile(outside, "outside");
    await rm(fixture.timelinePath);
    await symlink(outside, fixture.timelinePath);

    await expect(
      reResolveTimeline({ meta: fixture.meta, dataDir: fixture.dataDir }),
    ).rejects.toThrow(/Studio timeline escapes its allowed root/);
    await expect(readFile(outside, "utf8")).resolves.toBe("outside");
  });
});

async function createCapturedFixture() {
  const dataDir = await mkdtemp(join(tmpdir(), "democraft-resolve-"));
  tempDirs.push(dataDir);
  const demoPath = join(dataDir, "demo.mjs");
  await writeDemo(demoPath, {});
  process.env.DEMOCRAFT_STUDIO_DATA = await realpath(dataDir);
  process.env.DEMOCRAFT_STUDIO_WORKSPACE_ROOT = await realpath(dataDir);
  process.env.DEMOCRAFT_STUDIO_DEMO_PATH = await realpath(demoPath);
  process.env.DEMOCRAFT_STUDIO_CAPTURE_ENVIRONMENT_HASH = `capture-env-v1:sha256:${"e".repeat(64)}`;
  const compilation = await compileDemo(
    await loadDemo(demoPath, { version: "baseline" }),
  );
  const manifest: RecordedDemoManifest = {
    schemaVersion,
    demoId: compilation.ir.id,
    definitionHash: compilation.ir.definitionHash,
    captureHash: compilation.ir.captureHash,
    captureEnvironmentHash:
      process.env.DEMOCRAFT_STUDIO_CAPTURE_ENVIRONMENT_HASH,
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
  options: { title?: string; path?: string; invalid?: boolean; fps?: number },
): Promise<void> {
  await writeFile(
    demoPath,
    `export default {
  id: "demo",
  title: ${JSON.stringify(options.title ?? "Demo")},
  ${options.fps === undefined ? "" : `config: {fps: ${options.fps}},`}
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
