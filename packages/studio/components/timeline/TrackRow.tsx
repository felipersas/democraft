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
        "grid items-center group",
        !props.visible && "opacity-50",
      )}
      style={{ gridTemplateColumns: `${LABEL_COL_WIDTH}px 1fr` }}
    >
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-fg-muted)] group-hover:text-[var(--color-fg)] transition-colors pr-2">
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
          className="ml-auto text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] transition-colors"
        >
          {props.visible ? (
            <Eye className="w-3 h-3" />
          ) : (
            <EyeOff className="w-3 h-3" />
          )}
        </button>
      </div>
      <div
        className="relative h-7 bg-[var(--color-bg)] rounded border border-[var(--color-border)] cursor-pointer"
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
                  "absolute top-1 bottom-1 rounded-sm text-[9px] text-black/80 px-1 flex items-center overflow-hidden whitespace-nowrap transition-opacity",
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
            className="absolute top-0 bottom-0 w-px bg-[var(--color-fg)] pointer-events-none"
            style={{ left: props.frame * props.pxPerFrame }}
          />
        )}
      </div>
    </div>
  );
}
