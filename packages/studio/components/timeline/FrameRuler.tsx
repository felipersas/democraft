"use client";

import * as React from "react";
import { cn, formatTimecode } from "@/lib/utils";
import { pickTickStep } from "@/lib/timeline-ticks";
import { RangeHandle } from "@/components/timeline/RangeHandle";

export function FrameRuler(props: {
  total: number;
  fps: number;
  pxPerFrame: number;
  labelColWidth: number;
  frame: number;
  onSeek: (frame: number) => void;
  renderRange: [number, number] | null;
  onSetRenderRange: (range: [number, number] | null) => void;
}) {
  const step = pickTickStep(props.pxPerFrame, props.fps);
  const ticks: number[] = [];
  for (let f = 0; f <= props.total; f += step) ticks.push(f);
  if (ticks[ticks.length - 1] !== props.total) ticks.push(props.total);

  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = React.useState<null | "in" | "out">(null);
  // Keep a live ref of the current range so the window mousemove handler
  // (registered once per drag) always reads the latest value without needing
  // a functional updater on the context setter.
  const rangeRef = React.useRef(props.renderRange);
  rangeRef.current = props.renderRange;

  const xToFrame = React.useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      return Math.max(0, Math.min(props.total - 1, Math.round(x / props.pxPerFrame)));
    },
    [props.pxPerFrame, props.total],
  );

  // Drag handlers attached to window while a handle is being dragged.
  React.useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const f = xToFrame(e.clientX);
      const base = rangeRef.current ?? [0, props.total - 1];
      if (dragging === "in") {
        props.onSetRenderRange([Math.min(f, base[1] - 1), base[1]]);
      } else {
        props.onSetRenderRange([base[0], Math.max(f, base[0] + 1)]);
      }
    };
    const onUp = () => setDragging(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, props, xToFrame]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const f = x / props.pxPerFrame;
    props.onSeek(f);
  };

  const inFrame = props.renderRange?.[0] ?? 0;
  const outFrame = props.renderRange?.[1] ?? props.total - 1;
  const hasRange = props.renderRange !== null;

  return (
    <div
      className="grid items-end pt-1 pb-0.5"
      style={{ gridTemplateColumns: `${props.labelColWidth}px 1fr` }}
    >
      <div className="text-[9px] uppercase tracking-wider text-[var(--color-fg-dim)] pl-1">
        frame
      </div>
      <div
        ref={trackRef}
        className="relative h-6 cursor-pointer"
        onClick={handleSeek}
        title="Click to seek · drag handles below to set render range"
      >
        {/* render-range highlight band */}
        {hasRange && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: inFrame * props.pxPerFrame,
              width: (outFrame - inFrame + 1) * props.pxPerFrame,
              background: "var(--color-accent-muted)",
              borderLeft: "1px solid var(--color-accent-muted)",
              borderRight: "1px solid var(--color-accent-muted)",
            }}
          />
        )}
        {ticks.map((f) => {
          const left = f * props.pxPerFrame;
          const major = f % (step * 2) === 0;
          return (
            <div
              key={f}
              className="absolute bottom-0 flex flex-col items-center pointer-events-none"
              style={{ left, transform: "translateX(-50%)" }}
            >
              <div
                className={cn(
                  "w-px",
                  major ? "h-2.5" : "h-1.5",
                )}
                style={{
                  background: major
                    ? "var(--color-fg-dim)"
                    : "var(--color-border-strong)",
                }}
              />
              {major && (
                <span className="text-[9px] text-[var(--color-fg-dim)] tabular-nums mt-0.5 whitespace-nowrap">
                  {formatTimecode(f, props.fps)}
                </span>
              )}
            </div>
          );
        })}
        {/* In / Out handles */}
        {hasRange && (
          <>
            <RangeHandle
              frame={inFrame}
              pxPerFrame={props.pxPerFrame}
              label="In"
              onPointerDown={() => setDragging("in")}
              side="left"
              min={0}
              max={Math.max(0, outFrame - 1)}
              onChange={(frame) => props.onSetRenderRange([frame, outFrame])}
            />
            <RangeHandle
              frame={outFrame}
              pxPerFrame={props.pxPerFrame}
              label="Out"
              onPointerDown={() => setDragging("out")}
              side="right"
              min={Math.min(props.total - 1, inFrame + 1)}
              max={Math.max(0, props.total - 1)}
              onChange={(frame) => props.onSetRenderRange([inFrame, frame])}
            />
          </>
        )}
      </div>
    </div>
  );
}
