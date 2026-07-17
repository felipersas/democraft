// @vitest-environment jsdom
import * as React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlayerRef } from "@remotion/player";
import {
  ACTIVE_SEGMENTS_INTERNAL,
  activeSegmentIdAt,
  useActiveSegmentIds,
} from "./use-active-segments";
import type { TrackEntry } from "@/components/timeline/TrackRow";

function createFakePlayer() {
  let frame = 0;
  let playing = false;
  const listeners = new Map<string, Set<(event?: unknown) => void>>();
  return {
    player: {
      getCurrentFrame: () => frame,
      isPlaying: () => playing,
      addEventListener: (
        name: string,
        listener: (event?: unknown) => void,
      ) => {
        const group = listeners.get(name) ?? new Set();
        group.add(listener);
        listeners.set(name, group);
      },
      removeEventListener: (
        name: string,
        listener: (event?: unknown) => void,
      ) => {
        listeners.get(name)?.delete(listener);
      },
    } as unknown as PlayerRef,
    setFrame(f: number) {
      frame = f;
      listeners.get("frameupdate")?.forEach((l) =>
        l({ detail: { frame: f } }),
      );
    },
    setPlaying(p: boolean) {
      playing = p;
      listeners.get(p ? "play" : "pause")?.forEach((l) => l());
    },
    listenerCount(name: string) {
      return listeners.get(name)?.size ?? 0;
    },
  };
}

/**
 * Harness that records every value the hook publishes, by reference. The
 * callback is held in a ref so an unstable `onValue` prop never causes the
 * recording effect to fire — only an actual change in the published `ids`
 * (which itself comes from a change-driven setState) triggers a record.
 */
function Harness({
  player,
  groups,
  onValue,
}: {
  player: PlayerRef | null;
  groups: Parameters<typeof useActiveSegmentIds>[1];
  onValue: (ids: ReturnType<typeof useActiveSegmentIds>) => void;
}) {
  const ids = useActiveSegmentIds(player, groups);
  const onValueRef = React.useRef(onValue);
  onValueRef.current = onValue;
  React.useEffect(() => {
    onValueRef.current(ids);
  }, [ids]);
  return null;
}

describe("activeSegmentIdAt", () => {
  const tracks: TrackEntry[] = [
    { id: "a", from: 0, duration: 10, label: "A" },
    { id: "b", from: 20, duration: 5, label: "B" },
  ];

  it("returns the id covering the frame, with half-open right edge", () => {
    expect(activeSegmentIdAt(tracks, 0)).toBe("a");
    expect(activeSegmentIdAt(tracks, 9)).toBe("a");
    // frame 10 is past segment a (from + duration) → gap, then b starts at 20
    expect(activeSegmentIdAt(tracks, 10)).toBeNull();
    expect(activeSegmentIdAt(tracks, 19)).toBeNull();
    expect(activeSegmentIdAt(tracks, 20)).toBe("b");
    expect(activeSegmentIdAt(tracks, 24)).toBe("b");
    expect(activeSegmentIdAt(tracks, 25)).toBeNull();
  });

  it("returns null for an empty track list", () => {
    expect(activeSegmentIdAt([], 5)).toBeNull();
  });
});

describe("useActiveSegmentIds", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const groups = {
    camera: [
      { id: "cam1", from: 0, duration: 10, label: "establish" },
      { id: "cam2", from: 10, duration: 10, label: "focus" },
    ],
    cursor: [{ id: "cur1", from: 5, duration: 4, label: "click" }],
    overlays: [],
    audio: [],
  };

  it("publishes the initial active ids from the player's current frame", () => {
    const fake = createFakePlayer();
    const published: ReturnType<typeof useActiveSegmentIds>[] = [];
    act(() => {
      render(
        <Harness
          player={fake.player}
          groups={groups}
          onValue={(v) => published.push(v)}
        />,
      );
    });
    // Initial frame is 0 → cam1 covers [0,10). cursor/overlays/audio have none.
    expect(published.at(-1)).toEqual({
      camera: "cam1",
      cursor: null,
      overlays: null,
      audio: null,
    });
  });

  it("only publishes when an active id actually changes (not on every frame)", () => {
    const fake = createFakePlayer();
    const published: ReturnType<typeof useActiveSegmentIds>[] = [];
    act(() => {
      render(
        <Harness
          player={fake.player}
          groups={groups}
          onValue={(v) => published.push(v)}
        />,
      );
    });
    // After mount the hook settles on the player's current frame (0 → cam1).
    // Record the baseline: subsequent frames within the same segment must NOT
    // append anything new.
    const baseline = published.length;
    expect(published.at(-1)).toEqual({
      camera: "cam1",
      cursor: null,
      overlays: null,
      audio: null,
    });

    // Move within cam1 [0,10): frames 1, 2, 3, 4 must NOT publish.
    act(() => {
      fake.setFrame(1);
      fake.setFrame(2);
      fake.setFrame(3);
      fake.setFrame(4);
    });
    expect(published.length).toBe(baseline);

    // Cross into cam2 at frame 10 → exactly one publish.
    act(() => fake.setFrame(10));
    expect(published.length).toBe(baseline + 1);
    expect(published.at(-1)?.camera).toBe("cam2");

    // Cross into cursor seg [5,9): cursor id flips null → cur1, one publish.
    act(() => fake.setFrame(5));
    expect(published.at(-1)).toEqual({
      camera: "cam1",
      cursor: "cur1",
      overlays: null,
      audio: null,
    });
  });

  it("returns empty ids when there is no player", () => {
    const published: ReturnType<typeof useActiveSegmentIds>[] = [];
    act(() => {
      render(
        <Harness
          player={null}
          groups={groups}
          onValue={(v) => published.push(v)}
        />,
      );
    });
    expect(published.at(-1)).toBe(ACTIVE_SEGMENTS_INTERNAL.EMPTY_IDS);
  });

  it("unsubscribes on unmount", () => {
    const fake = createFakePlayer();
    let utils: ReturnType<typeof render>;
    act(() => {
      utils = render(
        <Harness
          player={fake.player}
          groups={groups}
          onValue={() => undefined}
        />,
      );
    });
    expect(fake.listenerCount("frameupdate")).toBe(1);
    act(() => utils!.unmount());
    expect(fake.listenerCount("frameupdate")).toBe(0);
  });
});
