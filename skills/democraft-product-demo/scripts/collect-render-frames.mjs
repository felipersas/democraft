#!/usr/bin/env node
/**
 * collect-render-frames.mjs — choose deterministic frame times for review.
 *
 * Input: a render timeline JSON produced by `democraft timeline`.
 * Output: JSON with scene start/middle/end frames. This helper does not render
 * images; it gives agents stable sentinel frame numbers to inspect with the
 * project's render tooling.
 *
 * Usage: node collect-render-frames.mjs timeline.json [fps]
 */
import { readFile } from "node:fs/promises";

const timelinePath = process.argv[2];
if (!timelinePath) {
  console.error("Usage: collect-render-frames.mjs timeline.json [fps]");
  process.exit(2);
}

const fps = Number(process.argv[3] ?? 30);
if (!Number.isFinite(fps) || fps <= 0) {
  console.error("fps must be a positive number");
  process.exit(2);
}

const timeline = JSON.parse(await readFile(timelinePath, "utf8"));
const scenes = Array.isArray(timeline.scenes) ? timeline.scenes : [];

const frames = scenes.flatMap((scene, index) => {
  const startMs = Number(scene.startMs ?? scene.start ?? 0);
  const durationMs = Number(scene.durationMs ?? scene.duration ?? 0);
  const sceneId = String(scene.id ?? scene.sceneId ?? `scene-${index + 1}`);
  const points = [
    ["start", startMs],
    ["middle", startMs + durationMs / 2],
    ["end", Math.max(startMs, startMs + durationMs - 1)],
  ];
  return points.map(([kind, timeMs]) => ({
    sceneId,
    kind,
    timeMs: Math.round(Number(timeMs)),
    frame: Math.max(0, Math.round((Number(timeMs) / 1000) * fps)),
  }));
});

console.log(JSON.stringify({ fps, frames }, null, 2));
