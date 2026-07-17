"use client";

import * as React from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "./ui/button";
import { useAudioPreview, useStudio } from "@/lib/studio-context";
import { usePlayerState } from "@/lib/hooks/use-player-frame";
import { useSeek } from "@/lib/hooks/use-seek";
import { formatFrames, formatTimecode } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Transport() {
  const { status, player, loop, setLoop } = useStudio();
  const { audioMuted, setAudioMuted } = useAudioPreview();

  const total =
    status.kind === "ready" ? status.data.timeline.durationInFrames : 0;
  const fps = status.kind === "ready" ? status.data.timeline.fps : 60;

  const { frame, playing } = usePlayerState(player);
  const seek = useSeek({ current: player }, total);

  const togglePlay = () => {
    if (!player) return;
    if (player.isPlaying()) player.pause();
    else player.play();
  };

  const toggleLoop = () => setLoop(!loop);
  const toggleAudioMuted = () => {
    setAudioMuted(!audioMuted);
  };

  return (
    <div className="flex h-14 items-center gap-3 border-t border-[var(--studio-border)] bg-[var(--studio-surface-1)] px-4" aria-label="Playback controls">
      <div className="flex items-center gap-0.5">
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
          className={cn(loop && "bg-[var(--studio-accent-soft)] text-[var(--studio-accent-hover)]")}
          title="Toggle loop"
        >
          {loop ? (
            <Repeat1 className="w-4 h-4" />
          ) : (
            <Repeat className="w-4 h-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleAudioMuted}
          disabled={status.kind !== "ready"}
          className={cn(!audioMuted && "text-[var(--studio-accent-hover)]")}
          title={audioMuted ? "Unmute audio preview" : "Mute audio preview"}
        >
          {audioMuted ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </Button>
      </div>

      <div className="studio-mono flex items-center gap-2 text-[11px] text-[var(--studio-fg-muted)]">
        <span className="rounded bg-[var(--studio-canvas)] px-2 py-1 text-[var(--studio-fg)]">
          {formatFrames(frame, total)}
        </span>
        <span>{formatTimecode(frame, fps)}</span>
      </div>

      <div className="flex-1" />

      <div className="studio-mono text-[10px] text-[var(--studio-fg-dim)]">
        {fps} FPS
      </div>
    </div>
  );
}
