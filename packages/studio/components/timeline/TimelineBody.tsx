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
import type { RenderTimeline } from "@democraft/schema";
import { useStudio } from "@/lib/studio-context";
import { cn } from "@/lib/utils";
import { isTypingTarget } from "@/lib/dom";
import { isLayerVisible } from "@/lib/layers";
import type { LayerKind } from "@/lib/types";
import { FrameRuler } from "@/components/timeline/FrameRuler";
import { TrackRow } from "@/components/timeline/TrackRow";
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
  frame: number;
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
    <div className="h-full flex flex-col bg-[var(--color-bg-panel)] overflow-hidden">
      <div className="px-4 py-2 border-b border-[var(--color-border)] flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-fg-muted)]">
          Timeline
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] text-[var(--color-fg-dim)] tabular-nums">
            {props.total} frames
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => zoomBy(1 / ZOOM_STEP)}
              title="Zoom out (-)"
              className="text-[var(--color-fg-dim)] hover:text-[var(--color-fg-muted)] transition-colors p-0.5"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => zoomBy(ZOOM_STEP)}
              title="Zoom in (+)"
              className="text-[var(--color-fg-dim)] hover:text-[var(--color-fg-muted)] transition-colors p-0.5"
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
              "text-[10px] px-1.5 py-0.5 rounded transition-colors tabular-nums",
              renderRange !== null
                ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                : "text-[var(--color-fg-dim)] hover:text-[var(--color-fg-muted)]",
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
            className="text-[var(--color-fg-dim)] hover:text-[var(--color-fg-muted)] transition-colors"
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
          <div className="sticky top-0 z-10 bg-[var(--color-bg-panel)]">
            <FrameRuler
              total={props.total}
              fps={props.fps}
              pxPerFrame={effectiveZoom}
              labelColWidth={labelColWidth}
              frame={props.frame}
              onSeek={props.onSeek}
              renderRange={renderRange}
              onSetRenderRange={setRenderRange}
            />
          </div>
          <div className="px-2 py-2 space-y-1">
            <TrackRow
              icon={<Camera className="w-3 h-3" />}
              label="Camera"
              color="var(--color-accent)"
              total={props.total}
              pxPerFrame={effectiveZoom}
              frame={props.frame}
              visible={isLayerOn("camera")}
              onToggleVisible={() => toggleLayer("camera")}
              onSolo={() => setSolo("camera")}
              tracks={props.timeline.camera.map((t) => ({
                id: t.id,
                from: t.fromFrame,
                duration: t.durationInFrames,
                label: t.kind === "establish" ? "establish" : "focus",
              }))}
              onSeek={props.onSeek}
            />
            <TrackRow
              icon={<MousePointer2 className="w-3 h-3" />}
              label="Cursor"
              color="#ffd479"
              total={props.total}
              pxPerFrame={effectiveZoom}
              frame={props.frame}
              visible={isLayerOn("cursor")}
              onToggleVisible={() => toggleLayer("cursor")}
              onSolo={() => setSolo("cursor")}
              tracks={props.timeline.cursor.map((t) => ({
                id: t.id,
                from: t.fromFrame,
                duration: Math.min(t.durationInFrames, 28),
                label: "click",
              }))}
              onSeek={props.onSeek}
            />
            <TrackRow
              icon={<SquareStack className="w-3 h-3" />}
              label="Overlays"
              color="#9cb4ff"
              total={props.total}
              pxPerFrame={effectiveZoom}
              frame={props.frame}
              visible={isLayerOn("overlays")}
              onToggleVisible={() => toggleLayer("overlays")}
              onSolo={() => setSolo("overlays")}
              tracks={props.timeline.overlays.map((t) => ({
                id: t.id,
                from: t.fromFrame,
                duration: t.durationInFrames,
                label: t.kind,
              }))}
              onSeek={props.onSeek}
            />
            {(props.timeline.audio ?? []).length > 0 && (
              <TrackRow
                icon={<Music className="w-3 h-3" />}
                label="Audio"
                color="#79e3c7"
                total={props.total}
                pxPerFrame={effectiveZoom}
                frame={props.frame}
                visible
                onToggleVisible={() => undefined}
                onSolo={() => undefined}
                tracks={(props.timeline.audio ?? []).map((t) => ({
                  id: t.id,
                  from: t.fromFrame,
                  duration: t.durationInFrames,
                  label: t.label ?? t.kind ?? "audio",
                }))}
                onSeek={props.onSeek}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
