import type { Diagnostic, TargetSnapshot } from "@democraft/schema";

export function targetDiagnostic(
  demoId: string,
  sceneId: string,
  stepId: string,
  targetId: string,
  message: string,
  details?: Diagnostic["details"],
): Diagnostic {
  return {
    code: "MD201",
    severity: "error",
    message,
    demoId,
    sceneId,
    stepId,
    targetId,
    details,
  };
}

export function unresolvedTargetDiagnostic(
  demoId: string,
  sceneId: string,
  stepId: string,
  targetId: string,
  attemptedLocators: TargetSnapshot["attemptedLocators"],
): Diagnostic {
  return targetDiagnostic(
    demoId,
    sceneId,
    stepId,
    targetId,
    `Target "${targetId}" could not be resolved.`,
    { attemptedLocators },
  );
}
