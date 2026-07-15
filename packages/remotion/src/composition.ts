import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { RecordedDemoManifest, RenderTimeline } from "@democraft/schema";
import type { CameraState } from "./camera";
import { cameraStateAt } from "./camera";
import { TargetAndCursorLayer } from "./cursor";
import {
  OverlayLayer,
  defaultVisualRegistry,
  type VisualRegistry,
} from "./overlays";
import {
  Backdrop,
  StageMedia,
  stageLayout,
  type CaptureDimensions,
} from "./stage";
import { compositionId } from "./constants";

// Re-exported so existing imports (e.g. tests) keep working from this module.
export { cameraStateAt } from "./camera";
export { stageMediaState } from "./stage";
export type { CameraState } from "./camera";
export { compositionId };

export type ProductDemoVideoProps = {
  manifest: RecordedDemoManifest;
  recordingSrc?: string;
  timeline: RenderTimeline;
  screenshotSrcByStepId: Record<string, string>;
  width: number;
  height: number;
  /**
   * Override the visual registry (renderer ID → component map). When omitted,
   * uses `defaultVisualRegistry` (the built-in `motion.*` + `remocn.*`
   * components). Pass a custom registry from a user-authored entry point to
   * add or replace renderers without editing the library.
   */
  registry?: VisualRegistry;
};

export const defaultProductDemoProps: ProductDemoVideoProps = {
  manifest: {
    schemaVersion: "1",
    demoId: "demo",
    steps: [],
    diagnostics: [],
  },
  timeline: {
    schemaVersion: "1",
    demoId: "demo",
    fps: 60,
    durationInFrames: 1,
    scenes: [],
    camera: [],
    cursor: [],
    overlays: [],
  },
  recordingSrc: undefined,
  screenshotSrcByStepId: {},
  width: 1920,
  height: 1080,
};

export function ProductDemoVideo(props: ProductDemoVideoProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  // Read capture dimensions from the manifest so the stage maps screenshots
  // at their native aspect ratio. Falls back to the frame size (1920×1080)
  // when the manifest is from an older capture that didn't record dimensions.
  const capture: CaptureDimensions | undefined = props.manifest.capture
    ? {
        width: props.manifest.capture.width,
        height: props.manifest.capture.height,
        deviceScaleFactor: props.manifest.capture.deviceScaleFactor,
      }
    : undefined;
  const stage = stageLayout(width, height, capture);
  const camera: CameraState = cameraStateAt(props.timeline, frame);
  const steps = props.timeline.scenes.flatMap((scene) => scene.steps);
  const registry = props.registry ?? defaultVisualRegistry;

  return React.createElement(
    AbsoluteFill,
    { style: { backgroundColor: "#10131a" } },
    React.createElement(Backdrop),
    React.createElement(StageMedia, {
      camera,
      capture,
      frame,
      recordingSrc: props.recordingSrc,
      screenshotSrcByStepId: props.screenshotSrcByStepId,
      stage,
      steps,
    }),
    React.createElement(TargetAndCursorLayer, {
      camera,
      frame,
      stage,
      timeline: props.timeline,
    }),
    React.createElement(OverlayLayer, {
      camera,
      frame,
      registry,
      stage,
      timeline: props.timeline,
    }),
  );
}
