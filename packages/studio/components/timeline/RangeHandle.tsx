"use client";

import * as React from "react";

/** A draggable in/out marker anchored at a frame. */
export function RangeHandle(props: {
  frame: number;
  pxPerFrame: number;
  label: string;
  side: "left" | "right";
  onPointerDown: () => void;
}) {
  return (
    <div
      className="absolute top-0 bottom-0 z-20 flex flex-col items-center cursor-ew-resize group"
      style={{ left: props.frame * props.pxPerFrame, transform: "translateX(-50%)" }}
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        props.onPointerDown();
      }}
      title={`Drag to set ${props.label} point`}
    >
      <div className="w-3 h-3 rounded-sm bg-[var(--color-accent)] group-hover:bg-[var(--color-accent-strong)] transition-colors" />
      <div className="flex-1 w-0.5 bg-[var(--color-accent)] opacity-70" />
    </div>
  );
}
