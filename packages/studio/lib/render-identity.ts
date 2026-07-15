import { assertCaptureCompatibility } from "@democraft/schema";
import type { RecordedDemoManifest, RenderTimeline } from "@democraft/schema";

export function assertRenderArtifactsCompatible(
  manifest: RecordedDemoManifest,
  timeline: RenderTimeline,
): void {
  assertCaptureCompatibility(timeline, manifest);
}
