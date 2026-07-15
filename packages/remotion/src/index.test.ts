import { describe, expect, it } from "vitest";
import { compositionId } from "./index";
import { cameraStateAt, stageMediaState } from "./composition";
import { imageStyle } from "./stage";
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

  it("renders screenshots at native resolution so camera zoom stays sharp", () => {
    // A capture at 1440×900 with deviceScaleFactor 2 yields 2880×1800 PNGs.
    // The <Img> must be sized at the native resolution (2880×1800) and scaled
    // down via transform — otherwise the browser rasterizes it at 1440×900
    // first and the camera's zoom amplifies an already-downscaled bitmap
    // (pixelation). This test pins the regression-prevention contract.
    const style = imageStyle(1, {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
    });
    expect(style.width).toBe(2880); // 1440 × 2
    expect(style.height).toBe(1800); // 900 × 2
    expect(style.transform).toBe("scale(0.5)"); // 1 / dsf → visually 1440×900
    expect(style.transformOrigin).toBe("0 0");
  });

  it("falls back to CSS dimensions when deviceScaleFactor is absent", () => {
    // Legacy captures without deviceScaleFactor keep the old behavior.
    const style = imageStyle(1, { width: 1440, height: 900 });
    expect(style.width).toBe(1440);
    expect(style.height).toBe(900);
    expect(style.transform).toBe("scale(1)");
  });
});
