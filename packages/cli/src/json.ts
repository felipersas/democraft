/**
 * Shared machine-readable JSON emitter for CLI commands.
 *
 * Establishes ONE stable contract for `--json` output, modeled on the auth
 * envelope (`./auth.ts`): `{ ok: true, ...payload }` on success and
 * `{ ok: false, code, message, diagnostics? }` on failure. New agent-facing
 * commands (`discover`, `doctor`, …) use this; existing commands are
 * untouched (no breaking change).
 *
 * Invariants (plan §11):
 * - `--json` writes ONLY the envelope to stdout. Human progress/logs go to
 *   stderr so stdout stays pure, parseable JSON.
 * - Errors include a stable `code` (a `DCxxxx` diagnostic code or a stable
 *   machine string) and an `exitCode` documented per command.
 */
import type { Diagnostic } from "@democraft/schema";
import type { CliResult } from "./types";

/** Success envelope: `{ ok: true, ...payload }`, exit 0, empty stderr. */
export function jsonOk(payload: Record<string, unknown>): CliResult {
  return {
    exitCode: 0,
    stdout: `${JSON.stringify({ ok: true, ...payload }, null, 2)}\n`,
    stderr: "",
  };
}

/**
 * Failure envelope: `{ ok: false, code, message, diagnostics? }`.
 * The envelope goes to stdout (so `cmd --json | jq` sees the failure);
 * `stderr` carries the same message for humans. `exitCode` is caller-driven.
 */
export function jsonFail(options: {
  code: string;
  message: string;
  exitCode?: number;
  diagnostics?: Diagnostic[];
  extra?: Record<string, unknown>;
}): CliResult {
  const exitCode = options.exitCode ?? 1;
  const payload: Record<string, unknown> = {
    ok: false,
    code: options.code,
    message: options.message,
  };
  if (options.diagnostics && options.diagnostics.length > 0) {
    payload.diagnostics = options.diagnostics;
  }
  if (options.extra) {
    Object.assign(payload, options.extra);
  }
  return {
    exitCode,
    stdout: `${JSON.stringify(payload, null, 2)}\n`,
    stderr: `${options.message}\n`,
  };
}
