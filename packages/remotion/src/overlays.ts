import React from "react";
import { interpolate, Sequence } from "remotion";
import type { BoundingBox, OverlayTrack, RenderTimeline } from "@democraft/schema";
import { SoftBlurIn } from "./components/remocn/soft-blur-in";
import { active } from "./utils";
import { transformedBox } from "./stage";
import type { CameraState } from "./camera";
import type { StageLayout } from "./stage";

export type VisualComponent<T> = React.FC<T>;
export type GenericVisualComponent = React.ComponentType<Record<string, unknown>>;

export type CaptionProps = {
  overlay: Extract<OverlayTrack, { kind: "caption" }>;
  opacity: number;
};

export type CalloutProps = {
  overlay: Extract<OverlayTrack, { kind: "callout" }>;
  opacity: number;
  box: BoundingBox;
};

export type CalloutTheme = "dark" | "light";

export type ModernCalloutProps = CalloutProps & {
  accentColor?: string;
  theme?: CalloutTheme;
};

export type VisualRegistry = {
  captions: Record<string, VisualComponent<CaptionProps>>;
  callouts: Record<string, VisualComponent<CalloutProps>>;
  visuals: Record<string, GenericVisualComponent>;
};

export function overlayOpacity(
  overlay: { fromFrame: number; durationInFrames: number },
  frame: number,
): number {
  return interpolate(
    frame,
    [
      overlay.fromFrame,
      overlay.fromFrame + 12,
      overlay.fromFrame + overlay.durationInFrames - 12,
      overlay.fromFrame + overlay.durationInFrames,
    ],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
}

export function calloutStyle(
  box: BoundingBox,
  opacity: number,
  backgroundColor: string,
): React.CSSProperties {
  return {
    position: "absolute",
    left: Math.min(box.x + box.width + 24, 1920 - 460),
    top: Math.max(42, box.y),
    width: 380,
    padding: 22,
    borderRadius: 14,
    backgroundColor,
    color: "white",
    boxShadow: "0 24px 70px rgba(0,0,0,.32)",
    opacity,
  };
}

export function OverlayLayer({
  camera,
  frame,
  registry,
  stage,
  timeline,
}: {
  camera: CameraState;
  frame: number;
  registry: VisualRegistry;
  stage: StageLayout;
  timeline: RenderTimeline;
}) {
  return React.createElement(
    React.Fragment,
    null,
    ...timeline.overlays
      .filter((overlay) => active(overlay, frame))
      .map((overlay) => {
        if (overlay.kind === "caption") {
          const opacity = overlayOpacity(overlay, frame);
          const Component = resolveCaptionComponent(
            registry,
            overlay.renderer,
          );
          return React.createElement(Component, {
            key: overlay.id,
            opacity,
            overlay,
          });
        }

        if (overlay.kind === "visual") {
          const Component = resolveVisualComponent(registry, overlay.visual);
          return React.createElement(
            Sequence,
            {
              key: overlay.id,
              from: overlay.fromFrame,
              durationInFrames: overlay.durationInFrames,
              name: overlay.visual,
            },
            React.createElement(Component, overlay.props),
          );
        }

        const opacity = overlayOpacity(overlay, frame);
        const rawBox = overlay.boundingBox ?? {
          x: 40,
          y: 40,
          width: 0,
          height: 0,
        };
        const box = transformedBox(rawBox, camera, stage);
        const Component = resolveCalloutComponent(registry, overlay.renderer);
        return React.createElement(Component, {
          box,
          key: overlay.id,
          opacity,
          overlay,
        });
      }),
  );
}

export function resolveCaptionComponent(
  registry: VisualRegistry,
  renderer?: string,
): VisualComponent<CaptionProps> {
  if (!renderer) return registry.captions["motion.caption"] ?? Caption;
  const component = registry.captions[renderer];
  if (component) return component;
  throw unknownRenderer("caption", renderer, Object.keys(registry.captions));
}

export function resolveCalloutComponent(
  registry: VisualRegistry,
  renderer?: string,
): VisualComponent<CalloutProps> {
  if (!renderer) return registry.callouts["motion.callout"] ?? Callout;
  const component = registry.callouts[renderer];
  if (component) return component;
  throw unknownRenderer("callout", renderer, Object.keys(registry.callouts));
}

export function resolveVisualComponent(
  registry: VisualRegistry,
  visual: string,
): GenericVisualComponent {
  const component = registry.visuals[visual];
  if (component) return component;
  throw unknownRenderer("visual", visual, Object.keys(registry.visuals));
}

function unknownRenderer(
  kind: "caption" | "callout" | "visual",
  renderer: string,
  registered: string[],
): Error {
  return new Error(
    `Unknown ${kind} renderer "${renderer}". Registered renderers: ${registered.sort().join(", ") || "none"}.`,
  );
}

export function Caption({ opacity, overlay }: CaptionProps) {
  return React.createElement(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        bottom: 150,
        transform: "translateX(-50%)",
        maxWidth: 980,
        padding: "18px 26px",
        borderRadius: 14,
        backgroundColor: "rgba(10,14,20,.84)",
        color: "white",
        font: "500 34px Inter, system-ui, sans-serif",
        opacity,
      },
    },
    overlay.text,
  );
}

export function KineticCaption({ opacity, overlay }: CaptionProps) {
  return React.createElement(
    "div",
    {
      style: {
        position: "absolute",
        left: "50%",
        bottom: 170,
        transform: `translateX(-50%) scale(${0.96 + opacity * 0.04})`,
        width: 980,
        maxWidth: 980,
        height: 76,
        padding: "16px 24px",
        borderRadius: 16,
        backgroundColor: "rgba(10,14,20,.72)",
        color: "white",
        font: "800 38px Inter, system-ui, sans-serif",
        letterSpacing: 0,
        opacity,
        textShadow: "0 18px 50px rgba(0,0,0,.42)",
      },
    },
    React.createElement(SoftBlurIn, {
      blur: 10,
      color: "white",
      fontSize: 38,
      fontWeight: 800,
      speed: 1.2,
      text: overlay.text,
    }),
  );
}

export function Callout({ box, opacity, overlay }: CalloutProps) {
  return React.createElement(
    "div",
    {
      style: calloutStyle(box, opacity, "rgba(10,14,20,.88)"),
    },
    React.createElement(
      "strong",
      { style: { display: "block", color: "#79e3c7", fontSize: 26 } },
      overlay.title,
    ),
    overlay.description
      ? React.createElement(
          "p",
          { style: { margin: "10px 0 0", fontSize: 21, lineHeight: 1.45 } },
          overlay.description,
        )
      : null,
  );
}

export function ModernCallout({
  accentColor = "#68df62",
  box,
  opacity,
  overlay,
  theme = "dark",
}: ModernCalloutProps): React.ReactElement {
  const dark = theme === "dark";

  return React.createElement(
    "div",
    {
      style: {
        ...calloutStyle(
          box,
          opacity,
          dark ? "rgba(14, 16, 18, 0.92)" : "rgba(250, 250, 249, 0.94)",
        ),
        padding: "20px 22px 21px",
        overflow: "hidden",
        color: dark ? "#f5f5f4" : "#18181b",
        border: `1px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(24,24,27,.14)"}`,
        borderRadius: 12,
        boxShadow: dark
          ? "0 24px 64px rgba(0,0,0,.42), inset 0 1px rgba(255,255,255,.04)"
          : "0 24px 64px rgba(15,23,42,.18), inset 0 1px rgba(255,255,255,.7)",
        backdropFilter: "blur(18px)",
        filter: `blur(${(1 - opacity) * 6}px)`,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        transform: `translateY(${(1 - opacity) * 14}px) scale(${0.985 + opacity * 0.015})`,
        transformOrigin: "top left",
      },
    },
    React.createElement("div", {
      style: {
        position: "absolute",
        top: 0,
        left: 22,
        width: 42,
        height: 2,
        backgroundColor: accentColor,
      },
    }),
    React.createElement(
      "strong",
      {
        style: {
          display: "block",
          fontSize: 25,
          fontWeight: 650,
          letterSpacing: "-0.025em",
          lineHeight: 1.2,
        },
      },
      overlay.title,
    ),
    overlay.description
      ? React.createElement(
          "p",
          {
            style: {
              margin: "9px 0 0",
              color: dark ? "rgba(245,245,244,.72)" : "rgba(24,24,27,.68)",
              fontSize: 19,
              lineHeight: 1.46,
            },
          },
          overlay.description,
        )
      : null,
  );
}

export function DarkCallout(props: CalloutProps): React.ReactElement {
  return React.createElement(ModernCallout, { ...props, theme: "dark" });
}

export function LightCallout(props: CalloutProps): React.ReactElement {
  return React.createElement(ModernCallout, {
    ...props,
    accentColor: "#6558d3",
    theme: "light",
  });
}

/** @deprecated Use ModernCallout or a themed renderer ID. */
export const GlassCallout = LightCallout;

/**
 * The built-in visual registry. Maps renderer IDs (the strings authors pass as
 * `renderer` on caption/callout steps) to React components.
 *
 * Convention: `<namespace>.<component>`
 *   - `motion.*` — the framework's default styling (used when `renderer` is
 *     omitted).
 *   - `remocn.*` — components backed by remocn (Remotion + shadcn) building
 *     blocks.
 *
 * A user-authored entry point can extend or replace this via
 * `defineVisualRegistry()`.
 */
export const defaultVisualRegistry: VisualRegistry = {
  captions: {
    "motion.caption": Caption,
    "remocn.kinetic-title": KineticCaption,
  },
  callouts: {
    "motion.callout": Callout,
    "remocn.glass-callout": GlassCallout,
    "remocn.callout-dark": DarkCallout,
    "remocn.callout-light": LightCallout,
  },
  visuals: {},
};
