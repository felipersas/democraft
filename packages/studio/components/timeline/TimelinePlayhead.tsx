"use client";

import * as React from "react";
import type { PlayerRef } from "@remotion/player";
import { subscribeToPlayer } from "@/lib/hooks/use-player-frame";

/**
 * Maps a frame number to its playhead pixel offset inside the rows content
 * region. The offset is clamped to `[0, total * pxPerFrame]` so a stray frame
 * beyond the timeline tail never overflows the content area (Remotion already
 * clamps, but this keeps the helper safe to call with untrusted input).
 */
export function frameToPlayheadX(
  frame: number,
  pxPerFrame: number,
  total: number,
): number {
  if (pxPerFrame <= 0 || total <= 0) return 0;
  const clamped = Math.max(0, Math.min(frame, total));
  return clamped * pxPerFrame;
}

/**
 * Single overlay playhead that spans all timeline rows.
 *
 * The timeline tree used to render one playhead `<div>` per {@link TrackRow}
 * and position it with the layout property `left`, driven by a React state
 * update on every Remotion `frameupdate` event. Under main-thread pressure the
 * browser skipped paints, so the playhead stalled and jumped. See
 * `docs/studio-playhead-performance-investigation.md`.
 *
 * This component keeps the timeline tree declarative and static: it subscribes
 * directly to Remotion's frame events (the source of truth — there is no
 * independent clock here), stores the latest frame in a ref, and writes
 * `transform: translate3d(...)` straight to its DOM node from a single
 * `requestAnimationFrame` loop. React never re-renders on a frame change, so
 * the ruler and track rows stay off the hot path.
 *
 * There is no CSS transition between frames: each tick snaps to whatever frame
 * Remotion last reported, which is inherently reduced-motion friendly.
 */
function TimelinePlayhead(props: {
  player: PlayerRef | null;
  pxPerFrame: number;
  total: number;
  labelColWidth: number;
}) {
  const elRef = React.useRef<HTMLDivElement | null>(null);
  const frameRef = React.useRef(0);
  const pxPerFrameRef = React.useRef(props.pxPerFrame);
  pxPerFrameRef.current = props.pxPerFrame;
  const totalRef = React.useRef(props.total);
  totalRef.current = props.total;

  // Remember the last frame/zoom we applied so we only touch the DOM when the
  // visible position actually changes.
  const lastAppliedFrameRef = React.useRef<number | null>(null);
  const lastAppliedZoomRef = React.useRef<number | null>(null);

  // Subscribe to the player's frame events. The handler only mutates a ref —
  // no React state — so this never triggers a re-render. The rAF loop below
  // picks the value up on the next display refresh.
  React.useEffect(() => {
    if (!props.player) return;
    return subscribeToPlayer(props.player, (state) => {
      frameRef.current = state.frame;
    });
  }, [props.player]);

  // Drive the playhead position from one rAF loop for the component's lifetime.
  // Writing the transform directly avoids React reconciliation per frame and
  // lets the browser coalesce the style update with the display refresh.
  React.useEffect(() => {
    let rafId = 0;
    const tick = () => {
      const el = elRef.current;
      if (el) {
        const frame = frameRef.current;
        const pxPerFrame = pxPerFrameRef.current;
        if (
          frame !== lastAppliedFrameRef.current ||
          pxPerFrame !== lastAppliedZoomRef.current
        ) {
          const x = frameToPlayheadX(frame, pxPerFrame, totalRef.current);
          el.style.transform = `translate3d(${x}px, 0, 0)`;
          lastAppliedFrameRef.current = frame;
          lastAppliedZoomRef.current = pxPerFrame;
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div
      ref={elRef}
      aria-hidden
      className="absolute top-0 bottom-0 w-px bg-[var(--studio-accent)] pointer-events-none"
      style={{
        left: props.labelColWidth,
        transform: "translate3d(0, 0, 0)",
        willChange: "transform",
      }}
    />
  );
}

export default React.memo(TimelinePlayhead);
