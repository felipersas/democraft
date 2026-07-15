import type { Diagnostic, DemoIR } from "@democraft/schema";

export function validateIR(ir: DemoIR): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const sceneIds = new Set<string>();

  if (!ir.id || !ir.title || !ir.source.baseUrl) {
    diagnostics.push({
      code: "DC001",
      severity: "error",
      message: "Demo id, title, and source.baseUrl are required.",
      demoId: ir.id,
    });
  }

  for (const [targetKey, target] of Object.entries(ir.targets)) {
    if (!targetKey || !target.id) {
      diagnostics.push({
        code: "DC106",
        severity: "error",
        message: "Target ids must be non-empty.",
        demoId: ir.id,
        targetId: target.id || targetKey,
      });
    }
    if (!Array.isArray(target.locators) || target.locators.length === 0) {
      diagnostics.push({
        code: "DC106",
        severity: "error",
        message: `Target "${target.id || targetKey}" must define at least one locator.`,
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
        demoId: ir.id,
      });
    }
    if (sceneIds.has(scene.id)) {
      diagnostics.push({
        code: "DC002",
        severity: "error",
        message: `Duplicate scene id "${scene.id}".`,
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
          demoId: ir.id,
          sceneId: scene.id,
        });
      }
      if (stepIds.has(step.id)) {
        diagnostics.push({
          code: "DC002",
          severity: "error",
          message: `Duplicate step id "${step.id}".`,
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
          demoId: ir.id,
          sceneId: scene.id,
          stepId: step.id,
        });
      } else if (target && !ir.targets[target]) {
        diagnostics.push({
          code: "DC101",
          severity: "error",
          message: `Unknown target "${target}".`,
          demoId: ir.id,
          sceneId: scene.id,
          stepId: step.id,
          targetId: target,
        });
      }
    }
  }

  return diagnostics;
}
