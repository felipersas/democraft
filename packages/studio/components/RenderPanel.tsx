"use client";

import * as React from "react";
import { Film, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { useStudio } from "@/lib/studio-context";
import { JobRow } from "./render/JobRow";
import { PresetField } from "./render/PresetField";
import { ScaleField, QualityField } from "./render/SettingsFields";

export function RenderPanel() {
  const {
    status,
    renderJobs,
    renderError,
    enqueueRender,
    clearFinishedRenders,
    captionOverrides,
    applyCaptionsToRender,
    renderRange,
    applyRenderRange,
    setApplyRenderRange,
  } = useStudio();
  const [scale, setScale] = React.useState(1);
  const [crf, setCrf] = React.useState(15);
  const ready = status.kind === "ready";
  const hasCaptionEdits = Object.keys(captionOverrides).length > 0;

  const handleEnqueue = () => {
    void enqueueRender({
      scale,
      crf,
      captionOverrides: applyCaptionsToRender ? captionOverrides : undefined,
    });
  };

  const hasFinished = renderJobs.some(
    (j) =>
      j.status === "done" || j.status === "failed" || j.status === "cancelled",
  );

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-panel)] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-[var(--color-accent)]" />
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-fg-muted)]">
            Render
          </div>
        </div>
        {renderJobs.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[var(--color-fg-dim)] tabular-nums">
              {renderJobs.length} job{renderJobs.length === 1 ? "" : "s"}
            </span>
            {hasFinished && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearFinishedRenders}
                title="Clear finished jobs"
                className="h-6 w-6"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <PresetField
          currentScale={scale}
          currentCrf={crf}
          onApply={(p) => {
            setScale(p.scale);
            setCrf(p.crf);
          }}
        />
        <ScaleField value={scale} onChange={setScale} disabled={!ready} />
        <QualityField value={crf} onChange={setCrf} disabled={!ready} />
      </div>

      <Button
        variant="primary"
        size="md"
        className="w-full"
        onClick={handleEnqueue}
        disabled={!ready}
      >
        <Film className="w-4 h-4" />
        Add to queue
      </Button>

      {renderError && (
        <div role="alert" className="text-[10px] text-red-400/90 leading-snug">
          {renderError}
        </div>
      )}

      {hasCaptionEdits && !applyCaptionsToRender && (
        <div className="text-[10px] text-[var(--color-fg-dim)] leading-snug">
          Caption edits won&apos;t apply to renders unless you enable it in the
          Inspector.
        </div>
      )}

      {renderRange !== null && (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={applyRenderRange}
            onChange={(e) => setApplyRenderRange(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          <span className="text-[10px] text-[var(--color-fg-muted)]">
            Render range{" "}
            <span className="text-[var(--color-fg-dim)] tabular-nums">
              ({renderRange[0]}–{renderRange[1]})
            </span>
          </span>
        </label>
      )}

      {renderJobs.length > 0 ? (
        <div className="space-y-1.5">
          {renderJobs
            .slice()
            .reverse()
            .map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
        </div>
      ) : (
        <div className="text-[10px] text-[var(--color-fg-dim)] text-center py-1">
          No renders queued. Click{" "}
          <span className="text-[var(--color-fg-muted)]">Add to queue</span> to
          start.
        </div>
      )}
    </div>
  );
}
