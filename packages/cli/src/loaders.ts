import { readFile, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { dirname } from "node:path";
import type { DemoDefinition } from "@democraft/core";
import type { RecordedDemoManifest } from "@democraft/schema";
import { resolveRecordedScreenshotPath } from "@democraft/playwright";
import { userResolve, workspaceRoot } from "./paths";

export async function loadDemo(demoPath: string): Promise<DemoDefinition> {
  const resolved = userResolve(demoPath);
  if (!(await existsFile(resolved))) {
    throw new Error(
      `Demo module not found.\n` +
        `  Passed:   ${demoPath}\n` +
        `  Resolved: ${resolved}\n` +
        `  Workspace root: ${workspaceRoot()}\n` +
        `  cwd:      ${process.cwd()}\n` +
        `  INIT_CWD: ${process.env.INIT_CWD ?? "(unset)"}`,
    );
  }
  const moduleUrl = pathToFileURL(resolved).href;
  const imported = (await import(moduleUrl)) as { default?: DemoDefinition };

  if (!imported.default) {
    throw new Error(`Demo module "${demoPath}" must have a default export.`);
  }

  return imported.default;
}

async function existsFile(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isFile();
  } catch {
    return false;
  }
}

export function resolveRecordingPath(recordingPath: string): string {
  return userResolve(recordingPath);
}

export function buildScreenshotSources(
  manifest: RecordedDemoManifest,
  manifestPath: string,
): Record<string, string> {
  const runDir = dirname(userResolve(manifestPath));
  const entries = manifest.steps
    .map(
      (step) =>
        [step.stepId, resolveRecordedScreenshotPath(runDir, step)] as const,
    )
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]));
  return Object.fromEntries(
    entries.map(([stepId, screenshotPath]) => [
      stepId,
      pathToFileURL(screenshotPath).href,
    ]),
  );
}

export async function buildScreenshotDataUrls(
  manifest: RecordedDemoManifest,
  manifestPath: string,
): Promise<Record<string, string>> {
  const runDir = dirname(userResolve(manifestPath));
  const entries = await Promise.all(
    manifest.steps.map(async (step) => {
      const screenshotPath = resolveRecordedScreenshotPath(runDir, step);
      if (!screenshotPath) return undefined;
      const png = await readFile(screenshotPath);
      return [step.stepId, `data:image/png;base64,${png.toString("base64")}`];
    }),
  );
  return Object.fromEntries(entries.filter((entry) => entry !== undefined));
}
