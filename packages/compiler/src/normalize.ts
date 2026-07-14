import type { CapturedStep } from "@democraft/core";
import type { DemoSceneIR, DemoStep, Diagnostic } from "@democraft/schema";
import { parseDurationMs } from "./duration";
import type { CapturedScene } from "./types";

export function normalizeScene(
  demoId: string,
  scene: CapturedScene,
  diagnostics: Diagnostic[],
): DemoSceneIR {
  return {
    id: scene.id,
    purpose: scene.purpose,
    pacing: scene.pacing ?? "normal",
    importance: scene.importance ?? "primary",
    steps: scene.steps.map((step, index) =>
      normalizeStep(demoId, scene.id, step, index, diagnostics),
    ),
  };
}

function normalizeStep(
  demoId: string,
  sceneId: string,
  step: CapturedStep,
  index: number,
  diagnostics: Diagnostic[],
): DemoStep {
  const id = step.id ?? `${sceneId}.${slugStep(step)}.${index + 1}`;

  switch (step.kind) {
    case "timeline.hold": {
      const durationMs = parseDurationMs(step.duration);
      if (durationMs === null) {
        diagnostics.push(invalidDuration(demoId, sceneId, id, step.duration));
      }
      return { kind: step.kind, id, durationMs: durationMs ?? 0 };
    }
    case "timeline.transition": {
      const durationMs = step.duration
        ? parseDurationMs(step.duration)
        : undefined;
      if (step.duration && durationMs === null) {
        diagnostics.push(invalidDuration(demoId, sceneId, id, step.duration));
      }
      return {
        kind: step.kind,
        id,
        transition: step.transition ?? "cut",
        durationMs: durationMs ?? undefined,
      };
    }
    default:
      return { ...step, id };
  }
}

function invalidDuration(
  demoId: string,
  sceneId: string,
  stepId: string,
  duration: string,
): Diagnostic {
  return {
    code: "MD102",
    severity: "error",
    message: `Invalid duration "${duration}". Use positive values like "250ms", "1s", or "1.5s".`,
    demoId,
    sceneId,
    stepId,
    details: { duration },
  };
}

function slugStep(step: CapturedStep): string {
  const targetOrPath =
    "target" in step
      ? step.target
      : "path" in step
        ? step.path
        : "name" in step
          ? step.name
          : "";
  return `${step.kind.replace(".", "-")}-${targetOrPath}`
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
