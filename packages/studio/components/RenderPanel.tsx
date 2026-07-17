"use client";

import * as React from "react";
import { Film, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { useStudio } from "@/lib/studio-context";
import { JobRow } from "./render/JobRow";
import { PresetField } from "./render/PresetField";
import { ScaleField, QualityField } from "./render/SettingsFields";
import { InspectorSection } from "./ui/InspectorSection";

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
    <InspectorSection
      icon={<Film className="h-4 w-4" />}
      title="Render"
      description="Create a reproducible output from the resolved timeline and selected Studio overrides."
      action={renderJobs.length > 0 ? (
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
        ) : undefined}
    >

      <div className="space-y-3">
        <PresetField
          currentScale={scale}
          currentCrf={crf}
          onApply={(p) => {
            setScale(p.scale);
            setCrf(p.crf);
          }}
        />
        <details className="rounded-md border border-[var(--studio-border)] bg-[var(--studio-surface-1)]">
          <summary className="flex h-9 cursor-pointer items-center px-2.5 text-[11px] font-medium text-[var(--studio-fg-muted)]">Advanced output settings</summary>
          <div className="space-y-3 border-t border-[var(--studio-border)] p-3">
            <ScaleField value={scale} onChange={setScale} disabled={!ready} />
            <QualityField value={crf} onChange={setCrf} disabled={!ready} />
          </div>
        </details>
      </div>

      <Button
        variant="primary"
        size="md"
        className="w-full"
        onClick={handleEnqueue}
        disabled={!ready}
      >
        <Film className="w-4 h-4" />
        Render video
      </Button>

      {renderError && (
        <div role="alert" className="mt-3 rounded-md border border-[var(--studio-error)]/40 bg-[var(--studio-error)]/10 p-2.5 text-[11px] text-[var(--studio-error)] leading-snug">
          {renderError}
        </div>
      )}

      {hasCaptionEdits && !applyCaptionsToRender && (
        <div className="mt-3 text-[11px] text-[var(--studio-warning)] leading-snug">
          Caption edits won&apos;t apply to renders unless you enable it in the
          Inspector.
        </div>
      )}

      {renderRange !== null && (
        <label className="mt-3 flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={applyRenderRange}
            onChange={(e) => setApplyRenderRange(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          <span className="text-[11px] text-[var(--studio-fg-muted)]">
            Render range{" "}
            <span className="text-[var(--color-fg-dim)] tabular-nums">
              ({renderRange[0]}–{renderRange[1]})
            </span>
          </span>
        </label>
      )}

      {renderJobs.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-[var(--studio-border)] pt-4">
          {renderJobs
            .slice()
            .reverse()
            .map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
        </div>
      ) : (
        <div className="studio-empty mt-4">
          <span className="font-medium text-[var(--studio-fg)]">Render queue is empty</span>
          Active and completed renders will appear here with their output status.
        </div>
      )}
    </InspectorSection>
  );
}
