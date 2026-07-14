import * as React from "react";

export function Field(props: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
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
