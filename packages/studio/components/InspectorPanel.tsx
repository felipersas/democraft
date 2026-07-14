"use client";

import * as React from "react";
import { MessageSquare, RotateCcw } from "lucide-react";
import type { OverlayTrack } from "@democraft/schema";
import { useStudio } from "@/lib/studio-context";
import { cn, truncate } from "@/lib/utils";
import { usePlayerFrame } from "@/lib/hooks/use-player-frame";

/**
 * Inspector for caption text. Lists captions active at the current playhead
 * (or all captions when none are active), each with an editable text field.
 * Edits are ephemeral: they override the preview instantly and, when
 * "Apply to render" is checked, are forwarded to the render queue (hybrid
 * seam — see docs/architecture/studio-roadmap.md "Props inspector").
 */
export function InspectorPanel() {
  const {
    status,
    playerRef,
    captionOverrides,
    setCaptionText,
    resetCaption,
    resetCaptions,
    applyCaptionsToRender,
    setApplyCaptionsToRender,
  } = useStudio();

  const timeline =
    status.kind === "ready" ? status.data.timeline : undefined;

  const frame = usePlayerFrame(playerRef, status);

  // Memoize the caption extraction + filtering so it doesn't re-run on every
  // state tick. These previously ran as three separate .filter() passes on
  // every render (including every frameupdate). Vercel rule:
  // rerender-derived-state-no-effect.
  const { shown, editedCount } = React.useMemo(() => {
    if (!timeline) return { shown: [], editedCount: 0 };
    const captionOverlays = timeline.overlays.filter(
      (o): o is Extract<OverlayTrack, { kind: "caption" }> =>
        o.kind === "caption",
    );
    // Show captions active at the playhead; if none, show all so the user can
    // still edit copy that isn't currently on screen.
    const active = captionOverlays.filter(
      (o) => frame >= o.fromFrame && frame < o.fromFrame + o.durationInFrames,
    );
    return {
      shown: active.length > 0 ? active : captionOverlays,
      editedCount: captionOverlays.filter(
        (o) => captionOverrides[o.id] != null,
      ).length,
    };
  }, [timeline, frame, captionOverrides]);

  if (!timeline) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-panel)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[var(--color-accent)]" />
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-fg-muted)]">
            Inspector
          </div>
        </div>
        {editedCount > 0 && (
          <button
            type="button"
            onClick={resetCaptions}
            className="flex items-center gap-1 text-[10px] text-[var(--color-fg-dim)] hover:text-[var(--color-fg-muted)] transition-colors"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            Reset all
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="text-[10px] text-[var(--color-fg-dim)] py-1">
          No captions in this demo.
        </div>
      ) : (
        <div className="space-y-2.5">
          {shown.map((o) => {
            const edited = captionOverrides[o.id] != null;
            const value = captionOverrides[o.id] ?? o.text;
            return (
              <div key={o.id} className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[var(--color-fg-muted)] truncate flex-1">
                    {truncate(o.text, 32)}
                  </span>
                  {edited && (
                    <button
                      type="button"
                      onClick={() => resetCaption(o.id)}
                      title="Reset this caption"
                      className="text-[var(--color-fg-dim)] hover:text-[var(--color-fg-muted)] transition-colors"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                    </button>
                  )}
                  {edited && (
                    <span className="text-[9px] uppercase tracking-wider text-[var(--color-accent)]">
                      edited
                    </span>
                  )}
                </div>
                <textarea
                  value={value}
                  onChange={(e) => setCaptionText(o.id, e.target.value)}
                  rows={2}
                  className={cn(
                    "w-full resize-y rounded-md bg-[var(--color-bg)] border border-[var(--color-border)]",
                    "px-2 py-1.5 text-[11px] text-[var(--color-fg)]",
                    "focus:outline-none focus:border-[var(--color-accent-muted)]",
                    "placeholder:text-[var(--color-fg-dim)]",
                  )}
                  placeholder="Caption text…"
                />
              </div>
            );
          })}
        </div>
      )}

      <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={applyCaptionsToRender}
          onChange={(e) => setApplyCaptionsToRender(e.target.checked)}
          className="mt-0.5 accent-[var(--color-accent)]"
        />
        <span className="text-[10px] text-[var(--color-fg-muted)] leading-snug">
          Apply caption edits to render
          <span className="block text-[var(--color-fg-dim)]">
            Edits are ephemeral — they won&apos;t change <code>demo.ts</code>.
          </span>
        </span>
      </label>
    </div>
  );
}


