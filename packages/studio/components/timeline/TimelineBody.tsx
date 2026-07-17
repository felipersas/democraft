"use client";

import * as React from "react";
import {
  Camera,
  MousePointer2,
  Music,
  SquareStack,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { PlayerRef } from "@remotion/player";
import type { RenderTimeline } from "@democraft/schema";
import { useStudio } from "@/lib/studio-context";
import { cn } from "@/lib/utils";
import { isTypingTarget } from "@/lib/dom";
import { isLayerVisible } from "@/lib/layers";
import type { LayerKind } from "@/lib/types";
import { useActiveSegmentIds } from "@/lib/hooks/use-active-segments";
import { FrameRuler } from "@/components/timeline/FrameRuler";
import { TrackRow } from "@/components/timeline/TrackRow";
import TimelinePlayhead from "@/components/timeline/TimelinePlayhead";
import {
  MIN_PX_PER_FRAME,
  MAX_PX_PER_FRAME,
  ZOOM_STEP,
  LABEL_COL_WIDTH,
} from "@/components/timeline/constants";

/**
 * Editor-style timeline: a frame ruler with timecode ticks at the top, zoom in
 * and out (cmd+scroll or +/- keys), and one track row per layer kind. The
 * ruler and rows share a single scroll container so they stay aligned.
 *
 * Replaces the pre-zoom "list of colored bars" layout — see
 * docs/architecture/studio-roadmap.md "Frame ruler with timecode ticks" + "Zoom in/out".
 */
export function TimelineBody(props: {
  timeline: RenderTimeline;
  total: number;
  fps: number;
  player: PlayerRef | null;
  onSeek: (frame: number) => void;
}) {
  const {
    layerState,
    soloLayer,
    toggleLayer,
    setSolo,
    resetLayers,
    renderRange,
    setRenderRange,
  } = useStudio();
  const isLayerOn = (k: LayerKind) => isLayerVisible(layerState, soloLayer, k);

  // pxPerFrame is the zoom level. Fit-to-width ≈ containerWidth/total; the
  // default keeps the whole timeline visible, and the user zooms in from there.
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [pxPerFrame, setPxPerFrame] = React.useState<number | null>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const labelColWidth = LABEL_COL_WIDTH;
  const trackWidth = Math.max(0, containerWidth - labelColWidth);

  // Derive the effective zoom during render instead of via a setState-in-effect.
  // When the user hasn't zoomed yet (pxPerFrame === null), compute the fit-to-
  // width value on the fly. This removes the init effect and its extra commit.
  // Vercel rule: rerender-derived-state-no-effect.
  const effectiveZoom = React.useMemo(() => {
    if (pxPerFrame !== null) return pxPerFrame;
    if (containerWidth === 0 || props.total === 0) return MIN_PX_PER_FRAME;
    const fit = trackWidth / props.total;
    return Math.max(MIN_PX_PER_FRAME, Math.min(MAX_PX_PER_FRAME, fit));
  }, [pxPerFrame, containerWidth, trackWidth, props.total]);

  const contentWidth = props.total * effectiveZoom;

  // Project the timeline's tracks into the flat { id, from, duration, label }
  // shape the rows render. Memoized on the timeline reference so the segment
  // arrays keep stable identities across the per-frame re-renders we are about
  // to remove — the rows and the active-segment hook only recompute when the
  // underlying timeline actually changes.
  const segments = React.useMemo(
    () => ({
      camera: props.timeline.camera.map((t) => ({
        id: t.id,
        from: t.fromFrame,
        duration: t.durationInFrames,
        label: t.kind === "establish" ? "establish" : "focus",
      })),
      cursor: props.timeline.cursor.map((t) => ({
        id: t.id,
        from: t.fromFrame,
        duration: Math.min(t.durationInFrames, 28),
        label: "click",
      })),
      overlays: props.timeline.overlays.map((t) => ({
        id: t.id,
        from: t.fromFrame,
        duration: t.durationInFrames,
        label: t.kind,
      })),
      audio: (props.timeline.audio ?? []).map((t) => ({
        id: t.id,
        from: t.fromFrame,
        duration: t.durationInFrames,
        label: t.label ?? t.kind ?? "audio",
      })),
    }),
    [props.timeline],
  );

  // Active-segment highlight is change-driven: it only updates React state when
  // the active track entry actually changes (at segment boundaries), not on
  // every frame. See use-active-segments.ts.
  const active = useActiveSegmentIds(props.player, segments);

  const zoomBy = React.useCallback(
    (factor: number) => {
      setPxPerFrame((prev) => {
        const base = prev ?? effectiveZoom;
        const next = base * factor;
        return Math.max(MIN_PX_PER_FRAME, Math.min(MAX_PX_PER_FRAME, next));
      });
    },
    [effectiveZoom],
  );

  const handleWheel = React.useCallback(
    (e: React.WheelEvent) => {
      // cmd+scroll (mac) or ctrl+scroll zooms; otherwise let the page scroll.
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
    },
    [zoomBy],
  );

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.code === "Equal" || e.code === "NumpadAdd") {
        // "+" (no shift needed on most layouts for "=" key)
        e.preventDefault();
        zoomBy(ZOOM_STEP);
      } else if (e.code === "Minus" || e.code === "NumpadSubtract") {
        e.preventDefault();
        zoomBy(1 / ZOOM_STEP);
      } else if (e.code === "Digit0") {
        e.preventDefault();
        if (trackWidth > 0 && props.total > 0) {
          setPxPerFrame(
            Math.max(
              MIN_PX_PER_FRAME,
              Math.min(MAX_PX_PER_FRAME, trackWidth / props.total),
            ),
          );
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoomBy, trackWidth, props.total]);

  return (
    <div className="h-full flex flex-col bg-[var(--studio-surface-2)] overflow-hidden">
      <div className="h-10 px-3 border-b border-[var(--studio-border)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--studio-fg)]">
          Timeline <span className="studio-mono text-[10px] font-normal text-[var(--studio-fg-dim)]">{props.total} frames</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => zoomBy(1 / ZOOM_STEP)}
              title="Zoom out (-)"
              aria-label="Zoom timeline out"
              className="grid h-8 w-8 place-items-center rounded-md text-[var(--studio-fg-dim)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-fg)]"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => zoomBy(ZOOM_STEP)}
              title="Zoom in (+)"
              aria-label="Zoom timeline in"
              className="grid h-8 w-8 place-items-center rounded-md text-[var(--studio-fg-dim)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-fg)]"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
          <button
            type="button"
            onClick={() =>
              setRenderRange(renderRange === null ? [0, props.total - 1] : null)
            }
            title={
              renderRange === null
                ? "Enable render range (drag In/Out handles on the ruler)"
                : "Disable render range"
            }
            className={cn(
              "h-8 text-[11px] px-2.5 rounded-md transition-colors studio-mono",
              renderRange !== null
                ? "bg-[var(--studio-accent-soft)] text-[var(--studio-accent-hover)]"
                : "text-[var(--studio-fg-muted)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-fg)]",
            )}
          >
            {renderRange !== null
              ? `${renderRange[0]}–${renderRange[1]}`
              : "Range"}
          </button>
          <button
            type="button"
            onClick={resetLayers}
            title="Reset layer visibility"
            aria-label="Reset layer visibility"
            className="grid h-8 w-8 place-items-center rounded-md text-[var(--studio-fg-dim)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-fg)]"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin"
        onWheel={handleWheel}
      >
        <div style={{ width: labelColWidth + contentWidth, minWidth: "100%" }}>
          <div className="sticky top-0 z-10 bg-[var(--studio-surface-2)]">
            <FrameRuler
              total={props.total}
              fps={props.fps}
              pxPerFrame={effectiveZoom}
              labelColWidth={labelColWidth}
              onSeek={props.onSeek}
              renderRange={renderRange}
              onSetRenderRange={setRenderRange}
            />
          </div>
          {/* The playhead overlay spans all rows. It is positioned absolutely
              over the rows region and offset by the label column so it tracks
              the track content; its transform is driven imperatively by
              TimelinePlayhead's own rAF loop, so it never re-renders the tree. */}
          <div className="relative">
            <div className="space-y-px py-1">
              <TrackRow
                icon={<Camera className="w-3 h-3" />}
                label="Camera"
                color="var(--studio-track-camera)"
                total={props.total}
                pxPerFrame={effectiveZoom}
                activeSegmentId={active.camera}
                visible={isLayerOn("camera")}
                onToggleVisible={() => toggleLayer("camera")}
                onSolo={() => setSolo("camera")}
                tracks={segments.camera}
                onSeek={props.onSeek}
              />
              <TrackRow
                icon={<MousePointer2 className="w-3 h-3" />}
                label="Cursor"
                color="var(--studio-track-cursor)"
                total={props.total}
                pxPerFrame={effectiveZoom}
                activeSegmentId={active.cursor}
                visible={isLayerOn("cursor")}
                onToggleVisible={() => toggleLayer("cursor")}
                onSolo={() => setSolo("cursor")}
                tracks={segments.cursor}
                onSeek={props.onSeek}
              />
              <TrackRow
                icon={<SquareStack className="w-3 h-3" />}
                label="Overlays"
                color="var(--studio-track-overlay)"
                total={props.total}
                pxPerFrame={effectiveZoom}
                activeSegmentId={active.overlays}
                visible={isLayerOn("overlays")}
                onToggleVisible={() => toggleLayer("overlays")}
                onSolo={() => setSolo("overlays")}
                tracks={segments.overlays}
                onSeek={props.onSeek}
              />
              <TrackRow
                icon={<Music className="w-3 h-3" />}
                label="Audio"
                color="var(--studio-track-audio)"
                total={props.total}
                pxPerFrame={effectiveZoom}
                activeSegmentId={active.audio}
                visible
                onToggleVisible={() => undefined}
                onSolo={() => undefined}
                tracks={segments.audio}
                onSeek={props.onSeek}
              />
            </div>
            <TimelinePlayhead
              player={props.player}
              pxPerFrame={effectiveZoom}
              total={props.total}
              labelColWidth={labelColWidth}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
