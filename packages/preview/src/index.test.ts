import { describe, expect, it } from "vitest";
import type { RecordedDemoManifest, RenderTimeline } from "@democraft/schema";
import { schemaVersion } from "@democraft/schema";
import { renderPreviewHtml } from "./index";

describe("preview", () => {
  it("renders a standalone html preview", () => {
    const html = renderPreviewHtml({
      manifest,
      timeline,
      videoSrc: "file:///tmp/demo.webm",
      screenshotSrcByStepId: {
        "intro.caption.1": "file:///tmp/intro-caption.png",
      },
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain('src="file:///tmp/demo.webm"');
    expect(html).toContain("file:///tmp/intro-caption.png");
    expect(html).toContain('id="scrub"');
    expect(html).toContain('id="play"');
    expect(html).toContain("Resolved Preview");
    expect(html).toContain("Caption text");
    expect(html).toContain("timeline =");
  });
});

const manifest: RecordedDemoManifest = {
  schemaVersion,
  demoId: "demo",
  recording: {
    path: "/tmp/demo.webm",
    width: 1440,
    height: 900,
  },
  steps: [],
  diagnostics: [],
};

const timeline: RenderTimeline = {
  schemaVersion,
  demoId: "demo",
  fps: 60,
  durationInFrames: 120,
  scenes: [
    {
      id: "intro",
      fromFrame: 0,
      durationInFrames: 120,
      steps: [
        {
          stepId: "intro.caption.1",
          sceneId: "intro",
          kind: "overlay.caption",
          fromFrame: 0,
          durationInFrames: 120,
        },
      ],
    },
  ],
  camera: [],
  cursor: [],
  overlays: [
    {
      id: "intro.caption.1.overlay",
      stepId: "intro.caption.1",
      sceneId: "intro",
      kind: "caption",
      text: "Caption text",
      fromFrame: 0,
      durationInFrames: 120,
    },
  ],
};
