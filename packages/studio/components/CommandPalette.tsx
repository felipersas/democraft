"use client";

import * as React from "react";
import { Search, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { fuzzySearch } from "@/lib/fuzzy-search";
import { useStudioCommands } from "./command-palette/useStudioCommands";
import type { Command } from "./command-palette/types";

/**
 * Cmd+K command palette. Fuzzy-searches across the studio's actions and
 * executes the selected one. The set of commands is built from the current
 * studio state (play/pause flips, layer toggles, render, seek-to-scene, …).
 *
 * See docs/architecture/studio-roadmap.md "Command palette (Cmd+K)".
 */
export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  useOpenOnCmdK(setOpen);

  if (!open) return null;
  return <PaletteBody onClose={() => setOpen(false)} />;
}

/** Global Cmd+K / Ctrl+K toggle. */
function useOpenOnCmdK(setOpen: React.Dispatch<React.SetStateAction<boolean>>) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);

  const commands = useStudioCommands();

  const filtered = React.useMemo(
    () => fuzzySearch(commands, query),
    [commands, query],
  );

  // Reset the active selection when the query changes. This is the React-
  // recommended pattern for "adjust state when a value changes" — track the
  // previous value and call setState during render rather than in an effect.
  // Vercel rule: rerender-derived-state-no-effect.
  const prevQuery = React.useRef(query);
  if (prevQuery.current !== query) {
    prevQuery.current = query;
    setActiveIndex(0);
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[activeIndex];
      if (cmd) {
        cmd.run();
        onClose();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  // Group filtered results for display, preserving score order.
  const groups = React.useMemo(() => {
    const map = new Map<string, { cmd: Command; index: number }[]>();
    filtered.forEach((cmd, index) => {
      const list = map.get(cmd.group) ?? [];
      list.push({ cmd, index });
      map.set(cmd.group, list);
    });
    return [...map.entries()];
  }, [filtered]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-[min(560px,90vw)] rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 border-b border-[var(--color-border)]">
          <Search className="w-4 h-4 text-[var(--color-fg-dim)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command…"
            className={cn(
              "flex-1 bg-transparent py-3 text-sm text-[var(--color-fg)]",
              "focus:outline-none placeholder:text-[var(--color-fg-dim)]",
            )}
          />
          <kbd className="text-[10px] text-[var(--color-fg-dim)] border border-[var(--color-border)] rounded px-1 py-0.5">
            esc
          </kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto scrollbar-thin py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-[var(--color-fg-dim)]">
              No matching commands.
            </div>
          ) : (
            groups.map(([group, items]) => (
              <div key={group} className="py-1">
                <div className="px-3 py-1 text-[9px] uppercase tracking-wider text-[var(--color-fg-dim)]">
                  {group}
                </div>
                {items.map(({ cmd, index }) => (
                  <button
                    key={cmd.id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      cmd.run();
                      onClose();
                    }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors",
                      index === activeIndex
                        ? "bg-[var(--color-bg-hover)]"
                        : "bg-transparent",
                    )}
                  >
                    <span className="text-[var(--color-fg-muted)]">
                      {cmd.icon}
                    </span>
                    <span className="flex-1 text-[12px] text-[var(--color-fg)]">
                      {cmd.label}
                    </span>
                    {cmd.hint && (
                      <kbd className="text-[10px] text-[var(--color-fg-dim)] border border-[var(--color-border)] rounded px-1 py-0.5">
                        {cmd.hint}
                      </kbd>
                    )}
                    {index === activeIndex && (
                      <CornerDownLeft className="w-3 h-3 text-[var(--color-fg-dim)]" />
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
