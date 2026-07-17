import type {
  AudioTrack,
  AudioTrackIR,
  RenderTimeline,
} from "@democraft/schema";
import { resolveAudioTracks } from "@democraft/timeline";

/**
 * Studio audio overrides: merge logic + source resolution.
 *
 * Overrides live in `studio-data/audio-overrides.json` as a full
 * {@link AudioTrackIR}[] set (ms form). When present, they REPLACE the
 * demo.ts `audioTracks` for both preview and render — the Studio never edits
 * demo.ts directly (see docs/architecture/studio-roadmap.md "Workflow / DX").
 * "Reset" deletes the override file, falling back to demo.ts.
 */

/**
 * The effective IR track set for the studio: overrides when present, otherwise
 * the timeline's own audio seeded back into IR form (lossy on the first load —
 * the canonical ms values live in demo.ts). This is what the AudioPanel edits
 * and what feeds both preview and render.
 */
export function effectiveAudioTracks(
  timeline: RenderTimeline,
  overrides: AudioTrackIR[] | undefined,
): AudioTrackIR[] | undefined {
  return overrides ?? timelineAudioToIr(timeline.audio ?? [], timeline.fps);
}

/**
 * Resolve the effective IR tracks into timeline-frame tracks, clipped to the
 * composition duration. Reuses the timeline resolver so preview and render
 * share one conversion path.
 */
export function resolveEffectiveAudio(
  tracks: AudioTrackIR[] | undefined,
  fps: number,
  durationInFrames: number,
): AudioTrack[] {
  return resolveAudioTracks(tracks ?? [], fps, durationInFrames);
}

/**
 * Build the audio tracks for a render job. When overrides exist, they replace
 * the timeline's audio and each path-based src is rewritten to point at the
 * materialized file in `studio-data/audio/` (so renderDemoVideo can copy it
 * into its temp publicDir). URL sources pass through. When no overrides exist,
 * the timeline's own audio is used unchanged (demo.ts workspace paths are
 * resolved by renderDemoVideo against the workspace root).
 */
export function buildRenderAudio(args: {
  timeline: Pick<RenderTimeline, "audio" | "fps" | "durationInFrames">;
  overrides: AudioTrackIR[] | undefined;
  dataDir: string;
}): AudioTrack[] | undefined {
  if (!args.overrides) return args.timeline.audio;
  return resolveEffectiveAudio(
    args.overrides,
    args.timeline.fps,
    args.timeline.durationInFrames,
  ).map((track) => ({
    ...track,
    src: isAbsoluteUrl(track.src)
      ? track.src
      : joinPath(args.dataDir, "audio", audioBasename(track.src)),
  }));
}

/**
 * Build the `audioSrcById` map for the studio preview: each track's `src` is
 * mapped to a served URL. URL sources (http/data/blob) pass through; path-based
 * sources are served from the materialized `studio-data/audio/` directory via
 * `/data/audio/<basename>`. Tracks whose source can't be served are omitted
 * (the AudioPanel flags them as unresolvable).
 */
export function resolveAudioSrcById(
  tracks: AudioTrack[],
  audioBaseUrl: string,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const track of tracks) {
    map[track.id] = isAbsoluteUrl(track.src)
      ? track.src
      : `${audioBaseUrl}/${encodeURIComponent(audioBasename(track.src))}`;
  }
  return map;
}

/** True for http(s)/data/blob URLs that must be used verbatim. */
export function isAbsoluteUrl(value: string): boolean {
  return /^(https?:|data:|blob:)/i.test(value);
}

/** The trailing filename of a path/URL src (used as the served filename). */
export function audioBasename(src: string): string {
  const queryless = src.split("?")[0]!.split("#")[0]!;
  const slash = Math.max(
    queryless.lastIndexOf("/"),
    queryless.lastIndexOf("\\"),
  );
  const name = slash >= 0 ? queryless.slice(slash + 1) : queryless;
  return name === "." || name === ".." ? "audio-track" : name;
}

/** Join path segments with a single forward slash (cross-platform). */
function joinPath(...segments: string[]): string {
  return segments
    .map((segment, index) =>
      index === 0
        ? segment.replace(/[\\/]+$/, "")
        : segment.replace(/^[\\/]+|[\\/]+$/g, ""),
    )
    .filter(Boolean)
    .join("/");
}

/**
 * Best-effort reverse of the timeline resolver: frame tracks → IR (ms). Used
 * only to seed the editor when no override file exists yet, so the panel shows
 * the demo.ts tracks for editing. Round-trips through frames are lossy on
 * fractional values (rounded to the nearest ms); the canonical IR always comes
 * from demo.ts via the compiler, and any edit immediately persists a precise
 * override file.
 */
function timelineAudioToIr(
  audio: AudioTrack[],
  fps: number,
): AudioTrackIR[] | undefined {
  if (audio.length === 0) return undefined;
  const msPerFrame = 1000 / Math.max(1, fps);
  return audio.map((track) => ({
    id: track.id,
    src: track.src,
    label: track.label,
    kind: track.kind,
    startAtMs: Math.round(track.fromFrame * msPerFrame),
    endAtMs:
      track.durationInFrames > 0
        ? Math.round((track.fromFrame + track.durationInFrames) * msPerFrame)
        : undefined,
    volume: track.volume,
    muted: track.muted,
    loop: track.loop,
    fadeInMs: Math.round(track.fadeInFrames * msPerFrame),
    fadeOutMs: Math.round(track.fadeOutFrames * msPerFrame),
    disabled: false,
  }));
}
