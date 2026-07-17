"use client";

import * as React from "react";
import { Captions, Music2, Clapperboard } from "lucide-react";
import { useStudio } from "@/lib/studio-context";
import { cn } from "@/lib/utils";
import { InspectorPanel } from "./InspectorPanel";
import { AudioPanel } from "./AudioPanel";
import { RenderPanel } from "./RenderPanel";

type InspectorTab = "captions" | "audio" | "render";

export function InspectorRail() {
  const [tab, setTab] = React.useState<InspectorTab>("captions");
  const { status, captionOverrides, audioTracks, hasAudioOverrides, renderJobs } = useStudio();
  const captionCount = status.kind === "ready"
    ? status.data.timeline.overlays.filter((overlay) => overlay.kind === "caption").length
    : 0;

  const tabs = [
    { id: "captions" as const, label: "Captions", icon: Captions, count: captionCount, changed: Object.keys(captionOverrides).length > 0 },
    { id: "audio" as const, label: "Audio", icon: Music2, count: audioTracks?.length ?? 0, changed: hasAudioOverrides },
    { id: "render" as const, label: "Render", icon: Clapperboard, count: renderJobs.length, changed: renderJobs.some((job) => job.status === "pending" || job.status === "rendering") },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-20 border-b border-[var(--studio-border)] bg-[var(--studio-surface-2)] p-2">
        <div className="grid grid-cols-3 gap-1" role="tablist" aria-label="Inspector tools">
          {tabs.map((item) => {
            const Icon = item.icon;
            const selected = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`inspector-${item.id}`}
                onClick={() => setTab(item.id)}
                className={cn(
                  "relative flex h-10 items-center justify-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-colors",
                  selected ? "bg-[var(--studio-active)] text-[var(--studio-fg)]" : "text-[var(--studio-fg-dim)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-fg-muted)]",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
                {item.count > 0 && <span className="studio-mono text-[9px] text-[var(--studio-fg-dim)]">{item.count}</span>}
                {item.changed && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--studio-accent)]" aria-label="Has active changes" />}
              </button>
            );
          })}
        </div>
      </div>

      <div id={`inspector-${tab}`} role="tabpanel" className="min-h-0 flex-1">
        {tab === "captions" && <InspectorPanel />}
        {tab === "audio" && <AudioPanel />}
        {tab === "render" && <RenderPanel />}
      </div>
    </div>
  );
}
