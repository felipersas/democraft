import type { ProductDemoVideoProps } from "./composition";

export type DemoMediaMode = "screenshots" | "recording";

export const DEFAULT_DEMO_MEDIA_MODE: DemoMediaMode = "screenshots";

const DEFAULT_COMPOSITION_WIDTH = 1920;
const DEFAULT_COMPOSITION_HEIGHT = 1080;

export type CreateProductDemoVideoPropsOptions = Omit<
  ProductDemoVideoProps,
  "recordingSrc" | "width" | "height"
> & {
  mediaMode?: DemoMediaMode;
  recordingSrc?: string;
  width?: number;
  height?: number;
};

export function createProductDemoVideoProps(
  options: CreateProductDemoVideoPropsOptions,
): ProductDemoVideoProps {
  const mediaMode = options.mediaMode ?? DEFAULT_DEMO_MEDIA_MODE;
  if (mediaMode === "recording" && !options.recordingSrc) {
    throw new Error("Recording mode requires a recording source.");
  }

  return {
    manifest: options.manifest,
    timeline: options.timeline,
    recordingSrc: mediaMode === "recording" ? options.recordingSrc : undefined,
    screenshotSrcByStepId: options.screenshotSrcByStepId,
    width: options.width ?? DEFAULT_COMPOSITION_WIDTH,
    height: options.height ?? DEFAULT_COMPOSITION_HEIGHT,
    registry: options.registry,
    audioSrcById: options.audioSrcById,
  };
}
