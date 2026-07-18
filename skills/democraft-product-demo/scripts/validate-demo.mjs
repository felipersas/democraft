#!/usr/bin/env node
/**
 * validate-demo.mjs — wraps `democraft validate <demo.ts> --json`.
 *
 * Prints a compact diagnostic summary and exits non-zero if any error
 * diagnostic is present. Use this before capture/render.
 *
 * Usage: node validate-demo.mjs <demo.ts> [path/to/cli/index.js]
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const demoPath = process.argv[2];
if (!demoPath) {
  console.error("Usage: validate-demo.mjs <demo.ts>");
  process.exit(2);
}
const cliBin = resolve(process.argv[3] ?? "../../packages/cli/dist/index.js");
const result = spawnSync(
  process.execPath,
  [cliBin, "validate", demoPath, "--json"],
  { encoding: "utf8" },
);

const diagnostics = JSON.parse(result.stdout || "[]");
const errors = diagnostics.filter((d) => d.severity === "error");
const warnings = diagnostics.filter((d) => d.severity === "warning");

for (const d of diagnostics) {
  const symbol = d.severity === "error" ? "✗" : d.severity === "warning" ? "!" : "·";
  const where = d.path ?? [d.sceneId, d.stepId, d.targetId].filter(Boolean).join("/");
  console.log(`${symbol} ${d.code} ${where ? `(${where}) ` : ""}${d.message}`);
  if (d.suggestion) console.log(`    → ${d.suggestion}`);
}
console.log("");
console.log(`${diagnostics.length} diagnostics (${errors.length} errors, ${warnings.length} warnings)`);
process.exit(errors.length > 0 ? 1 : 0);
