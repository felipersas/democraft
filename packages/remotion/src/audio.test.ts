import { describe, expect, it } from "vitest";
import type { AudioTrack } from "@democraft/schema";
import { audioVolumeAtFrame } from "./audio";

const track = (overrides: Partial<AudioTrack> = {}): AudioTrack => ({
  id: "music",
  src: "music.mp3",
  fromFrame: 0,
  durationInFrames: 90,
  volume: 1,
  muted: false,
  loop: false,
  fadeInFrames: 0,
  fadeOutFrames: 0,
  ...overrides,
});

describe("audioVolumeAtFrame", () => {
  it("holds full volume when there are no fades", () => {
    const t = track();
    expect(audioVolumeAtFrame(t, 0)).toBe(1);
    expect(audioVolumeAtFrame(t, 45)).toBe(1);
    expect(audioVolumeAtFrame(t, 89)).toBe(1);
  });

  it("scales by the track volume", () => {
    const t = track({ volume: 0.25 });
    expect(audioVolumeAtFrame(t, 45)).toBeCloseTo(0.25, 5);
  });

  it("ramps from 0 to volume across the fade-in region", () => {
    const t = track({ volume: 0.8, fadeInFrames: 30 });
    expect(audioVolumeAtFrame(t, 0)).toBe(0);
    expect(audioVolumeAtFrame(t, 15)).toBeCloseTo(0.4, 5); // midpoint of 0.8
    expect(audioVolumeAtFrame(t, 30)).toBeCloseTo(0.8, 5);
    expect(audioVolumeAtFrame(t, 45)).toBeCloseTo(0.8, 5); // held after fade
  });

  it("ramps from volume to 0 across the fade-out region", () => {
    const t = track({ volume: 1, fadeOutFrames: 30 });
    expect(audioVolumeAtFrame(t, 60)).toBeCloseTo(1, 5); // before fade-out
    expect(audioVolumeAtFrame(t, 75)).toBeCloseTo(0.5, 5); // midpoint
    expect(audioVolumeAtFrame(t, 90)).toBeCloseTo(0, 5); // end
  });

  it("combines fade-in and fade-out without extrapolating", () => {
    const t = track({ volume: 1, fadeInFrames: 30, fadeOutFrames: 30 });
    // Peak in the middle hold region (frame 45) is full volume.
    expect(audioVolumeAtFrame(t, 45)).toBeCloseTo(1, 5);
  });

  it("clamps frames outside the span", () => {
    const t = track({ volume: 1, fadeInFrames: 30 });
    expect(audioVolumeAtFrame(t, -5)).toBe(0); // before start, clamped to 0
    expect(audioVolumeAtFrame(t, 200)).toBe(1); // after span, clamped to full
  });

  it("returns 0 for a zero-duration span", () => {
    expect(audioVolumeAtFrame(track({ durationInFrames: 0 }), 0)).toBe(0);
  });

  it("clamps the result into [0, 1]", () => {
    // A degenerate track where fades overlap: the two ramps cross but the
    // product stays within range by construction.
    const t = track({
      durationInFrames: 10,
      fadeInFrames: 10,
      fadeOutFrames: 10,
    });
    for (let f = 0; f <= 10; f += 1) {
      const v = audioVolumeAtFrame(t, f);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
