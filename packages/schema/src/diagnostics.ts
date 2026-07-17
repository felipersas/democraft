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
  invalidAuthenticationProfile: "DC109",
  runtimeStepFailed: "DC201",
  // Audio track diagnostics (presentation-only; never affect capture).
  audioDuplicateId: "DC300",
  audioMissingSource: "DC301",
  audioInvalidVolume: "DC302",
  audioInvalidTime: "DC303",
  audioInvalidFade: "DC304",
  audioUnsupportedFormat: "DC305",
  audioInvalidDuration: "DC306",
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
  audioTrackId?: string;
  details?: Record<string, unknown>;
};

export type OperationResult<T> =
  | { ok: true; value: T; diagnostics: Diagnostic[] }
  | { ok: false; diagnostics: Diagnostic[] };
