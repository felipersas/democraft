import { describe, expect, it } from "vitest";
import type {
  AudioTrack,
  AudioTrackIR,
  RenderTimeline,
} from "@democraft/schema";
import {
  buildRenderAudio,
  effectiveAudioTracks,
  resolveAudioSrcById,
  resolveEffectiveAudio,
} from "./audio-overrides";

const timeline = (audio: AudioTrack[]): RenderTimeline => ({
  schemaVersion: "1",
  demoId: "demo",
  fps: 30,
  durationInFrames: 90,
  scenes: [],
  camera: [],
  cursor: [],
  overlays: [],
  audio,
});

const irTrack = (overrides: Partial<AudioTrackIR> = {}): AudioTrackIR => ({
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

describe("effectiveAudioTracks", () => {
  it("returns overrides when present", () => {
    const overrides = [irTrack({ id: "override" })];
    expect(effectiveAudioTracks(timeline([]), overrides)).toBe(overrides);
  });

  it("seeds from the timeline audio when no overrides exist", () => {
    const result = effectiveAudioTracks(
      timeline([
        {
          id: "music",
          src: "music.mp3",
          fromFrame: 30,
          durationInFrames: 60,
          volume: 0.5,
          muted: false,
          loop: true,
          fadeInFrames: 15,
          fadeOutFrames: 15,
        },
      ]),
      undefined,
    );
    expect(result).toEqual([
      expect.objectContaining({
        id: "music",
        src: "music.mp3",
        startAtMs: 1000, // 30 frames @ 30fps
        endAtMs: 3000, // 90 frames @ 30fps
        volume: 0.5,
        loop: true,
        fadeInMs: 500, // 15 frames @ 30fps
        fadeOutMs: 500,
      }),
    ]);
  });

  it("returns undefined when neither overrides nor timeline audio exist", () => {
    expect(effectiveAudioTracks(timeline([]), undefined)).toBeUndefined();
  });
});

describe("resolveEffectiveAudio", () => {
  it("converts IR tracks to frame tracks clipped to the composition", () => {
    const resolved = resolveEffectiveAudio(
      [irTrack({ startAtMs: 1000, endAtMs: 2500 })],
      30,
      1000,
    );
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({ fromFrame: 30, durationInFrames: 45 });
  });

  it("returns an empty array for no tracks", () => {
    expect(resolveEffectiveAudio(undefined, 30, 90)).toEqual([]);
  });
});

describe("resolveAudioSrcById", () => {
  const frameTrack = (src: string): AudioTrack => ({
    id: "music",
    src,
    fromFrame: 0,
    durationInFrames: 90,
    volume: 1,
    muted: false,
    loop: false,
    fadeInFrames: 0,
    fadeOutFrames: 0,
  });

  it("passes URL sources through verbatim", () => {
    const map = resolveAudioSrcById(
      [frameTrack("https://example.com/music.mp3")],
      "/data/audio",
    );
    expect(map).toEqual({ music: "https://example.com/music.mp3" });
  });

  it("maps path-based sources to the served audio URL by basename", () => {
    const map = resolveAudioSrcById(
      [frameTrack("./assets/music.mp3")],
      "/data/audio",
    );
    expect(map).toEqual({ music: "/data/audio/music.mp3" });
  });

  it("url-encodes the basename", () => {
    const map = resolveAudioSrcById(
      [frameTrack("./assets/my track.mp3")],
      "/data/audio",
    );
    expect(map).toEqual({ music: "/data/audio/my%20track.mp3" });
  });

  it("maps data: sources verbatim", () => {
    const map = resolveAudioSrcById(
      [frameTrack("data:audio/mp3;base64,AAA")],
      "/data/audio",
    );
    expect(map).toEqual({ music: "data:audio/mp3;base64,AAA" });
  });
});

describe("buildRenderAudio", () => {
  it("returns the timeline audio unchanged when no overrides exist", () => {
    const audio: AudioTrack[] = [
      {
        id: "music",
        src: "./assets/music.mp3",
        fromFrame: 0,
        durationInFrames: 90,
        volume: 1,
        muted: false,
        loop: false,
        fadeInFrames: 0,
        fadeOutFrames: 0,
      },
    ];
    const result = buildRenderAudio({
      timeline: { audio, fps: 30, durationInFrames: 90 },
      overrides: undefined,
      dataDir: "/data",
    });
    expect(result).toBe(audio);
  });

  it("resolves overrides to frames and rewrites path srcs into dataDir/audio", () => {
    const result = buildRenderAudio({
      timeline: { audio: [], fps: 30, durationInFrames: 90 },
      overrides: [
        irTrack({ id: "music", src: "./assets/music.mp3", startAtMs: 1000 }),
      ],
      dataDir: "/studio-data",
    });
    expect(result).toEqual([
      expect.objectContaining({
        id: "music",
        src: "/studio-data/audio/music.mp3",
        fromFrame: 30,
      }),
    ]);
  });

  it("passes URL sources through verbatim when resolving overrides", () => {
    const result = buildRenderAudio({
      timeline: { audio: [], fps: 30, durationInFrames: 90 },
      overrides: [irTrack({ id: "remote", src: "https://example.com/x.mp3" })],
      dataDir: "/studio-data",
    });
    expect(result?.[0]?.src).toBe("https://example.com/x.mp3");
  });
});
