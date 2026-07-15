import { watch } from "node:fs";
import { studioDataDir } from "./server-data";
import { existsDir } from "./fs";
import { publishReload, publish } from "./event-bus";
import { readMeta } from "./staleness";
import { reResolveTimeline } from "./resolve-demo";
import { trustedDemoPath } from "./studio-path-authority";

let started = false;
let dataDebounce: NodeJS.Timeout | undefined;
let demoDebounce: NodeJS.Timeout | undefined;

export async function startFileWatcher(): Promise<void> {
  if (started) return;
  started = true;
  const dir = studioDataDir();
  if (!(await existsDir(dir))) {
    started = false;
    return;
  }

  // Watch studio-data for capture/render outputs → hot-reload the studio.
  try {
    const watcher = watch(dir, { recursive: true }, (_eventType, filename) => {
      if (!filename) return;
      // meta.json changes are driven by us; don't double-reload on them.
      if (filename.endsWith("meta.json")) return;
      if (!/\.(json|png|webm|mp4)$/.test(filename)) return;
      clearTimeout(dataDebounce);
      dataDebounce = setTimeout(() => {
        publishReload();
      }, 200);
    });
    process.on("exit", () => watcher.close());
  } catch {
    started = false;
  }

  // Watch demo.ts for live edits → re-resolve the timeline without re-capture.
  // This is the "Auto-reload on demo.ts change" + "Live edits without
  // re-capture" roadmap item. Only edits with the same captureHash are applied;
  // capture-affecting or legacy-unknown edits request a re-capture instead.
  void watchDemoSource();
}

async function watchDemoSource(): Promise<void> {
  const meta = await readMeta(studioDataDir());
  if (!meta) return; // no demo source to watch
  try {
    const demoPath = await trustedDemoPath();
    const watcher = watch(demoPath, () => {
      clearTimeout(demoDebounce);
      demoDebounce = setTimeout(async () => {
        await handleDemoSourceChange(studioDataDir());
      }, 400);
    });
    process.on("exit", () => watcher.close());
  } catch {
    /* demo.ts may not exist yet; the watcher is best-effort */
  }
}

/** Re-read metadata for every change so recapture provenance is never stale. */
export async function handleDemoSourceChange(dataDir: string): Promise<void> {
  try {
    const currentMeta = await readMeta(dataDir);
    if (!currentMeta) {
      throw new Error("Studio metadata disappeared during reload.");
    }
    const result = await reResolveTimeline({ meta: currentMeta, dataDir });
    if (result?.structural) {
      publish("staleness", {
        kind: "structural",
        detail: result.detail,
      });
    }
  } catch (error) {
    publish("staleness", {
      kind: "failed",
      detail:
        error instanceof Error
          ? `Live reload failed: ${error.message}`
          : "Live reload failed.",
    });
  }
}
