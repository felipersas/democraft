"use client";

import * as React from "react";
import type { PlayerRef } from "@remotion/player";
import { subscribeToPlayer } from "@/lib/hooks/use-player-frame";
import type { TrackEntry } from "@/components/timeline/TrackRow";

export type ActiveSegmentIds = {
  camera: string | null;
  cursor: string | null;
  overlays: string | null;
  audio: string | null;
};

export type SegmentGroups = {
  camera: TrackEntry[];
  cursor: TrackEntry[];
  overlays: TrackEntry[];
  audio: TrackEntry[];
};

const EMPTY_GROUPS: SegmentGroups = {
  camera: [],
  cursor: [],
  overlays: [],
  audio: [],
};

const EMPTY_IDS: ActiveSegmentIds = {
  camera: null,
  cursor: null,
  overlays: null,
  audio: null,
};

/**
 * Returns the id of the track entry that is active at a given frame, or `null`
 * if none covers it. A segment is active when `from <= frame < from + duration`.
 */
export function activeSegmentIdAt(
  tracks: TrackEntry[],
  frame: number,
): string | null {
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i];
    if (frame >= t.from && frame < t.from + t.duration) return t.id;
  }
  return null;
}

function computeActiveIds(frame: number, groups: SegmentGroups): ActiveSegmentIds {
  return {
    camera: activeSegmentIdAt(groups.camera, frame),
    cursor: activeSegmentIdAt(groups.cursor, frame),
    overlays: activeSegmentIdAt(groups.overlays, frame),
    audio: activeSegmentIdAt(groups.audio, frame),
  };
}

/**
 * Tracks which track entry is active at the playhead, per layer kind.
 *
 * Unlike {@link usePlayerFrame}, this hook does **not** call `setState` on every
 * `frameupdate`. It recomputes the active id per track on every player event
 * but only publishes a new state when one of the ids actually changes — i.e.
 * at segment boundaries, a handful of times per playback instead of 60×/sec.
 * This keeps the active-segment highlight on the timeline without coupling the
 * track rows to the per-frame React render storm.
 *
 * Remotion's frame remains the source of truth.
 */
export function useActiveSegmentIds(
  player: PlayerRef | null,
  groups: SegmentGroups,
): ActiveSegmentIds {
  const [ids, setIds] = React.useState<ActiveSegmentIds>(EMPTY_IDS);

  // Keep the latest segment groups in a ref so the subscription (registered
  // once per player) always reads the current data without re-subscribing.
  const groupsRef = React.useRef<SegmentGroups>(groups);
  groupsRef.current = groups;
  const lastPublishedRef = React.useRef<ActiveSegmentIds>(EMPTY_IDS);

  React.useEffect(() => {
    if (!player) return;
    return subscribeToPlayer(player, (state) => {
      const next = computeActiveIds(state.frame, groupsRef.current);
      const prev = lastPublishedRef.current;
      if (
        next.camera !== prev.camera ||
        next.cursor !== prev.cursor ||
        next.overlays !== prev.overlays ||
        next.audio !== prev.audio
      ) {
        lastPublishedRef.current = next;
        setIds(next);
      }
    });
  }, [player]);

  // If there is no player yet, still expose a consistent empty result rather
  // than a stale memoization from a previous render.
  if (!player) return EMPTY_IDS;
  return ids;
}

export const ACTIVE_SEGMENTS_INTERNAL = { EMPTY_GROUPS, EMPTY_IDS };
