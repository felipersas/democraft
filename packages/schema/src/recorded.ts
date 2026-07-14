import type { BoundingBox, Locator } from "./geometry";
import type { DemoStep } from "./steps";
import type { Diagnostic } from "./diagnostics";
import type { schemaVersion } from "./version";

export type RecordedLocatorAttempt = {
  locator: Locator;
  success: boolean;
  error?: string;
};

export type TargetSnapshot = {
  targetId: string;
  attemptedLocators: RecordedLocatorAttempt[];
  successfulLocator?: Locator;
  boundingBox?: BoundingBox;
  visible: boolean;
  resolutionDurationMs: number;
};

export type RecordedStep = {
  stepId: string;
  sceneId: string;
  kind: DemoStep["kind"];
  startedAtMs: number;
  endedAtMs: number;
  targetSnapshot?: TargetSnapshot;
  url?: string;
};

export type RecordedDemoManifest = {
  schemaVersion: typeof schemaVersion;
  demoId: string;
  /**
   * Capture dimensions and device pixel ratio. Used by the renderer to
   * compute the stage layout so screenshots map 1:1 to the render frame.
   * Absent on older manifests (defaults to 1920×1080 @ 1×).
   */
  capture?: {
    width: number;
    height: number;
    deviceScaleFactor: number;
  };
  recording?: {
    path: string;
    width: number;
    height: number;
  };
  tracePath?: string;
  screenshotsPath?: string;
  steps: RecordedStep[];
  diagnostics: Diagnostic[];
};
