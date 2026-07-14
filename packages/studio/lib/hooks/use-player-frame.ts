"use client";

import * as React from "react";
import type { PlayerRef } from "@remotion/player";
import type { StudioStatus } from "@/lib/types";

/**
 * Subscribes to the Remotion player's `frameupdate` event and returns the
 * current frame. Replaces the near-identical effect blocks that were duplicated
 * in TimelineTrack, InspectorPanel, and Transport. Vercel rule:
 * client-event-listeners (deduplicate global event listeners).
 *
 * The effect re-subscribes when the player becomes available (i.e. when
 * `status` flips to `ready`), since `playerRef.current` is null until the
 * Player mounts.
 */
export function usePlayerFrame(
  playerRef: React.RefObject<PlayerRef | null>,
  status: StudioStatus,
): number {
  return usePlayerState(playerRef, status).frame;
}

/**
 * Like {@link usePlayerFrame}, but also tracks play/pause state. Used by the
 * Transport, which needs both values.
 */
export function usePlayerState(
  playerRef: React.RefObject<PlayerRef | null>,
  status: StudioStatus,
): { frame: number; playing: boolean } {
  const [frame, setFrame] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);

  React.useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) =>
      setFrame(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    setFrame(player.getCurrentFrame());
    setPlaying(player.isPlaying());
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
    };
  }, [playerRef, status]);

  return { frame, playing };
}
