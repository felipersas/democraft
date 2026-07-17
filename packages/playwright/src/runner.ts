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
import {
  resolveCaptureEnvironment,
  resolveSettleStrategy,
} from "./environment-fingerprint";
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
  const configuredEnvironment = options.environment ?? {};
  if (ir.authentication && configuredEnvironment.storageState) {
    throw new AuthenticationConfigurationError(
      "A demo authentication profile and --storage-state cannot be used together.",
      ir.authentication.profileId,
    );
  }
  if (ir.authentication && !options.authentication) {
    throw new AuthenticationConfigurationError(
      `Authentication profile ${ir.authentication.profileId} cannot be resolved by this runtime.`,
      ir.authentication.profileId,
    );
  }
  const prepared = ir.authentication
    ? await options.authentication!.prepare(ir.authentication.profileId)
    : undefined;
  const restoredState = prepared
    ? parseAuthenticationState(prepared.state)
    : undefined;
  const resolvedEnvironment = await resolveCaptureEnvironment(
    options,
    undefined,
    ir.authentication && prepared
      ? {
          profileId: ir.authentication.profileId,
          stateSha256: prepared.stateSha256,
        }
      : undefined,
  );
  const environment = resolvedEnvironment.environment;
  const viewport = environment.viewport;
  const deviceScaleFactor = environment.deviceScaleFactor;
  const timeoutMs = environment.timeoutMs;
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
    captureEnvironmentHash: resolvedEnvironment.captureEnvironmentHash,
    environment,
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
      headless: environment.headless,
    });
    throwIfAborted(options.signal);
    context = await browser.newContext({
      viewport,
      deviceScaleFactor,
      locale: environment.locale,
      timezoneId: environment.timezone,
      storageState: restoredState ?? configuredEnvironment.storageState,
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
      captureEnvironmentHash: resolvedEnvironment.captureEnvironmentHash,
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

export class AuthenticationConfigurationError extends Error {
  readonly public;
  readonly stage = "capture-preflight";
  constructor(
    message: string,
    readonly profileId?: string,
    readonly code:
      "AUTH_NOT_CONFIGURED" | "AUTH_STATE_CORRUPT" = "AUTH_NOT_CONFIGURED",
  ) {
    super(message);
    this.name = "AuthenticationConfigurationError";
    this.public = {
      code,
      profileId,
      status: code === "AUTH_STATE_CORRUPT" ? ("invalid" as const) : undefined,
      actionRequired:
        code === "AUTH_STATE_CORRUPT"
          ? ("repair-state" as const)
          : ("choose-profile" as const),
      message,
      stage: this.stage,
    };
  }
}

function parseAuthenticationState(state: Uint8Array): {
  cookies: unknown[];
  origins: unknown[];
} {
  try {
    const envelope = JSON.parse(Buffer.from(state).toString("utf8")) as {
      schemaVersion?: unknown;
      data?: { cookies?: unknown; origins?: unknown };
    };
    if (
      envelope.schemaVersion === 1 &&
      Array.isArray(envelope.data?.cookies) &&
      Array.isArray(envelope.data.origins)
    ) {
      return { cookies: envelope.data.cookies, origins: envelope.data.origins };
    }
  } catch {
    // Converted to a public, state-free error below.
  }
  throw new AuthenticationConfigurationError(
    "The authentication state is corrupt and must be renewed.",
    undefined,
    "AUTH_STATE_CORRUPT",
  );
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
