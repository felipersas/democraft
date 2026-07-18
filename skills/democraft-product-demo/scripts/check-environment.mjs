#!/usr/bin/env node
/**
 * check-environment.mjs — wraps `democraft doctor --json`.
 *
 * Prints a compact pass/fail summary and exits non-zero if any check errors.
 * Use this before discover/capture/render to fail fast on a broken environment.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const cliBin = resolve(process.argv[2] ?? "../../packages/cli/dist/index.js");
const result = spawnSync(process.execPath, [cliBin, "doctor", "--json"], {
  encoding: "utf8",
});

if (result.status !== 0) {
  console.error(`doctor failed (exit ${result.status})`);
  console.error(result.stderr || result.stdout);
  process.exit(1);
}

const envelope = JSON.parse(result.stdout);
const checks = envelope.checks ?? [];
const errors = checks.filter((c) => c.status === "error");
const warnings = checks.filter((c) => c.status === "warning");

for (const check of checks) {
  const symbol = check.status === "ok" ? "✓" : check.status === "warning" ? "!" : "✗";
  console.log(`${symbol} ${check.id}: ${check.message}`);
  if (check.suggestion) console.log(`    → ${check.suggestion}`);
}
console.log("");
console.log(
  `Summary: ${envelope.summary.status} (${errors.length} errors, ${warnings.length} warnings)`,
);
process.exit(errors.length > 0 ? 1 : 0);
