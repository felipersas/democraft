import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
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
  const inputProps = createProductDemoVideoProps({
    manifest: options.manifest,
    mediaMode,
    recordingSrc: selectedRecordingFile ? "recording.webm" : undefined,
    timeline: options.timeline,
    screenshotSrcByStepId: options.screenshotSrcByStepId,
    width: options.width,
    height: options.height,
  });
  const publicDir = await createRenderPublicDir(selectedRecordingFile);
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

async function createRenderPublicDir(
  recordingFile?: string,
): Promise<string | null> {
  if (!recordingFile) return null;
  const publicDir = await mkdtemp(join(tmpdir(), "democraft-remotion-"));
  await copyFile(recordingFile, join(publicDir, "recording.webm"));
  return publicDir;
}
