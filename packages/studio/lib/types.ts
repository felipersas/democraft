import type { PlayerRef } from "@remotion/player";
import type {
  AudioTrackIR,
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
  /**
   * Persisted Studio audio overrides (full track set, IR/ms form). When
   * present, these replace the demo.ts `audioTracks` for preview + render.
   * Undefined when no overrides file exists (use the timeline's audio).
   */
  audioOverrides?: AudioTrackIR[];
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
  /** Reactive player instance. Unlike ref.current, this updates consumers on mount. */
  player: PlayerRef | null;
  bindPlayer: (player: PlayerRef | null) => void;
  loop: boolean;
  setLoop: (value: boolean) => void;
  reload: () => void;

  /** Render queue. */
  renderJobs: RenderJob[];
  renderError: string | null;
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

  /**
   * Audio tracks being edited (IR/ms form). Reflects the override file when it
   * exists, otherwise seeds from the timeline's audio. Mutations persist to
   * `studio-data/audio-overrides.json` via POST /api/audio.
   */
  audioTracks: AudioTrackIR[] | undefined;
  /** True when an override file exists (tracks diverge from demo.ts). */
  hasAudioOverrides: boolean;
  setAudioTracks: (tracks: AudioTrackIR[]) => Promise<void>;
  addAudioTrack: (track: AudioTrackIR) => Promise<void>;
  updateAudioTrack: (id: string, patch: Partial<AudioTrackIR>) => Promise<void>;
  removeAudioTrack: (id: string) => Promise<void>;
  resetAudioTracks: () => Promise<void>;
  audioError: string | null;

};
