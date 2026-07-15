import { describe, expect, it } from "vitest";
import type { DemoIR, RecordedDemoManifest } from "@democraft/schema";
import { schemaVersion } from "@democraft/schema";
import { inspectTimeline, resolveTimeline } from "./index";

const ir: DemoIR = {
  schemaVersion,
  id: "demo",
  definitionHash: "definition-hash",
  captureHash: "capture-v1:sha256:same",
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
  definitionHash: "definition-v1:sha256:captured",
  captureHash: "capture-v1:sha256:same",
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

    expect(timeline.definitionHash).toBe("definition-hash");
    expect(timeline.captureHash).toBe("capture-v1:sha256:same");
    expect(timeline.durationInFrames).toBe(441);
    expect(
      timeline.scenes.map((scene) => [
        scene.id,
        scene.fromFrame,
        scene.durationInFrames,
      ]),
    ).toEqual([
      ["intro", 0, 228],
      ["create", 228, 213],
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

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid fps %s",
    (fps) => {
      expect(() => resolveTimeline(ir, manifest, { fps })).toThrow(
        "fps must be a finite number greater than 0",
      );
    },
  );

  it("uses snappy presentation pacing regardless of capture duration", () => {
    // A slow capture (page took 1.3s to respond during capture) must NOT
    // inflate the step's on-screen duration. The settle gate ensures the
    // *right* screenshot is captured; the timeline pacing is driven by what
    // the viewer needs to read, not by how slow the network was.
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

    // 650ms planned → 39 frames @60fps, NOT the 1300ms (78 frames) it took
    // to capture. Presentation pacing stays snappy.
    expect(clickStep?.durationInFrames).toBe(39);
  });

  it("rejects mismatched demo and capture identities", () => {
    expect(() => resolveTimeline(ir, { ...manifest, demoId: "other" })).toThrow(
      "Demo artifact mismatch",
    );
    expect(() =>
      resolveTimeline(ir, {
        ...manifest,
        captureHash: "capture-v1:sha256:other",
      }),
    ).toThrow("Capture artifact mismatch");
  });

  it("allows definition drift when capture identity remains compatible", () => {
    expect(() =>
      resolveTimeline(
        { ...ir, definitionHash: "definition-v1:sha256:new" },
        { ...manifest, definitionHash: "definition-v1:sha256:old" },
      ),
    ).not.toThrow();
  });

  it("accepts legacy manifests without a capture hash for reading", () => {
    const timeline = resolveTimeline(ir, {
      ...manifest,
      captureHash: undefined,
    });
    expect(timeline.captureHash).toBeUndefined();
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
