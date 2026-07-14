import type { CapturedStep } from "@democraft/core";
import type { Diagnostic, DemoIR } from "@democraft/schema";

export type CapturedScene = {
  id: string;
  purpose?: string;
  pacing?: "slow" | "normal" | "fast";
  importance?: "primary" | "secondary" | "supporting";
  steps: CapturedStep[];
};

export type CompilationResult = {
  ir: DemoIR;
  diagnostics: Diagnostic[];
};
