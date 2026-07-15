import { z } from "zod";
import type { DemoIR } from "./scenes";
import type { RecordedDemoManifest } from "./recorded";
import type { RenderTimeline } from "./timeline";
import type { RenderArtifactMetadata } from "./artifacts";
import type { StudioMeta, StudioRenderRequest } from "./studio";
import {
  diagnosticSchema,
  locatorSchema,
  targetDefinitionSchema,
} from "./schemas";

export type ArtifactKind =
  | "demo IR"
  | "recorded demo manifest"
  | "render timeline"
  | "render artifact metadata"
  | "studio metadata"
  | "studio render request";

export type ArtifactValidationIssue = {
  path: string;
  message: string;
  code: string;
};

export class ArtifactValidationError extends Error {
  readonly kind: ArtifactKind;
  readonly issues: ArtifactValidationIssue[];

  constructor(kind: ArtifactKind, issues: ArtifactValidationIssue[]) {
    const first = issues[0];
    const detail = first ? ` at ${first.path}: ${first.message}` : "";
    super(`Invalid ${kind}${detail}`);
    this.name = "ArtifactValidationError";
    this.kind = kind;
    this.issues = issues;
  }
}

const definitionHashSchema = z
  .string()
  .regex(/^definition-v1:sha256:[a-f0-9]{64}$/);
const captureHashSchema = z.string().regex(/^capture-v1:sha256:[a-f0-9]{64}$/);
const schemaVersionSchema = z.literal("1");
const nonNegativeFinite = z.number().finite().nonnegative();
const positiveFinite = z.number().finite().positive();
const nonNegativeInteger = z.number().int().nonnegative();
const positiveInteger = z.number().int().positive();

export const boundingBoxSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: nonNegativeFinite,
    height: nonNegativeFinite,
  })
  .passthrough();

const stepBase = { id: z.string().min(1) };
export const demoStepSchema = z.discriminatedUnion("kind", [
  z
    .object({ ...stepBase, kind: z.literal("browser.goto"), path: z.string() })
    .passthrough(),
  z
    .object({
      ...stepBase,
      kind: z.literal("browser.click"),
      target: z.string().min(1),
    })
    .passthrough(),
  z
    .object({
      ...stepBase,
      kind: z.literal("browser.fill"),
      target: z.string().min(1),
      value: z.string(),
    })
    .passthrough(),
  z
    .object({
      ...stepBase,
      kind: z.literal("browser.select"),
      target: z.string().min(1),
      value: z.string(),
    })
    .passthrough(),
  z
    .object({
      ...stepBase,
      kind: z.literal("assert.visible"),
      target: z.string().min(1),
    })
    .passthrough(),
  z
    .object({
      ...stepBase,
      kind: z.literal("assert.text"),
      target: z.string().min(1),
      text: z.string(),
    })
    .passthrough(),
  z
    .object({ ...stepBase, kind: z.literal("assert.url"), path: z.string() })
    .passthrough(),
  z
    .object({
      ...stepBase,
      kind: z.literal("camera.establish"),
      target: z.string().min(1).optional(),
    })
    .passthrough(),
  z
    .object({
      ...stepBase,
      kind: z.literal("camera.focus"),
      target: z.string().min(1),
      padding: nonNegativeFinite.optional(),
    })
    .passthrough(),
  z
    .object({
      ...stepBase,
      kind: z.literal("timeline.hold"),
      durationMs: nonNegativeFinite,
    })
    .passthrough(),
  z
    .object({
      ...stepBase,
      kind: z.literal("timeline.transition"),
      transition: z.enum(["cut", "crossfade"]),
      durationMs: nonNegativeFinite.optional(),
    })
    .passthrough(),
  z
    .object({
      ...stepBase,
      kind: z.literal("overlay.caption"),
      text: z.string(),
      renderer: z.string().optional(),
    })
    .passthrough(),
  z
    .object({
      ...stepBase,
      kind: z.literal("overlay.callout"),
      target: z.string().min(1),
      title: z.string(),
      description: z.string().optional(),
      renderer: z.string().optional(),
    })
    .passthrough(),
  z
    .object({ ...stepBase, kind: z.literal("cue"), name: z.string().min(1) })
    .passthrough(),
]);

const demoSceneSchema = z
  .object({
    id: z.string().min(1),
    purpose: z.string().optional(),
    pacing: z.enum(["slow", "normal", "fast"]),
    importance: z.enum(["primary", "secondary", "supporting"]),
    steps: z.array(demoStepSchema),
  })
  .passthrough();

export const demoIRSchema: z.ZodType<DemoIR> = z
  .object({
    schemaVersion: schemaVersionSchema,
    id: z.string().min(1),
    definitionHash: definitionHashSchema.optional(),
    captureHash: captureHashSchema.optional(),
    title: z.string(),
    source: z
      .object({
        baseUrl: z.string().min(1),
        initialPath: z.string().optional(),
      })
      .passthrough(),
    targets: z.record(targetDefinitionSchema),
    scenes: z.array(demoSceneSchema),
  })
  .passthrough();

const recordedLocatorAttemptSchema = z
  .object({
    locator: locatorSchema,
    success: z.boolean(),
    error: z.string().optional(),
  })
  .passthrough();

export const targetSnapshotSchema = z
  .object({
    targetId: z.string().min(1),
    attemptedLocators: z.array(recordedLocatorAttemptSchema),
    successfulLocator: locatorSchema.optional(),
    boundingBox: boundingBoxSchema.optional(),
    visible: z.boolean(),
    resolutionDurationMs: nonNegativeFinite,
  })
  .passthrough();

const stepKindSchema = z.enum([
  "browser.goto",
  "browser.click",
  "browser.fill",
  "browser.select",
  "assert.visible",
  "assert.text",
  "assert.url",
  "camera.establish",
  "camera.focus",
  "timeline.hold",
  "timeline.transition",
  "overlay.caption",
  "overlay.callout",
  "cue",
]);

const recordedStepSchema = z
  .object({
    stepId: z.string().min(1),
    sceneId: z.string().min(1),
    kind: stepKindSchema,
    startedAtMs: nonNegativeFinite,
    endedAtMs: nonNegativeFinite,
    targetSnapshot: targetSnapshotSchema.optional(),
    url: z.string().optional(),
  })
  .passthrough();

export const recordedDemoManifestSchema: z.ZodType<RecordedDemoManifest> = z
  .object({
    schemaVersion: schemaVersionSchema,
    demoId: z.string().min(1),
    definitionHash: definitionHashSchema.optional(),
    captureHash: captureHashSchema.optional(),
    capture: z
      .object({
        width: positiveInteger,
        height: positiveInteger,
        deviceScaleFactor: positiveFinite,
      })
      .passthrough()
      .optional(),
    recording: z
      .object({
        path: z.string().min(1),
        width: positiveInteger,
        height: positiveInteger,
      })
      .passthrough()
      .optional(),
    tracePath: z.string().optional(),
    screenshotsPath: z.string().optional(),
    steps: z.array(recordedStepSchema),
    diagnostics: z.array(diagnosticSchema),
  })
  .passthrough();

const renderStepSchema = z
  .object({
    stepId: z.string().min(1),
    sceneId: z.string().min(1),
    kind: stepKindSchema,
    fromFrame: nonNegativeInteger,
    durationInFrames: positiveInteger,
    targetSnapshot: targetSnapshotSchema.optional(),
  })
  .passthrough();
const trackBase = {
  id: z.string().min(1),
  stepId: z.string().min(1),
  sceneId: z.string().min(1),
  fromFrame: nonNegativeInteger,
  durationInFrames: positiveInteger,
};

const cameraTrackSchema = z
  .object({
    ...trackBase,
    kind: z.enum(["establish", "focus"]),
    targetId: z.string().min(1).optional(),
    boundingBox: boundingBoxSchema.optional(),
  })
  .passthrough();
const cursorTrackSchema = z
  .object({
    ...trackBase,
    kind: z.literal("click"),
    targetId: z.string().min(1),
    point: z
      .object({ x: z.number().finite(), y: z.number().finite() })
      .passthrough()
      .optional(),
  })
  .passthrough();
const overlayTrackSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...trackBase,
      kind: z.literal("caption"),
      text: z.string(),
      renderer: z.string().optional(),
    })
    .passthrough(),
  z
    .object({
      ...trackBase,
      kind: z.literal("callout"),
      targetId: z.string().min(1),
      title: z.string(),
      description: z.string().optional(),
      boundingBox: boundingBoxSchema.optional(),
      renderer: z.string().optional(),
    })
    .passthrough(),
]);

export const renderTimelineSchema: z.ZodType<RenderTimeline> = z
  .object({
    schemaVersion: schemaVersionSchema,
    demoId: z.string().min(1),
    definitionHash: definitionHashSchema.optional(),
    captureHash: captureHashSchema.optional(),
    fps: positiveFinite,
    durationInFrames: nonNegativeInteger,
    scenes: z.array(
      z
        .object({
          id: z.string().min(1),
          fromFrame: nonNegativeInteger,
          durationInFrames: nonNegativeInteger,
          steps: z.array(renderStepSchema),
        })
        .passthrough(),
    ),
    camera: z.array(cameraTrackSchema),
    cursor: z.array(cursorTrackSchema),
    overlays: z.array(overlayTrackSchema),
  })
  .passthrough();

const renderConfigurationSchema = z
  .object({
    fps: positiveFinite,
    durationInFrames: nonNegativeInteger,
    mediaMode: z.enum(["screenshots", "recording"]),
    width: positiveInteger.optional(),
    height: positiveInteger.optional(),
    scale: positiveFinite.optional(),
    crf: nonNegativeFinite.max(51).optional(),
    frameRange: z.tuple([nonNegativeInteger, nonNegativeInteger]).optional(),
  })
  .passthrough()
  .superRefine((render, context) => {
    const range = render.frameRange;
    if (!range) return;
    if (range[0] > range[1]) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["frameRange"],
        message: "Frame range start must not exceed its end.",
      });
    }
    if (range[1] >= render.durationInFrames) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["frameRange", 1],
        message: "Frame range end must be within durationInFrames.",
      });
    }
  });

export const renderArtifactMetadataSchema: z.ZodType<RenderArtifactMetadata> = z
  .object({
    schemaVersion: z.literal(1),
    renderId: z.string().min(1),
    demoId: z.string().min(1),
    definitionHash: definitionHashSchema.optional(),
    captureHash: captureHashSchema.optional(),
    status: z.enum(["rendering", "completed", "failed", "cancelled"]),
    createdAt: z.string().datetime(),
    startedAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    finishedAt: z.string().datetime().optional(),
    output: z.object({ video: z.literal("video.mp4") }).passthrough(),
    render: renderConfigurationSchema,
    source: z
      .object({
        manifestPath: z.string().optional(),
        timelinePath: z.string().optional(),
      })
      .passthrough()
      .optional(),
    error: z.object({ message: z.string() }).passthrough().optional(),
  })
  .passthrough()
  .superRefine((metadata, context) => {
    const finished = metadata.finishedAt !== undefined;
    const hasError = metadata.error !== undefined;
    if (metadata.status === "rendering" && (finished || hasError)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [finished ? "finishedAt" : "error"],
        message: "Rendering metadata cannot contain terminal fields.",
      });
    }
    if (metadata.status !== "rendering" && !finished) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["finishedAt"],
        message: `${metadata.status} metadata requires finishedAt.`,
      });
    }
    if (metadata.status === "failed" && !hasError) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["error"],
        message: "Failed metadata requires an error.",
      });
    }
    if (
      (metadata.status === "completed" || metadata.status === "cancelled") &&
      hasError
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["error"],
        message: `${metadata.status} metadata cannot contain an error.`,
      });
    }
  });

export const studioMetaSchema: z.ZodType<StudioMeta> = z
  .object({
    schemaVersion: schemaVersionSchema.optional(),
    demoPath: z.string().min(1),
    captureDir: z.string().min(1),
    workspaceRoot: z.string().min(1),
    demoId: z.string().min(1),
    definitionHash: definitionHashSchema.optional(),
    captureHash: captureHashSchema.optional(),
    capturedAt: nonNegativeFinite,
  })
  .passthrough();

const captionOverridesSchema = z.record(z.string().min(1), z.string());

export const studioRenderRequestSchema: z.ZodType<StudioRenderRequest> = z
  .object({
    width: z.number().int().min(16).max(16_384).optional(),
    height: z.number().int().min(16).max(16_384).optional(),
    scale: z.number().finite().positive().max(8).optional(),
    crf: z.number().finite().min(0).max(51).optional(),
    frameRange: z
      .tuple([nonNegativeInteger, nonNegativeInteger])
      .refine(([start, end]) => start <= end, {
        message: "Frame range start must not exceed its end.",
      })
      .optional(),
    entryPath: z.string().trim().min(1).max(4096).optional(),
    captionOverrides: captionOverridesSchema.optional(),
  })
  .passthrough();

export const parseDemoIR = parser("demo IR", demoIRSchema);
export const parseRecordedDemoManifest = parser(
  "recorded demo manifest",
  recordedDemoManifestSchema,
);
export const parseRenderTimeline = parser(
  "render timeline",
  renderTimelineSchema,
);
export const parseRenderArtifactMetadata = parser(
  "render artifact metadata",
  renderArtifactMetadataSchema,
);
export const parseStudioMeta = parser("studio metadata", studioMetaSchema);
export const parseStudioRenderRequest = parser(
  "studio render request",
  studioRenderRequestSchema,
);

export const parseDemoIRJson = jsonParser("demo IR", parseDemoIR);
export const parseRecordedDemoManifestJson = jsonParser(
  "recorded demo manifest",
  parseRecordedDemoManifest,
);
export const parseRenderTimelineJson = jsonParser(
  "render timeline",
  parseRenderTimeline,
);
export const parseRenderArtifactMetadataJson = jsonParser(
  "render artifact metadata",
  parseRenderArtifactMetadata,
);
export const parseStudioMetaJson = jsonParser(
  "studio metadata",
  parseStudioMeta,
);

function parser<T>(
  kind: ArtifactKind,
  schema: z.ZodType<T>,
): (value: unknown) => T {
  return (value) => {
    const result = schema.safeParse(value);
    if (result.success) return result.data;
    throw new ArtifactValidationError(
      kind,
      result.error.issues.map((issue) => ({
        path: formatPath(issue.path),
        message: issue.message,
        code: issue.code,
      })),
    );
  };
}

function jsonParser<T>(
  kind: ArtifactKind,
  parse: (value: unknown) => T,
): (json: string) => T {
  return (json) => {
    let value: unknown;
    try {
      value = JSON.parse(json);
    } catch {
      throw new ArtifactValidationError(kind, [
        { path: "$", message: "Invalid JSON", code: "invalid_json" },
      ]);
    }
    return parse(value);
  };
}

function formatPath(path: (string | number)[]): string {
  if (path.length === 0) return "$";
  return path.reduce<string>(
    (formatted, part) =>
      typeof part === "number"
        ? `${formatted}[${part}]`
        : `${formatted}.${part}`,
    "$",
  );
}
