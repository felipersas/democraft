"use client";

import * as React from "react";
import type { PlayerRef } from "@remotion/player";
import { clampFrame } from "@/lib/utils";

/**
 * Returns a stable `seek(target)` callback that clamps to the valid frame
 * range and imperatively seeks the Remotion player. Centralizes the seek logic
 * that was previously inlined (with slight inconsistencies) in TimelineTrack,
 * Transport, CommandPalette, and StudioShell.
 */
export function useSeek(
  playerRef: React.RefObject<PlayerRef | null>,
  total: number,
): (target: number) => void {
  return React.useCallback(
    (target: number) => {
      const player = playerRef.current;
      if (!player || total <= 0) return;
      const clamped = clampFrame(target, total);
      player.seekTo(clamped);
    },
    [playerRef, total],
  );
}
