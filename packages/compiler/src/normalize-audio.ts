import type { AudioTrackInput } from "@democraft/core";
import {
  DEFAULT_AUDIO_KIND,
  DEFAULT_AUDIO_VOLUME,
  diagnosticDocsUrl,
  type AudioKind,
  type AudioTrackIR,
  type Diagnostic,
} from "@democraft/schema";
import { parseDurationMs } from "./duration";

/**
 * Supported audio file extensions. The src is not opened at compile time
 * (compilation is environment-agnostic), but the extension is validated so a
 * typo like `.mp4` (video) surfaces as a clear diagnostic instead of failing
 * deep inside the Remotion render.
 */
const SUPPORTED_AUDIO_EXTENSIONS: readonly string[] = [
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".ogg",
  ".oga",
  ".flac",
  ".weba",
  ".opus",
];

/**
 * Normalize author `audioTracks` (Duration strings) into the serialized
 * `AudioTrackIR` form (milliseconds), pushing a diagnostic for any track whose
 * duration strings are unparseable or whose extension is unsupported. Returns
 * `undefined` when the author declared no tracks (keeps the IR field absent for
 * back-compat).
 *
 * Per-track cross-field validation (volume range, fade vs span, etc.) is
 * performed by `validateIR` for richer diagnostics — this function only
 * converts units, applies defaults, and reports unparseable durations /
 * unsupported formats.
 */
export function normalizeAudioTracks(
  demoId: string,
  tracks: AudioTrackInput[] | undefined,
  diagnostics: Diagnostic[],
): AudioTrackIR[] | undefined {
  if (!tracks || tracks.length === 0) return undefined;

  const normalized: AudioTrackIR[] = [];
  for (const track of tracks) {
    const startAtMs = durationOrDiagnostic(
      demoId,
      track,
      "startAt",
      track.startAt,
      0,
      diagnostics,
    );
    const endAtMs = optionalDurationOrDiagnostic(
      demoId,
      track,
      "endAt",
      track.endAt,
      diagnostics,
    );
    const fadeInMs = durationOrDiagnostic(
      demoId,
      track,
      "fadeIn",
      track.fadeIn,
      0,
      diagnostics,
    );
    const fadeOutMs = durationOrDiagnostic(
      demoId,
      track,
      "fadeOut",
      track.fadeOut,
      0,
      diagnostics,
    );

    const extension = audioExtension(track.src);
    if (extension && !SUPPORTED_AUDIO_EXTENSIONS.includes(extension)) {
      diagnostics.push({
        code: "DC305",
        severity: "error",
        message: `Audio track "${track.id}" has an unsupported file extension "${extension}".`,
        path: `audioTracks.${track.id}.src`,
        suggestion: `Use a supported audio format: ${SUPPORTED_AUDIO_EXTENSIONS.join(", ")}.`,
        docsUrl: diagnosticDocsUrl("DC305"),
        demoId,
        audioTrackId: track.id,
        details: { src: track.src, extension },
      });
    }

    normalized.push({
      id: track.id,
      src: track.src,
      label: track.label,
      kind: (track.kind as AudioKind | undefined) ?? DEFAULT_AUDIO_KIND,
      startAtMs,
      endAtMs,
      volume: track.volume ?? DEFAULT_AUDIO_VOLUME,
      muted: track.muted ?? false,
      loop: track.loop ?? false,
      fadeInMs,
      fadeOutMs,
      disabled: false,
    });
  }
  return normalized;
}

/**
 * Parse a required Duration field, pushing a DC306 diagnostic and falling back
 * to `defaultValue` when the value is missing or unparseable.
 */
function durationOrDiagnostic(
  demoId: string,
  track: AudioTrackInput,
  field: "startAt" | "fadeIn" | "fadeOut",
  value: string | undefined,
  defaultValue: number,
  diagnostics: Diagnostic[],
): number {
  if (value === undefined) return defaultValue;
  const parsed = parseDurationMs(value);
  if (parsed === null) {
    pushInvalidDuration(demoId, track, field, value, diagnostics);
    return defaultValue;
  }
  return parsed;
}

/**
 * Parse an optional Duration field. Missing → undefined (omit). Unparseable →
 * diagnostic + undefined.
 */
function optionalDurationOrDiagnostic(
  demoId: string,
  track: AudioTrackInput,
  field: "endAt",
  value: string | undefined,
  diagnostics: Diagnostic[],
): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseDurationMs(value);
  if (parsed === null) {
    pushInvalidDuration(demoId, track, field, value, diagnostics);
    return undefined;
  }
  return parsed;
}

function pushInvalidDuration(
  demoId: string,
  track: AudioTrackInput,
  field: string,
  value: string,
  diagnostics: Diagnostic[],
): void {
  diagnostics.push({
    code: "DC306",
    severity: "error",
    message: `Invalid duration "${value}" on audio track "${track.id}".`,
    path: `audioTracks.${track.id}.${field}`,
    suggestion: 'Use a duration such as "250ms", "1s", or "1.5s".',
    docsUrl: diagnosticDocsUrl("DC306"),
    demoId,
    audioTrackId: track.id,
    details: { field, duration: value },
  });
}

/** Extract the lowercased file extension from a path/URL src, or undefined. */
function audioExtension(src: string): string | undefined {
  const queryless = src.split("?")[0]?.split("#")[0];
  if (!queryless) return undefined;
  const slash = Math.max(
    queryless.lastIndexOf("/"),
    queryless.lastIndexOf("\\"),
  );
  const basename = slash >= 0 ? queryless.slice(slash + 1) : queryless;
  const dot = basename.lastIndexOf(".");
  if (dot <= 0) return undefined; // hidden file or no extension
  return basename.slice(dot).toLowerCase();
}
