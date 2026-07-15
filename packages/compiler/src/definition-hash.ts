import { createHash } from "node:crypto";
import type { DemoIR, DemoStep } from "@democraft/schema";

export const DEFINITION_HASH_PREFIX = "definition-v1:sha256:";
export const CAPTURE_HASH_PREFIX = "capture-v1:sha256:";

/**
 * Returns the deterministic JSON payload used by the definition hash.
 *
 * The human id, schema version, and an existing hash are intentionally
 * excluded. Object keys are sorted recursively while array order is retained.
 */
export function canonicalizeDefinition(
  ir: Pick<DemoIR, "title" | "source" | "targets" | "scenes" | "visuals">,
): string {
  return canonicalJson({
    title: ir.title,
    source: ir.source,
    targets: ir.targets,
    visuals: ir.visuals,
    scenes: ir.scenes,
  });
}

export function createDefinitionHash(
  ir: Pick<DemoIR, "title" | "source" | "targets" | "scenes" | "visuals">,
): string {
  return `${DEFINITION_HASH_PREFIX}${sha256(canonicalizeDefinition(ir))}`;
}

/**
 * Canonical projection of fields that can affect Playwright actions,
 * screenshots, target snapshots, timings, or capture diagnostics.
 *
 * Only fields proven to be presentation-only are excluded. The versioned
 * prefix must change whenever capture runtime semantics change this boundary.
 */
export function canonicalizeCaptureDefinition(
  ir: Pick<DemoIR, "source" | "targets" | "scenes">,
): string {
  return canonicalJson({
    source: { baseUrl: ir.source.baseUrl },
    targets: Object.fromEntries(
      Object.entries(ir.targets).map(([id, target]) => [
        id,
        { id: target.id, locators: target.locators },
      ]),
    ),
    scenes: ir.scenes.map((scene) => ({
      id: scene.id,
      steps: scene.steps.map(captureStepProjection),
    })),
  });
}

export function createCaptureHash(
  ir: Pick<DemoIR, "source" | "targets" | "scenes">,
): string {
  return `${CAPTURE_HASH_PREFIX}${sha256(canonicalizeCaptureDefinition(ir))}`;
}

function captureStepProjection(step: DemoStep): Record<string, unknown> {
  const identity = { id: step.id, kind: step.kind };
  switch (step.kind) {
    case "browser.goto":
    case "assert.url":
      return { ...identity, path: step.path };
    case "browser.click":
    case "assert.visible":
    case "camera.establish":
      return { ...identity, target: step.target };
    case "browser.fill":
    case "browser.select":
      return { ...identity, target: step.target, value: step.value };
    case "assert.text":
      return { ...identity, target: step.target, text: step.text };
    case "camera.focus":
      return { ...identity, target: step.target };
    case "timeline.hold":
    case "timeline.transition":
      return { ...identity, durationMs: step.durationMs };
    case "overlay.caption":
      return { ...identity, text: step.text };
    case "overlay.callout":
      return {
        ...identity,
        target: step.target,
        title: step.title,
        description: step.description,
      };
    case "overlay.visual":
      return identity;
    case "cue":
      return identity;
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value
      .map((item) => (item === undefined ? "null" : canonicalJson(item)))
      .join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }

  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError("Definition contains a non-JSON value.");
  }
  return serialized;
}
