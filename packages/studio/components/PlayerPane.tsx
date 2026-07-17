"use client";

import * as React from "react";
import { Player, type PlayerRef } from "@remotion/player";
import {
  createProductDemoVideoProps,
  ProductDemoVideo,
  visualRegistryFromDefinitions,
} from "@democraft/remotion/client";
import userDemo from "@democraft/user-demo";
import type { ProductDemoVideoProps } from "@democraft/remotion/client";
import type {
  AudioTrackIR,
  RecordedDemoManifest,
  RenderTimeline,
} from "@democraft/schema";
import { useAudioPreview, useStudio } from "@/lib/studio-context";
import { AlertCircle, RefreshCw } from "lucide-react";
import { isLayerVisible } from "@/lib/layers";
import { applyCaptionOverrides } from "@/lib/captions";
import {
  resolveAudioSrcById,
  resolveEffectiveAudio,
} from "@/lib/audio-overrides";
import { fitPlayerSize } from "@/lib/player-size";
import type { CaptionOverrides, LayerState } from "@/lib/types";

const userVisualRegistry = visualRegistryFromDefinitions(userDemo.visuals);

export function PlayerPane() {
  const {
    status,
    bindPlayer,
    loop,
    layerState,
    soloLayer,
    captionOverrides,
    audioTracks,
  } = useStudio();
  const { audioMuted } = useAudioPreview();

  // Memoize the derived timeline + input props so the Remotion <Player> only
  // recomputes when the editing state or source data actually changes. Without
  // this, every provider render allocates fresh objects passed to the Player,
  // which can trigger it to recompute composition props unnecessarily.
  // Vercel rule: rerender-derived-state-no-effect.
  //
  // This hook MUST run on every render (before any early return) to satisfy
  // the Rules of Hooks — its inputs are simply undefined while not ready.
  const inputProps = React.useMemo(() => {
    if (status.kind !== "ready") return null;
    const { manifest, timeline, screenshotBaseUrl } = status.data;
    return buildInputProps({
      manifest,
      timeline: applyEphemeralEdits(timeline, {
        layerState,
        soloLayer,
        captionOverrides,
        audioTracks,
        audioMuted,
      }),
      screenshotBaseUrl,
    });
  }, [
    status,
    layerState,
    soloLayer,
    captionOverrides,
    audioTracks,
    audioMuted,
  ]);

  if (status.kind === "loading") {
    return (
      <div className="flex-1 grid place-items-center p-6" aria-busy="true" aria-label="Loading Studio data">
        <div className="w-full max-w-4xl space-y-3">
          <div className="studio-skeleton aspect-video w-full" />
          <div className="mx-auto h-3 w-40 studio-skeleton" />
        </div>
      </div>
    );
  }

  if (status.kind === "error") {
    return (
      <div className="flex-1 grid place-items-center p-8 text-center">
        <div className="max-w-md rounded-xl border border-[var(--studio-error)]/35 bg-[var(--studio-surface-1)] p-5 text-left">
          <AlertCircle className="mb-3 h-5 w-5 text-[var(--studio-error)]" />
          <div className="text-sm font-semibold text-[var(--studio-fg)]">
            Studio data unavailable
          </div>
          <div className="mt-1.5 text-xs leading-relaxed text-[var(--studio-fg-muted)]">
            {status.message}
          </div>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 inline-flex h-8 items-center gap-2 rounded-md border border-[var(--studio-border-strong)] px-2.5 text-xs text-[var(--studio-fg)] hover:bg-[var(--studio-hover)]"><RefreshCw className="h-3.5 w-3.5" />Retry loading</button>
        </div>
      </div>
    );
  }

  // inputProps is non-null here because status.kind === "ready".
  const { timeline } = status.data;

  return (
    <div className="flex-1 grid place-items-center overflow-hidden bg-[var(--studio-canvas)] p-5 lg:p-8">
      <FittedPlayer
        bindPlayer={bindPlayer}
        inputProps={inputProps!}
        durationInFrames={timeline.durationInFrames}
        fps={timeline.fps}
        loop={loop}
      />
    </div>
  );
}

function FittedPlayer(props: {
  bindPlayer: (player: PlayerRef | null) => void;
  inputProps: ProductDemoVideoProps;
  durationInFrames: number;
  fps: number;
  loop: boolean;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState<{ width: number; height: number }>();

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const bounds = container.getBoundingClientRect();
      const next = fitPlayerSize(
        bounds.width,
        bounds.height,
        props.inputProps.width,
        props.inputProps.height,
      );
      setSize((current) =>
        current?.width === next.width && current.height === next.height
          ? current
          : next,
      );
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [props.inputProps.width, props.inputProps.height]);

  return (
    <div ref={containerRef} className="w-full h-full grid place-items-center">
      {size ? (
        <div
          className="relative overflow-hidden rounded-lg ring-1 ring-[var(--studio-border-strong)] shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          style={size}
        >
          <Player
            ref={props.bindPlayer}
            component={ProductDemoVideo}
            inputProps={props.inputProps}
            durationInFrames={props.durationInFrames}
            compositionWidth={props.inputProps.width}
            compositionHeight={props.inputProps.height}
            fps={props.fps}
            style={{ width: "100%", height: "100%" }}
            controls={false}
            loop={props.loop}
            autoPlay
            acknowledgeRemotionLicense
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Applies the studio's ephemeral editing state (layer visibility/solo and
 * caption text overrides) to produce a derived timeline for the preview.
 * The source data on disk is never mutated — this is the "studio-only" half
 * of the hybrid override seam described in docs/architecture/studio-roadmap.md.
 *
 * Visibility rules:
 *  - solo, when set, shows ONLY that layer kind and hides the other two.
 *  - a layer kind toggled off hides its tracks entirely.
 *  - camera hidden → empty camera array, which cameraStateAt([]) treats as
 *    identityCamera() (no zoom/focus), so the stage renders unframed.
 */
function applyEphemeralEdits(
  timeline: RenderTimeline,
  state: {
    layerState: LayerState;
    soloLayer: import("@/lib/types").LayerKind | null;
    captionOverrides: CaptionOverrides;
    audioTracks: AudioTrackIR[] | undefined;
    audioMuted: boolean;
  },
): RenderTimeline {
  const { layerState, soloLayer, captionOverrides, audioTracks, audioMuted } = state;

  const cameraVisible = isLayerVisible(layerState, soloLayer, "camera");
  const cursorVisible = isLayerVisible(layerState, soloLayer, "cursor");
  const overlaysVisible = isLayerVisible(layerState, soloLayer, "overlays");

  const hiddenOverlay = new Set(layerState.hiddenOverlayIds);

  const overlays = overlaysVisible
    ? applyCaptionOverrides(
        timeline.overlays.filter((o) => !hiddenOverlay.has(o.id)),
        captionOverrides,
      )
    : [];

  // Resolve the edited IR tracks (audioTracks reflects override file or demo.ts
  // seed) to frames for the preview, applying the master mute toggle. When the
  // editor has no tracks, keep the timeline's own audio (e.g. fresh load).
  const resolvedAudio =
    audioTracks !== undefined
      ? resolveEffectiveAudio(
          audioTracks,
          timeline.fps,
          timeline.durationInFrames,
        ).map((track) => ({
          ...track,
          muted: audioMuted ? true : track.muted,
        }))
      : timeline.audio;

  return {
    ...timeline,
    camera: cameraVisible ? timeline.camera : [],
    cursor: cursorVisible ? timeline.cursor : [],
    overlays,
    audio: resolvedAudio,
  };
}

function buildInputProps(args: {
  manifest: RecordedDemoManifest;
  timeline: RenderTimeline;
  screenshotBaseUrl: string;
}): ProductDemoVideoProps {
  const screenshotSrcByStepId: Record<string, string> = {};
  for (const step of args.manifest.steps) {
    const canonical = step.screenshotPath?.match(/^screenshots\/([^/]+)$/)?.[1];
    const filename = canonical ?? `${step.sceneId}-${step.stepId}.png`;
    screenshotSrcByStepId[step.stepId] =
      `${args.screenshotBaseUrl}/${encodeURIComponent(filename)}`;
  }
  // Audio sources for the preview: served from /data/audio/<basename>.
  const audioSrcById = resolveAudioSrcById(
    args.timeline.audio ?? [],
    "/data/audio",
  );
  return {
    ...createProductDemoVideoProps({
      manifest: args.manifest,
      mediaMode: "screenshots",
      timeline: args.timeline,
      screenshotSrcByStepId,
      audioSrcById,
    }),
    registry: userVisualRegistry,
  };
}
