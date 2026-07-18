export type { ResolveTimelineOptions } from "./types";
export { resolveTimeline, resolveAudioTracks } from "./resolve";
export { inspectTimeline } from "./inspect";
export {
  estimateDemoDurationMs,
  estimateSceneDurationMs,
  stepDurationMs,
  type DurationEstimate,
} from "./estimate";
