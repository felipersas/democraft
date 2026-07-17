"use client";

import * as React from "react";
import type { PlayerRef } from "@remotion/player";
import type { AudioTrackIR } from "@democraft/schema";
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
import { studioMutationRequest } from "./studio-api";
import { effectiveAudioTracks } from "./audio-overrides";

const StudioContext = React.createContext<StudioContextValue | null>(null);
const AudioPreviewContext = React.createContext<{
  audioMuted: boolean;
  setAudioMuted: (value: boolean) => void;
} | null>(null);

const DEFAULT_LAYER_STATE: LayerState = {
  camera: true,
  cursor: true,
  overlays: true,
  hiddenOverlayIds: [],
};

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<StudioStatus>({ kind: "loading" });
  const [renderJobs, setRenderJobs] = React.useState<RenderJob[]>([]);
  const [renderError, setRenderError] = React.useState<string | null>(null);
  const [loop, setLoop] = React.useState(true);
  const playerRef = React.useRef<PlayerRef | null>(null);
  const [player, setPlayer] = React.useState<PlayerRef | null>(null);
  const bindPlayer = React.useCallback((instance: PlayerRef | null) => {
    playerRef.current = instance;
    setPlayer(instance);
  }, []);
  const dataVersionRef = React.useRef(0);

  // Ephemeral editing state — never persisted, only affects preview + (opt-in) render.
  const [layerState, setLayerState] =
    React.useState<LayerState>(DEFAULT_LAYER_STATE);
  const [soloLayer, setSoloLayer] = React.useState<LayerKind | null>(null);
  const [captionOverrides, setCaptionOverrides] =
    React.useState<CaptionOverrides>({});
  const [applyCaptionsToRender, setApplyCaptionsToRender] =
    React.useState(false);
  const [renderRange, setRenderRange] = React.useState<[number, number] | null>(
    null,
  );
  const [applyRenderRange, setApplyRenderRange] = React.useState(true);

  // Audio editing state. `audioTracks` mirrors the server data (override file
  // when present, else the timeline's audio). Edits persist to
  // audio-overrides.json; the server-pushed reload re-syncs local state.
  const [audioTracks, setAudioTracksState] = React.useState<
    AudioTrackIR[] | undefined
  >(undefined);
  const [audioError, setAudioError] = React.useState<string | null>(null);

  // Seed local audio state from server data whenever it changes. When no
  // override file exists, the effective tracks are derived from the timeline.
  React.useEffect(() => {
    if (status.kind !== "ready") return;
    setAudioTracksState(
      effectiveAudioTracks(status.data.timeline, status.data.audioOverrides),
    );
  }, [status]);

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
        frameRange: applyRenderRange ? (renderRange ?? undefined) : undefined,
      };
      setRenderError(null);
      try {
        await studioMutationRequest(
          "/api/render",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(merged),
          },
          "Render request failed.",
        );
        await refreshJobs();
      } catch (error) {
        setRenderError(
          error instanceof Error ? error.message : "Render request failed.",
        );
      }
    },
    [refreshJobs, applyRenderRange, renderRange],
  );

  const cancelRender = React.useCallback((jobId: string) => {
    setRenderError(null);
    void studioMutationRequest(
      "/api/render/cancel",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId }),
      },
      "Cancel render failed.",
    ).catch((error) => {
      setRenderError(renderMutationError(error, "Cancel render failed."));
    });
  }, []);

  const clearFinishedRenders = React.useCallback(() => {
    setRenderError(null);
    void studioMutationRequest(
      "/api/render/jobs",
      { method: "DELETE" },
      "Clear finished renders failed.",
    ).catch((error) => {
      setRenderError(
        renderMutationError(error, "Clear finished renders failed."),
      );
    });
  }, []);

  const openOutputFolder = React.useCallback((jobId: string) => {
    setRenderError(null);
    void studioMutationRequest(
      `/api/open-folder?jobId=${encodeURIComponent(jobId)}`,
      { method: "POST" },
      "Open output folder failed.",
    ).catch((error) => {
      setRenderError(renderMutationError(error, "Open output folder failed."));
    });
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

  const setCaptionText = React.useCallback(
    (overlayId: string, text: string) => {
      setCaptionOverrides((prev) => ({ ...prev, [overlayId]: text }));
    },
    [],
  );

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

  // ----- Audio overrides (persisted to audio-overrides.json) -------------------

  /** Persist a full track set to the server (creates/replaces the override). */
  const persistAudio = React.useCallback(async (tracks: AudioTrackIR[]) => {
    setAudioError(null);
    try {
      await studioMutationRequest(
        "/api/audio",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(tracks),
        },
        "Audio save failed.",
      );
      // The file watcher fires `reload`, which re-fetches and re-seeds state.
    } catch (error) {
      setAudioError(
        error instanceof Error ? error.message : "Audio save failed.",
      );
    }
  }, []);

  const setAudioTracks = React.useCallback(
    async (tracks: AudioTrackIR[]) => {
      setAudioTracksState(tracks);
      await persistAudio(tracks);
    },
    [persistAudio],
  );

  const addAudioTrack = React.useCallback(
    async (track: AudioTrackIR) => {
      const next = [...(audioTracks ?? []), track];
      setAudioTracksState(next);
      await persistAudio(next);
    },
    [audioTracks, persistAudio],
  );

  const updateAudioTrack = React.useCallback(
    async (id: string, patch: Partial<AudioTrackIR>) => {
      const next = (audioTracks ?? []).map((t) =>
        t.id === id ? { ...t, ...patch } : t,
      );
      setAudioTracksState(next);
      await persistAudio(next);
    },
    [audioTracks, persistAudio],
  );

  const removeAudioTrack = React.useCallback(
    async (id: string) => {
      const next = (audioTracks ?? []).filter((t) => t.id !== id);
      setAudioTracksState(next);
      await persistAudio(next);
    },
    [audioTracks, persistAudio],
  );

  const resetAudioTracks = React.useCallback(async () => {
    setAudioError(null);
    setAudioTracksState(undefined);
    try {
      await studioMutationRequest(
        "/api/audio",
        { method: "DELETE" },
        "Audio reset failed.",
      );
    } catch (error) {
      setAudioError(
        error instanceof Error ? error.message : "Audio reset failed.",
      );
    }
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
      player,
      bindPlayer,
      loop,
      setLoop,
      reload,
      renderJobs,
      renderError,
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
      audioTracks,
      hasAudioOverrides:
        status.kind === "ready" && status.data.audioOverrides !== undefined,
      setAudioTracks,
      addAudioTrack,
      updateAudioTrack,
      removeAudioTrack,
      resetAudioTracks,
      audioError,
    }),
    [
      status,
      player,
      bindPlayer,
      loop,
      setLoop,
      reload,
      renderJobs,
      renderError,
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
      audioTracks,
      setAudioTracks,
      addAudioTrack,
      updateAudioTrack,
      removeAudioTrack,
      resetAudioTracks,
      audioError,
    ],
  );

  return (
    <StudioContext.Provider value={value}>
      <AudioPreviewProvider>{children}</AudioPreviewProvider>
    </StudioContext.Provider>
  );
}

function AudioPreviewProvider({ children }: { children: React.ReactNode }) {
  const [audioMuted, setAudioMuted] = React.useState(false);
  const value = React.useMemo(
    () => ({ audioMuted, setAudioMuted }),
    [audioMuted],
  );
  return (
    <AudioPreviewContext.Provider value={value}>
      {children}
    </AudioPreviewContext.Provider>
  );
}

export function useStudio(): StudioContextValue {
  const ctx = React.useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within StudioProvider");
  return ctx;
}

export function useAudioPreview() {
  const ctx = React.useContext(AudioPreviewContext);
  if (!ctx) throw new Error("useAudioPreview must be used within StudioProvider");
  return ctx;
}

function renderMutationError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
