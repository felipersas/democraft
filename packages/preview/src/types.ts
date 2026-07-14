import type { RecordedDemoManifest, RenderTimeline } from "@democraft/schema";

export type PreviewInput = {
  manifest: RecordedDemoManifest;
  timeline: RenderTimeline;
  videoSrc?: string;
  screenshotSrcByStepId?: Record<string, string>;
};
