"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { LABEL_COL_WIDTH } from "@/components/timeline/constants";

export type TrackEntry = {
  id: string;
  from: number;
  duration: number;
  label: string;
};

export function TrackRow(props: {
  icon: React.ReactNode;
  label: string;
  color: string;
  total: number;
  pxPerFrame: number;
  frame: number;
  visible: boolean;
  onToggleVisible: () => void;
  onSolo: () => void;
  tracks: TrackEntry[];
  onSeek: (frame: number) => void;
}) {
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const f = x / props.pxPerFrame;
    props.onSeek(f);
  };

  return (
    <div
      className={cn(
        "grid min-h-10 items-center group border-b border-[var(--studio-border)]/70",
        !props.visible && "bg-[var(--studio-surface-1)]",
      )}
      style={{ gridTemplateColumns: `${LABEL_COL_WIDTH}px 1fr` }}
    >
      <div className="sticky left-0 z-[2] flex h-full items-center gap-2 bg-[var(--studio-surface-2)] px-3 text-[11px] text-[var(--studio-fg-muted)] group-hover:text-[var(--studio-fg)]">
        <span style={{ color: props.color }}>{props.icon}</span>
        <span>{props.label}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (e.shiftKey) props.onSolo();
            else props.onToggleVisible();
          }}
          title={`Toggle ${props.label} visibility (shift-click = solo)`}
          aria-label={`${props.visible ? "Hide" : "Show"} ${props.label} track. Shift-click to solo.`}
          className="ml-auto grid h-8 w-8 place-items-center rounded-md text-[var(--studio-fg-dim)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-fg)]"
        >
          {props.visible ? (
            <Eye className="w-3 h-3" />
          ) : (
            <EyeOff className="w-3 h-3" />
          )}
        </button>
      </div>
      <div
        className="relative h-10 cursor-pointer bg-[var(--studio-canvas)]"
        style={{ width: props.total * props.pxPerFrame }}
        onClick={handleSeek}
        title="Click to seek"
      >
        {props.total > 0 &&
          props.tracks.map((t) => {
            const left = t.from * props.pxPerFrame;
            const width = Math.max(2, t.duration * props.pxPerFrame);
            const isActive =
              props.frame >= t.from && props.frame < t.from + t.duration;
            return (
              <div
                key={t.id}
                className={cn(
                  "absolute top-2 bottom-2 rounded-sm px-1.5 flex items-center overflow-hidden whitespace-nowrap text-[10px] font-medium text-black/85 transition-opacity",
                  isActive ? "opacity-100" : "opacity-60",
                )}
                style={{
                  left,
                  width,
                  background: props.color,
                }}
              >
                {props.pxPerFrame >= 1.5 && t.label}
              </div>
            );
          })}
        {props.total > 0 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-[var(--studio-accent)] pointer-events-none"
            style={{ left: props.frame * props.pxPerFrame }}
          />
        )}
      </div>
    </div>
  );
}
