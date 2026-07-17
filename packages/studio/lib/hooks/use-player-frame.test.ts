import { describe, expect, it, vi } from "vitest";
import type { PlayerRef } from "@remotion/player";
import { subscribeToPlayer } from "./use-player-frame";

describe("subscribeToPlayer", () => {
  it("publishes the mounted player state and reacts to frame/play/pause events", () => {
    let frame = 0;
    let playing = false;
    const listeners = new Map<string, Set<(event?: unknown) => void>>();
    const player = {
      getCurrentFrame: () => frame,
      isPlaying: () => playing,
      addEventListener: (name: string, listener: (event?: unknown) => void) => {
        const group = listeners.get(name) ?? new Set();
        group.add(listener);
        listeners.set(name, group);
      },
      removeEventListener: (name: string, listener: (event?: unknown) => void) => {
        listeners.get(name)?.delete(listener);
      },
    } as unknown as PlayerRef;
    const onChange = vi.fn();

    const unsubscribe = subscribeToPlayer(player, onChange);
    expect(onChange).toHaveBeenLastCalledWith({ frame: 0, playing: false });

    playing = true;
    listeners.get("play")?.forEach((listener) => listener());
    expect(onChange).toHaveBeenLastCalledWith({ frame: 0, playing: true });

    frame = 73;
    listeners.get("frameupdate")?.forEach((listener) => listener({ detail: { frame } }));
    expect(onChange).toHaveBeenLastCalledWith({ frame: 73, playing: true });

    playing = false;
    listeners.get("pause")?.forEach((listener) => listener());
    expect(onChange).toHaveBeenLastCalledWith({ frame: 73, playing: false });

    unsubscribe();
    expect([...listeners.values()].every((group) => group.size === 0)).toBe(true);
  });
});
