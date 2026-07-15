import path from "node:path";
import { readFile } from "node:fs/promises";
import type { RecordedDemoManifest } from "@democraft/schema";
import { existsFile } from "./fs";

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
    const file = path.join(
      dataDir,
      "screenshots",
      `${step.sceneId}-${step.stepId}.png`,
    );
    if (await existsFile(file)) {
      const png = await readFile(file);
      byStepId[step.stepId] = `data:image/png;base64,${png.toString("base64")}`;
    }
  }
  return byStepId;
}
