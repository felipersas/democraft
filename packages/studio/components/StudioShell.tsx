"use client";

import * as React from "react";
import { Clapperboard } from "lucide-react";
import { PlayerPane } from "./PlayerPane";
import { Transport } from "./Transport";
import { TimelineTrack } from "./TimelineTrack";
import { InspectorPanel } from "./InspectorPanel";
import { RenderPanel } from "./RenderPanel";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { StalenessBadge } from "./StalenessBadge";
import { RecaptureButton } from "./RecaptureButton";
import { useStudio } from "@/lib/studio-context";
import { isTypingTarget } from "@/lib/dom";

export function StudioShell() {
  useKeyboardShortcuts();
  const { status } = useStudio();

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <header className="flex items-center gap-3 px-4 h-11 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
        <div className="flex items-center gap-2">
          <Clapperboard className="w-4 h-4 text-[var(--color-accent)]" />
          <div className="text-sm font-semibold tracking-tight">
            Democraft Studio
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-dim)]">
          {status.kind === "ready" ? status.data.timeline.demoId : ""}
        </div>
        {status.kind === "ready" && (
          <StalenessBadge staleness={status.data.staleness} />
        )}
        {status.kind === "ready" && <RecaptureButton />}
        <div className="flex-1" />
        <span className="text-[10px] text-[var(--color-fg-dim)] tabular-nums hidden sm:inline">
          ⌘K commands · ? shortcuts
        </span>
        <a
          href="https://www.remotion.dev/docs"
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-[var(--color-fg-dim)] hover:text-[var(--color-fg-muted)] transition-colors"
        >
          Remotion docs ↗
        </a>
      </header>

      {/* Editor-style layout: player + inspector on top, full-width
          timeline docked at the bottom. Mirrors the arrangement in video
          editors (Premiere, DaVinci, Remotion Studio) so the timeline can
          stretch horizontally for precise frame work. */}
      <main className="flex-1 flex min-h-0">
        <section className="flex-1 flex flex-col min-w-0">
          <PlayerPane />
          <Transport />
        </section>
        <aside className="w-[320px] border-l border-[var(--color-border)] p-4 space-y-4 overflow-y-auto scrollbar-thin">
          <InspectorPanel />
          <RenderPanel />
        </aside>
      </main>
      <div className="h-[220px] border-t border-[var(--color-border)] flex-shrink-0">
        <TimelineTrack />
      </div>

      <CommandPalette />
      <ShortcutsOverlay />
    </div>
  );
}

function useKeyboardShortcuts() {
  const { playerRef, status } = useStudio();
  const total = status.kind === "ready" ? status.data.timeline.durationInFrames : 0;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const player = playerRef.current;
      if (!player) return;
      const frame = player.getCurrentFrame();
      if (e.code === "Space") {
        e.preventDefault();
        if (player.isPlaying()) player.pause();
        else player.play();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        player.seekTo(Math.max(0, frame - step));
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        player.seekTo(Math.min(total - 1, frame + step));
      } else if (e.code === "Home") {
        e.preventDefault();
        player.seekTo(0);
      } else if (e.code === "End") {
        e.preventDefault();
        player.seekTo(Math.max(0, total - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playerRef, total]);
}
