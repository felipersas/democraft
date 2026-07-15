import { writeFile } from "node:fs/promises";
import path from "node:path";
import { compileDemo } from "@democraft/compiler";
import { resolveTimeline } from "@democraft/timeline";
import {
  compareCaptureCompatibility,
  parseRecordedDemoManifestJson,
  type RenderTimeline,
  type StudioMeta,
} from "@democraft/schema";
import { loadDemo } from "./staleness";
import { readJson } from "./server-data";

/**
 * Re-resolves the timeline from the current demo.ts + existing manifest, then
 * rewrites studio-data/timeline.json in place. This is the "live edits without
 * re-capture" path: changes whose captureHash remains equal (for example,
 * renderer selection or scene presentation metadata) flow into the preview
 * without running Playwright. See
 * docs/architecture/studio-roadmap.md "Workflow / DX".
 *
 * Returns the new timeline, or a structural result without touching
 * timeline.json when the existing screenshots cannot be safely reused.
 */
export async function reResolveTimeline(args: {
  meta: StudioMeta;
  dataDir: string;
  fps?: number;
}): Promise<
  | { timeline: RenderTimeline; structural: false }
  | { structural: true; detail: string }
  | null
> {
  const manifestPath = path.join(args.dataDir, "manifest.json");
  const manifest = await readJson(manifestPath, parseRecordedDemoManifestJson);
  if (!manifest) return null;

  const demo = await loadDemo(args.meta.demoPath);
  const compilation = await compileDemo(demo);
  const errors = compilation.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  );
  if (errors.length > 0) {
    throw new Error(
      `Cannot re-resolve an invalid demo: ${errors.map((error) => error.message).join("; ")}`,
    );
  }

  if (compilation.ir.id !== args.meta.demoId) {
    return {
      structural: true,
      detail: "The demo's human id changed. Re-capture before re-resolving.",
    };
  }

  const compatibility = compareCaptureCompatibility(
    { demoId: compilation.ir.id, captureHash: compilation.ir.captureHash },
    manifest,
  );
  if (compatibility !== "compatible") {
    return {
      structural: true,
      detail:
        compatibility === "unknown"
          ? "The capture predates compatibility hashes. Re-capture before re-resolving."
          : "Capture-affecting fields changed. Re-capture before re-resolving.",
    };
  }

  const timeline = resolveTimeline(compilation.ir, manifest, {
    fps: args.fps,
  });

  await writeFile(
    path.join(args.dataDir, "timeline.json"),
    `${JSON.stringify(timeline, null, 2)}\n`,
  );

  return { timeline, structural: false };
}
