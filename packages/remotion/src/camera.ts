import type { CameraTrack, RenderTimeline } from "@democraft/schema";
import { lerp, smoothstep } from "./utils";
import type { StageLayout } from "./stage";

export type CameraState = {
  scale: number;
  focusX: number;
  focusY: number;
  translateX: number;
  translateY: number;
};

export function makeCamera(
  scale: number,
  focusX: number,
  focusY: number,
): CameraState {
  return {
    scale,
    focusX,
    focusY,
    translateX: 720 / scale - focusX,
    translateY: 450 / scale - focusY,
  };
}

export function identityCamera(): CameraState {
  return makeCamera(1, 720, 450);
}

export function cameraStateAt(
  timeline: RenderTimeline,
  frame: number,
): CameraState {
  const tracks = [...timeline.camera].sort((a, b) => a.fromFrame - b.fromFrame);
  let index = -1;
  for (let cursor = 0; cursor < tracks.length; cursor += 1) {
    if (frame >= tracks[cursor].fromFrame) index = cursor;
  }
  if (index === -1) return identityCamera();

  const track = tracks[index];
  const previous =
    index > 0 ? cameraTarget(tracks[index - 1]) : identityCamera();
  const next = cameraTarget(track);
  const progress = smoothstep(
    Math.min(
      1,
      Math.max(0, (frame - track.fromFrame) / track.durationInFrames),
    ),
  );

  return makeCamera(
    lerp(previous.scale, next.scale, progress),
    lerp(previous.focusX, next.focusX, progress),
    lerp(previous.focusY, next.focusY, progress),
  );
}

export function cameraTarget(track?: CameraTrack): CameraState {
  if (!track?.boundingBox || track.kind === "establish")
    return identityCamera();

  const padding = 88;
  const scale = Math.min(
    1.32,
    Math.max(
      1,
      Math.min(
        1440 / (track.boundingBox.width + padding * 2),
        900 / (track.boundingBox.height + padding * 2),
      ),
    ),
  );
  const focusX = track.boundingBox.x + track.boundingBox.width / 2;
  const focusY = track.boundingBox.y + track.boundingBox.height / 2;

  return makeCamera(scale, focusX, focusY);
}

export function cameraTransform(
  camera: CameraState,
  stage: StageLayout,
): string {
  const scale = stage.scale * camera.scale;
  return `matrix(${scale}, 0, 0, ${scale}, ${stage.x + camera.translateX * scale}, ${stage.y + camera.translateY * scale})`;
}
