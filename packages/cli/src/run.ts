import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { compileDemo, inspectIR } from "@democraft/compiler";
import { runDemo } from "@democraft/playwright";
import { renderPreviewHtml } from "@democraft/preview";
import {
  createProductDemoVideoProps,
  completeRenderArtifact,
  createRenderArtifact,
  failRenderArtifact,
  materializeDemoEntry,
  renderDemoVideo,
  type DemoMediaMode,
} from "@democraft/remotion";
import {
  estimateDemoDurationMs,
  inspectTimeline,
  resolveTimeline,
} from "@democraft/timeline";
import {
  assertCaptureCompatibility,
  parseRecordedDemoManifestJson,
  parseRenderTimelineJson,
  type RecordedDemoManifest,
  type RenderTimeline,
} from "@democraft/schema";
import { parseArgs } from "./args";
import { formatDiagnostics, formatTargets, formatTargetsJson } from "./format";
import { fail, help, ok } from "./help";
import {
  buildScreenshotDataUrls,
  buildScreenshotSources,
  loadDemo,
  resolveRecordingPath,
} from "./loaders";
import { resolveDemoPath, userResolve, workspaceRoot } from "./paths";
import { launchStudio } from "./studio";
import type { CliResult, ParsedArgs } from "./types";
import { authFailure, authenticationExecution, runAuthCommand } from "./auth";
import { jsonFail, jsonOk } from "./json";
import { runDoctorChecks, summarizeDoctor } from "./doctor";

export async function runCli(argv = process.argv.slice(2)): Promise<CliResult> {
  try {
    return await executeCli(argv);
  } catch (error) {
    if (isAuthenticationFailure(error)) {
      return authFailure(error, parseArgs(argv).json);
    }
    throw error;
  }
}

async function executeCli(argv: string[]): Promise<CliResult> {
  const args = parseArgs(argv);

  if (args.parseError) {
    return fail(`${args.parseError}\nRun \`democraft help\` for usage.`);
  }

  if (
    !args.command ||
    args.command === "help" ||
    args.command === "--help" ||
    args.command === "-h"
  ) {
    return ok(help());
  }

  if (args.command === "auth") {
    if (args.helpRequested) return ok(help("auth"));
    return runAuthCommand(args);
  }

  if (
    ![
      "inspect",
      "validate",
      "capture",
      "timeline",
      "preview",
      "render",
      "studio",
      "targets",
      "discover",
      "doctor",
      "auth",
    ].includes(args.command)
  ) {
    return fail(`Unknown command "${args.command}".\n\n${help()}`);
  }

  if (args.helpRequested) return ok(help(args.command));

  const numericError = validateNumericArgs(args);
  if (numericError) return fail(numericError);

  // `discover` and `doctor` are standalone — they don't resolve a demo module.
  if (args.command === "discover") {
    return runDiscoverCommand(args);
  }
  if (args.command === "doctor") {
    return runDoctorCommand(args);
  }

  if (
    args.command === "render" &&
    Boolean(args.manifestPath) !== Boolean(args.timelinePath)
  ) {
    return fail(
      "Artifact rendering requires both --manifest and --timeline. Omit both to render directly from the demo module.",
    );
  }

  const usesExplicitRenderArtifacts =
    args.command === "render" && args.manifestPath && args.timelinePath;
  const needsDemo = args.command !== "preview" && !usesExplicitRenderArtifacts;
  let demoPath = args.demoPath;
  if (needsDemo) {
    try {
      demoPath = resolveDemoPath(args.demoPath);
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  }

  if (args.command === "studio") {
    if (!demoPath) {
      return fail(`Missing demo module path.\n\n${help()}`);
    }
    const { url, dataDir } = await launchStudio({
      demoPath,
      outputDir: args.outputDir,
      port: args.port,
      noCapture: args.noCapture,
      headless: args.headless,
      fps: args.fps,
      workspaceRoot: workspaceRoot(),
      storageState: args.storageState,
    });
    return ok(
      `Studio ready at ${url}\nData: ${dataDir}\nPress Ctrl+C to stop.\n`,
    );
  }

  if (args.command === "timeline" && !args.manifestPath) {
    return fail('Missing manifest path. Pass "--manifest <manifest.json>".');
  }

  if (args.command === "preview") {
    if (!args.manifestPath || !args.timelinePath) {
      return fail(
        'Missing preview inputs. Pass "--manifest <manifest.json>" and "--timeline <timeline.json>".',
      );
    }

    const manifest = parseRecordedDemoManifestJson(
      await readFile(userResolve(args.manifestPath), "utf8"),
    );
    const timeline = parseRenderTimelineJson(
      await readFile(userResolve(args.timelinePath), "utf8"),
    );
    assertCaptureCompatibility(timeline, manifest);
    const outputFile =
      args.outputFile ?? `.democraft/previews/${timeline.demoId}.html`;
    const absoluteOutputFile = userResolve(outputFile);
    const recording = await resolveRequestedRecording(
      manifest,
      args.useRecording,
    );
    if (recording.error) return fail(recording.error);
    const mediaMode: DemoMediaMode = args.useRecording
      ? "recording"
      : "screenshots";
    const screenshotSrcByStepId = buildScreenshotSources(
      manifest,
      args.manifestPath,
    );
    const previewProps = createProductDemoVideoProps({
      manifest,
      mediaMode,
      recordingSrc: recording.file
        ? pathToFileURL(recording.file).href
        : undefined,
      timeline,
      screenshotSrcByStepId,
    });
    await mkdir(dirname(absoluteOutputFile), { recursive: true });
    await writeFile(
      absoluteOutputFile,
      renderPreviewHtml({
        manifest,
        timeline,
        videoSrc: previewProps.recordingSrc,
        screenshotSrcByStepId,
      }),
    );

    return ok(`Preview written to ${outputFile}\n`);
  }

  if (args.command === "render" && args.manifestPath && args.timelinePath) {
    const manifest = parseRecordedDemoManifestJson(
      await readFile(userResolve(args.manifestPath), "utf8"),
    );
    const timeline = parseRenderTimelineJson(
      await readFile(userResolve(args.timelinePath), "utf8"),
    );
    return executeRender({
      args,
      demoPath,
      manifest,
      manifestPath: args.manifestPath,
      timeline,
      timelinePath: args.timelinePath,
    });
  }

  if (!demoPath) {
    return fail(`Missing demo module path.\n\n${help()}`);
  }

  const demo = await loadDemo(demoPath);
  const compilation = await compileDemo(demo);

  if (args.command === "render") {
    if (
      compilation.diagnostics.some(
        (diagnostic) => diagnostic.severity === "error",
      )
    ) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `Static validation failed before render.\n${formatDiagnostics(compilation.diagnostics)}\n`,
      };
    }

    let captureArtifact:
      { outputDir: string; manifestPath: string } | undefined;
    const manifest = await runDemo(compilation.ir, {
      outputDir: args.outputDir,
      captureRootDir: args.outputDir
        ? undefined
        : resolve(workspaceRoot(), ".democraft/runs"),
      headless: args.headless,
      authentication: compilation.ir.authentication
        ? await authenticationExecution()
        : undefined,
      onArtifactCreated: (artifact) => {
        captureArtifact = artifact;
      },
    });
    if (!captureArtifact) {
      throw new Error(
        "Capture completed without reporting its artifact paths.",
      );
    }

    const timeline = resolveTimeline(compilation.ir, manifest, {
      fps: args.fps ?? compilation.config.fps,
    });
    const timelinePath = resolve(captureArtifact.outputDir, "timeline.json");
    await writeFile(timelinePath, `${JSON.stringify(timeline, null, 2)}\n`);

    return executeRender({
      args,
      demoPath,
      manifest,
      manifestPath: captureArtifact.manifestPath,
      timeline,
      timelinePath,
    });
  }

  if (args.command === "inspect") {
    // `--estimate` returns ONLY the presentation-duration estimate (no browser
    // or render needed). The default `inspect --json` shape (bare IR) is
    // preserved for back-compat — the estimate is opt-in via the flag so an
    // agent can budget a target length without a render-and-measure loop.
    if (args.estimate) {
      const estimatedDuration = estimateDemoDurationMs(
        compilation.ir,
        args.fps ?? compilation.config.fps,
      );
      return ok(
        args.json
          ? `${JSON.stringify(estimatedDuration, null, 2)}\n`
          : `Estimated duration: ~${estimatedDuration.totalSeconds}s (${estimatedDuration.totalFrames} frames)\n` +
            estimatedDuration.scenes
              .map((s) => `  ${s.sceneId}: ~${Math.round(s.estimatedMs / 100) / 10}s`)
              .join("\n") + "\n",
      );
    }
    return ok(
      args.json
        ? `${JSON.stringify(compilation.ir, null, 2)}\n`
        : `${inspectIR(compilation.ir)}\n`,
    );
  }

  if (args.command === "targets") {
    return ok(
      args.json
        ? `${JSON.stringify(formatTargetsJson(demo), null, 2)}\n`
        : `${formatTargets(demo)}\n`,
    );
  }

  if (args.command === "validate") {
    const exitCode = compilation.diagnostics.some(
      (diagnostic) => diagnostic.severity === "error",
    )
      ? 1
      : 0;
    const stdout = args.json
      ? `${JSON.stringify(compilation.diagnostics, null, 2)}\n`
      : `${formatDiagnostics(compilation.diagnostics)}\n`;
    return { exitCode, stdout, stderr: "" };
  }

  if (args.command === "timeline") {
    const manifestPath = args.manifestPath;
    if (!manifestPath) {
      return fail('Missing manifest path. Pass "--manifest <manifest.json>".');
    }

    if (
      compilation.diagnostics.some(
        (diagnostic) => diagnostic.severity === "error",
      )
    ) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `Static validation failed before timeline resolution.\n${formatDiagnostics(compilation.diagnostics)}\n`,
      };
    }

    const manifest = parseRecordedDemoManifestJson(
      await readFile(userResolve(manifestPath), "utf8"),
    );
    const timeline = resolveTimeline(compilation.ir, manifest, {
      fps: args.fps ?? compilation.config.fps,
    });
    const output = args.json
      ? `${JSON.stringify(timeline, null, 2)}\n`
      : `${inspectTimeline(timeline)}\n`;

    if (args.outputFile) {
      const outputFile = userResolve(args.outputFile);
      await mkdir(dirname(outputFile), { recursive: true });
      await writeFile(outputFile, `${JSON.stringify(timeline, null, 2)}\n`);
      return ok(`Timeline written to ${args.outputFile}\n`);
    }

    return ok(output);
  }

  if (
    compilation.diagnostics.some(
      (diagnostic) => diagnostic.severity === "error",
    )
  ) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `Static validation failed before capture.\n${formatDiagnostics(compilation.diagnostics)}\n`,
    };
  }

  let captureArtifact:
    | { captureRunId: string; manifestPath: string; outputDir: string }
    | undefined;
  const manifest = await runDemo(compilation.ir, {
    outputDir: args.outputDir,
    headless: args.headless,
    authentication: compilation.ir.authentication
      ? await authenticationExecution()
      : undefined,
    onArtifactCreated: (artifact) => {
      captureArtifact = artifact;
    },
  });

  return ok(
    args.json
      ? `${JSON.stringify(manifest, null, 2)}\n`
      : `Captured ${manifest.demoId}\nCapture run ID: ${captureArtifact?.captureRunId ?? manifest.captureRunId ?? "unknown"}\nManifest: ${captureArtifact?.manifestPath ?? `${args.outputDir}/manifest.json`}\n`,
  );
}

function isAuthenticationFailure(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    (("public" in error &&
      typeof (error as { public?: { code?: unknown } }).public?.code ===
        "string") ||
      ("code" in error &&
        String((error as { code?: unknown }).code).startsWith("AUTH_"))),
  );
}

async function executeRender(options: {
  args: ParsedArgs;
  demoPath?: string;
  manifest: RecordedDemoManifest;
  manifestPath: string;
  timeline: RenderTimeline;
  timelinePath: string;
}): Promise<CliResult> {
  const { args, demoPath, manifest, manifestPath, timeline, timelinePath } =
    options;
  assertCaptureCompatibility(timeline, manifest);
  const recording = await resolveRequestedRecording(
    manifest,
    args.useRecording,
  );
  if (recording.error) return fail(recording.error);

  const mediaMode: DemoMediaMode = args.useRecording
    ? "recording"
    : "screenshots";
  const usesGenericVisuals = timeline.overlays.some(
    (overlay) => overlay.kind === "visual",
  );
  if (usesGenericVisuals && !args.entryPath && !demoPath) {
    return fail(
      "This timeline uses custom visual components. Pass the demo module: `democraft render <demo.ts> --manifest ... --timeline ...`.",
    );
  }
  const entryPath = args.entryPath
    ? userResolve(args.entryPath)
    : usesGenericVisuals && demoPath
      ? await materializeDemoEntry(userResolve(demoPath))
      : undefined;
  const artifact = args.outputFile
    ? undefined
    : await createRenderArtifact({
        rootDirectory: resolve(workspaceRoot(), ".democraft/renders"),
        demoId: timeline.demoId,
        definitionHash: timeline.definitionHash ?? manifest.definitionHash,
        captureHash: timeline.captureHash ?? manifest.captureHash,
        captureEnvironmentHash:
          timeline.captureEnvironmentHash ?? manifest.captureEnvironmentHash,
        render: {
          fps: timeline.fps,
          durationInFrames: timeline.durationInFrames,
          mediaMode,
          scale: args.scale,
          crf: args.crf,
        },
        source: {
          manifestPath: userResolve(manifestPath),
          timelinePath: userResolve(timelinePath),
        },
      });
  const renderOutputFile = artifact
    ? artifact.temporaryOutputFile
    : userResolve(args.outputFile!);

  try {
    await renderDemoVideo({
      manifest,
      mediaMode,
      timeline,
      outputFile: renderOutputFile,
      recordingFile: recording.file,
      screenshotSrcByStepId: await buildScreenshotDataUrls(
        manifest,
        manifestPath,
      ),
      scale: args.scale,
      crf: args.crf,
      entryPath,
    });
    if (artifact) await completeRenderArtifact(artifact);
  } catch (error) {
    if (artifact) await failRenderArtifact(artifact, error);
    throw error;
  }

  if (!artifact) return ok(`Render written to ${args.outputFile}\n`);
  return ok(
    `Render written to ${artifact.outputFile}\nRender ID: ${artifact.metadata.renderId}\nMetadata: ${artifact.metadataPath}\n`,
  );
}

function validateNumericArgs(args: ParsedArgs): string | undefined {
  if (args.fps !== undefined && (!Number.isFinite(args.fps) || args.fps <= 0)) {
    return "Invalid --fps: expected a finite number greater than 0.";
  }
  if (
    args.scale !== undefined &&
    (!Number.isFinite(args.scale) || args.scale <= 0)
  ) {
    return "Invalid --scale: expected a finite number greater than 0.";
  }
  if (
    args.crf !== undefined &&
    (!Number.isFinite(args.crf) || args.crf < 0 || args.crf > 51)
  ) {
    return "Invalid --crf: expected a finite number from 0 to 51.";
  }
  if (
    args.port !== undefined &&
    (!Number.isInteger(args.port) || args.port < 1 || args.port > 65535)
  ) {
    return "Invalid --port: expected an integer from 1 to 65535.";
  }
  return undefined;
}

async function resolveRequestedRecording(
  manifest: RecordedDemoManifest,
  useRecording?: boolean,
): Promise<{ file?: string; error?: string }> {
  if (!useRecording) return {};
  if (!manifest.recording?.path) {
    return {
      error:
        'Raw recording requested with "--recording", but the manifest has no recording path.',
    };
  }

  const file = resolveRecordingPath(manifest.recording.path);
  try {
    await access(file);
    return { file };
  } catch {
    return {
      error: `Raw recording requested with "--recording", but the file was not found: ${file}`,
    };
  }
}

const DISCOVER_ORIGIN_BLOCKED_EXIT = 64;
const DISCOVER_UNSAFE_SCHEME_EXIT = 65;
const DISCOVER_TIMEOUT_EXIT = 66;
const DISCOVER_ABORTED_EXIT = 130;

/**
 * `democraft discover <url>` — produce a semantic Page Discovery map.
 * Read-only single-page snapshot (plan §5.8 Level 1). Wires SIGINT to an
 * AbortController so a user Ctrl+C cancels cleanly into exit code 130.
 */
async function runDiscoverCommand(args: ParsedArgs): Promise<CliResult> {
  if (!args.discoverUrl) {
    if (args.json) {
      // Usage error: envelope on stdout only, stderr empty (pure JSON contract).
      return {
        exitCode: 2,
        stdout: `${JSON.stringify(
          {
            ok: false,
            code: "DC_DISCOVER_MISSING_URL",
            message:
              "Missing page URL. Usage: democraft discover <url> [--allow-origin <origin>...] [--json]",
          },
          null,
          2,
        )}\n`,
        stderr: "",
      };
    }
    return fail(
      'Missing page URL.\n\nUsage: democraft discover <url> [--allow-origin <origin>...] [--json]\n',
    );
  }

  const controller = new AbortController();
  const onSigint = () => controller.abort();
  process.once("SIGINT", onSigint);
  let runId: string | undefined;
  let directory: string | undefined;
  try {
    const { discoverPage } = await import("@democraft/playwright");
    const { pageDiscovery, artifact, screenshotPath } = await discoverPage({
      url: args.discoverUrl,
      allowOrigins: args.allowOrigins,
      headless: args.headless ?? true,
      discoveryRootDir: resolve(workspaceRoot(), ".democraft", "discovery"),
      signal: controller.signal,
      onArtifactCreated: (created) => {
        runId = created.discoveryRunId;
        directory = created.outputDir;
      },
    });
    if (args.json) {
      return jsonOk({
        discovery: pageDiscovery,
        runId: artifact.discoveryRunId,
        directory: artifact.directory,
        screenshotPath,
      });
    }
    return ok(
      formatDiscoveryHuman(
        pageDiscovery,
        artifact.discoveryRunId,
        artifact.directory,
        screenshotPath,
      ),
    );
  } catch (error) {
    return formatDiscoverError(error, args.json, runId, directory);
  } finally {
    process.removeListener("SIGINT", onSigint);
  }
}

function formatDiscoverError(
  error: unknown,
  json: boolean,
  runId: string | undefined,
  directory: string | undefined,
): CliResult {
  // DiscoveryOriginError carries a stable DCxxxx code mapped to a granular exit.
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: unknown }).code);
    const message =
      error instanceof Error ? error.message : String(error);
    if (code === "DC401") {
      return json
        ? jsonFail({
            code,
            message,
            exitCode: DISCOVER_ORIGIN_BLOCKED_EXIT,
            extra: runId ? { runId, directory } : undefined,
          })
        : failExit(message, DISCOVER_ORIGIN_BLOCKED_EXIT);
    }
    if (code === "DC402") {
      return json
        ? jsonFail({
            code,
            message,
            exitCode: DISCOVER_UNSAFE_SCHEME_EXIT,
          })
        : failExit(message, DISCOVER_UNSAFE_SCHEME_EXIT);
    }
    if (code === "DC404" || message.includes("cancelled")) {
      return json
        ? jsonFail({
            code: "DC404",
            message: "Discovery was cancelled.",
            exitCode: DISCOVER_ABORTED_EXIT,
          })
        : failExit("Discovery was cancelled.\n", DISCOVER_ABORTED_EXIT);
    }
    if (code === "DC403" || message.toLowerCase().includes("timeout")) {
      return json
        ? jsonFail({
            code: "DC403",
            message,
            exitCode: DISCOVER_TIMEOUT_EXIT,
          })
        : failExit(message, DISCOVER_TIMEOUT_EXIT);
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  return json
    ? jsonFail({
        code: "DC_DISCOVER_FAILED",
        message,
        extra: runId ? { runId, directory } : undefined,
      })
    : failExit(`Discovery failed: ${message}\n`, 1);
}

function failExit(stderr: string, exitCode: number): CliResult {
  return { exitCode, stdout: "", stderr };
}

function formatDiscoveryHuman(
  discovery: { page: { url: string; title?: string }; elements: unknown[]; regions: unknown[]; collections: unknown[]; warnings: unknown[] },
  runId: string,
  directory: string,
  screenshotPath?: string,
): string {
  const lines = [
    `Discovered ${discovery.page.url}`,
    `Title: ${discovery.page.title ?? "(none)"}`,
    `Regions: ${discovery.regions.length}`,
    `Elements: ${discovery.elements.length}`,
    `Collections: ${discovery.collections.length}`,
    `Warnings: ${discovery.warnings.length}`,
    `Run ID: ${runId}`,
    `Directory: ${directory}`,
  ];
  if (screenshotPath) lines.push(`Screenshot: ${screenshotPath}`);
  lines.push("", "Pass --json for the full PageDiscovery map.");
  return `${lines.join("\n")}\n`;
}

/**
 * `democraft doctor` — environment health checks. Runs every check before
 * reporting so the agent sees the full picture (plan §10.1).
 */
async function runDoctorCommand(args: ParsedArgs): Promise<CliResult> {
  const nodeVersion = process.version;
  let playwrightInstalled = false;
  let chromiumExecutablePath: string | undefined;
  try {
    // Probe Playwright + Chromium through @democraft/playwright's binding so
    // the CLI never adds a direct `playwright` dependency. A quick headless
    // launch+close is the most honest "can we run a browser?" check; the
    // executablePath is surfaced purely for the human-readable success message.
    const { defaultBindings } = await import("@democraft/playwright");
    playwrightInstalled = true;
    const browser = await defaultBindings.chromium.launch({ headless: true });
    try {
      chromiumExecutablePath = (
        defaultBindings.chromium as unknown as {
          executablePath?: () => string;
        }
      ).executablePath?.();
    } catch {
      chromiumExecutablePath = undefined;
    }
    await browser.close();
  } catch {
    // Either Playwright failed to import or Chromium could not launch.
    chromiumExecutablePath = undefined;
  }

  const root = workspaceRoot();
  let workspaceRootWritable = false;
  try {
    await mkdir(resolve(root, ".democraft"), { recursive: true });
    workspaceRootWritable = true;
  } catch {
    workspaceRootWritable = false;
  }

  let appReachable: { url: string; ok: boolean } | undefined;
  if (args.doctorUrl) {
    try {
      const response = await fetch(args.doctorUrl, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      appReachable = { url: args.doctorUrl, ok: response.ok };
    } catch {
      appReachable = { url: args.doctorUrl, ok: false };
    }
  }

  const checks = runDoctorChecks({
    nodeVersion,
    playwrightInstalled,
    chromiumExecutablePath,
    workspaceRootWritable,
    workspaceRoot: root,
    appReachable,
  });
  const summary = summarizeDoctor(checks);
  const exitCode = summary.status === "error" ? 1 : 0;

  if (args.json) {
    const result = jsonOk({ checks, summary });
    return { ...result, exitCode };
  }

  const lines = checks.map((check) => {
    const symbol =
      check.status === "ok" ? "✓" : check.status === "warning" ? "!" : "✗";
    const line = `${symbol} ${check.id}: ${check.message}`;
    return check.suggestion ? `${line}\n    → ${check.suggestion}` : line;
  });
  lines.push(
    "",
    `Summary: ${summary.status} (${summary.errorCount} errors, ${summary.warningCount} warnings)`,
  );
  return { exitCode, stdout: "", stderr: `${lines.join("\n")}\n` };
}
