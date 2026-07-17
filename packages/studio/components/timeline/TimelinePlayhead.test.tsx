// @vitest-environment jsdom
import * as React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerRef } from "@remotion/player";
import TimelinePlayhead, {
  frameToPlayheadX,
} from "@/components/timeline/TimelinePlayhead";

/**
 * Builds a minimal PlayerRef stub whose listeners can be dispatched from the
 * test. Mirrors the pattern in use-player-frame.test.ts.
 */
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

describe("frameToPlayheadX", () => {
  it("maps frames to pixels and clamps to the timeline bounds", () => {
    expect(frameToPlayheadX(0, 2, 100)).toBe(0);
    expect(frameToPlayheadX(45, 2, 100)).toBe(90);
    // frame beyond total clamps to total (the last playhead position)
    expect(frameToPlayheadX(999, 2, 100)).toBe(200);
    // negative clamps to 0
    expect(frameToPlayheadX(-5, 2, 100)).toBe(0);
    // degenerate inputs never produce a negative or NaN offset
    expect(frameToPlayheadX(10, 0, 100)).toBe(0);
    expect(frameToPlayheadX(10, 2, 0)).toBe(0);
  });
});

describe("TimelinePlayhead", () => {
  // jsdom does not implement requestAnimationFrame. We install a queue-based
  // stub: requestAnimationFrame enqueues the callback and returns an id without
  // invoking it; flushRaf() runs all pending callbacks synchronously (and any
  // they themselves schedule, since the loop re-schedules each tick). This
  // keeps rAF deterministic and contained within act().
  let queue: FrameRequestCallback[] = [];
  let nextId = 1;
  let cancelled = new Set<number>();
  let rafSpy: ReturnType<typeof vi.fn>;
  let cancelSpy: ReturnType<typeof vi.fn>;

  function flushRaf() {
    // Drain callbacks queued so far. Each callback may re-enqueue (the loop
    // schedules the next tick); drain those too, bounded to avoid runaway.
    let guard = 0;
    while (queue.length > 0 && guard < 64) {
      const cb = queue.shift()!;
      guard++;
      cb(0);
    }
  }

  beforeEach(() => {
    queue = [];
    nextId = 1;
    cancelled = new Set();
    rafSpy = vi.fn((cb: FrameRequestCallback) => {
      const id = nextId++;
      queue.push(cb);
      return id;
    });
    cancelSpy = vi.fn((id: number) => {
      cancelled.add(id);
    });
    vi.stubGlobal("requestAnimationFrame", rafSpy);
    vi.stubGlobal("cancelAnimationFrame", cancelSpy);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders exactly one playhead node", () => {
    const { container } = render(
      <TimelinePlayhead player={null} pxPerFrame={2} total={100} labelColWidth={88} />,
    );
    // The playhead is the only child with aria-hidden.
    expect(container.querySelectorAll("[aria-hidden]")).toHaveLength(1);
    // And it carries the accent playhead class.
    expect(container.querySelector("[aria-hidden]")?.className).toContain(
      "bg-[var(--studio-accent)]",
    );
  });

  it("starts a single rAF loop and cancels it on unmount", () => {
    const fake = createFakePlayer();
    const { unmount } = render(
      <TimelinePlayhead player={fake.player} pxPerFrame={2} total={100} labelColWidth={88} />,
    );
    act(() => flushRaf());
    // Mount schedules the loop at least once.
    expect(rafSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(cancelSpy).not.toHaveBeenCalled();

    unmount();
    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes from the player on unmount", () => {
    const fake = createFakePlayer();
    const { unmount } = render(
      <TimelinePlayhead player={fake.player} pxPerFrame={2} total={100} labelColWidth={88} />,
    );
    act(() => flushRaf());
    expect(fake.listenerCount("frameupdate")).toBe(1);

    unmount();
    expect(fake.listenerCount("frameupdate")).toBe(0);
  });

  it("updates the playhead transform when a frameupdate fires (seek while paused)", () => {
    const fake = createFakePlayer();
    const { container } = render(
      <TimelinePlayhead player={fake.player} pxPerFrame={2} total={100} labelColWidth={88} />,
    );
    const node = container.querySelector<HTMLDivElement>("[aria-hidden]")!;
    act(() => flushRaf());

    act(() => {
      fake.setFrame(45); // seek to frame 45 while paused
      flushRaf();
    });

    expect(node.style.transform).toBe("translate3d(90px, 0, 0)");
  });

  it("repositions the playhead when zoom changes", () => {
    const fake = createFakePlayer();
    const { container, rerender } = render(
      <TimelinePlayhead player={fake.player} pxPerFrame={2} total={100} labelColWidth={88} />,
    );
    const node = container.querySelector<HTMLDivElement>("[aria-hidden]")!;

    act(() => {
      fake.setFrame(10);
    });
    act(() => flushRaf());
    expect(node.style.transform).toBe("translate3d(20px, 0, 0)");

    // Zoom in: 4 px/frame. Same frame 10 should now sit at 40px. We commit the
    // rerender and the rAF flush in separate act() callbacks so React updates
    // the pxPerFrame ref before the tick reads it.
    act(() => {
      rerender(
        <TimelinePlayhead player={fake.player} pxPerFrame={4} total={100} labelColWidth={88} />,
      );
    });
    act(() => flushRaf());
    expect(node.style.transform).toBe("translate3d(40px, 0, 0)");
  });

  it("does not keep updating after unmount", () => {
    const fake = createFakePlayer();
    const { container, unmount } = render(
      <TimelinePlayhead player={fake.player} pxPerFrame={2} total={100} labelColWidth={88} />,
    );
    const node = container.querySelector<HTMLDivElement>("[aria-hidden]")!;
    act(() => {
      fake.setFrame(5);
      flushRaf();
    });
    expect(node.style.transform).toBe("translate3d(10px, 0, 0)");

    unmount();

    // After unmount the loop is cancelled; firing more events must not move it.
    act(() => {
      fake.setFrame(80);
      flushRaf();
    });
    expect(node.style.transform).toBe("translate3d(10px, 0, 0)");
  });

  it("writes only the transform (never left) and has no transition", () => {
    const fake = createFakePlayer();
    const { container } = render(
      <TimelinePlayhead player={fake.player} pxPerFrame={2} total={100} labelColWidth={88} />,
    );
    const node = container.querySelector<HTMLDivElement>("[aria-hidden]")!;
    // Initial left is the label column offset; the rAF loop owns transform.
    expect(node.style.left).toBe("88px");
    expect(node.style.transition).toBe("");

    act(() => {
      fake.setFrame(20);
      flushRaf();
    });
    // left is untouched across updates; only transform moves.
    expect(node.style.left).toBe("88px");
    expect(node.style.transform).toBe("translate3d(40px, 0, 0)");
  });
});
