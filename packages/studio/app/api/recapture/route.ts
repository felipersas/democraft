import { NextResponse } from "next/server";
import { redactCaptureErrorMessage, runDemo } from "@democraft/playwright";
import { readMeta, loadDemo } from "@/lib/staleness";
import {
  materializeStudioData,
  updateMetaAfterCapture,
} from "@/lib/materialize";
import { studioDataDir } from "@/lib/server-data";
import { publish } from "@/lib/event-bus";
import { compileDemo } from "@democraft/compiler";
import { resolveTimeline } from "@democraft/timeline";
import path from "node:path";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
let recaptureInFlight = false;

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
  if (recaptureInFlight) {
    return NextResponse.json(
      { error: "A re-capture is already running." },
      { status: 409 },
    );
  }
  recaptureInFlight = true;
  try {
    return await performRecapture();
  } finally {
    recaptureInFlight = false;
  }
}

async function performRecapture() {
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
    let captureDir = meta.captureDir;
    manifest = await runDemo(compilation.ir, {
      outputDir:
        meta.captureOutputDirExplicit !== false ? meta.captureDir : undefined,
      captureRootDir: path.join(meta.workspaceRoot, ".democraft", "runs"),
      onArtifactCreated: (artifact) => {
        captureDir = artifact.outputDir;
      },
    });

    publish("recapture-progress", { phase: "resolving" });
    const timeline = resolveTimeline(compilation.ir, manifest);

    publish("recapture-progress", { phase: "materializing" });
    await materializeStudioData({
      dataDir,
      captureDir,
      manifest,
      timeline,
    });
    await updateMetaAfterCapture(dataDir, meta, compilation.ir, captureDir);
  } catch (err) {
    const message = redactCaptureErrorMessage(
      err instanceof Error ? err : "Re-capture failed.",
    );
    publish("recapture-progress", {
      phase: "failed",
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }

  publish("recapture-progress", { phase: "done" });
  // The file-watcher fires `reload` when studio-data changes; nudge in case
  // the debounce is slow for a user-triggered action.
  publish("reload", {});
  return NextResponse.json({ ok: true });
}
