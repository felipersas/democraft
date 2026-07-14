import type { LayerKind, LayerState } from "./types";

/**
 * Resolves whether a layer kind is visible given the current visibility +
 * solo state. Consolidates the `soloLayer === null ? layerState[k] :
 * soloLayer === k` formula that was duplicated in PlayerPane (3x inlined for
 * camera/cursor/overlays) and TimelineBody's `isLayerOn`.
 *
 * Solo semantics: when a layer is soloed, ONLY that layer kind is visible;
 * all others are hidden regardless of their individual toggle.
 */
export function isLayerVisible(
  layerState: LayerState,
  soloLayer: LayerKind | null,
  kind: LayerKind,
): boolean {
  return soloLayer === null ? layerState[kind] : soloLayer === kind;
}
