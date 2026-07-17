import * as React from "react";

export function InspectorSection(props: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="studio-section" aria-label={props.title}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="studio-section-title">
            <span className="text-[var(--studio-fg-muted)]" aria-hidden>{props.icon}</span>
            {props.title}
          </h2>
          {props.description && <p className="studio-section-description">{props.description}</p>}
        </div>
        {props.action}
      </div>
      <div className="mt-4">{props.children}</div>
    </section>
  );
}
