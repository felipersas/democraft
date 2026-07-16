// Client-side exports — used by Remotion entry points (registerRoot) and by
// the Studio's Remotion Player preview. These run inside the Remotion
// composition (client-side), not on the server.
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

export { compositionId } from "./constants";

export { stageLayout, type StageLayout, type CaptureDimensions } from "./stage";

export {
  defaultVisualRegistry,
  Caption,
  Callout,
  KineticCaption,
  GlassCallout,
  ModernCallout,
  DarkCallout,
  LightCallout,
  OverlayLayer,
  type VisualComponent,
  type GenericVisualComponent,
  type CaptionProps,
  type CalloutProps,
  type CalloutTheme,
  type ModernCalloutProps,
  type VisualRegistry,
} from "./overlays";

export {
  defineVisual,
  defineVisualRegistry,
  visualRegistryFromDefinitions,
  type VisualEntry,
} from "./registry";

export { remocnAdapter, type DemocraftAdapter } from "./adapters/remocn";

export {
  SoftBlurIn,
  type SoftBlurInProps,
} from "./components/remocn/soft-blur-in";
