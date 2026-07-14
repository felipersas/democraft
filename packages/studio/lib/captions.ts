import type { OverlayTrack } from "@democraft/schema";

export type CaptionOverrides = Record<string, string>;

/**
 * Returns a new overlays array with caption text replaced by any matching
 * override. Used by both the client preview (PlayerPane.applyEphemeralEdits)
 * and the server render path (render-queue.runJob) — the single source of
 * truth for the caption-override transform. See docs/architecture/studio-roadmap.md
 * "Inspector / editing" (hybrid override seam).
 */
export function applyCaptionOverrides(
  overlays: OverlayTrack[],
  overrides: CaptionOverrides,
): OverlayTrack[] {
  return overlays.map((o) =>
    o.kind === "caption" && overrides[o.id] != null
      ? { ...o, text: overrides[o.id] }
      : o,
  );
}
