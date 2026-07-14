"use client";

import * as React from "react";

/**
 * Named render presets persisted to localStorage. Lets the studio user save
 * reusable combinations of (scale, CRF) — e.g. "Quick preview" (1×, CRF 20)
 * and "Final" (2×, CRF 12). See docs/architecture/studio-roadmap.md "Render presets".
 */

export type RenderPreset = {
  id: string;
  name: string;
  scale: number;
  crf: number;
};

const STORAGE_KEY = "democraft:render-presets";

/** Sensible defaults shipped out of the box (not user-editable seeds). */
export const DEFAULT_PRESETS: RenderPreset[] = [
  { id: "preset-quick", name: "Quick preview", scale: 1, crf: 20 },
  { id: "preset-balanced", name: "Balanced", scale: 1, crf: 15 },
  { id: "preset-final", name: "Final", scale: 2, crf: 12 },
];

function loadPresets(): RenderPreset[] {
  if (typeof window === "undefined") return DEFAULT_PRESETS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PRESETS;
    const parsed = JSON.parse(raw) as RenderPreset[];
    if (!Array.isArray(parsed)) return DEFAULT_PRESETS;
    return parsed.filter(
      (p) =>
        p &&
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        typeof p.scale === "number" &&
        typeof p.crf === "number",
    );
  } catch {
    return DEFAULT_PRESETS;
  }
}

function savePresets(presets: RenderPreset[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    /* storage may be unavailable (private mode); presets stay in-memory */
  }
}

export function useRenderPresets() {
  const [presets, setPresets] = React.useState<RenderPreset[]>(DEFAULT_PRESETS);
  const [loaded, setLoaded] = React.useState(false);

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  React.useEffect(() => {
    setPresets(loadPresets());
    setLoaded(true);
  }, []);

  const addPreset = React.useCallback((preset: RenderPreset) => {
    setPresets((prev) => {
      const next = [...prev.filter((p) => p.id !== preset.id), preset];
      savePresets(next);
      return next;
    });
  }, []);

  const removePreset = React.useCallback((id: string) => {
    setPresets((prev) => {
      const next = prev.filter((p) => p.id !== id);
      savePresets(next);
      return next;
    });
  }, []);

  return { presets, loaded, addPreset, removePreset };
}
