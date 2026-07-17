/**
 * Audio track types and validation.
 *
 * Audio is *presentation-only* — it never affects Playwright capture (no
 * `captureHash` contribution), only the rendered video. Like captions and
 * overlays it lives in three representations:
 *
 *   Author (core)   AudioTrackInput   Duration strings (`"250ms"`, `"1s"`)
 *   IR (schema)     AudioTrackIR      milliseconds (serialized, hashed)
 *   Timeline        AudioTrack        frames (rendered by Remotion)
 *
 * The conversions are explicit and tested: core→IR (compiler), IR→frames
 * (timeline). See docs/architecture/remotion-integration.md "Audio".
 */

import { z } from "zod";

/** Semantic classification of an audio track. Drives Studio icon/color only. */
export type AudioKind = "music" | "narration" | "sfx" | "ambient";

export const AUDIO_KINDS: readonly AudioKind[] = [
  "music",
  "narration",
  "sfx",
  "ambient",
] as const;

export const DEFAULT_AUDIO_KIND: AudioKind = "sfx";
export const DEFAULT_AUDIO_VOLUME = 1;

/**
 * Serialized audio track (milliseconds). Persisted in the demo IR and in the
 * Studio's `audio-overrides.json`. The authoritative representation for
 * hashing and Studio edits.
 */
export type AudioTrackIR = {
  id: string;
  /** Path (workspace-relative or absolute), URL, or `staticFile("…")` reference. */
  src: string;
  label?: string;
  kind?: AudioKind;
  /** Start offset on the composition timeline, in ms. Defaults to 0. */
  startAtMs: number;
  /** Inclusive end offset on the composition timeline, in ms. Omit to play to composition end. */
  endAtMs?: number;
  /** 0..1. Defaults to 1. */
  volume: number;
  muted: boolean;
  loop: boolean;
  /** Fade-in duration in ms. Defaults to 0. */
  fadeInMs: number;
  /** Fade-out duration in ms. Defaults to 0. */
  fadeOutMs: number;
  /**
   * Whether the track is disabled (silent). Studio-only affordance; a disabled
   * track resolves to nothing in the timeline. Defaults to false.
   */
  disabled?: boolean;
};

/**
 * Rendered audio track (frames). Produced by the timeline resolver from an
 * {@link AudioTrackIR}. `spanFrames` is the on-screen duration of the track,
 * already clipped to the composition. Consumed by the Remotion `AudioLayer`.
 */
export type AudioTrack = {
  id: string;
  src: string;
  label?: string;
  kind?: AudioKind;
  /** First frame the track plays (composition frame space). */
  fromFrame: number;
  /** Number of frames the track is audible (≥0; 0 = not rendered). */
  durationInFrames: number;
  volume: number;
  muted: boolean;
  loop: boolean;
  /** Fade-in length in frames, clamped to the span. */
  fadeInFrames: number;
  /** Fade-out length in frames, clamped to the span. */
  fadeOutFrames: number;
};

const nonNegativeFinite = z.number().finite().nonnegative();
const nonNegativeInteger = z.number().int().nonnegative();

const audioKindSchema = z.enum(AUDIO_KINDS as [AudioKind, ...AudioKind[]]);

/**
 * Per-track zod schema with cross-field validation. List-level checks
 * (duplicate ids) run in the compiler's `validateIR` because they need a
 * `Diagnostic[]` sink and a demo id — see packages/compiler/src/validation.ts.
 */
export const audioTrackIRSchema: z.ZodType<AudioTrackIR> = z
  .object({
    id: z.string().min(1),
    src: z.string().min(1),
    label: z.string().optional(),
    kind: audioKindSchema.optional(),
    startAtMs: nonNegativeFinite,
    endAtMs: nonNegativeFinite.optional(),
    volume: nonNegativeFinite.max(1),
    muted: z.boolean(),
    loop: z.boolean(),
    fadeInMs: nonNegativeFinite,
    fadeOutMs: nonNegativeFinite,
    disabled: z.boolean().optional(),
  })
  .passthrough()
  .superRefine((track, ctx) => {
    if (track.endAtMs !== undefined && track.endAtMs <= track.startAtMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAtMs"],
        message: "endAt must be greater than startAt.",
      });
    }
    const spanMs = trackSpanMs(track);
    if (track.fadeInMs > spanMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fadeInMs"],
        message: `fadeIn (${track.fadeInMs}ms) must not exceed the track span (${spanMs}ms).`,
      });
    }
    if (track.fadeOutMs > spanMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fadeOutMs"],
        message: `fadeOut (${track.fadeOutMs}ms) must not exceed the track span (${spanMs}ms).`,
      });
    }
    if (
      track.fadeInMs + track.fadeOutMs > spanMs &&
      track.fadeInMs > 0 &&
      track.fadeOutMs > 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fadeInMs"],
        message: "fadeIn + fadeOut must not overlap within the track span.",
      });
    }
  });

export const audioTrackSchema: z.ZodType<AudioTrack> = z
  .object({
    id: z.string().min(1),
    src: z.string().min(1),
    label: z.string().optional(),
    kind: audioKindSchema.optional(),
    fromFrame: nonNegativeInteger,
    durationInFrames: nonNegativeInteger,
    volume: nonNegativeFinite.max(1),
    muted: z.boolean(),
    loop: z.boolean(),
    fadeInFrames: nonNegativeInteger,
    fadeOutFrames: nonNegativeInteger,
  })
  .passthrough();

/** Effective audible span of an IR track in ms (open-ended ⇒ Infinity). */
export function trackSpanMs(track: AudioTrackIR): number {
  if (track.endAtMs === undefined) return Number.POSITIVE_INFINITY;
  return Math.max(0, track.endAtMs - track.startAtMs);
}
