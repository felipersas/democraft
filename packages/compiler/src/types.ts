import type { CapturedStep, DemoConfig } from "@democraft/core";
import type { Diagnostic, DemoIR, OperationResult } from "@democraft/schema";

export type CapturedScene = {
  id: string;
  purpose?: string;
  pacing?: "slow" | "normal" | "fast";
  importance?: "primary" | "secondary" | "supporting";
  steps: CapturedStep[];
};

export type CompilationResult = {
  ir: DemoIR;
  config: Pick<DemoConfig, "fps">;
  diagnostics: Diagnostic[];
};

export type CompiledDemo = Omit<CompilationResult, "diagnostics">;
export type CompilationOperationResult = OperationResult<CompiledDemo>;
