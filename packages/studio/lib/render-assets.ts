import path from "node:path";
import { readFile } from "node:fs/promises";
import type { RecordedDemoManifest } from "@democraft/schema";
import { existsFile } from "./fs";

/**
 * Gathers the recording + screenshots that the Remotion renderer needs,
 * producing the same shapes the client player consumes (base64 data URIs for
 * screenshots, absolute file path for the recording). Extracted from
 * render-queue.runJob so both can be tested independently.
 */

export async function resolveRecordingFile(
  dataDir: string,
  recordingSrc?: string,
): Promise<string | undefined> {
  if (!recordingSrc) return undefined;
  const file = path.join(dataDir, "recording.webm");
  return (await existsFile(file)) ? file : undefined;
}

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
