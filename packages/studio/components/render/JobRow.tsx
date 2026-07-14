"use client";

import * as React from "react";
import {
  Loader2,
  Check,
  AlertTriangle,
  X,
  FolderOpen,
  Clock,
} from "lucide-react";
import { Button } from "../ui/button";
import { useStudio } from "@/lib/studio-context";
import { cn, formatDuration, shortenPath } from "@/lib/utils";
import { STUDIO_WIDTH, STUDIO_HEIGHT } from "@/lib/constants";
import type { RenderJob } from "@/lib/types";

export function JobRow({ job }: { job: RenderJob }) {
  const { cancelRender, openOutputFolder } = useStudio();

  return (
    <div
      className={cn(
        "rounded-md border bg-[var(--color-bg)] p-2.5 space-y-1.5",
        job.status === "failed"
          ? "border-red-500/30"
          : job.status === "done"
            ? "border-[var(--color-accent-muted)]"
            : job.status === "cancelled"
              ? "border-[var(--color-border)] opacity-60"
              : "border-[var(--color-border)]",
      )}
    >
      <div className="flex items-center gap-2 text-[11px]">
        <JobStatusIcon status={job.status} />
        <span className="text-[var(--color-fg)] font-medium">
          {labelForOptions(job.options)}
        </span>
        <span className="text-[var(--color-fg-dim)] text-[10px]">
          · {job.options.crf ?? 15} CRF
        </span>
        <div className="flex-1" />
        {job.status === "rendering" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => cancelRender(job.id)}
            title="Cancel render"
            className="h-5 w-5"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      {job.status === "rendering" && (
        <>
          <div className="h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent)] transition-[width] duration-200"
              style={{ width: `${Math.round(job.progress * 100)}%` }}
            />
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[var(--color-fg-dim)] tabular-nums">
            <span>{Math.round(job.progress * 100)}%</span>
            {job.progressDetail?.renderedFrames != null &&
              job.progressDetail?.totalFrames != null && (
                <span>
                  {job.progressDetail.renderedFrames}/
                  {job.progressDetail.totalFrames} frames
                </span>
              )}
            {job.progressDetail?.etaMs != null &&
              job.progressDetail.etaMs > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {formatDuration(job.progressDetail.etaMs)}
                </span>
              )}
            {job.progressDetail?.stage && (
              <span className="capitalize">{job.progressDetail.stage}</span>
            )}
          </div>
        </>
      )}

      {job.status === "done" && job.outputPath && (
        <button
          type="button"
          onClick={() => openOutputFolder(job.id)}
          className="group flex items-center gap-1.5 w-full text-left"
          title={`Reveal ${job.outputPath}`}
        >
          <FolderOpen className="w-3 h-3 text-[var(--color-accent)] shrink-0" />
          <span
            className={cn(
              "text-[10px] text-[var(--color-fg-dim)] truncate font-mono",
              "group-hover:text-[var(--color-fg-muted)] transition-colors",
            )}
          >
            {shortenPath(job.outputPath)}
          </span>
        </button>
      )}

      {job.status === "failed" && (
        <div className="text-[10px] text-red-400/90 leading-snug">
          {job.error}
        </div>
      )}

      {job.status === "cancelled" && (
        <div className="text-[10px] text-[var(--color-fg-dim)]">Cancelled</div>
      )}
    </div>
  );
}

function JobStatusIcon({ status }: { status: RenderJob["status"] }) {
  switch (status) {
    case "pending":
      return <Clock className="w-3 h-3 text-[var(--color-fg-dim)]" />;
    case "rendering":
      return <Loader2 className="w-3 h-3 text-[var(--color-accent)] animate-spin" />;
    case "done":
      return <Check className="w-3 h-3 text-[var(--color-accent)]" />;
    case "failed":
      return <AlertTriangle className="w-3 h-3 text-red-400" />;
    case "cancelled":
      return <X className="w-3 h-3 text-[var(--color-fg-dim)]" />;
  }
}

function labelForOptions(options: RenderJob["options"]): string {
  const scale = options.scale ?? 1;
  const w = STUDIO_WIDTH * scale;
  const h = STUDIO_HEIGHT * scale;
  return `${scale}× (${w}×${h})`;
}
