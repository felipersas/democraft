#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateRubric, validateScenario } from "./agent-reliability.mjs";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const scenariosRoot = join(repoRoot, "evals", "agent-reliability", "scenarios");

async function main() {
  const entries = await readdir(scenariosRoot, { withFileTypes: true });
  const scenarioDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(scenariosRoot, entry.name))
    .sort();
  const failures = [];

  for (const scenarioDir of scenarioDirs) {
    const scenarioPath = join(scenarioDir, "scenario.json");
    const scenario = JSON.parse(await readFile(scenarioPath, "utf8"));
    const scenarioIssues = validateScenario(scenario);
    for (const issue of scenarioIssues) {
      failures.push(`${scenarioPath}: ${issue}`);
    }

    if (scenario.rubricFile) {
      const rubricPath = join(scenarioDir, scenario.rubricFile);
      const rubric = JSON.parse(await readFile(rubricPath, "utf8"));
      const rubricIssues = validateRubric(rubric);
      for (const issue of rubricIssues) {
        failures.push(`${rubricPath}: ${issue}`);
      }
    }
  }

  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log(`Validated ${scenarioDirs.length} agent-reliability scenarios.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
