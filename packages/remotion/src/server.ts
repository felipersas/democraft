import { copyFile, mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  selectComposition,
  type CancelSignal,
  type FrameRange,
  type RenderMediaOnProgress,
} from "@remotion/renderer";
import type { RecordedDemoManifest, RenderTimeline } from "@democraft/schema";
import {
  createProductDemoVideoProps,
  DEFAULT_DEMO_MEDIA_MODE,
  type DemoMediaMode,
} from "./media";
import { compositionId } from "./constants";

export { createDemoEntrySource, materializeDemoEntry } from "./demo-entry";

export {
  cancelRenderArtifact,
  completeRenderArtifact,
  createRenderArtifact,
  failRenderArtifact,
  renderSlug,
  type CreateRenderArtifactOptions,
  type RenderArtifact,
  type RenderArtifactMetadata,
  type RenderArtifactStatus,
} from "./artifacts";

export type RenderDemoVideoOptions = {
  manifest: RecordedDemoManifest;
  timeline: RenderTimeline;
  screenshotSrcByStepId: Record<string, string>;
  recordingFile?: string;
  mediaMode?: DemoMediaMode;
  outputFile: string;
  width?: number;
  height?: number;
  scale?: number;
  crf?: number;
  /**
   * Optional path to the bundled entry.js (the file that calls registerRoot).
   * Defaults to dist/entry.js next to this module. Pass explicitly when
   * calling from inside a webpack bundle (e.g. Next.js dev server) where
   * import.meta.url is rewritten and the default resolution gives the
   * wrong path.
   */
  entryPath?: string;
  /**
   * Live render progress. Receives Remotion's RenderMediaProgress
   * ({ progress, renderedFrames, encodedFrames, stitchStage,
   * renderEstimatedTime, … }). Forwarded verbatim to renderMedia.
   */
  onProgress?: RenderMediaOnProgress;
  /**
   * Cancellation handle from makeCancelSignal(). When the paired cancel()
   * is invoked, renderMedia rejects with a cancel error.
   */
  cancelSignal?: CancelSignal;
  /**
   * Sub-range of frames to render ([startFrame, endFrame], inclusive). When
   * omitted the whole composition renders. Used by the studio's in/out
   * markers. See docs/architecture/studio-roadmap.md "Render range".
   */
  frameRange?: FrameRange;
  /**
   * Pre-resolved audio sources (id → publicDir-relative path or URL). When
   * supplied, the renderer skips its own audio-source resolution. Used by the
   * Studio, which serves audio from `studio-data/audio/` rather than the
   * workspace paths referenced in demo.ts.
   */
  audioSrcById?: Record<string, string>;
};

export async function renderDemoVideo(
  options: RenderDemoVideoOptions,
): Promise<void> {
  // Preserve the old public API: providing recordingFile was already an
  // explicit request to render from it. New callers should pass mediaMode.
  const mediaMode =
    options.mediaMode ??
    (options.recordingFile ? "recording" : DEFAULT_DEMO_MEDIA_MODE);
  const selectedRecordingFile =
    mediaMode === "recording" ? options.recordingFile : undefined;
  // Resolve audio sources before building props: path-based files are copied
  // into the temp publicDir under `audio/`; URLs pass through verbatim. The
  // resulting map (id → publicDir-relative path or URL) is consumed by
  // `AudioLayer`, which wraps publicDir paths in `staticFile()`. When the
  // caller supplies a pre-resolved map (e.g. the Studio, which serves files
  // from studio-data/audio), resolution is skipped.
  const audioTracks = options.timeline.audio ?? [];
  const callerAudioSrcById = options.audioSrcById;
  const publicDir =
    callerAudioSrcById !== undefined
      ? await createRenderPublicDir(selectedRecordingFile)
      : await createRenderPublicDir(selectedRecordingFile, audioTracks);
  const audioSrcById =
    callerAudioSrcById ?? (await resolveAudioSources(audioTracks, publicDir));
  const inputProps = createProductDemoVideoProps({
    manifest: options.manifest,
    mediaMode,
    recordingSrc: selectedRecordingFile ? "recording.webm" : undefined,
    timeline: options.timeline,
    screenshotSrcByStepId: options.screenshotSrcByStepId,
    audioSrcById,
    width: options.width,
    height: options.height,
  });
  const scale = options.scale ?? 1;
  try {
    const entryPoint =
      options.entryPath ??
      fileURLToPath(new URL("./entry.js", import.meta.url).href);
    const serveUrl = await bundle({ entryPoint, publicDir });
    const composition = await selectComposition({
      serveUrl,
      id: compositionId,
      inputProps,
    });

    await mkdir(dirname(options.outputFile), { recursive: true });
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      crf: options.crf ?? 15,
      scale,
      jpegQuality: 100,
      outputLocation: options.outputFile,
      inputProps,
      onProgress: options.onProgress,
      cancelSignal: options.cancelSignal,
      frameRange: options.frameRange,
    });
  } finally {
    if (publicDir) await rm(publicDir, { recursive: true, force: true });
  }
}

/**
 * Allocate a temp publicDir for Remotion's bundler to serve local assets:
 * the recording (when rendering from it) and any path-based audio files.
 * Returns null when neither is needed (pure-URL or no-audio renders).
 */
async function createRenderPublicDir(
  recordingFile?: string,
  audioTracks?: { src: string }[],
): Promise<string | null> {
  const hasPathAudio =
    audioTracks?.some((track) => !isAbsoluteUrl(track.src)) ?? false;
  if (!recordingFile && !hasPathAudio) return null;
  const publicDir = await mkdtemp(join(tmpdir(), "democraft-remotion-"));
  if (recordingFile) {
    await copyFile(recordingFile, join(publicDir, "recording.webm"));
  }
  return publicDir;
}

/**
 * Build the `audioSrcById` map. URL sources (http(s)/data/blob) are passed
 * through; path-based sources are copied into the publicDir under `audio/`
 * with a stable name (the basename) and referenced as a publicDir-relative
 * path that `AudioLayer` will wrap in `staticFile()`.
 *
 * Missing files are skipped (not mapped) — the Studio reports them as
 * validation errors so the render still completes for the resolvable tracks.
 */
async function resolveAudioSources(
  tracks: { id: string; src: string }[],
  publicDir: string | null,
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  if (!publicDir) {
    // Only URL sources can resolve without a publicDir.
    for (const track of tracks) {
      if (isAbsoluteUrl(track.src)) map[track.id] = track.src;
    }
    return map;
  }

  const audioDir = join(publicDir, "audio");
  await mkdir(audioDir, { recursive: true });
  for (const track of tracks) {
    if (isAbsoluteUrl(track.src)) {
      map[track.id] = track.src;
      continue;
    }
    if (!(await existsFile(track.src))) continue;
    const dest = join(audioDir, basename(track.src));
    await copyFile(track.src, dest);
    map[track.id] = `audio/${basename(track.src)}`;
  }
  return map;
}

async function existsFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function basename(filePath: string): string {
  const queryless = filePath.split("?")[0]!.split("#")[0]!;
  const slash = Math.max(
    queryless.lastIndexOf("/"),
    queryless.lastIndexOf("\\"),
  );
  const name = slash >= 0 ? queryless.slice(slash + 1) : queryless;
  // Disallow path traversal in the copied filename.
  return name === ".." || name === "." ? "audio-track" : name;
}

/** True for http(s)/data/blob URLs (must not be treated as local files). */
function isAbsoluteUrl(value: string): boolean {
  return /^(https?:|data:|blob:)/i.test(value);
}
