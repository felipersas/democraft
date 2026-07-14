/**
 * Tick density adapts to zoom: pick a frame step that keeps ticks ~50–120px
 * apart. Pure function — no React, no JSX.
 */
export function pickTickStep(pxPerFrame: number, fps: number): number {
  const targetPx = 80;
  const idealFrames = targetPx / pxPerFrame;
  const candidates = [
    fps * 0.5,
    fps,
    fps * 2,
    fps * 5,
    fps * 10,
    fps * 30,
    fps * 60,
    30,
    10,
    5,
    1,
  ];
  // Prefer candidates that land on a "nice" time boundary; fall back to round numbers.
  let best = candidates[0];
  let bestDiff = Infinity;
  for (const c of candidates) {
    if (c <= 0) continue;
    const diff = Math.abs(c - idealFrames);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = c;
    }
  }
  return Math.max(1, Math.round(best));
}
