import { describe, expect, it } from "vitest";
import {
  compositionId,
  createProductDemoVideoProps,
  DEFAULT_DEMO_MEDIA_MODE,
} from "./index";
import { cameraStateAt, stageMediaState } from "./composition";
import { imageStyle } from "./stage";
import {
  defaultVisualRegistry,
  resolveCalloutComponent,
  resolveCaptionComponent,
  resolveVisualComponent,
} from "./overlays";
import { defineVisual, defineVisualRegistry } from "./registry";
import { createDemoEntrySource } from "./demo-entry";
import type { RenderTimeline } from "@democraft/schema";

describe("remotion", () => {
  it("exposes the composition id used by the renderer", () => {
    expect(compositionId).toBe("Democraft");
  });

  it("builds screenshot-backed composition props by default", () => {
    const props = createProductDemoVideoProps({
      manifest: emptyManifest,
      timeline: emptyTimeline,
      recordingSrc: "recording.webm",
      screenshotSrcByStepId: { step: "step.png" },
    });

    expect(DEFAULT_DEMO_MEDIA_MODE).toBe("screenshots");
    expect(props.recordingSrc).toBeUndefined();
    expect(props.screenshotSrcByStepId).toEqual({ step: "step.png" });
    expect(props.width).toBe(1920);
    expect(props.height).toBe(1080);
  });

  it("only selects a recording when explicitly requested", () => {
    const props = createProductDemoVideoProps({
      manifest: emptyManifest,
      timeline: emptyTimeline,
      mediaMode: "recording",
      recordingSrc: "recording.webm",
      screenshotSrcByStepId: {},
    });

    expect(props.recordingSrc).toBe("recording.webm");
  });

  it("rejects recording mode when no recording is available", () => {
    expect(() =>
      createProductDemoVideoProps({
        manifest: emptyManifest,
        timeline: emptyTimeline,
        mediaMode: "recording",
        screenshotSrcByStepId: {},
      }),
    ).toThrow("Recording mode requires a recording source");
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
    expect(style.maxWidth).toBe("none");
    expect(style.maxHeight).toBe("none");
  });

  it("falls back to CSS dimensions when deviceScaleFactor is absent", () => {
    // Legacy captures without deviceScaleFactor keep the old behavior.
    const style = imageStyle(1, { width: 1440, height: 900 });
    expect(style.width).toBe(1440);
    expect(style.height).toBe(900);
    expect(style.transform).toBe("scale(1)");
    expect(style.maxWidth).toBe("none");
    expect(style.maxHeight).toBe("none");
  });

  it("rejects explicit renderer ids missing from the visual registry", () => {
    expect(() =>
      resolveCaptionComponent(defaultVisualRegistry, "local.missing"),
    ).toThrow(
      'Unknown caption renderer "local.missing". Registered renderers: motion.caption, remocn.kinetic-title.',
    );
    expect(() =>
      resolveCalloutComponent(defaultVisualRegistry, "local.missing"),
    ).toThrow(
      'Unknown callout renderer "local.missing". Registered renderers: motion.callout, remocn.callout-dark, remocn.callout-light, remocn.glass-callout.',
    );
    expect(() =>
      resolveVisualComponent(defaultVisualRegistry, "local.missing"),
    ).toThrow(
      'Unknown visual renderer "local.missing". Registered renderers: none.',
    );
  });

  it("ships dark and light callout renderers", () => {
    expect(resolveCalloutComponent(defaultVisualRegistry, "remocn.callout-dark")).toBeDefined();
    expect(resolveCalloutComponent(defaultVisualRegistry, "remocn.callout-light")).toBeDefined();
  });

  it("defines and resolves arbitrary typed visual components", () => {
    const Title = ({ text }: { text: string }) => text;
    const visual = defineVisual(Title);
    const registry = defineVisualRegistry({
      kind: "visual",
      id: "local.title",
      component: visual.component as typeof Title,
    });

    expect(visual.component).toBe(Title);
    expect(resolveVisualComponent(registry, "local.title")).toBe(Title);
  });

  it("generates an entry that imports visuals from the demo module", () => {
    const source = createDemoEntrySource("/workspace/demo.ts");

    expect(source).toContain('import demo from "/workspace/demo.ts"');
    expect(source).toContain("visualRegistryFromDefinitions(demo.visuals)");
    expect(source).toContain("registerRoot(Root)");
  });
});

const emptyManifest = {
  schemaVersion: "1" as const,
  demoId: "demo",
  steps: [],
  diagnostics: [],
};

const emptyTimeline: RenderTimeline = {
  schemaVersion: "1",
  demoId: "demo",
  fps: 60,
  durationInFrames: 1,
  scenes: [],
  camera: [],
  cursor: [],
  overlays: [],
};
