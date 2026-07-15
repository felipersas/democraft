import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  ArtifactValidationError,
  parseDemoIR,
  parseDemoIRJson,
  parseRecordedDemoManifestJson,
  parseRenderArtifactMetadataJson,
  parseRenderTimeline,
  parseRenderTimelineJson,
  parseStudioMetaJson,
  parseStudioRenderRequest,
} from "./artifact-schemas";
import { diagnosticSchema, targetDefinitionSchema } from "./schemas";

const fixtures = new URL("../fixtures/v1/", import.meta.url);
const HASHES = {
  definition: `definition-v1:sha256:${"a".repeat(64)}`,
  capture: `capture-v1:sha256:${"b".repeat(64)}`,
};

describe("artifact schemas v1", () => {
  it("reads every valid contract fixture including legacy optional fields", async () => {
    const [ir, manifest, completeManifest, timeline, metadata, meta] =
      await Promise.all([
        parseFixture("demo-ir.valid.json", parseDemoIRJson),
        parseFixture(
          "manifest.legacy.valid.json",
          parseRecordedDemoManifestJson,
        ),
        parseFixture(
          "manifest.complete.valid.json",
          parseRecordedDemoManifestJson,
        ),
        parseFixture("timeline.valid.json", parseRenderTimelineJson),
        parseFixture(
          "render-metadata.valid.json",
          parseRenderArtifactMetadataJson,
        ),
        parseFixture("studio-meta.legacy.valid.json", parseStudioMetaJson),
      ]);

    expect(ir.id).toBe("demo");
    expect(manifest.captureHash).toBeUndefined();
    expect(completeManifest.steps[0]?.targetSnapshot?.boundingBox?.width).toBe(
      3,
    );
    expect(timeline.scenes[0]?.steps[0]?.kind).toBe("browser.goto");
    expect(metadata.status).toBe("completed");
    expect(meta.schemaVersion).toBeUndefined();
    expect(parseDemoIRJson(JSON.stringify(ir))).toEqual(ir);
    expect(parseRecordedDemoManifestJson(JSON.stringify(manifest))).toEqual(
      manifest,
    );
    expect(parseRenderTimelineJson(JSON.stringify(timeline))).toEqual(timeline);
    expect(parseRenderArtifactMetadataJson(JSON.stringify(metadata))).toEqual(
      metadata,
    );
    expect(parseStudioMetaJson(JSON.stringify(meta))).toEqual(meta);
  });

  it("preserves nested locator, framing, target, and diagnostic extensions", () => {
    const target = {
      id: "save",
      extension: "target",
      locators: [
        {
          kind: "role",
          role: "button",
          name: "Save",
          extension: { locator: true },
        },
      ],
      framing: {
        preferredPadding: 8,
        extension: { framing: true },
      },
    };
    const diagnostic = {
      code: "DC101",
      severity: "warning",
      message: "Example",
      extension: { diagnostic: true },
    };

    expect(targetDefinitionSchema.parse(target)).toEqual(target);
    expect(diagnosticSchema.parse(diagnostic)).toEqual(diagnostic);
  });

  it("covers the complete author step union and preserves compatible extensions", async () => {
    const fixture = JSON.parse(
      await readFile(new URL("demo-ir.valid.json", fixtures), "utf8"),
    );
    fixture.definitionHash = HASHES.definition;
    fixture.captureHash = HASHES.capture;
    fixture.extension = { retained: true };
    fixture.scenes[0].steps = [
      { id: "1", kind: "browser.goto", path: "/" },
      { id: "2", kind: "browser.click", target: "save" },
      { id: "3", kind: "browser.fill", target: "save", value: "x" },
      { id: "4", kind: "browser.select", target: "save", value: "x" },
      { id: "5", kind: "assert.visible", target: "save" },
      { id: "6", kind: "assert.text", target: "save", text: "Saved" },
      { id: "7", kind: "assert.url", path: "/saved" },
      { id: "8", kind: "camera.establish" },
      { id: "9", kind: "camera.focus", target: "save", padding: 8 },
      { id: "10", kind: "timeline.hold", durationMs: 100 },
      {
        id: "11",
        kind: "timeline.transition",
        transition: "crossfade",
        durationMs: 100,
      },
      { id: "12", kind: "overlay.caption", text: "Saved", renderer: "" },
      {
        id: "13",
        kind: "overlay.callout",
        target: "save",
        title: "Save",
        renderer: "",
      },
      { id: "14", kind: "cue", name: "done" },
    ];

    const parsed = parseDemoIR(fixture);
    expect(parsed.scenes[0]?.steps.map((step) => step.kind)).toHaveLength(14);
    expect(parsed.scenes[0]?.steps[11]).toMatchObject({ renderer: "" });
    expect(parsed.scenes[0]?.steps[12]).toMatchObject({ renderer: "" });
    expect((parsed as Record<string, unknown>).extension).toEqual({
      retained: true,
    });
    expect(parseDemoIR(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });

  it("covers timeline track unions and geometry", async () => {
    const fixture = JSON.parse(
      await readFile(new URL("timeline.valid.json", fixtures), "utf8"),
    );
    const base = {
      stepId: "goto",
      sceneId: "intro",
      fromFrame: 0,
      durationInFrames: 1,
    };
    fixture.camera = [
      {
        ...base,
        id: "camera",
        kind: "focus",
        targetId: "save",
        boundingBox: { x: 1, y: 2, width: 3, height: 4 },
      },
    ];
    fixture.cursor = [
      {
        ...base,
        id: "cursor",
        kind: "click",
        targetId: "save",
        point: { x: 1, y: 2 },
      },
    ];
    fixture.overlays = [
      {
        ...base,
        id: "caption",
        kind: "caption",
        text: "Saved",
        renderer: "",
      },
      {
        ...base,
        id: "callout",
        kind: "callout",
        targetId: "save",
        title: "Save",
        renderer: "",
      },
    ];

    const parsed = parseRenderTimeline(fixture);
    expect(parsed.camera[0]?.boundingBox?.width).toBe(3);
    expect(parsed.overlays.map((track) => track.kind)).toEqual([
      "caption",
      "callout",
    ]);
    expect(parsed.overlays.map((track) => track.renderer)).toEqual(["", ""]);
    expect(parseRenderTimeline(JSON.parse(JSON.stringify(parsed)))).toEqual(
      parsed,
    );
  });

  it("reports a stable artifact kind and path-aware issue", async () => {
    await expect(
      parseFixture("manifest.invalid.json", parseRecordedDemoManifestJson),
    ).rejects.toMatchObject({
      name: "ArtifactValidationError",
      kind: "recorded demo manifest",
      issues: [expect.objectContaining({ path: "$.steps[0].startedAtMs" })],
    });
  });

  it("rejects unknown versions, malformed JSON, and malformed hashes", async () => {
    const timeline = JSON.parse(
      await readFile(new URL("timeline.valid.json", fixtures), "utf8"),
    );
    expect(() =>
      parseRenderTimeline({ ...timeline, schemaVersion: "2" }),
    ).toThrow("$.schemaVersion");
    expect(() =>
      parseRenderTimeline({
        ...timeline,
        captureHash: "capture-v1:sha256:short",
      }),
    ).toThrow("$.captureHash");
    const metadata = JSON.parse(
      await readFile(new URL("render-metadata.valid.json", fixtures), "utf8"),
    );
    expect(() =>
      parseRenderArtifactMetadataJson(
        JSON.stringify({ ...metadata, definitionHash: "sha256:short" }),
      ),
    ).toThrow("$.definitionHash");
    expect(() => parseRenderTimelineJson("{")).toThrow(ArtifactValidationError);
  });

  it("rejects invalid contract fixtures with path-aware errors", async () => {
    await expect(
      parseFixture("timeline.invalid.json", parseRenderTimelineJson),
    ).rejects.toMatchObject({
      issues: [expect.objectContaining({ path: "$.fps" })],
    });
    await expect(
      parseFixture(
        "render-metadata.invalid.json",
        parseRenderArtifactMetadataJson,
      ),
    ).rejects.toMatchObject({ kind: "render artifact metadata" });
    await expect(
      parseFixture("studio-meta.invalid.json", parseStudioMetaJson),
    ).rejects.toMatchObject({ kind: "studio metadata" });
  });

  it("validates Studio render requests without narrowing the caption DSL", () => {
    expect(
      parseStudioRenderRequest({
        width: 1920,
        height: 1080,
        scale: 1,
        crf: 20,
        frameRange: [0, 10],
        entryPath: "entry.ts",
        captionOverrides: { caption: "Updated" },
      }),
    ).toMatchObject({ width: 1920, frameRange: [0, 10] });
    expect(() => parseStudioRenderRequest(null)).toThrow(
      "Invalid studio render request",
    );
    expect(() => parseStudioRenderRequest({ crf: 52 })).toThrow("$.crf");
    expect(() => parseStudioRenderRequest({ frameRange: [10, 1] })).toThrow(
      "$.frameRange",
    );
    expect(() => parseStudioRenderRequest({ entryPath: "" })).toThrow(
      "$.entryPath",
    );
    const longKey = "caption".repeat(100);
    const longText = "copy".repeat(5_000);
    expect(
      parseStudioRenderRequest({ captionOverrides: { [longKey]: longText } })
        .captionOverrides?.[longKey],
    ).toBe(longText);
  });

  it("enforces terminal render metadata invariants", async () => {
    const completed = JSON.parse(
      await readFile(new URL("render-metadata.valid.json", fixtures), "utf8"),
    );
    expect(() =>
      parseRenderArtifactMetadataJson(
        JSON.stringify({
          ...completed,
          status: "rendering",
          error: { message: "stale" },
        }),
      ),
    ).toThrow("terminal fields");
    expect(() =>
      parseRenderArtifactMetadataJson(
        JSON.stringify({
          ...completed,
          status: "failed",
          error: undefined,
        }),
      ),
    ).toThrow("requires an error");
    expect(() =>
      parseRenderArtifactMetadataJson(
        JSON.stringify({
          ...completed,
          status: "cancelled",
          error: { message: "stale" },
        }),
      ),
    ).toThrow("cannot contain an error");
  });
});

async function parseFixture<T>(
  name: string,
  parse: (json: string) => T,
): Promise<T> {
  return parse(await readFile(new URL(name, fixtures), "utf8"));
}
