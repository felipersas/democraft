import React from "react";
import { Audio, interpolate, Sequence, staticFile } from "remotion";
import type { AudioTrack } from "@democraft/schema";

/**
 * Computes the volume multiplier (0..1) for an audio track at a given local
 * frame within its {@link AudioTrack.durationInFrames} span. Pure function so
 * the curve can be unit-tested without mounting Remotion.
 *
 * The curve:
 *  - ramps 0 → `track.volume` across `fadeInFrames` (clamped),
 *  - holds `track.volume`,
 *  - ramps `track.volume` → 0 across the last `fadeOutFrames`.
 *
 * When the fades would overlap (both > 0 and together exceed the span), the
 * two ramps cross at the midpoint — neither extrapolates beyond the audible
 * region. The resolver already clamps each fade to the span; this guard keeps
 * the curve safe for tracks authored directly on the timeline too.
 */
export function audioVolumeAtFrame(
  track: AudioTrack,
  localFrame: number,
): number {
  const span = track.durationInFrames;
  if (span <= 0) return 0;

  const fadeIn = Math.min(track.fadeInFrames, span);
  const fadeOut = Math.min(track.fadeOutFrames, span);

  let volume = track.volume;

  if (fadeIn > 0) {
    volume *= interpolate(localFrame, [0, fadeIn], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  if (fadeOut > 0) {
    const fadeOutStart = span - fadeOut;
    volume *= interpolate(localFrame, [fadeOutStart, span], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  return Math.max(0, Math.min(1, volume));
}

/**
 * The non-visual audio layer of {@link ProductDemoVideo}. Renders one
 * `<Sequence><Audio/></Sequence>` per timeline audio track. Audio is
 * presentation-only and never affects capture.
 *
 * `audioSrcById` resolves each track's `src` to a Remotion-loadable source:
 *  - an absolute URL (`http(s)://`, `data:`, `blob:`) is used verbatim;
 *  - a publicDir-relative path (e.g. `"audio/music.mp3"`) is wrapped in
 *    `staticFile()` so Remotion's bundler serves it — mirrors how
 *    `recordingSrc` is handled in `stage.ts`.
 *
 * Tracks missing from the map (unresolvable asset) are skipped rather than
 * crashing the render — the Studio surfaces those as validation errors.
 *
 * Fades are applied via the `volume` callback (`(frame) => number`) on the
 * inner `<Audio>`, where `frame` is local to the `<Sequence>`. `muted` and
 * `loop` are forwarded verbatim. There is intentionally no `startFrom`/`endAt`
 * on the `<Audio>` — source trimming is out of scope for v1.
 */
export function AudioLayer(props: {
  audio: AudioTrack[];
  audioSrcById?: Record<string, string>;
}): React.ReactElement {
  return React.createElement(
    React.Fragment,
    null,
    props.audio.map((track) => {
      const resolved = props.audioSrcById?.[track.id];
      // An unresolvable asset is silently skipped here; the Studio reports it
      // as a validation error so the user knows the track won't render.
      if (!resolved) return null;
      const src = isAbsoluteUrl(resolved) ? resolved : staticFile(resolved);
      return React.createElement(
        Sequence,
        {
          key: track.id,
          from: track.fromFrame,
          durationInFrames: track.durationInFrames,
          layout: "none" as const,
        },
        React.createElement(Audio, {
          src,
          muted: track.muted,
          loop: track.loop,
          volume: (frame: number) => audioVolumeAtFrame(track, frame),
        }),
      );
    }),
  );
}

/** True for http(s)/data/blob URLs that must NOT go through `staticFile`. */
function isAbsoluteUrl(value: string): boolean {
  return /^(https?:|data:|blob:)/i.test(value);
}
