import { stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { compileDemo } from "@democraft/compiler";
import type { DemoDefinition } from "@democraft/core";
import type {
  RecordedDemoManifest,
  Staleness,
  StudioMeta,
} from "@democraft/schema";
import { readJson } from "./server-data";
import { existsFile } from "./fs";
import path from "node:path";

// Native dynamic import that bypasses webpack's static analysis. webpack
// rewrites `import()` expressions it can see; wrapping it in a Function makes
// the call invisible to the bundler, so Node's native resolver (with the tsx
// ESM loader registered via NODE_OPTIONS) handles the .ts import at runtime.
const nativeImport = new Function(
  "specifier",
  "return import(specifier)",
) as (specifier: string) => Promise<unknown>;

/**
 * Loads a demo module the same way the CLI does — dynamic import of the
 * default export. The tsx loader (registered via NODE_OPTIONS by the CLI)
 * transpiles the .ts on the fly.
 */
export async function loadDemo(demoPath: string): Promise<DemoDefinition> {
  const moduleUrl = pathToFileURL(demoPath).href;
  const imported = (await nativeImport(moduleUrl)) as {
    default?: DemoDefinition;
  };
  if (!imported.default) {
    throw new Error(`Demo module "${demoPath}" must have a default export.`);
  }
  return imported.default;
}

/**
 * Computes how stale the current capture is relative to the live demo.ts.
 *
 * - `failed`: the manifest has chrome-error:// pages (app was down at capture).
 * - `structural`: re-compiling demo.ts yields a different IR id — the steps,
 *   scenes, targets, or captions changed. Re-capture needed (new screenshots).
 * - `content`: the IR id matches but demo.ts's mtime is newer than the
 *   manifest's — cosmetic edit (whitespace/comments). Re-resolve is safe but
 *   the capture itself is still valid.
 * - `fresh`: nothing changed.
 *
 * Returns `fresh` when meta or manifest is missing (studio has no baseline to
 * compare against — e.g. opened without ever capturing).
 */
export async function computeStaleness(args: {
  meta?: StudioMeta;
  manifest?: RecordedDemoManifest;
  dataDir: string;
}): Promise<Staleness> {
  const { meta, manifest } = args;
  if (!meta || !manifest) return { kind: "fresh" };

  // Capture-failure check: cheapest, and the most important signal for the
  // user (their screenshots are all error pages).
  const failedCapture = manifest.steps.some((step) =>
    step.url?.startsWith("chrome-error://"),
  );
  if (failedCapture) {
    return {
      kind: "failed",
      detail: "Capture ran while the app was down (chrome-error pages).",
    };
  }

  // Re-compile the demo and compare the content-derived id. If it changed,
  // the demo's structure changed (steps/targets/captions) → re-capture needed.
  try {
    const demo = await loadDemo(meta.demoPath);
    const compilation = await compileDemo(demo);
    if (compilation.ir.id !== manifest.demoId) {
      return {
        kind: "structural",
        detail:
          "demo.ts changed structurally since capture. Re-capture to refresh screenshots.",
      };
    }
    // Same IR — check whether the file was touched at all (cosmetic edit).
    const demoMtime = (await stat(meta.demoPath)).mtimeMs;
    const manifestMtime = (
      await stat(path.join(args.dataDir, "manifest.json"))
    ).mtimeMs;
    if (demoMtime > manifestMtime) {
      return {
        kind: "content",
        detail:
          "demo.ts was edited but the structure is unchanged. Re-resolve is safe.",
      };
    }
    return { kind: "fresh" };
  } catch {
    // demo.ts unresolvable (moved/deleted) — can't determine staleness.
    return {
      kind: "fresh",
      detail: "Could not read demo.ts to check staleness.",
    };
  }
}

/** Reads meta.json from the studio-data dir, if present. */
export async function readMeta(
  dataDir: string,
): Promise<StudioMeta | undefined> {
  return readJson<StudioMeta>(path.join(dataDir, "meta.json"));
}

export { existsFile };
