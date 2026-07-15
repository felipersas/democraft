export type StepBase = {
  id: string;
};

export type BrowserGotoStep = StepBase & {
  kind: "browser.goto";
  path: string;
};

export type BrowserClickStep = StepBase & {
  kind: "browser.click";
  target: string;
};

export type BrowserFillStep = StepBase & {
  kind: "browser.fill";
  target: string;
  value: string;
};

export type BrowserSelectStep = StepBase & {
  kind: "browser.select";
  target: string;
  value: string;
};

export type ExpectVisibleStep = StepBase & {
  kind: "assert.visible";
  target: string;
};

export type ExpectTextStep = StepBase & {
  kind: "assert.text";
  target: string;
  text: string;
};

export type ExpectUrlStep = StepBase & {
  kind: "assert.url";
  path: string;
};

export type CameraEstablishStep = StepBase & {
  kind: "camera.establish";
  target?: string;
};

export type CameraFocusStep = StepBase & {
  kind: "camera.focus";
  target: string;
  padding?: number;
};

export type TimelineHoldStep = StepBase & {
  kind: "timeline.hold";
  durationMs: number;
};

export type TimelineTransitionStep = StepBase & {
  kind: "timeline.transition";
  transition: "cut" | "crossfade";
  durationMs?: number;
};

export type OverlayCaptionStep = StepBase & {
  kind: "overlay.caption";
  text: string;
  renderer?: string;
};

export type OverlayCalloutStep = StepBase & {
  kind: "overlay.callout";
  target: string;
  title: string;
  description?: string;
  renderer?: string;
};

export type OverlayVisualStep = StepBase & {
  kind: "overlay.visual";
  visual: string;
  props: Record<string, unknown>;
  durationMs?: number;
};

export type CueStep = StepBase & {
  kind: "cue";
  name: string;
};

export type DemoStep =
  | BrowserGotoStep
  | BrowserClickStep
  | BrowserFillStep
  | BrowserSelectStep
  | ExpectVisibleStep
  | ExpectTextStep
  | ExpectUrlStep
  | CameraEstablishStep
  | CameraFocusStep
  | TimelineHoldStep
  | TimelineTransitionStep
  | OverlayCaptionStep
  | OverlayCalloutStep
  | OverlayVisualStep
  | CueStep;
