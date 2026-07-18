import { describe, expect, it } from "vitest";
import type { DemoIR, DemoStep } from "@democraft/schema";
import { schemaVersion } from "@democraft/schema";
import {
  estimateDemoDurationMs,
  estimateSceneDurationMs,
  stepDurationMs,
} from "./estimate";

const step = (overrides: Partial<DemoStep> & { kind: DemoStep["kind"]; id: string }): DemoStep =>
  overrides as DemoStep;

describe("duration estimate", () => {
  it("returns the explicit duration for author-paced steps", () => {
    expect(stepDurationMs(step({ kind: "timeline.hold", id: "h", durationMs: 2500 }))).toBe(2500);
    expect(
      stepDurationMs(step({ kind: "timeline.transition", id: "t", transition: "crossfade", durationMs: 800 })),
    ).toBe(800);
    // transition falls back to 500ms when unset
    expect(stepDurationMs(step({ kind: "timeline.transition", id: "t", transition: "cut" }))).toBe(500);
  });

  it("scales caption duration by text length with a 1200ms floor", () => {
    expect(stepDurationMs(step({ kind: "overlay.caption", id: "c", text: "Hi" }))).toBe(1200);
    // 40 chars * 45 = 1800
    expect(stepDurationMs(step({ kind: "overlay.caption", id: "c", text: "x".repeat(40) }))).toBe(1800);
  });

  it("scales callout duration by title+description length with an 1800ms floor", () => {
    expect(
      stepDurationMs(step({ kind: "overlay.callout", id: "co", target: "x", title: "Hi" })),
    ).toBe(1800);
    expect(
      stepDurationMs(
        step({ kind: "overlay.callout", id: "co", target: "x", title: "Saved", description: "x".repeat(60) }),
      ),
    ).toBeGreaterThan(1800);
  });

  it("uses fixed snappy beats for action steps", () => {
    expect(stepDurationMs(step({ kind: "browser.click", id: "c", target: "x" }))).toBe(650);
    expect(stepDurationMs(step({ kind: "browser.fill", id: "f", target: "x", value: "v" }))).toBe(700);
    expect(stepDurationMs(step({ kind: "browser.goto", id: "g", path: "/" }))).toBe(900);
    expect(stepDurationMs(step({ kind: "camera.establish", id: "e" }))).toBe(700);
    expect(stepDurationMs(step({ kind: "camera.focus", id: "f", target: "x" }))).toBe(1100);
    expect(stepDurationMs(step({ kind: "assert.visible", id: "a", target: "x" }))).toBe(300);
  });

  it("estimates per-scene and total duration from the IR alone", () => {
    const ir: DemoIR = {
      schemaVersion,
      id: "demo",
      title: "Demo",
      source: { baseUrl: "http://localhost:3000" },
      targets: { x: { id: "x", locators: [{ kind: "testId", id: "x" }] } },
      scenes: [
        {
          id: "intro",
          pacing: "normal",
          importance: "primary",
          steps: [
            { kind: "browser.goto", id: "g", path: "/" }, // 900
            { kind: "camera.establish", id: "e" }, // 700
            { kind: "overlay.caption", id: "c", text: "Welcome" }, // max(1200, 7*45=315) = 1200
            { kind: "timeline.hold", id: "h", durationMs: 1000 }, // 1000
          ],
        },
      ],
    };
    const estimate = estimateDemoDurationMs(ir, 60);
    // 900 + 700 + 1200 + 1000 = 3800ms
    expect(estimate.totalMs).toBe(3800);
    expect(estimate.totalSeconds).toBe(3.8);
    expect(estimate.scenes[0]?.sceneId).toBe("intro");
    expect(estimate.scenes[0]?.estimatedMs).toBe(3800);
    // 3800ms at 60fps = 228 frames
    expect(estimate.totalFrames).toBe(228);
  });

  it("estimates are pure: same IR yields the same numbers", () => {
    const ir: DemoIR = {
      schemaVersion,
      id: "demo",
      title: "Demo",
      source: { baseUrl: "http://localhost:3000" },
      targets: {},
      scenes: [
        {
          id: "s",
          pacing: "normal",
          importance: "primary",
          steps: [{ kind: "timeline.hold", id: "h", durationMs: 500 }],
        },
      ],
    };
    expect(estimateDemoDurationMs(ir)).toEqual(estimateDemoDurationMs(ir));
    expect(estimateSceneDurationMs(ir.scenes[0]!)).toBe(500);
  });

  it("respects the fps argument for frame conversion", () => {
    const ir: DemoIR = {
      schemaVersion,
      id: "demo",
      title: "Demo",
      source: { baseUrl: "http://localhost:3000" },
      targets: {},
      scenes: [
        {
          id: "s",
          pacing: "normal",
          importance: "primary",
          steps: [{ kind: "timeline.hold", id: "h", durationMs: 1000 }],
        },
      ],
    };
    expect(estimateDemoDurationMs(ir, 30).totalFrames).toBe(30);
    expect(estimateDemoDurationMs(ir, 60).totalFrames).toBe(60);
  });
});
