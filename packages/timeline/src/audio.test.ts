import { describe, expect, it } from "vitest";
import type { AudioTrackIR } from "@democraft/schema";
import { resolveAudioTracks } from "./resolve";

const FPS = 30;

const track = (overrides: Partial<AudioTrackIR> = {}): AudioTrackIR => ({
  id: "music",
  src: "music.mp3",
  startAtMs: 0,
  volume: 1,
  muted: false,
  loop: false,
  fadeInMs: 0,
  fadeOutMs: 0,
  ...overrides,
});

describe("resolveAudioTracks", () => {
  it("converts milliseconds to frames", () => {
    const [resolved] = resolveAudioTracks(
      [track({ startAtMs: 1000, endAtMs: 2500 })],
      FPS,
      1000,
    );
    expect(resolved.fromFrame).toBe(30); // 1s @ 30fps
    expect(resolved.durationInFrames).toBe(45); // 1.5s
  });

  it("clamps a track overshooting the composition to the end", () => {
    const [resolved] = resolveAudioTracks(
      [track({ startAtMs: 1000, endAtMs: 60_000 })],
      FPS,
      60, // 2s composition
    );
    expect(resolved.fromFrame).toBe(30);
    expect(resolved.durationInFrames).toBe(30); // clamped: 60 - 30
  });

  it("fills to composition end when endAt is omitted (non-looping)", () => {
    const [resolved] = resolveAudioTracks([track()], FPS, 90);
    expect(resolved.durationInFrames).toBe(90);
  });

  it("drops a track that starts after the composition ends", () => {
    const resolved = resolveAudioTracks(
      [track({ startAtMs: 10_000 })],
      FPS,
      60,
    );
    expect(resolved).toEqual([]);
  });

  it("drops a track with a non-positive span after clamping", () => {
    const resolved = resolveAudioTracks(
      [track({ startAtMs: 0, endAtMs: 0 })],
      FPS,
      60,
    );
    expect(resolved).toEqual([]);
  });

  it("drops disabled tracks", () => {
    const resolved = resolveAudioTracks(
      [track({ id: "off", disabled: true }), track({ id: "on" })],
      FPS,
      60,
    );
    expect(resolved.map((t) => t.id)).toEqual(["on"]);
  });

  it("clamps fades to the effective span", () => {
    const [resolved] = resolveAudioTracks(
      [
        track({
          startAtMs: 0,
          endAtMs: 1000,
          fadeInMs: 5_000,
          fadeOutMs: 5_000,
        }),
      ],
      FPS,
      1000,
    );
    expect(resolved.durationInFrames).toBe(30); // 1s
    expect(resolved.fadeInFrames).toBe(30);
    expect(resolved.fadeOutFrames).toBe(30);
  });

  it("preserves volume, muted, and loop", () => {
    const [resolved] = resolveAudioTracks(
      [track({ volume: 0.25, muted: true, loop: true })],
      FPS,
      60,
    );
    expect(resolved).toMatchObject({ volume: 0.25, muted: true, loop: true });
  });

  it("handles multiple simultaneous tracks", () => {
    const resolved = resolveAudioTracks(
      [
        track({ id: "music", startAtMs: 0 }),
        track({ id: "narration", startAtMs: 0 }),
        track({ id: "sfx", startAtMs: 500 }),
      ],
      FPS,
      90,
    );
    expect(resolved.map((t) => t.id)).toEqual(["music", "narration", "sfx"]);
  });

  it("returns an empty array when there are no tracks", () => {
    expect(resolveAudioTracks([], FPS, 60)).toEqual([]);
  });
});
