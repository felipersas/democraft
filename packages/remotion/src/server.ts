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
import type {
  RecordedDemoManifest,
  RenderTimeline,
} from "@democraft/schema";
import type { ProductDemoVideoProps } from "./composition";
import { compositionId } from "./constants";

export type RenderDemoVideoOptions = {
  manifest: RecordedDemoManifest;
  timeline: RenderTimeline;
  screenshotSrcByStepId: Record<string, string>;
  recordingFile?: string;
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
  const publicDir = await createRenderPublicDir(options.recordingFile);
  const scale = options.scale ?? 1;
  const inputProps: ProductDemoVideoProps = {
    manifest: options.manifest,
    recordingSrc: options.recordingFile ? "recording.webm" : undefined,
    timeline: options.timeline,
    screenshotSrcByStepId: options.screenshotSrcByStepId,
    width: options.width ?? 1920,
    height: options.height ?? 1080,
  };
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
