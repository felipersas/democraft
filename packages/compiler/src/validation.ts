import {
  diagnosticDocsUrl,
  type Diagnostic,
  type DemoIR,
} from "@democraft/schema";

export function validateIR(ir: DemoIR): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const sceneIds = new Set<string>();
  const visualIds = new Set(ir.visuals ?? []);

  if (!ir.id || !ir.title || !ir.source.baseUrl) {
    diagnostics.push({
      code: "DC001",
      severity: "error",
      message: "Demo id, title, and source.baseUrl are required.",
      path: "demo",
      suggestion: "Provide non-empty id, title, and source.baseUrl fields.",
      demoId: ir.id,
    });
  }

  for (const [targetKey, target] of Object.entries(ir.targets)) {
    if (!targetKey || !target.id) {
      diagnostics.push({
        code: "DC106",
        severity: "error",
        message: "Target ids must be non-empty.",
        path: `targets.${targetKey || "<empty>"}`,
        suggestion: "Use a stable non-empty target key.",
        demoId: ir.id,
        targetId: target.id || targetKey,
      });
    }
    if (!Array.isArray(target.locators) || target.locators.length === 0) {
      diagnostics.push({
        code: "DC106",
        severity: "error",
        message: `Target "${target.id || targetKey}" must define at least one locator.`,
        path: `targets.${targetKey}.locators`,
        suggestion: "Add at least one locator such as byRole() or byTestId().",
        demoId: ir.id,
        targetId: target.id || targetKey,
      });
    }
  }

  for (const scene of ir.scenes) {
    if (!scene.id) {
      diagnostics.push({
        code: "DC103",
        severity: "error",
        message: "Scene ids must be non-empty.",
        path: "scenes",
        suggestion: "Give every scene a stable non-empty id.",
        demoId: ir.id,
      });
    }
    if (sceneIds.has(scene.id)) {
      diagnostics.push({
        code: "DC002",
        severity: "error",
        message: `Duplicate scene id "${scene.id}".`,
        path: `scenes.${scene.id}`,
        suggestion: "Rename one of the scenes so every scene id is unique.",
        demoId: ir.id,
        sceneId: scene.id,
      });
    }
    sceneIds.add(scene.id);

    const stepIds = new Set<string>();
    for (const step of scene.steps) {
      if (!step.id) {
        diagnostics.push({
          code: "DC104",
          severity: "error",
          message: "Step ids must be non-empty.",
          path: `scenes.${scene.id}.steps`,
          suggestion: "Remove the empty id to generate one or provide a stable id.",
          demoId: ir.id,
          sceneId: scene.id,
        });
      }
      if (stepIds.has(step.id)) {
        diagnostics.push({
          code: "DC002",
          severity: "error",
          message: `Duplicate step id "${step.id}".`,
          path: `scenes.${scene.id}.steps.${step.id}`,
          suggestion: "Rename one of the steps so every step id is unique.",
          demoId: ir.id,
          sceneId: scene.id,
          stepId: step.id,
        });
      }
      stepIds.add(step.id);

      const hasTarget = "target" in step;
      const target = hasTarget ? step.target : undefined;
      if (hasTarget && !target) {
        diagnostics.push({
          code: "DC106",
          severity: "error",
          message: "Step target ids must be non-empty.",
          path: `scenes.${scene.id}.steps.${step.id}.target`,
          suggestion: "Use one of the target ids declared in targets.",
          demoId: ir.id,
          sceneId: scene.id,
          stepId: step.id,
        });
      } else if (target && !ir.targets[target]) {
        diagnostics.push({
          code: "DC101",
          severity: "error",
          message: `Unknown target "${target}".`,
          path: `scenes.${scene.id}.steps.${step.id}.target`,
          suggestion: unknownTargetSuggestion(target, Object.keys(ir.targets)),
          demoId: ir.id,
          sceneId: scene.id,
          stepId: step.id,
          targetId: target,
        });
      }

      if (step.kind === "overlay.visual") {
        if (!visualIds.has(step.visual)) {
          diagnostics.push({
            code: "DC107",
            severity: "error",
            message: `Unknown visual "${step.visual}".`,
            path: `scenes.${scene.id}.steps.${step.id}.visual`,
            suggestion:
              visualIds.size === 0
                ? `Declare "${step.visual}" in the demo visuals map.`
                : `Use one of the declared visuals: ${[...visualIds].join(", ")}.`,
            demoId: ir.id,
            sceneId: scene.id,
            stepId: step.id,
          });
        }
        if (!isJsonValue(step.props)) {
          diagnostics.push({
            code: "DC108",
            severity: "error",
            message: `Visual "${step.visual}" props must be JSON-serializable.`,
            path: `scenes.${scene.id}.steps.${step.id}.props`,
            suggestion:
              "Use only strings, numbers, booleans, null, arrays, and plain objects as visual props.",
            demoId: ir.id,
            sceneId: scene.id,
            stepId: step.id,
          });
        }
      }
    }
  }

  return diagnostics.map((diagnostic) => ({
    ...diagnostic,
    docsUrl: diagnostic.docsUrl ?? diagnosticDocsUrl(diagnostic.code),
  }));
}

function isJsonValue(value: unknown, seen = new Set<object>()): boolean {
  if (value === null) return true;
  if (["string", "boolean"].includes(typeof value)) return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    const valid = value.every((item) => isJsonValue(item, seen));
    seen.delete(value);
    return valid;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const valid = Object.values(value).every((item) => isJsonValue(item, seen));
  seen.delete(value);
  return valid;
}

function unknownTargetSuggestion(target: string, targetIds: string[]): string {
  if (targetIds.length === 0) {
    return `Declare "${target}" in targets.`;
  }
  return `Declare "${target}" in targets or use one of: ${targetIds.join(", ")}.`;
}
