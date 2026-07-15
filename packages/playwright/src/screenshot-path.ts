import { createHash } from "node:crypto";
import path from "node:path";
import type { RecordedStep } from "@democraft/schema";

export function canonicalScreenshotFilename(
  sceneId: string,
  stepId: string,
): string {
  const digest = createHash("sha256")
    .update(sceneId)
    .update("\0")
    .update(stepId)
    .digest("hex")
    .slice(0, 12);
  return `${safeSegment(sceneId)}-${safeSegment(stepId)}-${digest}.png`;
}

export function screenshotRelativePath(
  sceneId: string,
  stepId: string,
): string {
  return `screenshots/${canonicalScreenshotFilename(sceneId, stepId)}`;
}

export function resolveRecordedScreenshotPath(
  captureDirectory: string,
  step: Pick<RecordedStep, "sceneId" | "stepId" | "screenshotPath">,
): string | undefined {
  if (step.screenshotPath) {
    return resolveContained(captureDirectory, step.screenshotPath);
  }
  const legacy = `screenshots/${step.sceneId}-${step.stepId}.png`;
  return resolveContained(captureDirectory, legacy);
}

function resolveContained(
  root: string,
  relativePath: string,
): string | undefined {
  if (path.isAbsolute(relativePath)) return undefined;
  const rootAbsolute = path.resolve(root);
  const candidate = path.resolve(rootAbsolute, relativePath);
  const relative = path.relative(rootAbsolute, candidate);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return undefined;
  }
  return candidate;
}

function safeSegment(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "step"
  );
}
