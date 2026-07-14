import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { formatDiagnostics, parseArgs, runCli } from "./index";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

describe("cli", () => {
  it("parses command flags", () => {
    expect(
      parseArgs([
        "capture",
        "./demo.js",
        "--json",
        "--output-dir",
        "out",
        "--headed",
      ]),
    ).toEqual({
      command: "capture",
      demoPath: "./demo.js",
      json: true,
      staticOnly: false,
      outputDir: "out",
      headless: false,
    });
  });

  it("formats empty diagnostics", () => {
    expect(formatDiagnostics([])).toBe("No diagnostics.");
  });

  it("inspects a demo module", async () => {
    const demoPath = await writeDemoFixture();

    const result = await runCli(["inspect", demoPath]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("DEMO");
    expect(result.stdout).toContain('1. Go to "/dashboard"');
  });

  it("validates a demo module as json", async () => {
    const demoPath = await writeDemoFixture();

    const result = await runCli(["validate", demoPath, "--static", "--json"]);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([]);
  });

  it("lists target contracts as json", async () => {
    const demoPath = await writeDemoFixture();

    const result = await runCli(["targets", demoPath, "--json"]);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      demoId: "demo",
      targets: [
        {
          id: "dashboard",
          locators: [{ kind: "testId", id: "dashboard" }],
        },
      ],
    });
  });

  it("requires static validation mode", async () => {
    const demoPath = await writeDemoFixture();

    const result = await runCli(["validate", demoPath]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--static");
  });

  it("resolves a timeline from a manifest", async () => {
    const demoPath = await writeDemoFixture();
    const manifestPath = await writeManifestFixture();

    const result = await runCli([
      "timeline",
      demoPath,
      "--manifest",
      manifestPath,
      "--fps",
      "30",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("demo @ 30fps");
    expect(result.stdout).toContain("Scene: intro");
  });

  it("writes timeline json to an output file", async () => {
    const demoPath = await writeDemoFixture();
    const manifestPath = await writeManifestFixture();
    const dir = await mkdtemp(join(tmpdir(), "democraft-cli-"));
    tempDirs.push(dir);
    const outputFile = join(dir, "timeline.json");

    const result = await runCli([
      "timeline",
      demoPath,
      "--manifest",
      manifestPath,
      "--output-file",
      outputFile,
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Timeline written");
    expect(JSON.parse(await readFile(outputFile, "utf8"))).toMatchObject({
      demoId: "demo",
      fps: 60,
    });
  });

  it("writes a preview html file", async () => {
    const manifestPath = await writeManifestFixture();
    const timelinePath = await writeTimelineFixture();
    const dir = await mkdtemp(join(tmpdir(), "democraft-cli-"));
    tempDirs.push(dir);
    const outputFile = join(dir, "preview.html");

    const result = await runCli([
      "preview",
      "--manifest",
      manifestPath,
      "--timeline",
      timelinePath,
      "--output-file",
      outputFile,
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Preview written");
    const html = await readFile(outputFile, "utf8");
    expect(html).toContain("Resolved Preview");
    expect(html).toContain("<video");
    expect(html).toContain(
      "screenshots/intro-intro.browser-goto-dashboard.1.png",
    );
  });

  it("requires render inputs", async () => {
    const result = await runCli(["render"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Missing render inputs");
  });
});

async function writeDemoFixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "democraft-cli-"));
  tempDirs.push(dir);
  const demoPath = join(dir, "demo.mjs");

  const coreModule = resolve(
    process.cwd(),
    "../../packages/core/dist/index.js",
  );

  await writeFile(
    demoPath,
    `
import {defineDemo, defineTargets, byTestId} from "${coreModule}";

const targets = defineTargets({
  dashboard: byTestId("dashboard")
});

export default defineDemo({
  id: "demo",
  title: "Demo",
  source: {baseUrl: "http://localhost:3000"},
  targets,
  async run({demo}) {
    await demo.scene("intro", async (scene) => {
      await scene.goto("/dashboard");
      await scene.expectVisible("dashboard");
    });
  }
});
`,
  );

  return demoPath;
}

async function writeManifestFixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "democraft-cli-"));
  tempDirs.push(dir);
  const manifestPath = join(dir, "manifest.json");

  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        schemaVersion: "1",
        demoId: "demo",
        recording: {
          path: "/tmp/demo.webm",
          width: 1440,
          height: 900,
        },
        steps: [
          {
            stepId: "intro.browser-goto-dashboard.1",
            sceneId: "intro",
            kind: "browser.goto",
            startedAtMs: 0,
            endedAtMs: 700,
          },
          {
            stepId: "intro.assert-visible-dashboard.2",
            sceneId: "intro",
            kind: "assert.visible",
            startedAtMs: 700,
            endedAtMs: 710,
            targetSnapshot: {
              targetId: "dashboard",
              attemptedLocators: [
                {
                  locator: { kind: "testId", id: "dashboard" },
                  success: true,
                },
              ],
              successfulLocator: { kind: "testId", id: "dashboard" },
              boundingBox: { x: 0, y: 0, width: 100, height: 100 },
              visible: true,
              resolutionDurationMs: 1,
            },
          },
        ],
        diagnostics: [],
      },
      null,
      2,
    ),
  );

  return manifestPath;
}

async function writeTimelineFixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "democraft-cli-"));
  tempDirs.push(dir);
  const timelinePath = join(dir, "timeline.json");

  await writeFile(
    timelinePath,
    JSON.stringify(
      {
        schemaVersion: "1",
        demoId: "demo",
        fps: 60,
        durationInFrames: 60,
        scenes: [
          {
            id: "intro",
            fromFrame: 0,
            durationInFrames: 60,
            steps: [
              {
                stepId: "intro.browser-goto-dashboard.1",
                sceneId: "intro",
                kind: "browser.goto",
                fromFrame: 0,
                durationInFrames: 42,
              },
            ],
          },
        ],
        camera: [],
        cursor: [],
        overlays: [],
      },
      null,
      2,
    ),
  );

  return timelinePath;
}
