import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { compileDemo, inspectIR } from "@democraft/compiler";
import { runDemo } from "@democraft/playwright";
import { renderPreviewHtml } from "@democraft/preview";
import { renderDemoVideo } from "@democraft/remotion";
import { inspectTimeline, resolveTimeline } from "@democraft/timeline";
import type { RecordedDemoManifest, RenderTimeline } from "@democraft/schema";
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
import type { CliResult } from "./types";

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

    const manifest = JSON.parse(
      await readFile(userResolve(args.manifestPath), "utf8"),
    ) as RecordedDemoManifest;
    const timeline = JSON.parse(
      await readFile(userResolve(args.timelinePath), "utf8"),
    ) as RenderTimeline;
    const outputFile =
      args.outputFile ?? `.democraft/previews/${timeline.demoId}.html`;
    const absoluteOutputFile = userResolve(outputFile);
    await mkdir(dirname(absoluteOutputFile), { recursive: true });
    await writeFile(
      absoluteOutputFile,
      renderPreviewHtml({
        manifest,
        timeline,
        videoSrc: manifest.recording?.path
          ? pathToFileURL(resolveRecordingPath(manifest.recording.path)).href
          : undefined,
        screenshotSrcByStepId: buildScreenshotSources(
          manifest,
          args.manifestPath,
        ),
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

    const manifest = JSON.parse(
      await readFile(userResolve(args.manifestPath), "utf8"),
    ) as RecordedDemoManifest;
    const timeline = JSON.parse(
      await readFile(userResolve(args.timelinePath), "utf8"),
    ) as RenderTimeline;
    const outputFile =
      args.outputFile ?? `.democraft/renders/${timeline.demoId}.mp4`;

    await renderDemoVideo({
      manifest,
      timeline,
      outputFile: userResolve(outputFile),
      recordingFile: manifest.recording?.path
        ? resolveRecordingPath(manifest.recording.path)
        : undefined,
      screenshotSrcByStepId: await buildScreenshotDataUrls(
        manifest,
        args.manifestPath,
      ),
      scale: args.scale,
      crf: args.crf,
      entryPath: args.entryPath ? userResolve(args.entryPath) : undefined,
    });

    return ok(`Render written to ${outputFile}\n`);
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

    const manifest = JSON.parse(
      await readFile(userResolve(manifestPath), "utf8"),
    ) as RecordedDemoManifest;
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

  const manifest = await runDemo(compilation.ir, {
    outputDir: args.outputDir,
    headless: args.headless,
  });

  return ok(
    args.json
      ? `${JSON.stringify(manifest, null, 2)}\n`
      : `Captured ${manifest.demoId}\nManifest: ${args.outputDir ?? `.democraft/runs/${manifest.demoId}`}/manifest.json\n`,
  );
}
