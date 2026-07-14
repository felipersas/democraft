"use client";

import * as React from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
} from "lucide-react";
import { Button } from "./ui/button";
import { useStudio } from "@/lib/studio-context";
import { usePlayerState } from "@/lib/hooks/use-player-frame";
import { useSeek } from "@/lib/hooks/use-seek";
import { formatFrames, formatTimecode } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Transport() {
  const { status, playerRef, loop, setLoop } = useStudio();

  const total = status.kind === "ready" ? status.data.timeline.durationInFrames : 0;
  const fps = status.kind === "ready" ? status.data.timeline.fps : 60;

  const { frame, playing } = usePlayerState(playerRef, status);
  const seek = useSeek(playerRef, total);

  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isPlaying()) player.pause();
    else player.play();
  };

  const toggleLoop = () => setLoop(!loop);

  return (
    <div className="flex items-center gap-3 px-4 h-12 border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => seek(frame - 1)}
          disabled={status.kind !== "ready"}
          title="Previous frame (←)"
        >
          <SkipBack className="w-4 h-4" />
        </Button>
        <Button
          variant="primary"
          size="icon"
          onClick={togglePlay}
          disabled={status.kind !== "ready"}
          title={playing ? "Pause (space)" : "Play (space)"}
        >
          {playing ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => seek(frame + 1)}
          disabled={status.kind !== "ready"}
          title="Next frame (→)"
        >
          <SkipForward className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleLoop}
          disabled={status.kind !== "ready"}
          className={cn(loop && "text-[var(--color-accent)]")}
          title="Toggle loop"
        >
          {loop ? (
            <Repeat1 className="w-4 h-4" />
          ) : (
            <Repeat className="w-4 h-4" />
          )}
        </Button>
      </div>

      <div className="text-xs font-mono text-[var(--color-fg-muted)] tabular-nums">
        <span className="text-[var(--color-fg)]">
          {formatFrames(frame, total)}
        </span>
        <span className="mx-2 opacity-50">·</span>
        <span>{formatTimecode(frame, fps)}</span>
      </div>

      <div className="flex-1" />

      <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-dim)]">
        {fps} fps
      </div>
    </div>
  );
}
