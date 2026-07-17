import { describe, expect, it } from "vitest";
import {
  AUDIO_KINDS,
  audioTrackIRSchema,
  audioTrackSchema,
  trackSpanMs,
  type AudioTrackIR,
} from "./audio";
import { parseAudioOverridesJson } from "./artifact-schemas";

const validTrack = (overrides: Partial<AudioTrackIR> = {}): AudioTrackIR => ({
  id: "music",
  src: "./assets/music.mp3",
  startAtMs: 0,
  volume: 0.5,
  muted: false,
  loop: true,
  fadeInMs: 0,
  fadeOutMs: 0,
  ...overrides,
});

describe("audioTrackIRSchema", () => {
  it("accepts a minimal valid track and applies no defaults (all fields required in IR)", () => {
    const track = validTrack();
    const result = audioTrackIRSchema.safeParse(track);
    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual(track);
  });

  it("accepts all supported kinds", () => {
    for (const kind of AUDIO_KINDS) {
      const result = audioTrackIRSchema.safeParse(validTrack({ kind }));
      expect(result.success, `kind ${kind}`).toBe(true);
    }
  });

  it("accepts an optional endAt greater than startAt", () => {
    const result = audioTrackIRSchema.safeParse(
      validTrack({ startAtMs: 1000, endAtMs: 4000 }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects an empty id", () => {
    const result = audioTrackIRSchema.safeParse(validTrack({ id: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects an empty src", () => {
    const result = audioTrackIRSchema.safeParse(validTrack({ src: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects volume above 1", () => {
    const result = audioTrackIRSchema.safeParse(validTrack({ volume: 1.5 }));
    expect(result.success).toBe(false);
  });

  it("rejects a negative start time", () => {
    const result = audioTrackIRSchema.safeParse(validTrack({ startAtMs: -1 }));
    expect(result.success).toBe(false);
  });

  it("rejects endAt not greater than startAt", () => {
    const equal = audioTrackIRSchema.safeParse(
      validTrack({ startAtMs: 1000, endAtMs: 1000 }),
    );
    const before = audioTrackIRSchema.safeParse(
      validTrack({ startAtMs: 1000, endAtMs: 500 }),
    );
    expect(equal.success).toBe(false);
    expect(before.success).toBe(false);
  });

  it("rejects a negative fade", () => {
    expect(
      audioTrackIRSchema.safeParse(validTrack({ fadeInMs: -1 })).success,
    ).toBe(false);
    expect(
      audioTrackIRSchema.safeParse(validTrack({ fadeOutMs: -1 })).success,
    ).toBe(false);
  });

  it("rejects a fade longer than the bounded span", () => {
    const result = audioTrackIRSchema.safeParse(
      validTrack({ startAtMs: 0, endAtMs: 1000, fadeInMs: 1500 }),
    );
    expect(result.success).toBe(false);
  });

  it("allows any fade length when the span is open-ended (no endAt)", () => {
    const result = audioTrackIRSchema.safeParse(
      validTrack({ endAtMs: undefined, fadeInMs: 60_000, fadeOutMs: 60_000 }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects overlapping fades within a bounded span", () => {
    const result = audioTrackIRSchema.safeParse(
      validTrack({
        startAtMs: 0,
        endAtMs: 1000,
        fadeInMs: 700,
        fadeOutMs: 700,
      }),
    );
    expect(result.success).toBe(false);
  });
});

describe("trackSpanMs", () => {
  it("returns endAt - startAt when bounded", () => {
    expect(trackSpanMs(validTrack({ startAtMs: 1000, endAtMs: 4000 }))).toBe(
      3000,
    );
  });

  it("returns Infinity when endAt is omitted", () => {
    expect(trackSpanMs(validTrack({ endAtMs: undefined }))).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe("audioTrackSchema", () => {
  it("accepts a rendered frame-based track", () => {
    const result = audioTrackSchema.safeParse({
      id: "music",
      src: "audio/music.mp3",
      fromFrame: 0,
      durationInFrames: 300,
      volume: 0.5,
      muted: false,
      loop: true,
      fadeInFrames: 30,
      fadeOutFrames: 30,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative frame values", () => {
    expect(
      audioTrackSchema.safeParse({
        id: "x",
        src: "x.mp3",
        fromFrame: -1,
        durationInFrames: 10,
        volume: 1,
        muted: false,
        loop: false,
        fadeInFrames: 0,
        fadeOutFrames: 0,
      }).success,
    ).toBe(false);
  });
});

describe("parseAudioOverridesJson", () => {
  it("parses a list of tracks", () => {
    const json = JSON.stringify([
      validTrack({ id: "a" }),
      validTrack({ id: "b" }),
    ]);
    expect(parseAudioOverridesJson(json)).toHaveLength(2);
  });

  it("throws on an invalid override set", () => {
    const json = JSON.stringify([validTrack({ volume: 2 })]);
    expect(() => parseAudioOverridesJson(json)).toThrow(/audio overrides/);
  });
});
