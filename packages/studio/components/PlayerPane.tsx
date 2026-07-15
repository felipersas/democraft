"use client";

import * as React from "react";
import { Player, type PlayerRef } from "@remotion/player";
import {
  createProductDemoVideoProps,
  ProductDemoVideo,
} from "@democraft/remotion/client";
import type { ProductDemoVideoProps } from "@democraft/remotion/client";
import type { RenderTimeline, RecordedDemoManifest } from "@democraft/schema";
import { useStudio } from "@/lib/studio-context";
import { cn } from "@/lib/utils";
import { isLayerVisible } from "@/lib/layers";
import { applyCaptionOverrides } from "@/lib/captions";
import { fitPlayerSize } from "@/lib/player-size";
import type { CaptionOverrides, LayerState } from "@/lib/types";

export function PlayerPane() {
  const { status, playerRef, loop, layerState, soloLayer, captionOverrides } =
    useStudio();

  if (status.kind === "loading") {
    return (
      <div className="flex-1 grid place-items-center text-[var(--color-fg-muted)] text-sm">
        Loading studio data…
      </div>
    );
  }

  if (status.kind === "error") {
    return (
      <div className="flex-1 grid place-items-center p-8 text-center">
        <div className="max-w-md space-y-2">
          <div className="text-sm font-medium text-[var(--color-fg)]">
            Studio data unavailable
          </div>
          <div className="text-xs text-[var(--color-fg-muted)]">
            {status.message}
          </div>
        </div>
      </div>
    );
  }

  const { manifest, timeline, screenshotBaseUrl } = status.data;

  // Memoize the derived timeline + input props so the Remotion <Player> only
  // recomputes when the editing state or source data actually changes. Without
  // this, every provider render allocates fresh objects passed to the Player,
  // which can trigger it to recompute composition props unnecessarily.
  // Vercel rule: rerender-derived-state-no-effect.
  const inputProps = React.useMemo(
    () =>
      buildInputProps({
        manifest,
        timeline: applyEphemeralEdits(timeline, {
          layerState,
          soloLayer,
          captionOverrides,
        }),
        screenshotBaseUrl,
      }),
    [
      manifest,
      timeline,
      layerState,
      soloLayer,
      captionOverrides,
      screenshotBaseUrl,
    ],
  );

  return (
    <div className="flex-1 grid place-items-center p-6 bg-[var(--color-bg)] overflow-hidden">
      <FittedPlayer
        playerRef={playerRef}
        inputProps={inputProps}
        durationInFrames={timeline.durationInFrames}
        fps={timeline.fps}
        loop={loop}
      />
    </div>
  );
}

function FittedPlayer(props: {
  playerRef: React.RefObject<PlayerRef | null>;
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
          className={cn(
            "relative rounded-xl overflow-hidden shadow-2xl",
            "shadow-black/40 ring-1 ring-[var(--color-border)]",
          )}
          style={size}
        >
          <Player
            ref={props.playerRef}
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
  },
): RenderTimeline {
  const { layerState, soloLayer, captionOverrides } = state;

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

  return {
    ...timeline,
    camera: cameraVisible ? timeline.camera : [],
    cursor: cursorVisible ? timeline.cursor : [],
    overlays,
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
  return createProductDemoVideoProps({
    manifest: args.manifest,
    mediaMode: "screenshots",
    timeline: args.timeline,
    screenshotSrcByStepId,
  });
}
