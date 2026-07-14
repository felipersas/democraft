import React from "react";
import { interpolate } from "remotion";
import type { CursorTrack, RenderTimeline } from "@democraft/schema";
import { cameraTransform } from "./camera";
import type { CameraState } from "./camera";
import type { StageLayout } from "./stage";

export const CLICK_PULSE_FRAMES = 28;

export function TargetAndCursorLayer({
  camera,
  frame,
  stage,
  timeline,
}: {
  camera: CameraState;
  frame: number;
  stage: StageLayout;
  timeline: RenderTimeline;
}) {
  return React.createElement(
    "div",
    {
      style: {
        position: "absolute",
        width: 1440,
        height: 900,
        transform: cameraTransform(camera, stage),
        transformOrigin: "0 0",
      },
    },
    ...timeline.cursor
      .filter((track) => track.point && frame >= track.fromFrame)
      .map((track) =>
        React.createElement(ClickRipple, {
          key: track.id,
          track,
          frame,
        }),
      ),
  );
}

export function ClickRipple({
  track,
  frame,
}: {
  track: CursorTrack;
  frame: number;
}) {
  if (!track.point) return null;
  const local = frame - track.fromFrame;
  if (local >= CLICK_PULSE_FRAMES) return null;
  const progress = local / CLICK_PULSE_FRAMES;
  const dotOpacity = interpolate(progress, [0, 0.2, 0.7, 1], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ringScale = interpolate(progress, [0, 1], [0.4, 2.2], {
    extrapolateRight: "clamp",
  });
  const ringOpacity = interpolate(progress, [0, 0.3, 1], [0, 0.55, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const size = 26;
  return React.createElement(
    "div",
    {
      style: {
        position: "absolute",
        left: track.point.x,
        top: track.point.y,
        width: 0,
        height: 0,
      },
    },
    React.createElement("div", {
      style: {
        position: "absolute",
        left: -size / 2,
        top: -size / 2,
        width: size,
        height: size,
        borderRadius: 999,
        backgroundColor: "#79e3c7",
        opacity: dotOpacity,
        boxShadow: "0 0 0 6px rgba(121,227,199,.25)",
      },
    }),
    React.createElement("div", {
      style: {
        position: "absolute",
        left: -size / 2,
        top: -size / 2,
        width: size,
        height: size,
        borderRadius: 999,
        border: "3px solid #79e3c7",
        transform: `scale(${ringScale})`,
        opacity: ringOpacity,
      },
    }),
  );
}
