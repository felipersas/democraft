import { access, mkdir } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import {
  parseDemoIR,
  parseRecordedDemoManifest,
  schemaVersion,
  type DemoIR,
  type Diagnostic,
  type RecordedDemoManifest,
  type RecordedStep,
} from "@democraft/schema";
import { defaultBindings } from "./bindings";
import { executeStep } from "./execute";
import { DEFAULT_SETTLE_STRATEGY } from "./types";
import {
  cancelCaptureArtifact,
  CaptureAbortError,
  completeCaptureArtifact,
  createCaptureArtifact,
  failCaptureArtifact,
  isCaptureAbort,
  startCaptureArtifact,
  writeCaptureManifestAtomic,
} from "./capture-artifacts";
import type {
  BrowserContextLike,
  BrowserLike,
  PageLike,
  PlaywrightBindings,
  RunDemoOptions,
  SettleStrategy,
} from "./types";

export async function runDemo(
  ir: DemoIR,
  options: RunDemoOptions = {},
): Promise<RecordedDemoManifest> {
  return runDemoWithBindings(ir, defaultBindings, options);
}

export async function runDemoWithBindings(
  ir: DemoIR,
  bindings: PlaywrightBindings,
  options: RunDemoOptions = {},
): Promise<RecordedDemoManifest> {
  ir = parseDemoIR(ir);
  const environment = options.environment ?? {};
  const viewport = environment.viewport ?? { width: 1920, height: 1080 };
  const deviceScaleFactor = environment.deviceScaleFactor ?? 2;
  const timeoutMs = options.timeoutMs ?? 8000;
  assertPositiveFinite("viewport.width", viewport.width);
  assertPositiveFinite("viewport.height", viewport.height);
  assertPositiveFinite("deviceScaleFactor", deviceScaleFactor);
  assertPositiveFinite("timeoutMs", timeoutMs);
  throwIfAborted(options.signal);

  const settleStrategy = resolveSettleStrategy(environment.settle);
  const artifact = await createCaptureArtifact({
    rootDirectory: options.captureRootDir ?? resolve(".democraft", "runs"),
    outputDirectory: options.outputDir,
    demoId: ir.id,
    definitionHash: ir.definitionHash,
    captureHash: ir.captureHash,
    environment: {
      headless: options.headless ?? true,
      viewport,
      deviceScaleFactor,
      locale: environment.locale ?? "en-US",
      timezone: environment.timezone ?? "UTC",
      settle: settleStrategy ?? false,
      timeoutMs,
    },
  });
  const diagnostics: Diagnostic[] = [];
  const steps: RecordedStep[] = [];
  let browser: BrowserLike | undefined;
  let context: BrowserContextLike | undefined;
  let page: PageLike | undefined;
  let traceStarted = false;
  let recordingPath: string | undefined;
  let traceAvailable = false;

  try {
    await startCaptureArtifact(artifact);
    await options.onArtifactCreated?.({
      captureRunId: artifact.captureRunId,
      outputDir: artifact.directory,
      manifestPath: artifact.manifestPath,
      metadataPath: artifact.metadataPath,
    });
    throwIfAborted(options.signal);
    await mkdir(artifact.screenshotsPath, { recursive: true });
    throwIfAborted(options.signal);

    browser = await bindings.chromium.launch({
      headless: options.headless ?? true,
    });
    throwIfAborted(options.signal);
    context = await browser.newContext({
      viewport,
      deviceScaleFactor,
      locale: environment.locale ?? "en-US",
      timezoneId: environment.timezone ?? "UTC",
      storageState: environment.storageState,
      recordVideo: { dir: artifact.directory, size: viewport },
    });
    let executionFailed = false;
    let executionError: unknown;
    let cleanupFailed = false;
    let cleanupError: unknown;
    try {
      throwIfAborted(options.signal);
      await context.tracing?.start({
        screenshots: true,
        snapshots: true,
        sources: true,
      });
      traceStarted = Boolean(context.tracing);
      throwIfAborted(options.signal);
      page = await context.newPage();

      for (const scene of ir.scenes) {
        for (const step of scene.steps) {
          throwIfAborted(options.signal);
          const recorded = await executeStep({
            ir,
            page,
            sceneId: scene.id,
            step,
            // Default 8s: SPAs (Next App Router) can take several seconds to
            // swap a route on a cold code-split chunk, and this timeout gates
            // both target resolution and click-navigation. Override for faster
            // apps or mock runtimes.
            timeoutMs,
            screenshotsPath: artifact.screenshotsPath,
            diagnostics,
            settleStrategy,
          });
          steps.push(recorded);
          throwIfAborted(options.signal);
        }
      }
    } catch (error) {
      executionFailed = true;
      executionError = error;
    } finally {
      if (traceStarted) {
        try {
          await context.tracing?.stop({ path: artifact.tracePath });
        } catch (error) {
          cleanupFailed = true;
          cleanupError = error;
        }
        if (!cleanupFailed) {
          traceAvailable = await access(artifact.tracePath)
            .then(() => true)
            .catch(() => false);
        }
      }
      try {
        await context.close();
      } catch (error) {
        if (!cleanupFailed) cleanupError = error;
        cleanupFailed = true;
      }
      try {
        recordingPath = await page
          ?.video?.()
          ?.path()
          .catch(() => undefined);
      } catch {
        // Video is optional; Playwright can omit it when context setup fails.
      }
    }
    if (executionFailed) throw executionError;
    if (cleanupFailed) throw cleanupError;
    await browser.close();
    browser = undefined;
    throwIfAborted(options.signal);
    const manifest = parseRecordedDemoManifest({
      schemaVersion,
      demoId: ir.id,
      captureRunId: artifact.captureRunId,
      definitionHash: ir.definitionHash,
      captureHash: ir.captureHash,
      capture: {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor,
      },
      recording: recordingPath
        ? {
            path: publicArtifactPath(recordingPath),
            width: viewport.width,
            height: viewport.height,
          }
        : undefined,
      tracePath: traceAvailable
        ? publicArtifactPath(artifact.tracePath)
        : undefined,
      screenshotsPath: publicArtifactPath(artifact.screenshotsPath),
      steps,
      diagnostics,
    });

    await writeCaptureManifestAtomic(
      artifact,
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    await completeCaptureArtifact(artifact, { recordingPath, traceAvailable });
    return manifest;
  } catch (error) {
    try {
      if (isCaptureAbort(error, options.signal)) {
        await cancelCaptureArtifact(artifact);
      } else {
        await failCaptureArtifact(artifact, error);
      }
    } catch {
      // Preserve the operational error; terminal persistence is best-effort.
    }
    throw error;
  } finally {
    await browser?.close().catch(() => undefined);
    await artifact.releaseLock?.();
  }
}

function assertPositiveFinite(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite number greater than 0.`);
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw new CaptureAbortError();
}

function publicArtifactPath(target: string): string {
  const absolute = resolve(target);
  const fromCwd = relative(process.cwd(), absolute);
  return fromCwd && !fromCwd.startsWith("..") && !isAbsolute(fromCwd)
    ? fromCwd
    : absolute;
}

/**
 * Resolve the user-provided settle option into a fully-specified strategy (or
 * `undefined` when disabled).
 *
 * - `undefined` (omitted) → {@link DEFAULT_SETTLE_STRATEGY} (DOM + visual,
 *   350ms idle window, 4s timeout). Capture settles automatically — no author
 *   configuration needed.
 * - `false` → `undefined` (settling disabled; falls back to the fixed hold).
 * - partial `SettleStrategy` → merged over the defaults so callers can tune a
 *   single knob (e.g. `{ idleWindowMs: 600 }`) without restating the rest.
 */
function resolveSettleStrategy(
  settle: SettleStrategy | false | undefined,
): Required<SettleStrategy> | undefined {
  if (settle === false) return undefined;
  if (settle === undefined) return { ...DEFAULT_SETTLE_STRATEGY };
  return { ...DEFAULT_SETTLE_STRATEGY, ...settle };
}
