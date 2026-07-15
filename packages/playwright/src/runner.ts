import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
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
import type {
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
  assertPositiveFinite("viewport.width", viewport.width);
  assertPositiveFinite("viewport.height", viewport.height);
  assertPositiveFinite("deviceScaleFactor", deviceScaleFactor);

  const outputDir = options.outputDir ?? join(".democraft", "runs", ir.id);
  const screenshotsPath = join(outputDir, "screenshots");
  const diagnostics: Diagnostic[] = [];
  const steps: RecordedStep[] = [];
  // Resolve the settle strategy: defaults to DOM+visual settling (captures after
  // the page quiets down), `false` disables it (legacy fixed-hold behavior).
  const settleStrategy = resolveSettleStrategy(environment.settle);

  await mkdir(screenshotsPath, { recursive: true });

  const browser = await bindings.chromium.launch({
    headless: options.headless ?? true,
  });

  try {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor,
      locale: environment.locale ?? "en-US",
      timezoneId: environment.timezone ?? "UTC",
      storageState: environment.storageState,
      recordVideo: { dir: outputDir, size: viewport },
    });

    const tracePath = join(outputDir, "trace.zip");
    await context.tracing?.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });

    let page: PageLike | undefined;

    try {
      page = await context.newPage();

      for (const scene of ir.scenes) {
        for (const step of scene.steps) {
          const recorded = await executeStep({
            ir,
            page,
            sceneId: scene.id,
            step,
            // Default 8s: SPAs (Next App Router) can take several seconds to
            // swap a route on a cold code-split chunk, and this timeout gates
            // both target resolution and click-navigation. Override for faster
            // apps or mock runtimes.
            timeoutMs: options.timeoutMs ?? 8000,
            screenshotsPath,
            diagnostics,
            settleStrategy,
          });
          steps.push(recorded);
        }
      }

      await context.tracing?.stop({ path: tracePath });
    } finally {
      await context.close();
    }

    const recordingPath = await page
      ?.video?.()
      ?.path()
      .catch(() => undefined);
    const manifest = parseRecordedDemoManifest({
      schemaVersion,
      demoId: ir.id,
      definitionHash: ir.definitionHash,
      captureHash: ir.captureHash,
      capture: {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor,
      },
      recording: recordingPath
        ? {
            path: recordingPath,
            width: viewport.width,
            height: viewport.height,
          }
        : undefined,
      tracePath,
      screenshotsPath,
      steps,
      diagnostics,
    });

    await writeFile(
      join(outputDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    return manifest;
  } finally {
    await browser.close();
  }
}

function assertPositiveFinite(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite number greater than 0.`);
  }
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
