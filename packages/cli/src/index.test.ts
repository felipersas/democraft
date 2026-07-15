import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { renderDemoVideo } from "@democraft/remotion";
import { runDemo } from "@democraft/playwright";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatDiagnostics, parseArgs, runCli } from "./index";
import {
  captureActionForCompatibility,
  studioDevServerArgs,
  studioUrl,
} from "./studio";

vi.mock("@democraft/remotion", async () => {
  const actual = await vi.importActual<typeof import("@democraft/remotion")>(
    "@democraft/remotion",
  );
  return { ...actual, renderDemoVideo: vi.fn() };
});

vi.mock("@democraft/playwright", async () => {
  const actual = await vi.importActual<typeof import("@democraft/playwright")>(
    "@democraft/playwright",
  );
  return { ...actual, runDemo: vi.fn() };
});

const tempDirs: string[] = [];
const DEFINITION_HASH = `definition-v1:sha256:${"a".repeat(64)}`;
const TIMELINE_DEFINITION_HASH = `definition-v1:sha256:${"b".repeat(64)}`;
const CAPTURE_HASH = `capture-v1:sha256:${"c".repeat(64)}`;
const OTHER_CAPTURE_HASH = `capture-v1:sha256:${"d".repeat(64)}`;

beforeEach(() => {
  vi.mocked(renderDemoVideo).mockImplementation(async ({ outputFile }) => {
    await writeFile(outputFile, "video");
  });
  vi.mocked(runDemo).mockImplementation(async (ir, options) => {
    const outputDir =
      options?.outputDir ?? "/workspace/.democraft/runs/demo/run";
    await options?.onArtifactCreated?.({
      captureRunId: "demo-2026-07-15-abcdef",
      outputDir,
      manifestPath: join(outputDir, "manifest.json"),
      metadataPath: join(outputDir, "metadata.json"),
    });
    return {
      schemaVersion: "1",
      demoId: ir.id,
      captureRunId: "demo-2026-07-15-abcdef",
      definitionHash: ir.definitionHash,
      captureHash: ir.captureHash,
      steps: [],
      diagnostics: [],
    };
  });
});

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
  vi.mocked(renderDemoVideo).mockReset();
  vi.mocked(runDemo).mockReset();
});

describe("cli", () => {
  it("builds the Studio command and loopback URL without exposing secrets", () => {
    expect(studioDevServerArgs(4310)).toEqual([
      "--filter",
      "@democraft/studio",
      "dev",
      "--port",
      "4310",
    ]);
    expect(studioUrl(4310)).toBe("http://127.0.0.1:4310");
    expect(studioUrl(4310)).not.toContain("token");
  });

  it("reuses only captures with known-compatible identity", () => {
    expect(captureActionForCompatibility("compatible")).toBe("reuse");
    expect(captureActionForCompatibility("unknown")).toBe("capture");
    expect(captureActionForCompatibility("incompatible")).toBe("capture");
    expect(() => captureActionForCompatibility("unknown", true)).toThrow(
      "compatibility is unknown",
    );
    expect(() => captureActionForCompatibility("incompatible", true)).toThrow(
      "it is incompatible",
    );
  });

  it("parses command flags", () => {
    expect(
      parseArgs([
        "capture",
        "./demo.js",
        "--json",
        "--output-dir",
        "out",
        "--headed",
        "--recording",
      ]),
    ).toEqual({
      command: "capture",
      demoPath: "./demo.js",
      json: true,
      staticOnly: false,
      outputDir: "out",
      headless: false,
      useRecording: true,
    });
  });

  it("formats empty diagnostics", () => {
    expect(formatDiagnostics([])).toBe("No diagnostics.");
  });

  it("prints the managed capture run id and actual manifest path", async () => {
    const demoPath = await writeDemoFixture();

    const result = await runCli(["capture", demoPath]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Capture run ID: demo-2026-07-15-abcdef");
    expect(result.stdout).toContain(
      "Manifest: /workspace/.democraft/runs/demo/run/manifest.json",
    );
    expect(vi.mocked(runDemo)).toHaveBeenCalledWith(
      expect.objectContaining({ id: "demo" }),
      expect.objectContaining({ outputDir: undefined }),
    );
  });

  it("preserves an explicit capture output directory exactly", async () => {
    const demoPath = await writeDemoFixture();
    const parent = await mkdtemp(join(tmpdir(), "democraft-cli-capture-"));
    tempDirs.push(parent);
    const outputDir = join(parent, "exact");

    const result = await runCli([
      "capture",
      demoPath,
      "--output-dir",
      outputDir,
    ]);

    expect(result.stdout).toContain(`Manifest: ${outputDir}/manifest.json`);
    expect(vi.mocked(runDemo)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ outputDir }),
    );
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

  it.each([
    ["--fps", "NaN", "finite number greater than 0"],
    ["--scale", "0", "finite number greater than 0"],
    ["--crf", "52", "from 0 to 51"],
    ["--port", "1.5", "integer from 1 to 65535"],
  ])("rejects invalid numeric flag %s", async (flag, value, message) => {
    const demoPath = await writeDemoFixture();
    const result = await runCli(["inspect", demoPath, flag, value]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(`Invalid ${flag}`);
    expect(result.stderr).toContain(message);
  });

  it("resolves a timeline from a manifest", async () => {
    const demoPath = await writeDemoFixture();
    const manifestPath = await writeManifestFixture("/tmp/demo.webm", null);

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
    const manifestPath = await writeManifestFixture("/tmp/demo.webm", null);
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
    expect(html).not.toContain('src="file:///tmp/demo.webm"');
    expect(html).toContain(
      "screenshots/intro-intro.browser-goto-dashboard.1.png",
    );
  });

  it("rejects an invalid preview artifact before writing output", async () => {
    const manifestPath = await writeManifestFixture();
    const timelinePath = await writeTimelineFixture();
    const timeline = JSON.parse(await readFile(timelinePath, "utf8"));
    await writeFile(
      timelinePath,
      JSON.stringify({ ...timeline, durationInFrames: "sixty" }),
    );
    const dir = await mkdtemp(join(tmpdir(), "democraft-cli-"));
    tempDirs.push(dir);
    const outputFile = join(dir, "preview.html");

    await expect(
      runCli([
        "preview",
        "--manifest",
        manifestPath,
        "--timeline",
        timelinePath,
        "--output-file",
        outputFile,
      ]),
    ).rejects.toThrow("$.durationInFrames");
    await expect(readFile(outputFile)).rejects.toThrow();
  });

  it("rejects incompatible preview inputs before writing output", async () => {
    const manifestPath = await writeManifestFixture();
    const timelinePath = await writeTimelineFixture();
    const timeline = JSON.parse(await readFile(timelinePath, "utf8"));
    await writeFile(
      timelinePath,
      JSON.stringify({
        ...timeline,
        captureHash: OTHER_CAPTURE_HASH,
      }),
    );
    const dir = await mkdtemp(join(tmpdir(), "democraft-cli-"));
    tempDirs.push(dir);
    const outputFile = join(dir, "preview.html");

    await expect(
      runCli([
        "preview",
        "--manifest",
        manifestPath,
        "--timeline",
        timelinePath,
        "--output-file",
        outputFile,
      ]),
    ).rejects.toThrow("Capture artifact mismatch");
    await expect(readFile(outputFile)).rejects.toThrow();
  });

  it("uses the raw recording in preview only when requested", async () => {
    const dir = await mkdtemp(join(tmpdir(), "democraft-cli-"));
    tempDirs.push(dir);
    const recordingFile = join(dir, "recording.webm");
    await writeFile(recordingFile, "recording");
    const manifestPath = await writeManifestFixture(recordingFile);
    const timelinePath = await writeTimelineFixture();
    const outputFile = join(dir, "preview.html");

    const result = await runCli([
      "preview",
      "--manifest",
      manifestPath,
      "--timeline",
      timelinePath,
      "--output-file",
      outputFile,
      "--recording",
    ]);

    expect(result.exitCode).toBe(0);
    expect(await readFile(outputFile, "utf8")).toContain(
      `src="${pathToFileURL(recordingFile).href}"`,
    );
  });

  it("reports a clear error when recording mode has no source", async () => {
    const manifestPath = await writeManifestFixture(null);
    const timelinePath = await writeTimelineFixture();

    const result = await runCli([
      "preview",
      "--manifest",
      manifestPath,
      "--timeline",
      timelinePath,
      "--recording",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("manifest has no recording path");
  });

  it("renders settled screenshots by default", async () => {
    const manifestPath = await writeManifestFixture();
    const timelinePath = await writeTimelineFixture();

    const result = await withTemporaryInvocationRoot(() =>
      runCli([
        "render",
        "--manifest",
        manifestPath,
        "--timeline",
        timelinePath,
      ]),
    );

    expect(result.exitCode).toBe(0);
    expect(vi.mocked(renderDemoVideo)).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaMode: "screenshots",
        recordingFile: undefined,
      }),
    );
    expect(result.stdout).toContain("Render ID:");
    const [{ outputFile }] = vi.mocked(renderDemoVideo).mock.calls[0];
    const metadata = JSON.parse(
      await readFile(join(dirname(outputFile), "metadata.json"), "utf8"),
    );
    expect(metadata).toMatchObject({
      demoId: "demo",
      definitionHash: TIMELINE_DEFINITION_HASH,
      captureHash: CAPTURE_HASH,
      status: "completed",
      output: { video: "video.mp4" },
    });
    expect(await readFile(join(dirname(outputFile), "video.mp4"), "utf8")).toBe(
      "video",
    );
  });

  it("rejects an invalid render artifact before invoking the renderer", async () => {
    const manifestPath = await writeManifestFixture();
    const timelinePath = await writeTimelineFixture();
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.steps[0].startedAtMs = "zero";
    await writeFile(manifestPath, JSON.stringify(manifest));

    await expect(
      runCli([
        "render",
        "--manifest",
        manifestPath,
        "--timeline",
        timelinePath,
      ]),
    ).rejects.toThrow("$.steps[0].startedAtMs");
    expect(renderDemoVideo).not.toHaveBeenCalled();
  });

  it("uses a distinct managed output for consecutive renders", async () => {
    const manifestPath = await writeManifestFixture();
    const timelinePath = await writeTimelineFixture();

    await withTemporaryInvocationRoot(async () => {
      await runCli([
        "render",
        "--manifest",
        manifestPath,
        "--timeline",
        timelinePath,
      ]);
      await runCli([
        "render",
        "--manifest",
        manifestPath,
        "--timeline",
        timelinePath,
      ]);
    });

    const outputs = vi
      .mocked(renderDemoVideo)
      .mock.calls.map(([options]) => options.outputFile);
    expect(new Set(outputs).size).toBe(2);
  });

  it.each([
    ["demo", { demoId: "other" }, "Demo artifact mismatch"],
    [
      "capture",
      { captureHash: OTHER_CAPTURE_HASH },
      "Capture artifact mismatch",
    ],
  ])(
    "rejects a %s mismatch before starting a render",
    async (_kind, timelinePatch, message) => {
      const manifestPath = await writeManifestFixture();
      const timelinePath = await writeTimelineFixture();
      const timeline = JSON.parse(await readFile(timelinePath, "utf8"));
      await writeFile(
        timelinePath,
        JSON.stringify({ ...timeline, ...timelinePatch }),
      );

      await expect(
        withTemporaryInvocationRoot(() =>
          runCli([
            "render",
            "--manifest",
            manifestPath,
            "--timeline",
            timelinePath,
          ]),
        ),
      ).rejects.toThrow(message);
      expect(renderDemoVideo).not.toHaveBeenCalled();
    },
  );

  it("preserves an explicit output file", async () => {
    const manifestPath = await writeManifestFixture();
    const timelinePath = await writeTimelineFixture();
    const dir = await mkdtemp(join(tmpdir(), "democraft-cli-"));
    tempDirs.push(dir);
    const outputFile = join(dir, "legacy.mp4");

    const result = await runCli([
      "render",
      "--manifest",
      manifestPath,
      "--timeline",
      timelinePath,
      "--output-file",
      outputFile,
    ]);

    expect(result.stdout).toBe(`Render written to ${outputFile}\n`);
    expect(vi.mocked(renderDemoVideo)).toHaveBeenCalledWith(
      expect.objectContaining({ outputFile }),
    );
  });

  it("records renderer failures without promoting a video", async () => {
    const manifestPath = await writeManifestFixture();
    const timelinePath = await writeTimelineFixture();
    vi.mocked(renderDemoVideo).mockRejectedValueOnce(
      new Error("encoder failed"),
    );

    await expect(
      withTemporaryInvocationRoot(() =>
        runCli([
          "render",
          "--manifest",
          manifestPath,
          "--timeline",
          timelinePath,
        ]),
      ),
    ).rejects.toThrow("encoder failed");

    const [{ outputFile }] = vi.mocked(renderDemoVideo).mock.calls[0];
    const directory = dirname(outputFile);
    const metadata = JSON.parse(
      await readFile(join(directory, "metadata.json"), "utf8"),
    );
    expect(metadata).toMatchObject({
      status: "failed",
      error: { message: "encoder failed" },
    });
    await expect(readFile(join(directory, "video.mp4"))).rejects.toThrow();
  });

  it("renders from the raw recording only when requested", async () => {
    const dir = await mkdtemp(join(tmpdir(), "democraft-cli-"));
    tempDirs.push(dir);
    const recordingFile = join(dir, "recording.webm");
    const outputFile = join(dir, "recording.mp4");
    await writeFile(recordingFile, "recording");
    const manifestPath = await writeManifestFixture(recordingFile);
    const timelinePath = await writeTimelineFixture();

    const result = await runCli([
      "render",
      "--manifest",
      manifestPath,
      "--timeline",
      timelinePath,
      "--recording",
      "--output-file",
      outputFile,
    ]);

    expect(result.exitCode).toBe(0);
    expect(vi.mocked(renderDemoVideo)).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaMode: "recording",
        recordingFile,
      }),
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

async function writeManifestFixture(
  recordingPath: string | null = "/tmp/demo.webm",
  captureHash: string | null = CAPTURE_HASH,
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "democraft-cli-"));
  tempDirs.push(dir);
  const manifestPath = join(dir, "manifest.json");
  const screenshotsDir = join(dir, "screenshots");
  await mkdir(screenshotsDir, { recursive: true });
  await Promise.all([
    writeFile(
      join(screenshotsDir, "intro-intro.browser-goto-dashboard.1.png"),
      "screenshot",
    ),
    writeFile(
      join(screenshotsDir, "intro-intro.assert-visible-dashboard.2.png"),
      "screenshot",
    ),
  ]);

  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        schemaVersion: "1",
        demoId: "demo",
        definitionHash: DEFINITION_HASH,
        captureHash: captureHash ?? undefined,
        recording: recordingPath
          ? {
              path: recordingPath,
              width: 1440,
              height: 900,
            }
          : undefined,
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
        definitionHash: TIMELINE_DEFINITION_HASH,
        captureHash: CAPTURE_HASH,
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

async function withTemporaryInvocationRoot<T>(
  run: () => Promise<T>,
): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "democraft-cli-root-"));
  tempDirs.push(directory);
  const previousCwd = process.cwd();
  const previousInitCwd = process.env.INIT_CWD;
  process.chdir(directory);
  process.env.INIT_CWD = directory;
  try {
    return await run();
  } finally {
    process.chdir(previousCwd);
    if (previousInitCwd === undefined) delete process.env.INIT_CWD;
    else process.env.INIT_CWD = previousInitCwd;
  }
}
