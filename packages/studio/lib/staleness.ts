import { stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { compileDemo } from "@democraft/compiler";
import type { DemoDefinition } from "@democraft/core";
import {
  compareCaptureCompatibility,
  parseStudioMetaJson,
  type RecordedDemoManifest,
  type Staleness,
  type StudioMeta,
} from "@democraft/schema";
import { readJson } from "./server-data";
import { existsFile } from "./fs";
import path from "node:path";
import { resolveExistingPathWithin } from "./path-boundary";
import { trustedDemoPath } from "./studio-path-authority";

// Native dynamic import that bypasses webpack's static analysis. webpack
// rewrites `import()` expressions it can see; wrapping it in a Function makes
// the call invisible to the bundler, so Node's native resolver (with the tsx
// ESM loader registered via NODE_OPTIONS) handles the .ts import at runtime.
const nativeImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<unknown>;

/**
 * Loads a demo module the same way the CLI does — dynamic import of the
 * default export. The tsx loader (registered via NODE_OPTIONS by the CLI)
 * transpiles the .ts on the fly.
 */
export async function loadDemo(
  demoPath: string,
  options: { version?: string | number } = {},
): Promise<DemoDefinition> {
  const authorized = await trustedDemoPath();
  const canonical = await resolveExistingPathWithin(
    path.dirname(authorized),
    demoPath,
    "Demo module import",
  );
  if (canonical !== authorized) {
    throw new Error(`Demo module is not the file authorized at Studio launch.`);
  }
  const file = await stat(canonical);
  const moduleUrl = new URL(pathToFileURL(canonical));
  moduleUrl.searchParams.set(
    "democraft-version",
    String(options.version ?? `${file.mtimeMs}-${file.size}`),
  );
  const imported = (await nativeImport(moduleUrl.href)) as {
    default?: DemoDefinition;
  };
  if (!imported.default) {
    throw new Error(`Demo module "${canonical}" must have a default export.`);
  }
  return imported.default;
}

/**
 * Computes how stale the current capture is relative to the live demo.ts.
 *
 * - `failed`: the manifest has chrome-error:// pages (app was down at capture).
 * - `structural`: human identity or capture compatibility differs (or cannot
 *   be established for a legacy capture). Re-capture needed.
 * - `content`: the complete author definition changed while captureHash stayed
 *   compatible, or only the file mtime changed. Re-resolve is safe.
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

  try {
    const demoPath = await trustedDemoPath();
    const demo = await loadDemo(demoPath);
    const compilation = await compileDemo(demo);
    const errors = compilation.diagnostics.filter(
      (diagnostic) => diagnostic.severity === "error",
    );
    if (errors.length > 0) {
      return {
        kind: "failed",
        detail: `Demo compilation failed: ${errors.map((error) => error.message).join("; ")}`,
      };
    }
    if (compilation.ir.id !== meta.demoId) {
      return {
        kind: "structural",
        detail: "The demo's human id changed. Re-capture is required.",
      };
    }

    const compatibility = compareCaptureCompatibility(
      { demoId: compilation.ir.id, captureHash: compilation.ir.captureHash },
      manifest,
    );
    if (compatibility === "unknown") {
      return {
        kind: "structural",
        detail:
          "Capture predates compatibility hashes. Re-capture once before reusing screenshots.",
      };
    }
    if (compatibility === "incompatible") {
      return {
        kind: "structural",
        detail:
          "Demo identity or capture-affecting fields changed. Re-capture to refresh screenshots.",
      };
    }
    if (
      compilation.ir.definitionHash &&
      manifest.definitionHash &&
      compilation.ir.definitionHash !== manifest.definitionHash
    ) {
      return {
        kind: "content",
        detail:
          "Presentation-only fields changed. Re-resolve can reuse the existing screenshots.",
      };
    }

    const manifestPath = await resolveExistingPathWithin(
      args.dataDir,
      path.join(args.dataDir, "manifest.json"),
      "Studio manifest",
    );
    const demoMtime = (await stat(demoPath)).mtimeMs;
    const manifestMtime = (await stat(manifestPath)).mtimeMs;
    if (demoMtime > manifestMtime) {
      return {
        kind: "content",
        detail:
          "demo.ts was edited but the structure is unchanged. Re-resolve is safe.",
      };
    }
    return { kind: "fresh" };
  } catch {
    return {
      kind: "failed",
      detail: "Could not compile demo.ts to check capture compatibility.",
    };
  }
}

/** Reads meta.json from the studio-data dir, if present. */
export async function readMeta(
  dataDir: string,
): Promise<StudioMeta | undefined> {
  return readJson(
    path.join(dataDir, "meta.json"),
    parseStudioMetaJson,
    dataDir,
  );
}

export { existsFile };
