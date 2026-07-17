"use client";

import * as React from "react";
import type { PlayerRef } from "@remotion/player";

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
  player: PlayerRef | null,
): number {
  return usePlayerState(player).frame;
}

/**
 * Like {@link usePlayerFrame}, but also tracks play/pause state. Used by the
 * Transport, which needs both values.
 */
export function usePlayerState(
  player: PlayerRef | null,
): { frame: number; playing: boolean } {
  const [frame, setFrame] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);

  React.useEffect(() => {
    if (!player) return;
    return subscribeToPlayer(player, (state) => {
      setFrame(state.frame);
      setPlaying(state.playing);
    });
  }, [player]);

  return { frame, playing };
}

export function subscribeToPlayer(
  player: PlayerRef,
  onChange: (state: { frame: number; playing: boolean }) => void,
): () => void {
  const emit = () => onChange({
    frame: player.getCurrentFrame(),
    playing: player.isPlaying(),
  });
  const onFrame = (event: { detail: { frame: number } }) => onChange({
    frame: event.detail.frame,
    playing: player.isPlaying(),
  });

  player.addEventListener("frameupdate", onFrame);
  player.addEventListener("play", emit);
  player.addEventListener("pause", emit);
  emit();

  return () => {
    player.removeEventListener("frameupdate", onFrame);
    player.removeEventListener("play", emit);
    player.removeEventListener("pause", emit);
  };
}
