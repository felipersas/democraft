#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const skillRoot = join(repoRoot, "skills", "democraft-product-demo");
const skillPath = join(skillRoot, "SKILL.md");

const requiredReferences = [
  "references/workflow.md",
  "references/discovery.md",
  "references/demo-direction.md",
  "references/locator-strategy.md",
  "references/authentication.md",
  "references/authoring-api.md",
  "references/repair-playbook.md",
  "references/diagnostics.md",
];

const requiredScripts = [
  "scripts/check-environment.mjs",
  "scripts/summarize-discovery.mjs",
  "scripts/validate-demo.mjs",
  "scripts/collect-render-frames.mjs",
];

const requiredAssets = [
  "assets/basic-demo.ts",
  "assets/feature-walkthrough.ts",
  "assets/product-tour.ts",
];

async function main() {
  const failures = [];
  const skill = await readFile(skillPath, "utf8");
  if (!skill.startsWith("---\n")) {
    failures.push("SKILL.md must start with YAML frontmatter.");
  }
  if (!/^name:\s+democraft-product-demo$/m.test(skill)) {
    failures.push("SKILL.md frontmatter must name democraft-product-demo.");
  }
  if (!/^description:\s+.+DemoCraft.+/m.test(skill)) {
    failures.push("SKILL.md frontmatter must include a DemoCraft description.");
  }
  if (!skill.includes("democraft discover <url> --json")) {
    failures.push("SKILL.md must document the discover command.");
  }
  if (!skill.includes("at most one automatic repair round")) {
    failures.push("SKILL.md must preserve the one-round repair limit.");
  }

  for (const relativePath of [
    ...requiredReferences,
    ...requiredScripts,
    ...requiredAssets,
  ]) {
    try {
      await access(join(skillRoot, relativePath));
    } catch {
      failures.push(`Missing skill file: ${relativePath}`);
    }
  }

  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log("Validated democraft-product-demo skill structure.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
