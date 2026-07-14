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

  for (const scene of ir.scenes) {
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

      const target = "target" in step ? step.target : undefined;
      if (target && !ir.targets[target]) {
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
