import { watch } from "node:fs";
import { studioDataDir } from "./server-data";
import { existsDir } from "./fs";
import { publishReload, publish } from "./event-bus";
import { readMeta } from "./staleness";
import { reResolveTimeline } from "./resolve-demo";

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
    const watcher = watch(
      dir,
      { recursive: true },
      (_eventType, filename) => {
        if (!filename) return;
        // meta.json changes are driven by us; don't double-reload on them.
        if (filename.endsWith("meta.json")) return;
        if (!/\.(json|png|webm|mp4)$/.test(filename)) return;
        clearTimeout(dataDebounce);
        dataDebounce = setTimeout(() => {
          publishReload();
        }, 200);
      },
    );
    process.on("exit", () => watcher.close());
  } catch {
    started = false;
  }

  // Watch demo.ts for live edits → re-resolve the timeline without re-capture.
  // This is the "Auto-reload on demo.ts change" + "Live edits without
  // re-capture" roadmap item. Captions, pacing, overlay text flow into the
  // preview instantly.
  void watchDemoSource();
}

async function watchDemoSource(): Promise<void> {
  const meta = await readMeta(studioDataDir());
  if (!meta) return; // no demo source to watch
  try {
    const watcher = watch(meta.demoPath, () => {
      clearTimeout(demoDebounce);
      demoDebounce = setTimeout(async () => {
        try {
          const result = await reResolveTimeline({
            meta,
            dataDir: studioDataDir(),
          });
          if (!result) return;
          if (result.structural) {
            // Structural change — re-resolve is unsafe; tell the UI to
            // re-capture. The file-watcher's own reload will also fire when
            // timeline.json is rewritten, refreshing the stale badge.
            publish("staleness", { kind: "structural" });
          }
          // timeline.json was rewritten → the data watcher fires `reload`.
        } catch {
          /* demo.ts may be mid-edit (syntax error); ignore transient failures */
        }
      }, 400);
    });
    process.on("exit", () => watcher.close());
  } catch {
    /* demo.ts may not exist yet; the watcher is best-effort */
  }
}
