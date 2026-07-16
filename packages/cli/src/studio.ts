import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { compileDemo } from "@democraft/compiler";
import {
  resolveLatestCompletedCapture,
  resolveRecordedScreenshotPath,
  resolveCaptureEnvironment,
  isReusableCaptureDirectory,
  runDemo,
} from "@democraft/playwright";
import { resolveTimeline } from "@democraft/timeline";
import {
  compareCaptureCompatibility,
  parseRecordedDemoManifest,
  parseRecordedDemoManifestJson,
  parseRenderTimeline,
  parseStudioMeta,
  schemaVersion,
  type CaptureCompatibility,
  type RecordedDemoManifest,
  type StudioMeta,
} from "@democraft/schema";
import { formatDiagnostics } from "./format";
import { loadDemo } from "./loaders";
import { userResolve } from "./paths";
import {
  resolveStudioRuntime,
  STUDIO_LOOPBACK_HOST,
} from "./studio-runtime";

export type StudioOptions = {
  demoPath: string;
  outputDir?: string;
  port?: number;
  noCapture?: boolean;
  headless?: boolean;
  fps?: number;
  workspaceRoot?: string;
};

export function studioUrl(port: number): string {
  return `http://${STUDIO_LOOPBACK_HOST}:${port}`;
}

export async function launchStudio(
  options: StudioOptions,
): Promise<{ port: number; dataDir: string; url: string }> {
  const demo = await loadDemo(options.demoPath);
  const demoPath = await realpath(userResolve(options.demoPath));
  const compilation = await compileDemo(demo);
  const captureEnvironment = await resolveCaptureEnvironment({
    headless: options.headless,
  });

  if (compilation.diagnostics.some((d) => d.severity === "error")) {
    throw new Error(
      `Static validation failed.\n${formatDiagnostics(compilation.diagnostics)}`,
    );
  }

  const root = await realpath(options.workspaceRoot ?? process.cwd());
  const artifactsRoot = await prepareManagedStudioDirectory(
    root,
    path.join(root, ".democraft"),
    "Democraft artifacts directory",
  );
  const runsRoot = await prepareManagedStudioDirectory(
    artifactsRoot,
    path.join(artifactsRoot, "runs"),
    "Managed capture directory",
  );
  const explicitCaptureDirRaw = options.outputDir
    ? path.isAbsolute(options.outputDir)
      ? options.outputDir
      : path.resolve(root, options.outputDir)
    : undefined;
  const explicitCaptureDir = explicitCaptureDirRaw
    ? await canonicalizePotentialPath(explicitCaptureDirRaw)
    : undefined;
  const latestCapture = explicitCaptureDir
    ? undefined
    : await resolveLatestCompletedCapture(runsRoot, compilation.ir.id);
  let captureDir = explicitCaptureDir ?? latestCapture?.captureDir;
  const canonicalDataDir = await prepareManagedStudioDirectory(
    artifactsRoot,
    path.join(artifactsRoot, "studio-data"),
    "Studio data directory",
  );

  let manifest: RecordedDemoManifest;
  const existingManifest =
    captureDir &&
    (await isReusableCaptureDirectory(captureDir, compilation.ir.id))
      ? await readArtifactIfExists(
          path.join(captureDir, "manifest.json"),
          parseRecordedDemoManifestJson,
        )
      : undefined;
  const existingCompatibility = existingManifest
    ? compareCaptureCompatibility(
        {
          demoId: compilation.ir.id,
          captureHash: compilation.ir.captureHash,
          captureEnvironmentHash: captureEnvironment.captureEnvironmentHash,
        },
        existingManifest,
      )
    : undefined;
  const existingAction = existingCompatibility
    ? captureActionForCompatibility(existingCompatibility, options.noCapture)
    : undefined;

  if (existingManifest && existingAction === "reuse") {
    manifest = existingManifest;
    // Default: reuse the prior capture silently. Only announce when the
    // user explicitly skipped and we honored it, so they know we didn't run
    // Playwright.
    if (options.noCapture) {
      process.stderr.write(
        `Reusing existing${latestCapture?.legacy ? " legacy" : ""} capture from ${captureDir} (--no-capture).\n`,
      );
    }
  } else if (options.noCapture) {
    throw new Error(
      `--no-capture was set but no prior completed capture exists${explicitCaptureDir ? ` at\n  ${path.join(explicitCaptureDir, "manifest.json")}` : ` for "${compilation.ir.id}" under\n  ${runsRoot}`}\nRun \`democraft studio\` once without --no-capture to capture.`,
    );
  } else {
    process.stderr.write(
      existingManifest
        ? "Existing capture is not known-compatible — running Playwright to refresh it…\n"
        : "No prior capture found — running Playwright (this may take a while)…\n",
    );
    manifest = await runDemo(compilation.ir, {
      outputDir: explicitCaptureDir,
      captureRootDir: runsRoot,
      headless: options.headless,
      onArtifactCreated: (artifact) => {
        captureDir = artifact.outputDir;
      },
    });
  }

  if (!captureDir) {
    throw new Error("Capture completed without an artifact directory.");
  }

  const failedCapture = manifest.steps.some((step) =>
    step.url?.startsWith("chrome-error://"),
  );
  if (failedCapture) {
    process.stderr.write(
      `\n⚠  Capture produced chrome-error:// pages. The demo's baseUrl\n` +
        `   (${compilation.ir.source.baseUrl}) wasn't reachable when Playwright ran.\n` +
        `   Start the app first, then use Re-capture in the studio.\n\n`,
    );
  }

  const timeline = resolveTimeline(compilation.ir, manifest, {
    fps: options.fps ?? compilation.config.fps,
  });
  const meta = parseStudioMeta({
    schemaVersion,
    demoPath,
    captureDir,
    captureOutputDirExplicit: explicitCaptureDir !== undefined,
    workspaceRoot: root,
    demoId: compilation.ir.id,
    definitionHash: compilation.ir.definitionHash,
    captureHash: compilation.ir.captureHash,
    captureEnvironmentHash: manifest.captureEnvironmentHash,
    capturedAt: Date.now(),
  });

  await materializeStudioData({
    dataDir: canonicalDataDir,
    captureDir,
    manifest,
    timeline,
    meta,
  });

  const port = options.port ?? 3000;
  const url = await startStudioServer({
    port,
    dataDir: canonicalDataDir,
    workspaceRoot: root,
    demoPath,
    explicitCaptureDir,
    captureHeadless: captureEnvironment.environment.headless,
    captureEnvironmentHash: captureEnvironment.captureEnvironmentHash,
  });

  return { port, dataDir: canonicalDataDir, url };
}

export function captureActionForCompatibility(
  compatibility: CaptureCompatibility,
  noCapture = false,
): "reuse" | "capture" {
  if (compatibility === "compatible") return "reuse";
  if (noCapture) {
    throw new Error(
      compatibility === "unknown"
        ? "--no-capture cannot reuse the existing legacy capture because compatibility is unknown. Run without --no-capture to capture it again."
        : "--no-capture cannot reuse the existing capture because it is incompatible. Run without --no-capture to refresh it.",
    );
  }
  return "capture";
}

export async function materializeStudioData(args: {
  dataDir: string;
  captureDir: string;
  manifest: RecordedDemoManifest;
  timeline: ReturnType<typeof resolveTimeline>;
  meta?: StudioMeta;
  afterBackupRenamed?: () => Promise<void>;
}): Promise<void> {
  const manifest = parseRecordedDemoManifest(args.manifest);
  const timeline = parseRenderTimeline(args.timeline);
  const meta = args.meta ? parseStudioMeta(args.meta) : undefined;
  const parent = path.dirname(args.dataDir);
  const generation = path.join(
    parent,
    `.${path.basename(args.dataDir)}.generation-${process.pid}-${randomBytes(6).toString("hex")}`,
  );
  const backup = path.join(
    parent,
    `${path.basename(args.dataDir)}.previous-${process.pid}-${randomBytes(6).toString("hex")}`,
  );
  const screenshotsSrc = path.join(args.captureDir, "screenshots");
  const screenshotsDst = path.join(generation, "screenshots");
  await mkdir(screenshotsDst, { recursive: true });

  try {
    if (await existsDir(screenshotsSrc)) {
      for (const step of manifest.steps) {
        const src = resolveRecordedScreenshotPath(args.captureDir, step);
        if (src && (await existsFile(src))) {
          const safeSrc = await resolveCaptureArtifactPath(
            args.captureDir,
            src,
            `Screenshot for step ${step.stepId}`,
          );
          await copyAtomicTarget(
            generation,
            safeSrc,
            path.join(screenshotsDst, path.basename(src)),
            `Materialized screenshot for step ${step.stepId}`,
          );
        }
      }
    }

    const recordingRaw = manifest.recording?.path;
    const recordingSrc = recordingRaw
      ? await resolvePersistedCapturePath(args.captureDir, recordingRaw)
      : undefined;
    const recordingDst = path.join(generation, "recording.webm");
    if (recordingSrc && (await existsFile(recordingSrc))) {
      await copyAtomicTarget(
        generation,
        recordingSrc,
        recordingDst,
        "Materialized recording",
      );
    }

    await Promise.all([
      writeAtomicTarget(
        generation,
        path.join(generation, "manifest.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
        "Materialized manifest",
      ),
      writeAtomicTarget(
        generation,
        path.join(generation, "timeline.json"),
        `${JSON.stringify(timeline, null, 2)}\n`,
        "Materialized timeline",
      ),
      meta
        ? writeAtomicTarget(
            generation,
            path.join(generation, "meta.json"),
            `${JSON.stringify(meta, null, 2)}\n`,
            "Studio metadata",
          )
        : Promise.resolve(),
    ]);

    await rename(args.dataDir, backup);
    try {
      await args.afterBackupRenamed?.();
      await rename(generation, args.dataDir);
    } catch (error) {
      await rename(backup, args.dataDir);
      throw error;
    }
    await rm(backup, { recursive: true, force: true }).catch(() => undefined);
  } catch (error) {
    await rm(generation, { recursive: true, force: true });
    throw error;
  }
}

async function startStudioServer(args: {
  port: number;
  dataDir: string;
  workspaceRoot: string;
  demoPath: string;
  explicitCaptureDir?: string;
  captureHeadless: boolean;
  captureEnvironmentHash: string;
}): Promise<string> {
  const runtime = resolveStudioRuntime(args.port);
  return new Promise((resolve, reject) => {
    const sessionToken = randomBytes(32).toString("base64url");
    const child = spawn(runtime.command, runtime.args, {
      cwd: runtime.cwd,
      stdio: ["inherit", "pipe", "inherit"],
      env: studioServerEnvironment(args, sessionToken),
      shell: false,
    });

    const url = studioUrl(args.port);
    let resolved = false;

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      process.stdout.write(chunk);
      if (
        !resolved &&
        (text.includes("- Local:") || text.includes("Ready in"))
      ) {
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
            `Studio server exited with code ${code} before becoming ready`,
          ),
        );
      }
    });

    process.on("SIGINT", () => child.kill("SIGINT"));
    process.on("SIGTERM", () => child.kill("SIGTERM"));
  });
}

export function studioServerEnvironment(
  args: {
    dataDir: string;
    workspaceRoot: string;
    demoPath: string;
    explicitCaptureDir?: string;
    captureHeadless: boolean;
    captureEnvironmentHash: string;
  },
  sessionToken: string,
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DEMOCRAFT_STUDIO_DATA: args.dataDir,
    DEMOCRAFT_STUDIO_WORKSPACE_ROOT: args.workspaceRoot,
    DEMOCRAFT_STUDIO_DEMO_PATH: args.demoPath,
    DEMOCRAFT_STUDIO_EXPLICIT_CAPTURE_DIR: args.explicitCaptureDir ?? "",
    DEMOCRAFT_STUDIO_CAPTURE_HEADLESS: String(args.captureHeadless),
    DEMOCRAFT_STUDIO_CAPTURE_ENVIRONMENT_HASH: args.captureEnvironmentHash,
    DEMOCRAFT_STUDIO_SESSION_TOKEN: sessionToken,
    // Register the tsx loader so Studio can import the authorized .ts demo.
    NODE_OPTIONS: [process.env.NODE_OPTIONS, "--import tsx"]
      .filter(Boolean)
      .join(" "),
  };
}

async function resolvePersistedCapturePath(
  captureDir: string,
  persisted: string,
): Promise<string | undefined> {
  const captureRelative = path.isAbsolute(persisted)
    ? persisted
    : path.resolve(captureDir, persisted);
  if (await existsFile(captureRelative)) {
    return resolveCaptureArtifactPath(
      captureDir,
      captureRelative,
      "Capture recording",
    );
  }
  const legacy = path.resolve(persisted);
  if (await existsFile(legacy)) {
    return resolveCaptureArtifactPath(
      captureDir,
      legacy,
      "Legacy capture recording",
    );
  }
  return undefined;
}

async function resolveCaptureArtifactPath(
  captureDir: string,
  candidate: string,
  label: string,
): Promise<string> {
  const [root, target] = await Promise.all([
    realpath(captureDir),
    realpath(candidate),
  ]);
  const relative = path.relative(root, target);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`${label} escapes the capture directory: ${target}`);
  }
  return target;
}

async function canonicalizePotentialPath(candidate: string): Promise<string> {
  const missing: string[] = [];
  let ancestor = path.resolve(candidate);
  while (true) {
    try {
      return path.join(await realpath(ancestor), ...missing);
    } catch (error) {
      if (!isNodeError(error, "ENOENT")) throw error;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw error;
      missing.unshift(path.basename(ancestor));
      ancestor = parent;
    }
  }
}

export async function prepareManagedStudioDirectory(
  root: string,
  candidate: string,
  label: string,
): Promise<string> {
  const canonicalRoot = await realpath(root);
  const safeCandidate = await canonicalizePotentialPath(candidate);
  assertContained(canonicalRoot, safeCandidate, label);
  await mkdir(safeCandidate, { recursive: true });
  const canonicalCandidate = await realpath(safeCandidate);
  assertContained(canonicalRoot, canonicalCandidate, label);
  return canonicalCandidate;
}

async function writeAtomicTarget(
  root: string,
  target: string,
  contents: string,
  label: string,
) {
  await promoteAtomicTarget(root, target, label, (temp) =>
    writeFile(temp, contents, { flag: "wx" }),
  );
}

async function copyAtomicTarget(
  root: string,
  source: string,
  target: string,
  label: string,
) {
  await promoteAtomicTarget(root, target, label, (temp) =>
    copyFile(source, temp),
  );
}

async function promoteAtomicTarget(
  root: string,
  target: string,
  label: string,
  create: (temp: string) => Promise<unknown>,
) {
  const canonicalRoot = await realpath(root);
  const safeTarget = await canonicalizePotentialPath(target);
  assertContained(canonicalRoot, safeTarget, label);
  await rejectTargetSymlink(safeTarget, label);
  const temp = path.join(
    path.dirname(safeTarget),
    `.${path.basename(safeTarget)}.${process.pid}-${randomBytes(6).toString("hex")}.tmp`,
  );
  try {
    await create(temp);
    const revalidated = await canonicalizePotentialPath(safeTarget);
    assertContained(canonicalRoot, revalidated, label);
    if (revalidated !== safeTarget)
      throw new Error(`${label} changed during write.`);
    await rejectTargetSymlink(safeTarget, label);
    await rename(temp, safeTarget);
  } finally {
    await rm(temp, { force: true }).catch(() => undefined);
  }
}

function assertContained(root: string, target: string, label: string) {
  const relative = path.relative(root, target);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`${label} escapes its output directory: ${target}`);
  }
}

async function rejectTargetSymlink(target: string, label: string) {
  try {
    if ((await lstat(target)).isSymbolicLink()) {
      throw new Error(`${label} must not be a symbolic link: ${target}`);
    }
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return;
    throw error;
  }
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

function isNodeError(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}

async function readArtifactIfExists<T>(
  p: string,
  parse: (json: string) => T,
): Promise<T | undefined> {
  try {
    const text = await readFile(p, "utf8");
    return parse(text);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return undefined;
    }
    throw error;
  }
}
