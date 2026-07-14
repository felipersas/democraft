import { copyFile, mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { compileDemo } from "@democraft/compiler";
import { runDemo } from "@democraft/playwright";
import { resolveTimeline } from "@democraft/timeline";
import type { RecordedDemoManifest, StudioMeta } from "@democraft/schema";
import { formatDiagnostics } from "./format";
import { loadDemo } from "./loaders";

export type StudioOptions = {
  demoPath: string;
  outputDir?: string;
  port?: number;
  noCapture?: boolean;
  headless?: boolean;
  fps?: number;
  workspaceRoot?: string;
};

export async function launchStudio(
  options: StudioOptions,
): Promise<{ port: number; dataDir: string; url: string }> {
  const demo = await loadDemo(options.demoPath);
  const compilation = await compileDemo(demo);

  if (
    compilation.diagnostics.some((d) => d.severity === "error")
  ) {
    throw new Error(
      `Static validation failed.\n${formatDiagnostics(compilation.diagnostics)}`,
    );
  }

  const root = options.workspaceRoot ?? process.cwd();
  const captureDir =
    options.outputDir
      ? path.isAbsolute(options.outputDir)
        ? options.outputDir
        : path.resolve(root, options.outputDir)
      : path.join(root, ".democraft", "runs", compilation.ir.id);
  const dataDir = path.join(root, ".democraft", "studio-data");
  await mkdir(dataDir, { recursive: true });

  let manifest: RecordedDemoManifest;
  const existingManifest = await readJsonSafe<RecordedDemoManifest>(
    path.join(captureDir, "manifest.json"),
  );

  if (existingManifest) {
    manifest = existingManifest;
    // Default: reuse the prior capture silently. Only announce when the
    // user explicitly skipped and we honored it, so they know we didn't run
    // Playwright.
    if (options.noCapture) {
      process.stderr.write(
        `Reusing existing capture from ${captureDir} (--no-capture).\n`,
      );
    }
  } else if (options.noCapture) {
    // Forced skip but nothing to reuse — fail loudly rather than silently
    // degrading into a full capture (the old behavior, which surprised users).
    throw new Error(
      `--no-capture was set but no prior capture exists at\n  ${path.join(
        captureDir,
        "manifest.json",
      )}\nRun \`democraft studio\` once without --no-capture to capture.`,
    );
  } else {
    process.stderr.write(
      `No prior capture found — running Playwright (this may take a while)…\n`,
    );
    manifest = await runDemo(compilation.ir, {
      outputDir: captureDir,
      headless: options.headless,
    });
  }

  const failedCapture = manifest.steps.some(
    (step) => step.url?.startsWith("chrome-error://"),
  );
  if (failedCapture) {
    process.stderr.write(
      `\n⚠  Capture produced chrome-error:// pages. The demo's baseUrl\n` +
        `   (${compilation.ir.source.baseUrl}) wasn't reachable when Playwright ran.\n` +
        `   Start the app first, then use Re-capture in the studio.\n\n`,
    );
  }

  const timeline = resolveTimeline(compilation.ir, manifest, {
    fps: options.fps,
  });

  await materializeStudioData({
    dataDir,
    captureDir,
    manifest,
    timeline,
  });

  // Persist metadata so the studio knows where the demo source lives and
  // where captures are written — needed for in-studio re-capture, staleness
  // detection, and auto re-resolve. See docs/architecture/studio-roadmap.md "Workflow/DX".
  await writeMetaFile({
    dataDir,
    demoPath: path.resolve(options.demoPath),
    captureDir,
    workspaceRoot: root,
    demoId: compilation.ir.id,
    capturedAt: Date.now(),
  });

  const port = options.port ?? 3000;
  const url = await startStudioServer({ port, dataDir, workspaceRoot: root });

  return { port, dataDir, url };
}

/** Metadata persisted to studio-data/meta.json. The studio reads this to
 * locate the demo source (for re-resolve / re-capture) and detect staleness.
 * Type lives in @democraft/schema so both CLI and studio share it. */
async function writeMetaFile(args: {
  dataDir: string;
  demoPath: string;
  captureDir: string;
  workspaceRoot: string;
  demoId: string;
  capturedAt: number;
}): Promise<void> {
  const meta: StudioMeta = {
    demoPath: args.demoPath,
    captureDir: args.captureDir,
    workspaceRoot: args.workspaceRoot,
    demoId: args.demoId,
    capturedAt: args.capturedAt,
  };
  const { writeFile } = await import("node:fs/promises");
  await writeFile(
    path.join(args.dataDir, "meta.json"),
    `${JSON.stringify(meta, null, 2)}\n`,
  );
}

async function materializeStudioData(args: {
  dataDir: string;
  captureDir: string;
  manifest: RecordedDemoManifest;
  timeline: ReturnType<typeof resolveTimeline>;
}): Promise<void> {
  const screenshotsSrc = path.join(args.captureDir, "screenshots");
  const screenshotsDst = path.join(args.dataDir, "screenshots");
  await rm(screenshotsDst, { recursive: true, force: true });
  await mkdir(screenshotsDst, { recursive: true });

  if (await existsDir(screenshotsSrc)) {
    for (const step of args.manifest.steps) {
      const name = `${step.sceneId}-${step.stepId}.png`;
      const src = path.join(screenshotsSrc, name);
      if (await existsFile(src)) {
        await copyFile(src, path.join(screenshotsDst, name));
      }
    }
  }

  const recordingRaw = args.manifest.recording?.path;
  const recordingSrc = recordingRaw
    ? path.isAbsolute(recordingRaw)
      ? recordingRaw
      : path.resolve(args.captureDir, recordingRaw)
    : undefined;
  const recordingDst = path.join(args.dataDir, "recording.webm");
  if (recordingSrc && (await existsFile(recordingSrc))) {
    await copyFile(recordingSrc, recordingDst);
  }

  const { writeFile } = await import("node:fs/promises");
  await writeFile(
    path.join(args.dataDir, "manifest.json"),
    `${JSON.stringify(args.manifest, null, 2)}\n`,
  );
  await writeFile(
    path.join(args.dataDir, "timeline.json"),
    `${JSON.stringify(args.timeline, null, 2)}\n`,
  );
}

async function startStudioServer(args: {
  port: number;
  dataDir: string;
  workspaceRoot: string;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      [
        "--filter",
        "@democraft/studio",
        "dev",
        "--port",
        String(args.port),
      ],
      {
        cwd: args.workspaceRoot,
        stdio: ["inherit", "pipe", "inherit"],
        env: {
          ...process.env,
          DEMOCRAFT_STUDIO_DATA: args.dataDir,
          // Register the tsx loader so the studio's route handlers can
          // dynamically import() the demo's TypeScript module (demo.ts).
          // Without this, Node can't natively import .ts files. Using
          // NODE_OPTIONS keeps tsx out of the Next webpack bundle (which
          // can't resolve it).
          NODE_OPTIONS: [process.env.NODE_OPTIONS, "--import tsx"]
            .filter(Boolean)
            .join(" "),
        },
        shell: process.platform === "win32",
      },
    );

    const url = `http://localhost:${args.port}`;
    let resolved = false;

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      process.stdout.write(chunk);
      if (!resolved && (text.includes("- Local:") || text.includes("Ready in"))) {
        resolved = true;
        resolve(url);
      }
    });

    child.on("error", (err) => {
      if (!resolved) reject(err);
    });

    child.on("exit", (code) => {
      if (!resolved) {
        reject(
          new Error(
            `Studio dev server exited with code ${code} before becoming ready`,
          ),
        );
      }
    });

    process.on("SIGINT", () => child.kill("SIGINT"));
    process.on("SIGTERM", () => child.kill("SIGTERM"));
  });
}

async function existsFile(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isFile();
  } catch {
    return false;
  }
}

async function existsDir(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function readJsonSafe<T>(p: string): Promise<T | undefined> {
  try {
    const text = await readFile(p, "utf8");
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}
