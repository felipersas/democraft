import {
  defaultVisualRegistry,
  type VisualRegistry,
} from "../overlays";

/**
 * A Democraft adapter bundles optional extensions to the rendering pipeline.
 *
 * Today the only field is `visualRegistry`, which adds or overrides renderer
 * IDs (the strings authors pass as `renderer` on caption/callout steps). Future
 * fields may include theme presets, cursor styles, browser frames, etc.
 *
 * The type lives in `@democraft/core` (as `DemocraftAdapter`) to avoid a
 * circular dependency, but is re-exported here for convenience.
 */
export type DemocraftAdapter = {
  name: string;
  visualRegistry?: VisualRegistry;
};

/**
 * Create the remocn adapter — the recommended adapter for Democraft.
 *
 * Remocn ("Remotion + shadcn") is the primary source of cinematic components
 * for overlays. The adapter ships with built-in renderers (`motion.*` defaults
 * + `remocn.*` components). Pass a custom registry to add or replace
 * renderers.
 *
 * @example
 * ```ts
 * import { remocnAdapter, defineVisualRegistry } from "@democraft/remotion";
 * import { MyCaption } from "./my-caption";
 *
 * export default defineConfig({
 *   adapters: [
 *     remocnAdapter({
 *       registry: defineVisualRegistry(
 *         { kind: "caption", id: "local.my-caption", component: MyCaption },
 *       ),
 *     }),
 *   ],
 * });
 * ```
 *
 * The adapter's registry is consumed by a user-authored entry point (see the
 * "Custom entry" guide) to wire the components into `<ProductDemoVideo>`.
 */
export function remocnAdapter(options?: {
  registry?: VisualRegistry;
}): DemocraftAdapter {
  return {
    name: "remocn",
    visualRegistry: options?.registry ?? defaultVisualRegistry,
  };
}
