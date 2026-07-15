import type { BoundingBox } from "./geometry";
import type { DemoStep } from "./steps";
import type { TargetSnapshot } from "./recorded";
import type { schemaVersion } from "./version";

export type RenderStep = {
  stepId: string;
  sceneId: string;
  kind: DemoStep["kind"];
  fromFrame: number;
  durationInFrames: number;
  targetSnapshot?: TargetSnapshot;
};

export type RenderScene = {
  id: string;
  fromFrame: number;
  durationInFrames: number;
  steps: RenderStep[];
};

export type CameraTrack = {
  id: string;
  stepId: string;
  sceneId: string;
  kind: "establish" | "focus";
  targetId?: string;
  fromFrame: number;
  durationInFrames: number;
  boundingBox?: BoundingBox;
};

export type CursorTrack = {
  id: string;
  stepId: string;
  sceneId: string;
  kind: "click";
  targetId: string;
  fromFrame: number;
  durationInFrames: number;
  point?: {
    x: number;
    y: number;
  };
};

export type OverlayTrack =
  | {
      id: string;
      stepId: string;
      sceneId: string;
      kind: "caption";
      text: string;
      fromFrame: number;
      durationInFrames: number;
      renderer?: string;
    }
  | {
      id: string;
      stepId: string;
      sceneId: string;
      kind: "callout";
      targetId: string;
      title: string;
      description?: string;
      fromFrame: number;
      durationInFrames: number;
      boundingBox?: BoundingBox;
      renderer?: string;
    }
  | {
      id: string;
      stepId: string;
      sceneId: string;
      kind: "visual";
      visual: string;
      props: Record<string, unknown>;
      renderer?: never;
      fromFrame: number;
      durationInFrames: number;
    };

export type RenderTimeline = {
  schemaVersion: typeof schemaVersion;
  demoId: string;
  /** Versioned SHA-256 of the author definition used for this timeline. */
  definitionHash?: string;
  /** Versioned hash of the capture-compatible definition projection. */
  captureHash?: string;
  /** Environment identity inherited from the recorded capture. */
  captureEnvironmentHash?: string;
  fps: number;
  durationInFrames: number;
  scenes: RenderScene[];
  camera: CameraTrack[];
  cursor: CursorTrack[];
  overlays: OverlayTrack[];
};
