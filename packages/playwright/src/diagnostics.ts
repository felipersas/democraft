import {
  diagnosticDocsUrl,
  type Diagnostic,
  type TargetSnapshot,
} from "@democraft/schema";

export function targetDiagnostic(
  demoId: string,
  sceneId: string,
  stepId: string,
  targetId: string,
  message: string,
  details?: Diagnostic["details"],
): Diagnostic {
  return {
    code: "DC201",
    severity: "error",
    message,
    path: `scenes.${sceneId}.steps.${stepId}.target`,
    suggestion: message.includes("could not be resolved")
      ? `Review the locators declared for target "${targetId}".`
      : `Inspect target "${targetId}" and the failed assertion.`,
    docsUrl: diagnosticDocsUrl("DC201"),
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
