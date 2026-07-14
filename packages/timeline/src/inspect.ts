import type { RenderTimeline } from "@democraft/schema";

export function inspectTimeline(timeline: RenderTimeline): string {
  const lines = [
    `${timeline.demoId} @ ${timeline.fps}fps`,
    `Duration: ${timeline.durationInFrames} frames`,
    "",
  ];

  for (const scene of timeline.scenes) {
    lines.push(
      `Scene: ${scene.id} (${scene.fromFrame}-${scene.fromFrame + scene.durationInFrames})`,
    );
    for (const step of scene.steps) {
      lines.push(
        `- ${step.kind} ${step.stepId}: ${step.fromFrame}+${step.durationInFrames}`,
      );
    }
    lines.push("");
  }

  lines.push(`Camera tracks: ${timeline.camera.length}`);
  lines.push(`Cursor tracks: ${timeline.cursor.length}`);
  lines.push(`Overlay tracks: ${timeline.overlays.length}`);

  return lines.join("\n").trimEnd();
}
