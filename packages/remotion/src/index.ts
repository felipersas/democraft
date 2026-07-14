// --- Server-side ---
export {
  renderDemoVideo,
  type RenderDemoVideoOptions,
} from "./server";
export { compositionId } from "./constants";

// --- Client-side composition ---
export {
  ProductDemoVideo,
  defaultProductDemoProps,
  type ProductDemoVideoProps,
} from "./composition";

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
  type CaptionProps,
  type CalloutProps,
  type VisualRegistry,
} from "./overlays";

// --- Registry API ---
export {
  defineVisualRegistry,
  type VisualEntry,
} from "./registry";

// --- Adapters ---
export {
  remocnAdapter,
  type DemocraftAdapter,
} from "./adapters/remocn";
