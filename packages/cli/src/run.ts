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
  renderDemoVideo,
  type DemoMediaMode,
} from "@democraft/remotion";
import { inspectTimeline, resolveTimeline } from "@democraft/timeline";
import {
  assertCaptureCompatibility,
  parseRecordedDemoManifestJson,
  parseRenderTimelineJson,
  type RecordedDemoManifest,
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
import { userResolve, workspaceRoot } from "./paths";
import { launchStudio } from "./studio";
import type { CliResult, ParsedArgs } from "./types";

export async function runCli(argv = process.argv.slice(2)): Promise<CliResult> {
  const args = parseArgs(argv);

  if (
    !args.command ||
    args.command === "help" ||
    args.command === "--help" ||
    args.command === "-h"
  ) {
    return ok(help());
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
    ].includes(args.command)
  ) {
    return fail(`Unknown command "${args.command}".\n\n${help()}`);
  }

  const numericError = validateNumericArgs(args);
  if (numericError) return fail(numericError);

  if (!["preview", "render"].includes(args.command) && !args.demoPath) {
    return fail(`Missing demo module path.\n\n${help()}`);
  }

  if (args.command === "studio") {
    const demoPath = args.demoPath;
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
    });
    return ok(
      `Studio ready at ${url}\nData: ${dataDir}\nPress Ctrl+C to stop.\n`,
    );
  }

  if (args.command === "validate" && !args.staticOnly) {
    return fail('Only static validation is implemented. Pass "--static".');
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

  if (args.command === "render") {
    if (!args.manifestPath || !args.timelinePath) {
      return fail(
        'Missing render inputs. Pass "--manifest <manifest.json>" and "--timeline <timeline.json>".',
      );
    }

    const manifest = parseRecordedDemoManifestJson(
      await readFile(userResolve(args.manifestPath), "utf8"),
    );
    const timeline = parseRenderTimelineJson(
      await readFile(userResolve(args.timelinePath), "utf8"),
    );
    assertCaptureCompatibility(timeline, manifest);
    const recording = await resolveRequestedRecording(
      manifest,
      args.useRecording,
    );
    if (recording.error) return fail(recording.error);

    const mediaMode: DemoMediaMode = args.useRecording
      ? "recording"
      : "screenshots";
    const artifact = args.outputFile
      ? undefined
      : await createRenderArtifact({
          rootDirectory: resolve(workspaceRoot(), ".democraft/renders"),
          demoId: timeline.demoId,
          definitionHash: timeline.definitionHash ?? manifest.definitionHash,
          captureHash: timeline.captureHash ?? manifest.captureHash,
          render: {
            fps: timeline.fps,
            durationInFrames: timeline.durationInFrames,
            mediaMode,
            scale: args.scale,
            crf: args.crf,
          },
          source: {
            manifestPath: userResolve(args.manifestPath),
            timelinePath: userResolve(args.timelinePath),
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
          args.manifestPath,
        ),
        scale: args.scale,
        crf: args.crf,
        entryPath: args.entryPath ? userResolve(args.entryPath) : undefined,
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

  const demoPath = args.demoPath;
  if (!demoPath) {
    return fail(`Missing demo module path.\n\n${help()}`);
  }

  const demo = await loadDemo(demoPath);
  const compilation = await compileDemo(demo);

  if (args.command === "inspect") {
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
      fps: args.fps,
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
