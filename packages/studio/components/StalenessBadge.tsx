"use client";

import { CheckCircle2, AlertTriangle, RefreshCw, XCircle } from "lucide-react";
import type { Staleness } from "@democraft/schema";
import { cn } from "@/lib/utils";

/**
 * Colored badge showing whether the current capture is fresh, stale, or
 * failed. Surfaced in the studio header so the user knows when to re-capture.
 * See docs/architecture/studio-roadmap.md "Workflow / DX" (staleness signal).
 */
export function StalenessBadge({ staleness }: { staleness?: Staleness }) {
  if (!staleness) return null;

  const config = {
    fresh: {
      icon: <CheckCircle2 className="w-3 h-3" />,
      label: "Capture fresh",
      className: "text-[var(--color-accent)]",
    },
    content: {
      icon: <AlertTriangle className="w-3 h-3" />,
      label: "demo.ts edited",
      className: "text-amber-400",
    },
    structural: {
      icon: <RefreshCw className="w-3 h-3" />,
      label: "Re-capture needed",
      className: "text-orange-400",
    },
    failed: {
      icon: <XCircle className="w-3 h-3" />,
      label: "Capture failed",
      className: "text-red-400",
    },
  }[staleness.kind];

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded",
        "border border-current/20 bg-current/5",
        config.className,
      )}
      title={staleness.detail ?? config.label}
    >
      {config.icon}
      <span className="hidden sm:inline">{config.label}</span>
    </div>
  );
}
