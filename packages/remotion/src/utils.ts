export function active(
  track: { fromFrame: number; durationInFrames: number },
  frame: number,
): boolean {
  return (
    frame >= track.fromFrame && frame < track.fromFrame + track.durationInFrames
  );
}

export function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

export function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}
