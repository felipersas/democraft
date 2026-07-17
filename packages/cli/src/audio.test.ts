import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderDemoVideo } from "@democraft/remotion";
import { runDemo } from "@democraft/playwright";
import { runCli } from "./index";

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

beforeEach(() => {
  vi.mocked(renderDemoVideo).mockImplementation(async ({ outputFile }) => {
    await writeFile(outputFile, "video");
  });
  vi.mocked(runDemo).mockImplementation(async (ir, options) => {
    const outputDir =
      options?.outputDir ??
      join(options?.captureRootDir ?? "/tmp", "demo", "run");
    await mkdir(outputDir, { recursive: true });
    await options?.onArtifactCreated?.({
      captureRunId: "demo-run",
      outputDir,
      manifestPath: join(outputDir, "manifest.json"),
      metadataPath: join(outputDir, "metadata.json"),
    });
    return {
      schemaVersion: "1",
      demoId: ir.id,
      captureRunId: "demo-run",
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

async function writeAudioDemo(audioTracks: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "democraft-cli-audio-"));
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

const targets = defineTargets({dashboard: byTestId("dashboard")});

export default defineDemo({
  id: "audio-demo",
  title: "Audio demo",
  source: {baseUrl: "http://localhost:3000"},
  targets,
  audioTracks: ${audioTracks},
  async run({demo}) {
    await demo.scene("intro", async (scene) => {
      await scene.goto("/dashboard");
      await scene.hold("1s");
    });
  }
});
`,
  );
  return demoPath;
}

describe("cli audio", () => {
  it("inspects a demo with audio tracks", async () => {
    const demoPath = await writeAudioDemo(
      `[{id: "music", src: "./assets/music.mp3", kind: "music", volume: 0.25, loop: true}]`,
    );

    const result = await runCli(["inspect", demoPath, "--json"]);

    expect(result.exitCode).toBe(0);
    const ir = JSON.parse(result.stdout);
    expect(ir.audio).toEqual([
      expect.objectContaining({
        id: "music",
        src: "./assets/music.mp3",
        kind: "music",
        volume: 0.25,
        loop: true,
      }),
    ]);
  });

  it("surfaces an unsupported-extension diagnostic via validate", async () => {
    const demoPath = await writeAudioDemo(`[{id: "vid", src: "./clip.mp4"}]`);

    const result = await runCli(["validate", demoPath, "--static", "--json"]);

    expect(result.exitCode).toBe(1);
    const diagnostics = JSON.parse(result.stdout);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: "DC305", audioTrackId: "vid" }),
    );
  });

  it("flows audio tracks through compile → resolve → render", async () => {
    const demoPath = await writeAudioDemo(
      `[{id: "music", src: "https://example.com/music.mp3", volume: 0.5, fadeIn: "500ms"}]`,
    );

    const result = await runCli(["render", demoPath]);

    expect(result.exitCode).toBe(0);
    const [options] = vi.mocked(renderDemoVideo).mock.calls[0];
    // The timeline reaching renderDemoVideo carries the resolved audio track.
    expect(options.timeline.audio).toHaveLength(1);
    expect(options.timeline.audio![0]).toMatchObject({
      id: "music",
      src: "https://example.com/music.mp3",
      volume: 0.5,
      fromFrame: 0,
      fadeInFrames: expect.any(Number),
    });
  });

  it("preserves the existing pipeline for demos without audio", async () => {
    const dir = await mkdtemp(join(tmpdir(), "democraft-cli-noaudio-"));
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
const targets = defineTargets({dashboard: byTestId("dashboard")});
export default defineDemo({
  id: "no-audio",
  title: "No audio",
  source: {baseUrl: "http://localhost:3000"},
  targets,
  async run({demo}) {
    await demo.scene("intro", async (scene) => {
      await scene.goto("/dashboard");
    });
  }
});
`,
    );

    const result = await runCli(["inspect", demoPath, "--json"]);

    expect(result.exitCode).toBe(0);
    const ir = JSON.parse(result.stdout);
    expect(ir.audio).toBeUndefined();
  });
});
