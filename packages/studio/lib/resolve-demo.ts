import { writeFile } from "node:fs/promises";
import path from "node:path";
import { compileDemo } from "@democraft/compiler";
import { resolveTimeline } from "@democraft/timeline";
import type { RecordedDemoManifest, RenderTimeline, StudioMeta } from "@democraft/schema";
import { loadDemo } from "./staleness";
import { readJson } from "./server-data";

/**
 * Re-resolves the timeline from the current demo.ts + existing manifest, then
 * rewrites studio-data/timeline.json in place. This is the "live edits without
 * re-capture" path: caption text, pacing, and overlay changes from demo.ts
 * flow into the preview instantly, without running Playwright. See
 * docs/architecture/studio-roadmap.md "Workflow / DX".
 *
 * Returns the new timeline, or `null` if the manifest is missing or the IR id
 * changed structurally (caller should prompt re-capture instead).
 */
export async function reResolveTimeline(args: {
  meta: StudioMeta;
  dataDir: string;
  fps?: number;
}): Promise<{ timeline: RenderTimeline; structural: boolean } | null> {
  const manifestPath = path.join(args.dataDir, "manifest.json");
  const manifest = await readJson<RecordedDemoManifest>(manifestPath);
  if (!manifest) return null;

  const demo = await loadDemo(args.meta.demoPath);
  const compilation = await compileDemo(demo);
  // If the IR id drifted from what was captured, the step/target structure
  // changed — re-resolve would produce a timeline that doesn't match the
  // captured screenshots. Surface this to the caller.
  const structural = compilation.ir.id !== manifest.demoId;

  const timeline = resolveTimeline(compilation.ir, manifest, {
    fps: args.fps,
  });

  await writeFile(
    path.join(args.dataDir, "timeline.json"),
    `${JSON.stringify(timeline, null, 2)}\n`,
  );

  return { timeline, structural };
}
