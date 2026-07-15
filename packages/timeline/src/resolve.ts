import {
  assertCaptureCompatibility,
  type BoundingBox,
  type DemoIR,
  type DemoStep,
  type RecordedDemoManifest,
  type RecordedStep,
  type RenderStep,
  type RenderTimeline,
  schemaVersion,
} from "@democraft/schema";
import type { ResolveTimelineOptions } from "./types";

export function resolveTimeline(
  ir: DemoIR,
  manifest: RecordedDemoManifest,
  options: ResolveTimelineOptions = {},
): RenderTimeline {
  assertCaptureCompatibility(
    { demoId: ir.id, captureHash: ir.captureHash },
    manifest,
  );
  const fps = options.fps ?? 60;
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new RangeError(
      `Timeline fps must be a finite number greater than 0.`,
    );
  }
  const recordedByStepId = new Map(
    manifest.steps.map((step) => [step.stepId, step]),
  );
  let cursorFrame = 0;
  const timeline: RenderTimeline = {
    schemaVersion,
    demoId: ir.id,
    definitionHash: ir.definitionHash,
    captureHash:
      ir.captureHash && manifest.captureHash ? ir.captureHash : undefined,
    captureEnvironmentHash: manifest.captureEnvironmentHash,
    fps,
    durationInFrames: 0,
    scenes: [],
    camera: [],
    cursor: [],
    overlays: [],
  };

  for (const scene of ir.scenes) {
    const sceneFromFrame = cursorFrame;
    const renderSteps: RenderStep[] = [];

    for (const step of scene.steps) {
      const recordedStep = recordedByStepId.get(step.id);
      const durationInFrames = msToFrames(stepDurationMs(step), fps);
      const renderStep: RenderStep = {
        stepId: step.id,
        sceneId: scene.id,
        kind: step.kind,
        fromFrame: cursorFrame,
        durationInFrames,
        targetSnapshot: recordedStep?.targetSnapshot,
      };
      renderSteps.push(renderStep);
      collectTracks(timeline, step, renderStep, recordedStep);
      cursorFrame += durationInFrames;
    }

    timeline.scenes.push({
      id: scene.id,
      fromFrame: sceneFromFrame,
      durationInFrames: cursorFrame - sceneFromFrame,
      steps: renderSteps,
    });
  }

  timeline.durationInFrames = cursorFrame;
  return timeline;
}

function collectTracks(
  timeline: RenderTimeline,
  step: DemoStep,
  renderStep: RenderStep,
  recordedStep?: RecordedStep,
) {
  switch (step.kind) {
    case "camera.establish":
    case "camera.focus":
      timeline.camera.push({
        id: `${renderStep.stepId}.camera`,
        stepId: renderStep.stepId,
        sceneId: renderStep.sceneId,
        kind: step.kind === "camera.establish" ? "establish" : "focus",
        targetId: "target" in step ? step.target : undefined,
        fromFrame: renderStep.fromFrame,
        durationInFrames: renderStep.durationInFrames,
        boundingBox: recordedStep?.targetSnapshot?.boundingBox,
      });
      break;
    case "browser.click": {
      const box = recordedStep?.targetSnapshot?.boundingBox;
      timeline.cursor.push({
        id: `${renderStep.stepId}.cursor`,
        stepId: renderStep.stepId,
        sceneId: renderStep.sceneId,
        kind: "click",
        targetId: step.target,
        fromFrame: renderStep.fromFrame,
        durationInFrames: renderStep.durationInFrames,
        point: box ? center(box) : undefined,
      });
      break;
    }
    case "overlay.caption":
      timeline.overlays.push({
        id: `${renderStep.stepId}.overlay`,
        stepId: renderStep.stepId,
        sceneId: renderStep.sceneId,
        kind: "caption",
        text: step.text,
        fromFrame: renderStep.fromFrame,
        durationInFrames: renderStep.durationInFrames,
        renderer: step.renderer,
      });
      break;
    case "overlay.callout":
      timeline.overlays.push({
        id: `${renderStep.stepId}.overlay`,
        stepId: renderStep.stepId,
        sceneId: renderStep.sceneId,
        kind: "callout",
        targetId: step.target,
        title: step.title,
        description: step.description,
        fromFrame: renderStep.fromFrame,
        durationInFrames: renderStep.durationInFrames,
        boundingBox: recordedStep?.targetSnapshot?.boundingBox,
        renderer: step.renderer,
      });
      break;
    case "overlay.visual":
      timeline.overlays.push({
        id: `${renderStep.stepId}.overlay`,
        stepId: renderStep.stepId,
        sceneId: renderStep.sceneId,
        kind: "visual",
        visual: step.visual,
        props: step.props,
        fromFrame: renderStep.fromFrame,
        durationInFrames: renderStep.durationInFrames,
      });
      break;
    default:
      break;
  }
}

/**
 * The on-screen duration of a step in the rendered video — its *presentation*
 * pacing, decoupled from how long the step took to capture.
 *
 * Capture duration (settle + network + rendering) is concerned with picking
 * the *right frame*: the runtime waits for the page to settle so the
 * screenshot reflects the fully-loaded view. That wait should not leak into
 * the video's timeline — otherwise every navigation inflates the duration with
 * dead air (a 0.7s click ballooning to 4s of frozen frame while the page was
 * loading). Presentation pacing is driven by what the viewer needs to read,
 * not by how slow the network was during capture.
 *
 * Author-paced steps (holds, captions, callouts, transitions) keep their
 * explicit durations. Action steps (click, fill, goto, camera moves, asserts)
 * use snappy fixed beats that show the change and move on.
 */
function stepDurationMs(step: DemoStep): number {
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

function msToFrames(ms: number, fps: number): number {
  return Math.max(1, Math.round((ms / 1000) * fps));
}

function center(box: BoundingBox): { x: number; y: number } {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}
