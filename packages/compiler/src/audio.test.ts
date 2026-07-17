import { describe, expect, it } from "vitest";
import { defineDemo, defineTargets, byTestId } from "@democraft/core";
import type { Duration } from "@democraft/core";
import { compileDemo, createCaptureHash, createDefinitionHash } from "./index";
import type { DemoIR } from "@democraft/schema";

const targets = defineTargets({
  dashboard: byTestId("dashboard"),
});

function audioDemo(audioTracks: unknown) {
  return defineDemo({
    id: "audio-demo",
    title: "Audio demo",
    source: { baseUrl: "http://localhost:3000" },
    targets,
    audioTracks: audioTracks as never,
    async run() {},
  });
}

describe("compiler audio tracks", () => {
  it("normalizes audio tracks into the IR in milliseconds", async () => {
    const result = await compileDemo(
      audioDemo([
        {
          id: "music",
          src: "./assets/music.mp3",
          kind: "music",
          startAt: "1s",
          endAt: "2.5s",
          volume: 0.25,
          loop: true,
          fadeIn: "250ms",
          fadeOut: "250ms",
        },
      ]),
    );
    expect(result.ir.audio).toEqual([
      {
        id: "music",
        src: "./assets/music.mp3",
        label: undefined,
        kind: "music",
        startAtMs: 1000,
        endAtMs: 2500,
        volume: 0.25,
        muted: false,
        loop: true,
        fadeInMs: 250,
        fadeOutMs: 250,
        disabled: false,
      },
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it("omits the IR audio field when no tracks are declared (back-compat)", async () => {
    const result = await compileDemo(
      defineDemo({
        id: "no-audio",
        title: "No audio",
        source: { baseUrl: "http://localhost:3000" },
        async run() {},
      }),
    );
    expect(result.ir.audio).toBeUndefined();
  });

  it("applies defaults: startAt 0, volume 1, kind sfx, fades 0", async () => {
    const result = await compileDemo(
      audioDemo([{ id: "sfx", src: "beep.wav" }]),
    );
    expect(result.ir.audio?.[0]).toMatchObject({
      startAtMs: 0,
      volume: 1,
      kind: "sfx",
      muted: false,
      loop: false,
      fadeInMs: 0,
      fadeOutMs: 0,
      endAtMs: undefined,
    });
  });

  it("reports duplicate audio ids (DC300)", async () => {
    const result = await compileDemo(
      audioDemo([
        { id: "dup", src: "a.mp3" },
        { id: "dup", src: "b.mp3" },
      ]),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "DC300",
        severity: "error",
        audioTrackId: "dup",
      }),
    );
  });

  it("reports unsupported file extensions (DC305)", async () => {
    const result = await compileDemo(
      audioDemo([{ id: "vid", src: "./clip.mp4" }]),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "DC305", audioTrackId: "vid" }),
    );
  });

  it("reports unparseable durations (DC306)", async () => {
    const result = await compileDemo(
      audioDemo([{ id: "bad", src: "a.mp3", startAt: "soon" as Duration }]),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "DC306", audioTrackId: "bad" }),
    );
  });

  it("reports volume out of range (DC302)", async () => {
    const result = await compileDemo(
      audioDemo([{ id: "loud", src: "a.mp3", volume: 2 }]),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "DC302", audioTrackId: "loud" }),
    );
  });

  it("reports endAt not greater than startAt (DC303)", async () => {
    const result = await compileDemo(
      audioDemo([{ id: "t", src: "a.mp3", startAt: "2s", endAt: "1s" }]),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "DC303", audioTrackId: "t" }),
    );
  });

  it("reports fades exceeding the bounded span (DC304)", async () => {
    const result = await compileDemo(
      audioDemo([
        {
          id: "f",
          src: "a.mp3",
          startAt: "0s",
          endAt: "1s",
          fadeIn: "2s",
        },
      ]),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "DC304", audioTrackId: "f" }),
    );
  });

  it("accepts any fade length when the span is open-ended", async () => {
    const result = await compileDemo(
      audioDemo([{ id: "open", src: "a.mp3", fadeIn: "60s", fadeOut: "60s" }]),
    );
    expect(result.diagnostics.filter((d) => d.code === "DC304")).toEqual([]);
  });

  describe("hash boundary", () => {
    const baseIr = (): DemoIR => ({
      schemaVersion: "1",
      id: "demo",
      title: "Demo",
      source: { baseUrl: "http://localhost:3000" },
      targets: { t: { id: "t", locators: [{ kind: "testId", id: "t" }] } },
      scenes: [],
    });

    it("includes audio in the definition hash", () => {
      const without = baseIr();
      const withAudio: DemoIR = {
        ...baseIr(),
        audio: [
          {
            id: "music",
            src: "music.mp3",
            startAtMs: 0,
            volume: 0.5,
            muted: false,
            loop: true,
            fadeInMs: 0,
            fadeOutMs: 0,
          },
        ],
      };
      expect(createDefinitionHash(withAudio)).not.toBe(
        createDefinitionHash(without),
      );
    });

    it("excludes audio from the capture hash (audio never forces re-capture)", () => {
      const without = baseIr();
      const withAudio: DemoIR = {
        ...baseIr(),
        audio: [
          {
            id: "music",
            src: "music.mp3",
            startAtMs: 0,
            volume: 0.5,
            muted: false,
            loop: true,
            fadeInMs: 0,
            fadeOutMs: 0,
          },
        ],
      };
      expect(createCaptureHash(withAudio)).toBe(createCaptureHash(without));
    });

    it("filters undefined audio so demos without audio keep a stable hash", () => {
      // canonicalJson drops undefined values, so an IR with the audio key
      // absent and one with audio: undefined must hash identically. This is
      // the back-comat guarantee for demos authored before audio support.
      const a = baseIr();
      const b: DemoIR = { ...baseIr(), audio: undefined };
      expect(createDefinitionHash(a)).toBe(createDefinitionHash(b));
    });
  });
});
