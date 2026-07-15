import { NextResponse } from "next/server";
import { runDemo } from "@democraft/playwright";
import { readMeta, loadDemo } from "@/lib/staleness";
import {
  materializeStudioData,
  updateMetaAfterCapture,
} from "@/lib/materialize";
import { studioDataDir } from "@/lib/server-data";
import { publish } from "@/lib/event-bus";
import { compileDemo } from "@democraft/compiler";
import { resolveTimeline } from "@democraft/timeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Re-runs the Playwright capture for the demo the studio was launched with,
 * then materializes the fresh artifacts into studio-data. The file-watcher
 * picks up the rewritten files and pushes a `reload` to the browser, so the
 * studio hot-reloads automatically when the capture completes.
 *
 * Progress is published as `recapture-progress` events over SSE so the UI
 * can show a spinner/state.
 */
export async function POST() {
  const dataDir = studioDataDir();
  const meta = await readMeta(dataDir);
  if (!meta) {
    return NextResponse.json(
      { error: "No demo metadata found. Launch via `democraft studio` first." },
      { status: 404 },
    );
  }

  publish("recapture-progress", { phase: "compiling" });
  let manifest;
  try {
    const demo = await loadDemo(meta.demoPath);
    const compilation = await compileDemo(demo);
    const errors = compilation.diagnostics.filter(
      (diagnostic) => diagnostic.severity === "error",
    );
    if (errors.length > 0) {
      throw new Error(
        `Static validation failed: ${errors.map((error) => error.message).join("; ")}`,
      );
    }

    publish("recapture-progress", { phase: "capturing" });
    manifest = await runDemo(compilation.ir, { outputDir: meta.captureDir });

    publish("recapture-progress", { phase: "resolving" });
    const timeline = resolveTimeline(compilation.ir, manifest);

    publish("recapture-progress", { phase: "materializing" });
    await materializeStudioData({
      dataDir,
      captureDir: meta.captureDir,
      manifest,
      timeline,
    });
    await updateMetaAfterCapture(dataDir, meta, compilation.ir);
  } catch (err) {
    publish("recapture-progress", {
      phase: "failed",
      error: err instanceof Error ? err.message : "Re-capture failed.",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Re-capture failed." },
      { status: 500 },
    );
  }

  publish("recapture-progress", { phase: "done" });
  // The file-watcher fires `reload` when studio-data changes; nudge in case
  // the debounce is slow for a user-triggered action.
  publish("reload", {});
  return NextResponse.json({ ok: true });
}
