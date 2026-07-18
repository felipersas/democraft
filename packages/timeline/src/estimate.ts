/**
 * Pure presentation-duration estimation.
 *
 * The on-screen duration of a step in the rendered video is its *presentation*
 * pacing, decoupled from how long the step took to capture. This module
 * exposes that logic as pure functions so a tool or agent can estimate a
 * demo's total runtime WITHOUT launching a browser or rendering — turning a
 * render-and-measure loop into a single `inspect --json` call.
 *
 * `stepDurationMs` is the single source of truth: `resolve.ts` imports and
 * calls it, so the estimate and the actual timeline always agree on pacing.
 *
 * Action steps (click, fill, goto, camera moves, asserts) use snappy fixed
 * beats that show the change and move on. Author-paced steps (holds,
 * captions, callouts, transitions) keep their explicit durations.
 */
import type { DemoIR, DemoSceneIR, DemoStep } from "@democraft/schema";

/**
 * The presentation duration (ms) a step contributes to the rendered video,
 * based only on the authored IR — no capture data required. This is the
 * *minimum* duration; a slow capture can extend a step (resolve takes
 * `max(planned, actual)`), but the planned value is the estimate an agent
 * needs pre-capture.
 */
export function stepDurationMs(step: DemoStep): number {
  switch (step.kind) {
    case "timeline.hold":
      return step.durationMs;
    case "timeline.transition":
      return step.durationMs ?? 500;
    case "overlay.caption":
      return Math.max(1200, step.text.length * 45);
    case "overlay.callout":
      return Math.max(
        1800,
        `${step.title} ${step.description ?? ""}`.trim().length * 45,
      );
    case "overlay.visual":
      return step.durationMs ?? 1800;
    case "camera.establish":
      return 700;
    case "camera.focus":
      return 1100;
    case "browser.click":
      return 650;
    case "browser.fill":
    case "browser.select":
      return 700;
    case "browser.goto":
      return 900;
    case "assert.visible":
    case "assert.text":
    case "assert.url":
      return 300;
    case "cue":
      return 1;
  }
}

/** Per-scene estimated presentation duration (ms), summed across its steps. */
export function estimateSceneDurationMs(scene: DemoSceneIR): number {
  return scene.steps.reduce((sum, step) => sum + stepDurationMs(step), 0);
}

export type DurationEstimate = {
  /** Total estimated presentation duration in milliseconds. */
  totalMs: number;
  /** Total estimated presentation duration in seconds (1 decimal). */
  totalSeconds: number;
  /** Estimated duration in frames at the given fps. */
  totalFrames: number;
  /** Per-scene breakdown, in authored order. */
  scenes: Array<{
    sceneId: string;
    estimatedMs: number;
    estimatedFrames: number;
  }>;
};

/**
 * Estimate a demo's total rendered duration from its IR alone — no browser, no
 * capture, no render. The estimate is the sum of each step's planned
 * presentation duration; a real render may run slightly longer if capture is
 * slow, but this is the right budgeting number for an agent aiming at a target
 * length.
 */
export function estimateDemoDurationMs(
  ir: DemoIR,
  fps = 60,
): DurationEstimate {
  const scenes = ir.scenes.map((scene) => {
    const estimatedMs = estimateSceneDurationMs(scene);
    return {
      sceneId: scene.id,
      estimatedMs,
      estimatedFrames: msToFrames(estimatedMs, fps),
    };
  });
  const totalMs = scenes.reduce((sum, scene) => sum + scene.estimatedMs, 0);
  return {
    totalMs,
    totalSeconds: Math.round((totalMs / 1000) * 10) / 10,
    totalFrames: msToFrames(totalMs, fps),
    scenes,
  };
}

/** ms → frames, rounding up to at least 1 frame (matches `resolve.ts`). */
function msToFrames(ms: number, fps: number): number {
  return Math.max(1, Math.round((ms / 1000) * fps));
}
