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
  /** Relative path inside the capture directory for the captured frame. */
  screenshotPath?: string;
};

export type RecordedDemoManifest = {
  schemaVersion: typeof schemaVersion;
  demoId: string;
  /** Unique execution id for captures written by the versioned lifecycle. */
  captureRunId?: string;
  /** Versioned SHA-256 of the complete compiled author definition. */
  definitionHash?: string;
  /** Versioned hash used to decide whether screenshots can be reused. */
  captureHash?: string;
  /** Effective browser/runtime environment used to produce this capture. */
  captureEnvironmentHash?: string;
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
