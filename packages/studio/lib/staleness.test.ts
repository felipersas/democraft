import { mkdtemp, realpath, rm, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { compileDemo } from "@democraft/compiler";
import type {
  DemoIR,
  RecordedDemoManifest,
  StudioMeta,
} from "@democraft/schema";
import { schemaVersion } from "@democraft/schema";
import { afterEach, describe, expect, it } from "vitest";
import { computeStaleness, loadDemo } from "./staleness";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
  delete process.env.DEMOCRAFT_STUDIO_DATA;
  delete process.env.DEMOCRAFT_STUDIO_WORKSPACE_ROOT;
  delete process.env.DEMOCRAFT_STUDIO_DEMO_PATH;
});

describe("studio staleness", () => {
  it("reloads an edited ESM demo using an explicit version", async () => {
    const fixture = await createFixture();
    await writeDemo(fixture.demoPath, { title: "First" });
    await authorizeDemo(fixture.demoPath);
    const first = await loadDemo(fixture.demoPath, { version: "first" });

    await writeDemo(fixture.demoPath, { title: "Second" });
    const second = await loadDemo(fixture.demoPath, { version: "second" });

    expect(first.title).toBe("First");
    expect(second.title).toBe("Second");
  });

  it("reloads an edited ESM demo when its mtime changes", async () => {
    const fixture = await createFixture();
    await writeDemo(fixture.demoPath, { title: "First" });
    await authorizeDemo(fixture.demoPath);
    const first = await loadDemo(fixture.demoPath);

    await writeDemo(fixture.demoPath, { title: "Other" });
    const future = new Date(Date.now() + 2_000);
    await utimes(fixture.demoPath, future, future);
    const second = await loadDemo(fixture.demoPath);

    expect(first.title).toBe("First");
    expect(second.title).toBe("Other");
  });

  it("classifies presentation-only changes as safely re-resolvable", async () => {
    const fixture = await capturedFixture();
    await writeDemo(fixture.demoPath, { title: "Presentation changed" });

    await expect(staleness(fixture)).resolves.toMatchObject({
      kind: "content",
      detail: expect.stringContaining("Presentation-only"),
    });
  });

  it("requires recapture for capture-affecting changes", async () => {
    const fixture = await capturedFixture();
    await writeDemo(fixture.demoPath, { path: "/changed" });

    await expect(staleness(fixture)).resolves.toMatchObject({
      kind: "structural",
      detail: expect.stringContaining("capture-affecting"),
    });
  });

  it("treats a legacy capture without captureHash as unknown", async () => {
    const fixture = await capturedFixture();
    await writeManifest(fixture, {
      ...fixture.manifest,
      captureHash: undefined,
    });

    await expect(staleness(fixture)).resolves.toMatchObject({
      kind: "structural",
      detail: expect.stringContaining("predates compatibility hashes"),
    });
  });

  it("reports compiler diagnostics instead of a stale decision", async () => {
    const fixture = await capturedFixture();
    await writeDemo(fixture.demoPath, { invalid: true });

    await expect(staleness(fixture)).resolves.toMatchObject({
      kind: "failed",
      detail: expect.stringContaining("Unknown target"),
    });
  });
});

type Fixture = {
  dataDir: string;
  demoPath: string;
  manifest: RecordedDemoManifest;
  meta: StudioMeta;
};

async function createFixture(): Promise<{
  dataDir: string;
  demoPath: string;
}> {
  const dataDir = await mkdtemp(join(tmpdir(), "democraft-staleness-"));
  tempDirs.push(dataDir);
  const canonical = await realpath(dataDir);
  process.env.DEMOCRAFT_STUDIO_DATA = canonical;
  process.env.DEMOCRAFT_STUDIO_WORKSPACE_ROOT = canonical;
  return { dataDir, demoPath: join(dataDir, "demo.mjs") };
}

async function capturedFixture(): Promise<Fixture> {
  const fixture = await createFixture();
  await writeDemo(fixture.demoPath, {});
  await authorizeDemo(fixture.demoPath);
  const definition = await loadDemo(fixture.demoPath, { version: "baseline" });
  const compilation = await compileDemo(definition);
  const manifest = manifestFor(compilation.ir);
  const meta: StudioMeta = {
    demoPath: fixture.demoPath,
    captureDir: fixture.dataDir,
    workspaceRoot: fixture.dataDir,
    demoId: compilation.ir.id,
    capturedAt: Date.now(),
  };
  const result = { ...fixture, manifest, meta };
  await writeManifest(result, manifest);
  return result;
}

async function authorizeDemo(demoPath: string): Promise<void> {
  process.env.DEMOCRAFT_STUDIO_DEMO_PATH = await realpath(demoPath);
}

function staleness(fixture: Fixture) {
  return computeStaleness({
    meta: fixture.meta,
    manifest: fixture.manifest,
    dataDir: fixture.dataDir,
  });
}

async function writeManifest(
  fixture: Fixture,
  manifest: RecordedDemoManifest,
): Promise<void> {
  await writeFile(
    join(fixture.dataDir, "manifest.json"),
    JSON.stringify(manifest),
  );
  fixture.manifest = manifest;
}

function manifestFor(ir: DemoIR): RecordedDemoManifest {
  return {
    schemaVersion,
    demoId: ir.id,
    definitionHash: ir.definitionHash,
    captureHash: ir.captureHash,
    steps: [],
    diagnostics: [],
  };
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
