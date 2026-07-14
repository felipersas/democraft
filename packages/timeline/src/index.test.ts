import { describe, expect, it } from "vitest";
import type { DemoIR, RecordedDemoManifest } from "@democraft/schema";
import { schemaVersion } from "@democraft/schema";
import { inspectTimeline, resolveTimeline } from "./index";

const ir: DemoIR = {
  schemaVersion,
  id: "demo",
  title: "Demo",
  source: { baseUrl: "http://localhost:3000" },
  targets: {
    button: { id: "button", locators: [{ kind: "testId", id: "button" }] },
    card: { id: "card", locators: [{ kind: "testId", id: "card" }] },
  },
  scenes: [
    {
      id: "intro",
      pacing: "normal",
      importance: "primary",
      steps: [
        { kind: "browser.goto", id: "intro.goto.1", path: "/dashboard" },
        { kind: "camera.establish", id: "intro.establish.2", target: "card" },
        { kind: "overlay.caption", id: "intro.caption.3", text: "Hello" },
        { kind: "timeline.hold", id: "intro.hold.4", durationMs: 1000 },
      ],
    },
    {
      id: "create",
      pacing: "normal",
      importance: "primary",
      steps: [
        { kind: "browser.click", id: "create.click.1", target: "button" },
        { kind: "camera.focus", id: "create.focus.2", target: "card" },
        {
          kind: "overlay.callout",
          id: "create.callout.3",
          target: "card",
          title: "Ready",
        },
      ],
    },
  ],
};

const manifest: RecordedDemoManifest = {
  schemaVersion,
  demoId: "demo",
  steps: [
    {
      stepId: "intro.goto.1",
      sceneId: "intro",
      kind: "browser.goto",
      startedAtMs: 0,
      endedAtMs: 850,
    },
    {
      stepId: "intro.establish.2",
      sceneId: "intro",
      kind: "camera.establish",
      startedAtMs: 850,
      endedAtMs: 860,
      targetSnapshot: snapshot("card", {
        x: 10,
        y: 20,
        width: 300,
        height: 200,
      }),
    },
    {
      stepId: "create.click.1",
      sceneId: "create",
      kind: "browser.click",
      startedAtMs: 900,
      endedAtMs: 930,
      targetSnapshot: snapshot("button", {
        x: 100,
        y: 50,
        width: 80,
        height: 40,
      }),
    },
    {
      stepId: "create.focus.2",
      sceneId: "create",
      kind: "camera.focus",
      startedAtMs: 930,
      endedAtMs: 940,
      targetSnapshot: snapshot("card", {
        x: 10,
        y: 20,
        width: 300,
        height: 200,
      }),
    },
    {
      stepId: "create.callout.3",
      sceneId: "create",
      kind: "overlay.callout",
      startedAtMs: 940,
      endedAtMs: 950,
      targetSnapshot: snapshot("card", {
        x: 10,
        y: 20,
        width: 300,
        height: 200,
      }),
    },
  ],
  diagnostics: [],
};

describe("timeline", () => {
  it("resolves deterministic frame ranges and tracks", () => {
    const timeline = resolveTimeline(ir, manifest, { fps: 60 });

    expect(timeline.durationInFrames).toBe(438);
    expect(
      timeline.scenes.map((scene) => [
        scene.id,
        scene.fromFrame,
        scene.durationInFrames,
      ]),
    ).toEqual([
      ["intro", 0, 225],
      ["create", 225, 213],
    ]);
    expect(timeline.camera).toEqual([
      expect.objectContaining({
        stepId: "intro.establish.2",
        kind: "establish",
        boundingBox: { x: 10, y: 20, width: 300, height: 200 },
      }),
      expect.objectContaining({
        stepId: "create.focus.2",
        kind: "focus",
      }),
    ]);
    expect(timeline.cursor).toEqual([
      expect.objectContaining({
        stepId: "create.click.1",
        point: { x: 140, y: 70 },
      }),
    ]);
    expect(timeline.overlays.map((overlay) => overlay.kind)).toEqual([
      "caption",
      "callout",
    ]);
  });

  it("inspects timelines as readable text", () => {
    const text = inspectTimeline(resolveTimeline(ir, manifest, { fps: 30 }));

    expect(text).toContain("demo @ 30fps");
    expect(text).toContain("Scene: intro");
    expect(text).toContain("Camera tracks: 2");
  });

  it("does not compress steps below their captured duration", () => {
    const slowClickManifest: RecordedDemoManifest = {
      ...manifest,
      steps: manifest.steps.map((step) =>
        step.stepId === "create.click.1"
          ? { ...step, startedAtMs: 900, endedAtMs: 2200 }
          : step,
      ),
    };

    const timeline = resolveTimeline(ir, slowClickManifest, { fps: 60 });
    const clickStep = timeline.scenes
      .flatMap((scene) => scene.steps)
      .find((step) => step.stepId === "create.click.1");

    expect(clickStep?.durationInFrames).toBe(78);
  });
});

function snapshot(
  targetId: string,
  boundingBox: { x: number; y: number; width: number; height: number },
) {
  return {
    targetId,
    attemptedLocators: [
      { locator: { kind: "testId" as const, id: targetId }, success: true },
    ],
    successfulLocator: { kind: "testId" as const, id: targetId },
    boundingBox,
    visible: true,
    resolutionDurationMs: 1,
  };
}
