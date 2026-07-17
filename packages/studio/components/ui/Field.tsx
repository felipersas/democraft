import * as React from "react";
import { cn } from "@/lib/utils";

export function Field(props: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", props.className)}>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[var(--color-fg-muted)]">{props.label}</span>
        {props.hint && (
          <span className="text-[var(--color-fg-dim)] tabular-nums">
            {props.hint}
          </span>
        )}
      </div>
      {props.children}
    </div>
  );
}
