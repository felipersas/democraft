"use client";

import * as React from "react";
import type { PlayerRef } from "@remotion/player";
import type {
  CaptionOverrides,
  LayerKind,
  LayerState,
  RenderJob,
  RenderOptions,
  StudioContextValue,
  StudioData,
  StudioStatus,
} from "./types";

const StudioContext = React.createContext<StudioContextValue | null>(null);

const DEFAULT_LAYER_STATE: LayerState = {
  camera: true,
  cursor: true,
  overlays: true,
  hiddenOverlayIds: [],
};

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<StudioStatus>({ kind: "loading" });
  const [renderJobs, setRenderJobs] = React.useState<RenderJob[]>([]);
  const [loop, setLoop] = React.useState(true);
  const playerRef = React.useRef<PlayerRef | null>(null);
  const dataVersionRef = React.useRef(0);

  // Ephemeral editing state — never persisted, only affects preview + (opt-in) render.
  const [layerState, setLayerState] =
    React.useState<LayerState>(DEFAULT_LAYER_STATE);
  const [soloLayer, setSoloLayer] = React.useState<LayerKind | null>(null);
  const [captionOverrides, setCaptionOverrides] =
    React.useState<CaptionOverrides>({});
  const [applyCaptionsToRender, setApplyCaptionsToRender] =
    React.useState(false);
  const [renderRange, setRenderRange] = React.useState<
    [number, number] | null
  >(null);
  const [applyRenderRange, setApplyRenderRange] = React.useState(true);

  const fetchData = React.useCallback(async () => {
    setStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/data?ts=" + dataVersionRef.current, {
        cache: "no-store",
      });
      if (!res.ok) {
        const message = await res.text();
        setStatus({ kind: "error", message: message || "Failed to load." });
        return;
      }
      const data = (await res.json()) as StudioData;
      setStatus({ kind: "ready", data });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  }, []);

  const reload = React.useCallback(() => {
    dataVersionRef.current += 1;
    void fetchData();
  }, [fetchData]);

  const refreshJobs = React.useCallback(async () => {
    try {
      const res = await fetch("/api/render/jobs", { cache: "no-store" });
      if (!res.ok) return;
      const { jobs } = (await res.json()) as { jobs: RenderJob[] };
      setRenderJobs(jobs);
    } catch {
      /* queue is best-effort */
    }
  }, []);

  const enqueueRender = React.useCallback(
    async (options?: RenderOptions) => {
      // Merge caller-supplied options (scale/crf/captions) with the in/out
      // render range, which is derived from studio state — not passed by the
      // caller — so the range toggle in the Inspector stays the single source
      // of truth for whether the sub-range applies.
      const merged: RenderOptions = {
        ...options,
        frameRange: applyRenderRange ? renderRange ?? undefined : undefined,
      };
      try {
        const res = await fetch("/api/render", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(merged),
        });
        if (!res.ok) return;
        await refreshJobs();
      } catch {
        /* surfaced via queue status */
      }
    },
    [refreshJobs, applyRenderRange, renderRange],
  );

  const cancelRender = React.useCallback(
    (jobId: string) => {
      void fetch("/api/render/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
    },
    [],
  );

  const clearFinishedRenders = React.useCallback(() => {
    void fetch("/api/render/jobs", { method: "DELETE" });
  }, []);

  const openOutputFolder = React.useCallback((jobId: string) => {
    void fetch(`/api/open-folder?jobId=${encodeURIComponent(jobId)}`);
  }, []);

  // ----- Layer visibility + solo -------------------------------------------------

  const toggleLayer = React.useCallback((kind: LayerKind) => {
    setLayerState((prev) => ({ ...prev, [kind]: !prev[kind] }));
  }, []);

  const toggleOverlayVisible = React.useCallback((id: string) => {
    setLayerState((prev) => {
      const set = new Set(prev.hiddenOverlayIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, hiddenOverlayIds: [...set] };
    });
  }, []);

  const setSolo = React.useCallback((kind: LayerKind | null) => {
    setSoloLayer((prev) => (prev === kind ? null : kind));
  }, []);

  const resetLayers = React.useCallback(() => {
    setLayerState(DEFAULT_LAYER_STATE);
    setSoloLayer(null);
  }, []);

  // ----- Caption overrides -------------------------------------------------------

  const setCaptionText = React.useCallback((overlayId: string, text: string) => {
    setCaptionOverrides((prev) => ({ ...prev, [overlayId]: text }));
  }, []);

  const resetCaption = React.useCallback((overlayId: string) => {
    setCaptionOverrides((prev) => {
      if (!(overlayId in prev)) return prev;
      const next = { ...prev };
      delete next[overlayId];
      return next;
    });
  }, []);

  const resetCaptions = React.useCallback(() => {
    setCaptionOverrides({});
  }, []);

  React.useEffect(() => {
    void fetchData();
    void refreshJobs();
  }, [fetchData, refreshJobs]);

  React.useEffect(() => {
    const es = new EventSource("/api/events");
    es.addEventListener("reload", () => {
      dataVersionRef.current += 1;
      void fetchData();
    });
    // Structural change detected by the demo.ts watcher → reload so the
    // staleness badge updates (re-resolve was skipped because it's unsafe).
    es.addEventListener("staleness", () => {
      dataVersionRef.current += 1;
      void fetchData();
    });
    es.addEventListener("render-job-update", (e) => {
      try {
        const job = JSON.parse((e as MessageEvent).data) as RenderJob;
        setRenderJobs((prev) => {
          const i = prev.findIndex((j) => j.id === job.id);
          if (i < 0) return [...prev, job];
          const next = prev.slice();
          next[i] = job;
          return next;
        });
      } catch {
        /* ignore malformed events */
      }
    });
    es.addEventListener("render-jobs-cleared", () => {
      setRenderJobs((prev) =>
        prev.filter(
          (j) =>
            j.status !== "done" &&
            j.status !== "failed" &&
            j.status !== "cancelled",
        ),
      );
    });
    return () => es.close();
  }, [fetchData]);

  // Memoize the context value so consumers only re-render when a value they
  // read actually changes. Without this, the provider allocates a fresh value
  // object on every render and every useStudio() consumer re-renders on any
  // state tick (e.g. a caption edit re-renders the Player). Vercel rule:
  // rerender-derived-state-no-effect.
  const value: StudioContextValue = React.useMemo(
    () => ({
      status,
      playerRef,
      loop,
      setLoop,
      reload,
      renderJobs,
      enqueueRender,
      cancelRender,
      clearFinishedRenders,
      openOutputFolder,
      layerState,
      soloLayer,
      toggleLayer,
      toggleOverlayVisible,
      setSolo,
      resetLayers,
      captionOverrides,
      setCaptionText,
      resetCaption,
      resetCaptions,
      applyCaptionsToRender,
      setApplyCaptionsToRender,
      renderRange,
      setRenderRange,
      applyRenderRange,
      setApplyRenderRange,
    }),
    [
      status,
      loop,
      setLoop,
      reload,
      renderJobs,
      enqueueRender,
      cancelRender,
      clearFinishedRenders,
      openOutputFolder,
      layerState,
      soloLayer,
      toggleLayer,
      toggleOverlayVisible,
      setSolo,
      resetLayers,
      captionOverrides,
      setCaptionText,
      resetCaption,
      resetCaptions,
      applyCaptionsToRender,
      setApplyCaptionsToRender,
      renderRange,
      setRenderRange,
      applyRenderRange,
      setApplyRenderRange,
    ],
  );

  return (
    <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
  );
}

export function useStudio(): StudioContextValue {
  const ctx = React.useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within StudioProvider");
  return ctx;
}
