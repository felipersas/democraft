"use client";

import * as React from "react";
import { MessageSquareText, RotateCcw } from "lucide-react";
import type { OverlayTrack } from "@democraft/schema";
import { useStudio } from "@/lib/studio-context";
import { cn, truncate } from "@/lib/utils";
import { usePlayerFrame } from "@/lib/hooks/use-player-frame";
import { InspectorSection } from "./ui/InspectorSection";
import { Button } from "./ui/button";

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
    player,
    captionOverrides,
    setCaptionText,
    resetCaption,
    resetCaptions,
    applyCaptionsToRender,
    setApplyCaptionsToRender,
  } = useStudio();

  const timeline =
    status.kind === "ready" ? status.data.timeline : undefined;

  const frame = usePlayerFrame(player);

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
    <InspectorSection
      icon={<MessageSquareText className="h-4 w-4" />}
      title="Captions"
      description="Edit presentation copy at the playhead. demo.ts remains unchanged."
      action={editedCount > 0 ? <Button variant="ghost" size="sm" onClick={resetCaptions}><RotateCcw className="h-3.5 w-3.5" />Reset all</Button> : undefined}
    >

      {shown.length === 0 ? (
        <div className="studio-empty">
          <span className="font-medium text-[var(--studio-fg)]">No editable captions</span>
          Add a caption overlay in demo.ts, then re-capture to edit its presentation copy here.
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((o) => {
            const edited = captionOverrides[o.id] != null;
            const value = captionOverrides[o.id] ?? o.text;
            return (
              <div key={o.id} className="space-y-2 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-1)] p-3">
                <div className="flex items-center gap-1.5">
                  <span className="truncate flex-1 text-[11px] font-medium text-[var(--studio-fg-muted)]">
                    Caption · {truncate(o.text, 32)}
                  </span>
                  {edited && (
                    <button
                      type="button"
                      onClick={() => resetCaption(o.id)}
                      title="Reset this caption"
                      className="grid h-7 w-7 place-items-center rounded-md text-[var(--studio-fg-dim)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-fg)]"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                    </button>
                  )}
                  {edited && (
                    <span className="rounded-full bg-[var(--studio-accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--studio-accent-hover)]">
                      Edited
                    </span>
                  )}
                </div>
                <textarea
                  value={value}
                  onChange={(e) => setCaptionText(o.id, e.target.value)}
                  rows={2}
                  className={cn(
                    "w-full min-h-20 max-h-44 resize-y px-2.5 py-2 text-xs leading-relaxed",
                  )}
                  placeholder="Caption text…"
                />
              </div>
            );
          })}
        </div>
      )}

      <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-md bg-[var(--studio-accent-soft)] p-3 select-none">
        <input
          type="checkbox"
          checked={applyCaptionsToRender}
          onChange={(e) => setApplyCaptionsToRender(e.target.checked)}
          className="mt-0.5"
        />
        <span className="text-[11px] font-medium text-[var(--studio-fg)] leading-snug">
          Apply edits to next render
          <span className="mt-1 block font-normal text-[var(--studio-fg-muted)]">
            Studio override only. This never writes to <code>demo.ts</code>.
          </span>
        </span>
      </label>
    </InspectorSection>
  );
}
