import { describe, expect, it } from "vitest";
import type { RecordedDemoManifest, RenderTimeline } from "@democraft/schema";
import { schemaVersion } from "@democraft/schema";
import { assertRenderArtifactsCompatible } from "./render-identity";

const DEFINITION_OLD = `definition-v1:sha256:${"a".repeat(64)}`;
const DEFINITION_NEW = `definition-v1:sha256:${"b".repeat(64)}`;
const CAPTURE_HASH = `capture-v1:sha256:${"c".repeat(64)}`;
const OTHER_CAPTURE_HASH = `capture-v1:sha256:${"d".repeat(64)}`;

describe("studio render identity", () => {
  it("rejects mismatched demos and capture hashes", () => {
    const manifest = manifestFixture();
    expect(() =>
      assertRenderArtifactsCompatible(manifest, {
        ...timelineFixture(),
        demoId: "other",
      }),
    ).toThrow("Demo artifact mismatch");
    expect(() =>
      assertRenderArtifactsCompatible(manifest, {
        ...timelineFixture(),
        captureHash: OTHER_CAPTURE_HASH,
      }),
    ).toThrow("Capture artifact mismatch");
  });

  it("allows presentation-only definition drift and legacy hashes", () => {
    expect(() =>
      assertRenderArtifactsCompatible(
        { ...manifestFixture(), definitionHash: DEFINITION_OLD },
        { ...timelineFixture(), definitionHash: DEFINITION_NEW },
      ),
    ).not.toThrow();
    expect(() =>
      assertRenderArtifactsCompatible(
        { ...manifestFixture(), captureHash: undefined },
        timelineFixture(),
      ),
    ).not.toThrow();
  });
});

function manifestFixture(): RecordedDemoManifest {
  return {
    schemaVersion,
    demoId: "demo",
    captureHash: CAPTURE_HASH,
    steps: [],
    diagnostics: [],
  };
}

function timelineFixture(): RenderTimeline {
  return {
    schemaVersion,
    demoId: "demo",
    captureHash: CAPTURE_HASH,
    fps: 60,
    durationInFrames: 1,
    scenes: [],
    camera: [],
    cursor: [],
    overlays: [],
  };
}
