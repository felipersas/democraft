import type { PlayerRef } from "@remotion/player";
import type {
  RecordedDemoManifest,
  RenderTimeline,
  Staleness,
  StudioMeta,
} from "@democraft/schema";

// Render types live in a dedicated module (single source of truth, shared
// with the server-side queue). Re-export so existing `@/lib/types` imports
// keep working.
export type {
  CaptionOverrides,
  RenderJob,
  RenderJobOptions,
  RenderJobStatus,
} from "./types/render";

import type {
  CaptionOverrides,
  RenderJob,
  RenderJobOptions,
} from "./types/render";

export type StudioData = {
  manifest: RecordedDemoManifest;
  timeline: RenderTimeline;
  screenshotBaseUrl: string;
  dataDir: string;
  meta?: StudioMeta;
  staleness?: Staleness;
};

export type StudioStatus =
  | { kind: "loading" }
  | { kind: "ready"; data: StudioData }
  | { kind: "error"; message: string };

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

export type RenderOptions = RenderJobOptions & {
  captionOverrides?: CaptionOverrides;
};

// ---------------------------------------------------------------------------
// Layer visibility + solo (docs/architecture/studio-roadmap.md "Layer visibility toggles")
// ---------------------------------------------------------------------------

export type LayerKind = "camera" | "cursor" | "overlays";

export type LayerState = {
  camera: boolean;
  cursor: boolean;
  overlays: boolean;
  /** Individual overlay ids hidden regardless of the overlays toggle. */
  hiddenOverlayIds: string[];
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export type StudioContextValue = {
  status: StudioStatus;
  playerRef: React.RefObject<PlayerRef | null>;
  loop: boolean;
  setLoop: (value: boolean) => void;
  reload: () => void;

  /** Render queue. */
  renderJobs: RenderJob[];
  enqueueRender: (options?: RenderOptions) => Promise<void>;
  cancelRender: (jobId: string) => void;
  clearFinishedRenders: () => void;
  openOutputFolder: (jobId: string) => void;

  /** Layer visibility + solo. */
  layerState: LayerState;
  soloLayer: LayerKind | null;
  toggleLayer: (kind: LayerKind) => void;
  toggleOverlayVisible: (id: string) => void;
  setSolo: (kind: LayerKind | null) => void;
  resetLayers: () => void;

  /** Caption text overrides (ephemeral). */
  captionOverrides: CaptionOverrides;
  setCaptionText: (overlayId: string, text: string) => void;
  resetCaption: (overlayId: string) => void;
  resetCaptions: () => void;
  /** Whether caption edits are forwarded to the next render (hybrid path). */
  applyCaptionsToRender: boolean;
  setApplyCaptionsToRender: (value: boolean) => void;

  /**
   * In/out render range. `null` = render everything; otherwise an inclusive
   * [startFrame, endFrame] sub-range set by the timeline's in/out handles.
   * See docs/architecture/studio-roadmap.md "In/out markers" + "Render range".
   */
  renderRange: [number, number] | null;
  setRenderRange: (range: [number, number] | null) => void;
  /** Whether the render range is forwarded to the next render. */
  applyRenderRange: boolean;
  setApplyRenderRange: (value: boolean) => void;
};
