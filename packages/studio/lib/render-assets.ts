import { readFile } from "node:fs/promises";
import type { RecordedDemoManifest } from "@democraft/schema";
import { resolveRecordedScreenshotPath } from "@democraft/playwright";
import { existsFile } from "./fs";
import { resolveExistingPathWithin } from "./path-boundary";

/**
 * Loads the settled screenshots consumed by the Studio render queue. Keeping
 * this path screenshot-only makes the Studio preview and its rendered output
 * use the same stable, post-settle media as the CLI's default render.
 */

export async function loadScreenshotDataUris(
  manifest: RecordedDemoManifest,
  dataDir: string,
): Promise<Record<string, string>> {
  const byStepId: Record<string, string> = {};
  for (const step of manifest.steps) {
    const file = resolveRecordedScreenshotPath(dataDir, step);
    if (!file) continue;
    if (await existsFile(file)) {
      const safeFile = await resolveExistingPathWithin(
        dataDir,
        file,
        `Render screenshot for step ${step.stepId}`,
      );
      const png = await readFile(safeFile);
      byStepId[step.stepId] = `data:image/png;base64,${png.toString("base64")}`;
    }
  }
  return byStepId;
}
