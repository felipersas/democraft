import { describe, expect, it } from "vitest";
import { compositionId } from "./index";
import { cameraStateAt, stageMediaState } from "./composition";
import type { RenderTimeline } from "@democraft/schema";

describe("remotion", () => {
  it("exposes the composition id used by the renderer", () => {
    expect(compositionId).toBe("Democraft");
  });

  it("only crossfades screenshots during explicit transition steps", () => {
    const steps = [
      {
        stepId: "a",
        sceneId: "intro",
        kind: "browser.goto" as const,
        fromFrame: 0,
        durationInFrames: 30,
      },
      {
        stepId: "t",
        sceneId: "intro",
        kind: "timeline.transition" as const,
        fromFrame: 30,
        durationInFrames: 30,
      },
      {
        stepId: "b",
        sceneId: "intro",
        kind: "browser.click" as const,
        fromFrame: 60,
        durationInFrames: 30,
      },
    ];
    const sources = { a: "a.png", b: "b.png", t: "t.png" };

    expect(stageMediaState(steps, sources, 10)).toMatchObject({
      currentSrc: "a.png",
      currentOpacity: 1,
      previousOpacity: 0,
    });
    expect(stageMediaState(steps, sources, 45)).toMatchObject({
      currentSrc: "b.png",
      currentOpacity: 0.5,
      previousSrc: "a.png",
      previousOpacity: 0.5,
    });
  });

  it("moves camera focus diagonally in a straight stage line", () => {
    const timeline: RenderTimeline = {
      schemaVersion: "1",
      demoId: "demo",
      fps: 60,
      durationInFrames: 60,
      scenes: [],
      camera: [
        {
          id: "a.cam",
          stepId: "a",
          sceneId: "s",
          kind: "focus",
          targetId: "t",
          fromFrame: 0,
          durationInFrames: 30,
          boundingBox: { x: 1000, y: 200, width: 80, height: 40 },
        },
      ],
      cursor: [],
      overlays: [],
    };
    const start = cameraStateAt(timeline, 0);
    const mid = cameraStateAt(timeline, 15);
    const end = cameraStateAt(timeline, 30);
    expect(mid.focusX).toBeCloseTo((start.focusX + end.focusX) / 2, 5);
    expect(mid.focusY).toBeCloseTo((start.focusY + end.focusY) / 2, 5);
    expect(end.focusX).toBeCloseTo(1040, 5);
    expect(end.focusY).toBeCloseTo(220, 5);
  });
});
