import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  canonicalScreenshotFilename,
  resolveRecordedScreenshotPath,
} from "./screenshot-path";

describe("screenshot paths", () => {
  it("creates stable contained filenames for hostile ids", () => {
    const filename = canonicalScreenshotFilename("../../scene", "step/a?b");
    expect(filename).toMatch(/^scene-step-a-b-[a-f0-9]{12}\.png$/);
    expect(filename).not.toContain("/");
    expect(filename).not.toContain("..");
  });

  it("rejects persisted paths outside the capture directory", () => {
    expect(
      resolveRecordedScreenshotPath("/tmp/capture", {
        sceneId: "scene",
        stepId: "step",
        screenshotPath: "../secret.png",
      }),
    ).toBeUndefined();
    expect(
      resolveRecordedScreenshotPath("/tmp/capture", {
        sceneId: "scene",
        stepId: "step",
        screenshotPath: "screenshots/frame.png",
      }),
    ).toBe(path.join("/tmp/capture", "screenshots", "frame.png"));
  });
});
