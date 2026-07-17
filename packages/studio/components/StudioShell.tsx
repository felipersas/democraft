"use client";

import * as React from "react";
import {
  Command,
  HelpCircle,
  Sparkles,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { PlayerPane } from "./PlayerPane";
import { Transport } from "./Transport";
import { TimelineTrack } from "./TimelineTrack";
import { InspectorRail } from "./InspectorRail";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { StalenessBadge } from "./StalenessBadge";
import { RecaptureButton } from "./RecaptureButton";
import { AuthenticationHeaderStatus } from "./AuthenticationHeaderStatus";
import { useStudio } from "@/lib/studio-context";
import { isTypingTarget } from "@/lib/dom";

export function StudioShell() {
  useKeyboardShortcuts();
  const { status } = useStudio();
  const [inspectorOpen, setInspectorOpen] = React.useState(false);

  return (
    <div className="studio-shell">
      <header className="studio-header">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-[var(--studio-fg)] text-[var(--studio-canvas)]">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.2} />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-[-0.015em]">
              Democraft
            </div>
            <div className="text-[10px] text-[var(--studio-fg-dim)]">
              Studio
            </div>
          </div>
        </div>
        <div className="h-5 w-px bg-[var(--studio-border)]" />
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-[var(--studio-fg)]">
            {status.kind === "ready"
              ? status.data.timeline.demoId
              : "Opening demo…"}
          </div>
          <div className="hidden text-[10px] text-[var(--studio-fg-dim)] md:block">
            demo.ts · local workspace
          </div>
        </div>
        {status.kind === "ready" && (
          <StalenessBadge staleness={status.data.staleness} />
        )}
        {status.kind === "ready" && <AuthenticationHeaderStatus />}
        {status.kind === "ready" && <RecaptureButton />}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setInspectorOpen(true)}
          className="studio-inspector-trigger"
          aria-label="Open inspector"
          aria-expanded={inspectorOpen}
        >
          <SlidersHorizontal />
        </button>
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new Event("studio:open-commands"))
          }
          className="hidden h-8 items-center gap-2 rounded-md px-2.5 text-xs text-[var(--studio-fg-muted)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-fg)] sm:flex"
          aria-label="Open command palette"
        >
          <Command className="h-3.5 w-3.5" />
          <span>Commands</span>
          <kbd className="rounded border border-[var(--studio-border-strong)] bg-[var(--studio-canvas)] px-1.5 py-0.5 text-[10px]">
            ⌘K
          </kbd>
        </button>
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new Event("studio:open-shortcuts"))
          }
          className="grid h-8 w-8 place-items-center rounded-md text-[var(--studio-fg-muted)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-fg)]"
          aria-label="Open keyboard shortcuts"
          title="Keyboard shortcuts (?)"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </header>

      {/* Editor-style layout: player + inspector on top, full-width
          timeline docked at the bottom. Mirrors the arrangement in video
          editors (Premiere, DaVinci, Remotion Studio) so the timeline can
          stretch horizontally for precise frame work. */}
      <main className="studio-workspace">
        <section className="studio-stage-column" aria-label="Preview workspace">
          <PlayerPane />
          <Transport />
        </section>
        {inspectorOpen && (
          <button
            type="button"
            className="studio-inspector-scrim"
            aria-label="Close inspector"
            onClick={() => setInspectorOpen(false)}
          />
        )}
        <aside
          className={`studio-inspector scrollbar-thin${inspectorOpen ? " is-open" : ""}`}
          aria-label="Inspector"
        >
          <div className="studio-inspector-mobile-header">
            <span>Inspector</span>
            <button
              type="button"
              onClick={() => setInspectorOpen(false)}
              aria-label="Close inspector"
            >
              <X />
            </button>
          </div>
          <InspectorRail />
        </aside>
      </main>
      <section className="studio-timeline" aria-label="Timeline">
        <TimelineTrack />
      </section>

      <CommandPalette />
      <ShortcutsOverlay />
    </div>
  );
}

function useKeyboardShortcuts() {
  const { playerRef, status } = useStudio();
  const total =
    status.kind === "ready" ? status.data.timeline.durationInFrames : 0;

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
