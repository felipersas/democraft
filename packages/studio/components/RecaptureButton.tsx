"use client";

import * as React from "react";
import { RefreshCw, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

type RecapturePhase =
  | { kind: "idle" }
  | { kind: "running"; phase: string }
  | { kind: "done" }
  | { kind: "failed"; error: string };

const PHASE_LABELS: Record<string, string> = {
  compiling: "Compiling…",
  capturing: "Capturing (Playwright)…",
  resolving: "Resolving timeline…",
  materializing: "Materializing…",
};

/**
 * Header button that triggers a fresh Playwright capture from within the
 * studio. Subscribes to `recapture-progress` SSE events to show live status.
 * On success the file-watcher auto-reloads the studio. See
 * docs/architecture/studio-roadmap.md "Workflow / DX" (Re-capture within the studio).
 */
export function RecaptureButton() {
  const [state, setState] = React.useState<RecapturePhase>({ kind: "idle" });

  React.useEffect(() => {
    const es = new EventSource("/api/events");
    const onProgress = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as {
          phase: string;
          error?: string;
        };
        if (data.phase === "done") {
          setState({ kind: "done" });
          setTimeout(() => setState({ kind: "idle" }), 2000);
        } else if (data.phase === "failed") {
          setState({ kind: "failed", error: data.error ?? "Failed" });
          setTimeout(() => setState({ kind: "idle" }), 4000);
        } else {
          setState({ kind: "running", phase: data.phase });
        }
      } catch {
        /* ignore malformed */
      }
    };
    es.addEventListener("recapture-progress", onProgress);
    return () => {
      es.removeEventListener("recapture-progress", onProgress);
      es.close();
    };
  }, []);

  const handleClick = async () => {
    if (state.kind === "running") return;
    if (
      !window.confirm(
        "Re-capture will run Playwright against the target app.\n" +
          "Make sure the app is running. Continue?",
      )
    )
      return;
    setState({ kind: "running", phase: "starting" });
    try {
      await fetch("/api/recapture", { method: "POST" });
    } catch (err) {
      setState({
        kind: "failed",
        error: err instanceof Error ? err.message : "Request failed",
      });
    }
  };

  const running = state.kind === "running";
  const label =
    state.kind === "running"
      ? PHASE_LABELS[state.phase] ?? "Working…"
      : state.kind === "done"
        ? "Done"
        : state.kind === "failed"
          ? "Failed"
          : "Re-capture";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={running}
      title={
        state.kind === "failed" ? state.error : "Re-run Playwright capture"
      }
      className={cn(
        "flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors",
        "border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]",
        state.kind === "failed" && "text-red-400 border-red-500/30",
        state.kind === "done" && "text-[var(--color-accent)]",
        state.kind === "idle" && "text-[var(--color-fg-muted)]",
        running && "text-[var(--color-fg-muted)] cursor-wait",
      )}
    >
      {running ? (
        <RefreshCw className="w-3 h-3 animate-spin" />
      ) : (
        <Camera className="w-3 h-3" />
      )}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
