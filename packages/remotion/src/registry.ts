import {
  defaultVisualRegistry,
  type CalloutProps,
  type CaptionProps,
  type VisualComponent,
  type VisualRegistry,
} from "./overlays";
import type React from "react";

type VisualDefinition<TProps> = {
  readonly component: unknown;
  readonly __visualProps?: (props: TProps) => TProps;
};

/**
 * A single visual registration — maps a renderer ID to a React component.
 *
 * Used with {@link defineVisualRegistry} to build a custom registry that
 * extends (or replaces) the built-in defaults.
 *
 * @example
 * ```ts
 * { kind: "caption", id: "local.my-caption", component: MyCaption }
 * { kind: "callout", id: "remocn.pulse-callout", component: PulseCallout }
 * ```
 */
export type VisualEntry =
  | {
      kind: "caption";
      id: string;
      component: VisualComponent<CaptionProps>;
    }
  | {
      kind: "callout";
      id: string;
      component: VisualComponent<CalloutProps>;
    }
  | {
      kind: "visual";
      id: string;
      component: React.ComponentType<never>;
    };

/** Declare any React/Remotion component while preserving its exact props. */
export function defineVisual<TProps>(
  component: React.ComponentType<TProps>,
): VisualDefinition<TProps> {
  return { component };
}

/**
 * Build a custom visual registry by extending the built-in defaults.
 *
 * Pass any number of {@link VisualEntry} objects. Each entry adds (or
 * overrides) a renderer ID in the registry. The result is a complete
 * `VisualRegistry` you can pass to `<ProductDemoVideo registry={...} />` from
 * a user-authored entry point.
 *
 * IDs follow the `<namespace>.<component>` convention:
 * - `motion.*` — framework defaults (override with caution).
 * - `remocn.*` — remocn (Remotion + shadcn) components.
 * - `local.*` — your own project components.
 *
 * @example
 * ```ts
 * import { defineVisualRegistry } from "@democraft/remotion";
 * import { MyCaption } from "./my-caption";
 *
 * const registry = defineVisualRegistry(
 *   { kind: "caption", id: "local.my-caption", component: MyCaption },
 * );
 * ```
 *
 * The returned registry includes all built-in renderers (`motion.*`,
 * `remocn.*`) plus your additions. Entries with the same ID as a built-in
 * renderer override the default.
 */
export function defineVisualRegistry(
  ...entries: VisualEntry[]
): VisualRegistry {
  const registry: VisualRegistry = {
    captions: { ...defaultVisualRegistry.captions },
    callouts: { ...defaultVisualRegistry.callouts },
    visuals: { ...defaultVisualRegistry.visuals },
  };
  for (const entry of entries) {
    if (entry.kind === "caption") {
      registry.captions[entry.id] = entry.component;
    } else if (entry.kind === "callout") {
      registry.callouts[entry.id] = entry.component;
    } else {
      registry.visuals[entry.id] =
        entry.component as React.ComponentType<Record<string, unknown>>;
    }
  }
  return registry;
}

// Re-export types that registry consumers need.
export type { CaptionProps, CalloutProps, VisualComponent, VisualRegistry };
