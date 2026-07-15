export const diagnosticCodes = {
  invalidConfig: "DC001",
  duplicateId: "DC002",
  authoringFailed: "DC003",
  unknownTarget: "DC101",
  invalidDuration: "DC102",
  invalidScene: "DC103",
  invalidStep: "DC104",
  unknownRenderer: "DC105",
  invalidTarget: "DC106",
  runtimeStepFailed: "DC201",
} as const;

export function diagnosticDocsUrl(code: string): string {
  return `https://democraft.dev/en/docs/reference/diagnostics?code=${code}`;
}

export type DiagnosticSeverity = "info" | "warning" | "error";

export type Diagnostic = {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  path?: string;
  suggestion?: string;
  docsUrl?: string;
  demoId?: string;
  sceneId?: string;
  stepId?: string;
  targetId?: string;
  details?: Record<string, unknown>;
};

export type OperationResult<T> =
  | { ok: true; value: T; diagnostics: Diagnostic[] }
  | { ok: false; diagnostics: Diagnostic[] };
