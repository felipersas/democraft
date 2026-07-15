import React from "react";
import { Img, OffthreadVideo, interpolate, staticFile } from "remotion";
import type { BoundingBox, RenderStep } from "@democraft/schema";
import type { CameraState } from "./camera";
import { cameraTransform } from "./camera";

export type StageLayout = {
  scale: number;
  x: number;
  y: number;
};

/**
 * The viewport dimensions used during Playwright capture. The stage layout
 * maps the captured screenshot (at these CSS dimensions) into the render
 * frame. Defaults to 1920×1080 to match the Remotion composition; older
 * captures that used 1440×900 pass their own dimensions via the manifest's
 * `capture` field.
 *
 * `deviceScaleFactor` records the pixel density the screenshot was captured
 * at (Playwright `deviceScaleFactor`, default 2). The native PNG resolution is
 * `width × height × deviceScaleFactor`. The renderer renders the `<Img>` at
 * native resolution (with a compensating scale) so camera zoom amplifies a
 * full-resolution bitmap instead of an already-downscaled one — preventing
 * pixelation on focus shots. Defaults to 1 when absent (legacy captures).
 */
export type CaptureDimensions = {
  width: number;
  height: number;
  deviceScaleFactor?: number;
};

/** Default capture dimensions when the manifest doesn't specify any. */
const DEFAULT_CAPTURE: CaptureDimensions = { width: 1920, height: 1080 };

export function stageLayout(
  width: number,
  height: number,
  capture: CaptureDimensions = DEFAULT_CAPTURE,
): StageLayout {
  const scale = Math.min(width / capture.width, height / capture.height);
  return {
    scale,
    x: (width - capture.width * scale) / 2,
    y: (height - capture.height * scale) / 2,
  };
}

export function transformedBox(
  box: BoundingBox,
  camera: CameraState,
  stage: StageLayout,
): BoundingBox {
  const scale = stage.scale * camera.scale;
  return {
    x: stage.x + (box.x + camera.translateX) * scale,
    y: stage.y + (box.y + camera.translateY) * scale,
    width: box.width * scale,
    height: box.height * scale,
  };
}

export function imageStyle(
  opacity: number,
  capture: CaptureDimensions = DEFAULT_CAPTURE,
): React.CSSProperties {
  const dsf = capture.deviceScaleFactor ?? 1;
  // Render the <Img> at the screenshot's NATIVE resolution
  // (width × dsf), then scale it back down to CSS dimensions so it visually
  // fills the 1440×900 stage. The browser rasterizes the element at native
  // resolution (2880×1800 for dsf 2) on its own compositing layer; when the
  // parent's camera transform then zooms in (matrix scale up to ~1.3), it
  // samples from that high-resolution bitmap instead of an already-downscaled
  // 1440×900 one. This is what keeps focus shots sharp rather than pixelated.
  return {
    position: "absolute",
    top: 0,
    left: 0,
    width: capture.width * dsf,
    height: capture.height * dsf,
    // Host styles such as Tailwind's `img { max-width: 100% }` must not clamp
    // the native DPR-sized bitmap before the compensating transform runs.
    maxWidth: "none",
    maxHeight: "none",
    transform: `scale(${1 / dsf})`,
    transformOrigin: "0 0",
    objectFit: "contain",
    opacity,
  };
}

export function currentStep(
  steps: RenderStep[],
  frame: number,
): RenderStep | undefined {
  return [...steps].reverse().find((step) => frame >= step.fromFrame);
}

export function firstScreenshot(
  sources: Record<string, string>,
): string | undefined {
  return Object.values(sources)[0];
}

export function previousRenderStep(
  steps: RenderStep[],
  step?: RenderStep,
): RenderStep | undefined {
  const index = step
    ? steps.findIndex((item) => item.stepId === step.stepId)
    : -1;
  return index > 0 ? steps[index - 1] : undefined;
}

export function nextRenderStep(
  steps: RenderStep[],
  step?: RenderStep,
): RenderStep | undefined {
  const index = step
    ? steps.findIndex((item) => item.stepId === step.stepId)
    : -1;
  return index >= 0 && index < steps.length - 1 ? steps[index + 1] : undefined;
}

export function screenshotForStep(
  sources: Record<string, string>,
  step?: RenderStep,
): string | undefined {
  return step ? sources[step.stepId] : firstScreenshot(sources);
}

export function stageMediaState(
  steps: RenderStep[],
  sources: Record<string, string>,
  frame: number,
): {
  currentSrc?: string;
  currentOpacity: number;
  previousSrc?: string;
  previousOpacity: number;
} {
  const step = currentStep(steps, frame);
  if (!step) {
    return {
      currentSrc: firstScreenshot(sources),
      currentOpacity: 1,
      previousOpacity: 0,
    };
  }

  if (step.kind !== "timeline.transition" || step.durationInFrames <= 1) {
    return {
      currentSrc: screenshotForStep(sources, step),
      currentOpacity: 1,
      previousOpacity: 0,
    };
  }

  const progress = interpolate(
    frame,
    [step.fromFrame, step.fromFrame + step.durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return {
    currentSrc: screenshotForStep(sources, nextRenderStep(steps, step) ?? step),
    currentOpacity: progress,
    previousSrc: screenshotForStep(sources, previousRenderStep(steps, step)),
    previousOpacity: 1 - progress,
  };
}

export function Backdrop() {
  return React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background:
        "linear-gradient(135deg, #10131a 0%, #18202b 52%, #0d1118 100%)",
    },
  });
}

export function StageMedia({
  camera,
  capture = DEFAULT_CAPTURE,
  frame,
  recordingSrc,
  screenshotSrcByStepId,
  stage,
  steps,
}: {
  camera: CameraState;
  capture?: CaptureDimensions;
  frame: number;
  recordingSrc?: string;
  screenshotSrcByStepId: Record<string, string>;
  stage: StageLayout;
  steps: RenderStep[];
}) {
  const media = stageMediaState(steps, screenshotSrcByStepId, frame);

  return React.createElement(
    "div",
    {
      style: {
        position: "absolute",
        left: stage.x,
        top: stage.y,
        width: capture.width * stage.scale,
        height: capture.height * stage.scale,
        borderRadius: 18,
        boxShadow: "0 28px 90px rgba(0,0,0,.35)",
        overflow: "hidden",
      },
    },
    React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          width: capture.width,
          height: capture.height,
          transform: cameraTransform(camera, { ...stage, x: 0, y: 0 }),
          transformOrigin: "0 0",
        },
      },
      recordingSrc
        ? React.createElement(OffthreadVideo, {
            muted: true,
            src: staticFile(recordingSrc),
            style: imageStyle(1, capture),
          })
        : null,
      recordingSrc
        ? null
        : media.previousSrc && media.previousOpacity > 0
          ? React.createElement(Img, {
              src: media.previousSrc,
              style: imageStyle(media.previousOpacity, capture),
            })
          : null,
      !recordingSrc && media.currentSrc
        ? React.createElement(Img, {
            src: media.currentSrc,
            style: imageStyle(media.currentOpacity, capture),
          })
        : null,
    ),
  );
}
