import path from "node:path";
import { resolveTimeline } from "@democraft/timeline";
import {
  compareCaptureCompatibility,
  parseRecordedDemoManifestJson,
  type RenderTimeline,
  type StudioMeta,
} from "@democraft/schema";
import { readJson } from "./server-data";
import {
  trustedCaptureEnvironmentHash,
  trustedDataDirectory,
  trustedDemoPath,
  trustedWorkspaceRoot,
} from "./studio-path-authority";
import { compileDemoModuleIsolated } from "./compile-demo-isolated";
import { writeFileContainedAtomic } from "./safe-write";
import {
  resolveExistingPathWithin,
  resolveWritePathWithin,
} from "./path-boundary";

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
  const dataDir = await trustedDataDirectory();
  await resolveExistingPathWithin(
    dataDir,
    args.dataDir,
    "Studio data directory",
  );
  const manifestPath = path.join(dataDir, "manifest.json");
  const manifest = await readJson(manifestPath, parseRecordedDemoManifestJson);
  if (!manifest) return null;

  const demoPath = await trustedDemoPath();
  const compilation = await compileDemoModuleIsolated(demoPath, {
    cwd: await trustedWorkspaceRoot(),
  });
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
    {
      demoId: compilation.ir.id,
      captureHash: compilation.ir.captureHash,
      captureEnvironmentHash: trustedCaptureEnvironmentHash(),
    },
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

  const timelinePath = await resolveWritePathWithin(
    dataDir,
    path.join(dataDir, "timeline.json"),
    "Studio timeline",
  );
  await writeFileContainedAtomic(
    dataDir,
    timelinePath,
    `${JSON.stringify(timeline, null, 2)}\n`,
    "Studio timeline",
  );

  return { timeline, structural: false };
}
