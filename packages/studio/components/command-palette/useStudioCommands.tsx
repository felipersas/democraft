"use client";

import * as React from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Film,
  Repeat1,
  Eye,
  RotateCcw,
  Search,
  ZoomIn,
  ZoomOut,
  MessageSquare,
} from "lucide-react";
import { useStudio } from "@/lib/studio-context";
import type { Command } from "./types";

/**
 * Builds the full set of palette commands from the current studio state.
 * The play/pause label flips, layer toggles reflect current visibility,
 * and one seek-to-scene command is generated per scene in the timeline.
 */
export function useStudioCommands(): Command[] {
  const {
    status,
    playerRef,
    loop,
    setLoop,
    enqueueRender,
    toggleLayer,
    layerState,
    resetLayers,
    resetCaptions,
    reload,
  } = useStudio();

  return React.useMemo(() => {
    const ready = status.kind === "ready";
    const player = playerRef.current;
    const total = ready ? status.data.timeline.durationInFrames : 0;
    const frame = player?.getCurrentFrame() ?? 0;
    const isPlaying = player?.isPlaying() ?? false;
    const seek = (f: number) => {
      const clamped = Math.max(0, Math.min(total - 1, Math.round(f)));
      player?.seekTo(clamped);
    };

    const cmds: Command[] = [
      {
        id: "play-pause",
        label: isPlaying ? "Pause" : "Play",
        group: "Playback",
        icon: isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />,
        run: () => (isPlaying ? player?.pause() : player?.play()),
        disabled: !ready,
      },
      {
        id: "prev-frame",
        label: "Previous frame",
        hint: "←",
        group: "Playback",
        icon: <SkipBack className="w-3.5 h-3.5" />,
        run: () => seek(frame - 1),
        disabled: !ready,
      },
      {
        id: "next-frame",
        label: "Next frame",
        hint: "→",
        group: "Playback",
        icon: <SkipForward className="w-3.5 h-3.5" />,
        run: () => seek(frame + 1),
        disabled: !ready,
      },
      {
        id: "seek-start",
        label: "Go to start",
        hint: "Home",
        group: "Playback",
        icon: <SkipBack className="w-3.5 h-3.5" />,
        run: () => seek(0),
        disabled: !ready,
      },
      {
        id: "seek-end",
        label: "Go to end",
        hint: "End",
        group: "Playback",
        icon: <SkipForward className="w-3.5 h-3.5" />,
        run: () => seek(total - 1),
        disabled: !ready,
      },
      {
        id: "toggle-loop",
        label: loop ? "Disable loop" : "Enable loop",
        group: "Playback",
        icon: <Repeat1 className="w-3.5 h-3.5" />,
        run: () => setLoop(!loop),
        disabled: !ready,
      },
      {
        id: "render",
        label: "Add render to queue",
        group: "Render",
        icon: <Film className="w-3.5 h-3.5" />,
        run: () => void enqueueRender(),
        disabled: !ready,
      },
      {
        id: "toggle-camera",
        label: `${layerState.camera ? "Hide" : "Show"} camera layer`,
        group: "Layers",
        icon: <Eye className="w-3.5 h-3.5" />,
        run: () => toggleLayer("camera"),
        disabled: !ready,
      },
      {
        id: "toggle-cursor",
        label: `${layerState.cursor ? "Hide" : "Show"} cursor layer`,
        group: "Layers",
        icon: <Eye className="w-3.5 h-3.5" />,
        run: () => toggleLayer("cursor"),
        disabled: !ready,
      },
      {
        id: "toggle-overlays",
        label: `${layerState.overlays ? "Hide" : "Show"} overlays layer`,
        group: "Layers",
        icon: <Eye className="w-3.5 h-3.5" />,
        run: () => toggleLayer("overlays"),
        disabled: !ready,
      },
      {
        id: "reset-layers",
        label: "Reset layer visibility",
        group: "Layers",
        icon: <RotateCcw className="w-3.5 h-3.5" />,
        run: () => resetLayers(),
        disabled: !ready,
      },
      {
        id: "reset-captions",
        label: "Reset caption edits",
        group: "Inspector",
        icon: <MessageSquare className="w-3.5 h-3.5" />,
        run: () => resetCaptions(),
        disabled: !ready,
      },
      {
        id: "zoom-in",
        label: "Zoom timeline in",
        hint: "+",
        group: "Timeline",
        icon: <ZoomIn className="w-3.5 h-3.5" />,
        run: () => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Equal" })),
        disabled: !ready,
      },
      {
        id: "zoom-out",
        label: "Zoom timeline out",
        hint: "−",
        group: "Timeline",
        icon: <ZoomOut className="w-3.5 h-3.5" />,
        run: () => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Minus" })),
        disabled: !ready,
      },
      {
        id: "reload",
        label: "Reload studio data",
        group: "Studio",
        icon: <RotateCcw className="w-3.5 h-3.5" />,
        run: () => reload(),
      },
    ];

    // Seek-to-scene commands (one per scene in the timeline).
    if (ready) {
      for (const scene of status.data.timeline.scenes) {
        cmds.push({
          id: `seek-scene-${scene.id}`,
          label: `Seek to scene: ${scene.id}`,
          group: "Scenes",
          icon: <Search className="w-3.5 h-3.5" />,
          run: () => seek(scene.fromFrame),
        });
      }
    }

    return cmds.filter((c) => !c.disabled);
  }, [
    status,
    playerRef,
    loop,
    setLoop,
    enqueueRender,
    toggleLayer,
    layerState,
    resetLayers,
    resetCaptions,
    reload,
  ]);
}
