"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isTypingTarget } from "@/lib/dom";

/**
 * `?` overlay listing every keyboard binding the studio responds to. Press
 * `?` (or Shift+/) to toggle. See docs/architecture/studio-roadmap.md "Keyboard shortcuts
 * overlay".
 *
 * The binding list is hand-maintained to mirror the handlers in StudioShell,
 * TimelineTrack, and CommandPalette. If you add a binding, add it here too.
 */
export function ShortcutsOverlay() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.key === "?") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("studio:open-shortcuts", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("studio:open-shortcuts", onOpen);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[min(640px,90vw)] max-h-[80vh] overflow-y-auto scrollbar-thin rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <div className="text-sm font-medium text-[var(--color-fg)]">
            Keyboard shortcuts
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[var(--color-fg-dim)] hover:text-[var(--color-fg-muted)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-dim)]">
                {group.title}
              </div>
              {group.items.map((item) => (
                <div
                  key={item.keys}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-[12px] text-[var(--color-fg-muted)]">
                    {item.action}
                  </span>
                  <kbd
                    className={cn(
                      "text-[10px] text-[var(--color-fg)] tabular-nums",
                      "border border-[var(--color-border)] rounded px-1.5 py-0.5 bg-[var(--color-bg)]",
                      "whitespace-nowrap",
                    )}
                  >
                    {item.keys}
                  </kbd>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type ShortcutItem = { action: string; keys: string };
type ShortcutGroup = { title: string; items: ShortcutItem[] };

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Playback",
    items: [
      { action: "Play / pause", keys: "Space" },
      { action: "Previous frame", keys: "←" },
      { action: "Next frame", keys: "→" },
      { action: "Jump 10 frames back", keys: "Shift + ←" },
      { action: "Jump 10 frames ahead", keys: "Shift + →" },
      { action: "Go to start", keys: "Home" },
      { action: "Go to end", keys: "End" },
    ],
  },
  {
    title: "Timeline",
    items: [
      { action: "Zoom in", keys: "+" },
      { action: "Zoom out", keys: "−" },
      { action: "Fit to width", keys: "0" },
      { action: "Zoom (scroll)", keys: "⌘ + scroll" },
    ],
  },
  {
    title: "Studio",
    items: [
      { action: "Command palette", keys: "⌘ K" },
      { action: "This shortcuts list", keys: "?" },
    ],
  },
  {
    title: "Layers",
    items: [
      { action: "Toggle layer visibility", keys: "click eye" },
      { action: "Solo a layer", keys: "Shift + click eye" },
    ],
  },
];
