#!/usr/bin/env node
/**
 * summarize-discovery.mjs — pretty-prints `discover --json` into compact notes.
 *
 * Reads a discovery JSON file (or stdin) and prints a region/element/collection
 * summary plus the top locator candidate per element — the subset an agent
 * actually needs to author targets.
 *
 * Usage:
 *   node summarize-discovery.mjs <discovery.json>
 *   democraft discover <url> --json | node summarize-discovery.mjs
 */
import { readFileSync } from "node:fs";

let raw;
if (process.argv[2]) {
  raw = readFileSync(process.argv[2], "utf8");
} else {
  raw = readFileSync(0, "utf8");
}
const envelope = JSON.parse(raw);
const discovery = envelope.discovery ?? envelope;

const page = discovery.page ?? {};
console.log(`Page: ${page.url ?? "?"} — ${page.title ?? "(no title)"}`);
console.log(`Regions: ${(discovery.regions ?? []).length}`);
for (const region of discovery.regions ?? []) {
  console.log(`  - ${region.kind}${region.label ? ` "${region.label}"` : ""} (${region.id})`);
}

console.log(`\nElements: ${(discovery.elements ?? []).length}`);
for (const el of discovery.elements ?? []) {
  const top = el.locatorCandidates?.[0];
  const loc = top
    ? formatLocator(top.locator)
    : "(no candidate)";
  const stable = top ? ` [${top.stability}, ${top.confidence}]` : "";
  const target = el.suggestedTargetId ? ` → ${el.suggestedTargetId}` : "";
  console.log(`  - (${el.kind}) ${el.name ?? el.text ?? el.id}: ${loc}${stable}${target}`);
}

if ((discovery.collections ?? []).length > 0) {
  console.log(`\nCollections: ${(discovery.collections ?? []).length}`);
  for (const col of discovery.collections ?? []) {
    console.log(
      `  - ${col.label ?? col.id}: ${col.count} × ${col.itemRole ?? "item"} (sample: ${col.sampleElementIds.slice(0, 3).join(", ")}…)`,
    );
  }
}

if ((discovery.warnings ?? []).length > 0) {
  console.log(`\nWarnings:`);
  for (const w of discovery.warnings ?? []) {
    console.log(`  - ${w.code} [${w.severity}]: ${w.message}`);
  }
}

function formatLocator(loc) {
  switch (loc.kind) {
    case "role":
      return `byRole(${JSON.stringify(loc.role)}${loc.name ? `, { name: ${JSON.stringify(loc.name)} }` : ""})`;
    case "label":
      return `byLabel(${JSON.stringify(loc.text)})`;
    case "testId":
      return `byTestId(${JSON.stringify(loc.id)})`;
    case "text":
      return `byText(${JSON.stringify(loc.text)})`;
    default:
      return JSON.stringify(loc);
  }
}
