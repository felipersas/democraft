import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  DemoIR,
  Diagnostic,
  RecordedDemoManifest,
  RecordedStep,
} from "@democraft/schema";
import { schemaVersion } from "@democraft/schema";
import { defaultBindings } from "./bindings";
import { executeStep } from "./execute";
import type { PageLike, PlaywrightBindings, RunDemoOptions } from "./types";

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
  const outputDir = options.outputDir ?? join(".democraft", "runs", ir.id);
  const screenshotsPath = join(outputDir, "screenshots");
  const diagnostics: Diagnostic[] = [];
  const steps: RecordedStep[] = [];
  const environment = options.environment ?? {};
  const viewport = environment.viewport ?? { width: 1920, height: 1080 };
  const deviceScaleFactor = environment.deviceScaleFactor ?? 2;

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
            timeoutMs: options.timeoutMs ?? 5000,
            screenshotsPath,
            diagnostics,
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
    const manifest: RecordedDemoManifest = {
      schemaVersion,
      demoId: ir.id,
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
    };

    await writeFile(
      join(outputDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    return manifest;
  } finally {
    await browser.close();
  }
}
