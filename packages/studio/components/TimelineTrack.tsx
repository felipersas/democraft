"use client";

import type { RenderTimeline } from "@democraft/schema";
import { useStudio } from "@/lib/studio-context";
import { usePlayerFrame } from "@/lib/hooks/use-player-frame";
import { useSeek } from "@/lib/hooks/use-seek";
import { TimelineBody } from "@/components/timeline/TimelineBody";

export function TimelineTrack() {
  const { status, playerRef } = useStudio();

  const timeline: RenderTimeline | undefined =
    status.kind === "ready" ? status.data.timeline : undefined;
  const total = timeline?.durationInFrames ?? 0;
  const fps = timeline?.fps ?? 60;

  const frame = usePlayerFrame(playerRef, status);
  const seekToFrame = useSeek(playerRef, total);

  if (!timeline) {
    return (
      <div className="h-full grid place-items-center text-xs text-[var(--color-fg-dim)]">
        Timeline unavailable
      </div>
    );
  }

  return (
    <TimelineBody
      timeline={timeline}
      total={total}
      fps={fps}
      frame={frame}
      onSeek={seekToFrame}
    />
  );
}
