// --- Server-side ---
export { renderDemoVideo, type RenderDemoVideoOptions } from "./server";
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
export { compositionId } from "./constants";

// --- Client-side composition ---
export {
  ProductDemoVideo,
  defaultProductDemoProps,
  type ProductDemoVideoProps,
} from "./composition";

export {
  createProductDemoVideoProps,
  DEFAULT_DEMO_MEDIA_MODE,
  type CreateProductDemoVideoPropsOptions,
  type DemoMediaMode,
} from "./media";

// --- Stage layout ---
export { stageLayout, type StageLayout, type CaptureDimensions } from "./stage";

// --- Visual registry + built-in components ---
export {
  defaultVisualRegistry,
  Caption,
  Callout,
  KineticCaption,
  GlassCallout,
  OverlayLayer,
  type VisualComponent,
  type GenericVisualComponent,
  type CaptionProps,
  type CalloutProps,
  type VisualRegistry,
} from "./overlays";

// --- Registry API ---
export { defineVisual, defineVisualRegistry, type VisualEntry } from "./registry";

// --- Adapters ---
export { remocnAdapter, type DemocraftAdapter } from "./adapters/remocn";
