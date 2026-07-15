export const diagnosticCodes = {
  invalidConfig: "DC001",
  duplicateId: "DC002",
  unknownTarget: "DC101",
  invalidDuration: "DC102",
  invalidScene: "DC103",
  invalidStep: "DC104",
  unknownRenderer: "DC105",
  invalidTarget: "DC106",
} as const;

export type DiagnosticSeverity = "info" | "warning" | "error";

export type Diagnostic = {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  demoId?: string;
  sceneId?: string;
  stepId?: string;
  targetId?: string;
  details?: Record<string, unknown>;
};
