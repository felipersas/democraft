"use client";

import * as React from "react";

/** A draggable in/out marker anchored at a frame. */
export function RangeHandle(props: {
  frame: number;
  pxPerFrame: number;
  label: string;
  side: "left" | "right";
  onPointerDown: () => void;
  min: number;
  max: number;
  onChange: (frame: number) => void;
}) {
  return (
    <button
      type="button"
      role="slider"
      aria-label={`${props.label} point`}
      aria-valuemin={props.min}
      aria-valuemax={props.max}
      aria-valuenow={props.frame}
      className="absolute top-0 bottom-0 z-20 flex w-5 flex-col items-center cursor-ew-resize group border-0 bg-transparent p-0"
      style={{ left: props.frame * props.pxPerFrame, transform: "translateX(-50%)" }}
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        props.onPointerDown();
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 10 : 1;
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          props.onChange(Math.max(props.min, props.frame - step));
        } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          props.onChange(Math.min(props.max, props.frame + step));
        } else if (e.key === "Home") {
          e.preventDefault(); props.onChange(props.min);
        } else if (e.key === "End") {
          e.preventDefault(); props.onChange(props.max);
        }
      }}
      title={`Drag to set ${props.label} point`}
    >
      <span className="w-3 h-3 rounded-sm bg-[var(--studio-accent)] group-hover:bg-[var(--studio-accent-hover)] transition-colors" />
      <span className="flex-1 w-0.5 bg-[var(--studio-accent)] opacity-70" />
    </button>
  );
}
