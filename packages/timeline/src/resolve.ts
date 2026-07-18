import {
  assertCaptureCompatibility,
  type AudioTrack,
  type AudioTrackIR,
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
import { stepDurationMs } from "./estimate";

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
    audio: [],
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
  timeline.audio = resolveAudioTracks(
    ir.audio ?? [],
    fps,
    timeline.durationInFrames,
  );
  return timeline;
}

/**
 * Convert IR audio tracks (ms) into timeline audio tracks (frames), clipping
 * each track to the composition duration. Disabled tracks are dropped. A track
 * with a non-positive span after clipping is dropped (nothing to play).
 *
 * Fades are clamped to the effective span so the Remotion volume curve never
 * extrapolates beyond the audible region. Non-looping tracks without an endAt
 * fill to the composition end (they go silent when the source finishes — see
 * "Known limitations" in the audio docs).
 */
export function resolveAudioTracks(
  tracks: AudioTrackIR[],
  fps: number,
  durationInFrames: number,
): AudioTrack[] {
  const resolved: AudioTrack[] = [];
  for (const track of tracks) {
    if (track.disabled) continue;

    // NOTE: the module-level `msToFrames` enforces a minimum of 1 frame (it is
    // used for step *durations*, which must never be zero). Audio start times
    // and spans need faithful rounding instead — 0ms must be frame 0, and a
    // zero span must be detectable so the track can be dropped.
    const fromFrame = audioMsToFrames(track.startAtMs, fps);
    if (fromFrame >= durationInFrames && durationInFrames > 0) continue;

    const endFrame =
      track.endAtMs === undefined
        ? durationInFrames
        : audioMsToFrames(track.endAtMs, fps);
    const spanFrames = Math.max(0, endFrame - fromFrame);

    // Clamp the audible span to the composition; a track overshooting the end
    // is silenced past durationInFrames by the Sequence's durationInFrames.
    const clampedSpan = Math.min(spanFrames, durationInFrames - fromFrame);
    if (clampedSpan <= 0) continue;

    const fadeInFrames = Math.min(
      audioMsToFrames(track.fadeInMs, fps),
      clampedSpan,
    );
    const fadeOutFrames = Math.min(
      audioMsToFrames(track.fadeOutMs, fps),
      clampedSpan,
    );

    resolved.push({
      id: track.id,
      src: track.src,
      label: track.label,
      kind: track.kind,
      fromFrame,
      durationInFrames: clampedSpan,
      volume: track.volume,
      muted: track.muted,
      loop: track.loop,
      fadeInFrames,
      fadeOutFrames,
    });
  }
  return resolved;
}

/** Faithful ms→frame round for audio (no minimum-1 enforcement). */
function audioMsToFrames(ms: number, fps: number): number {
  return Math.round((ms / 1000) * fps);
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

function msToFrames(ms: number, fps: number): number {
  return Math.max(1, Math.round((ms / 1000) * fps));
}

function center(box: BoundingBox): { x: number; y: number } {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}
