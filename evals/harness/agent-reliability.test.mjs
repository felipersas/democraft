import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyCommandFailure,
  computeSentinelFrames,
  parseHarnessArgs,
  validateRubric,
  validateScenario,
} from "./agent-reliability.mjs";

test("parseHarnessArgs accepts discovery and full-flow options", () => {
  assert.deepEqual(
    parseHarnessArgs([
      "evals/agent-reliability/scenarios/01-static-landing-page",
      "--plan",
      "DemoPlan.json",
      "--demo",
      "demo.ts",
      "--repair-demo",
      "repair.ts",
      "--mode",
      "full",
      "--port",
      "4567",
      "--skip-render",
    ]),
    {
      scenarioDir: "evals/agent-reliability/scenarios/01-static-landing-page",
      demoPath: "demo.ts",
      planPath: "DemoPlan.json",
      repairDemoPath: "repair.ts",
      mode: "full",
      port: 4567,
      skipRender: true,
    },
  );
});

test("validateScenario rejects missing load-bearing fields", () => {
  assert.deepEqual(validateScenario({}), [
    "scenario.schemaVersion must be 1.",
    "scenario.id is required.",
    "scenario.title is required.",
    "scenario.promptFile is required.",
    "scenario.rubricFile is required.",
    "scenario.fixture.appFile is required.",
    "scenario.fixture.healthPath is required.",
    "scenario.budgets.maximumDurationMs is required.",
  ]);
});

test("validateRubric accepts must and should rules", () => {
  assert.deepEqual(
    validateRubric({
      schemaVersion: 1,
      rules: [
        { id: "mustRender", level: "must" },
        { id: "visualEvidenceWithinBounds", level: "should" },
      ],
    }),
    [],
  );
});

test("classifyCommandFailure maps common stages to taxonomy", () => {
  assert.equal(
    classifyCommandFailure("doctor", {
      stdout: "",
      stderr: "Chromium missing",
    }),
    "ENVIRONMENT_SETUP",
  );
  assert.equal(
    classifyCommandFailure("validate", { stdout: "[]", stderr: "" }),
    "AUTHORING_API_MISUSE",
  );
  assert.equal(
    classifyCommandFailure("render", {
      stdout: "",
      stderr: "Could not resolve target",
    }),
    "LOCATOR_UNSTABLE",
  );
});

test("computeSentinelFrames returns stable quarter points", () => {
  assert.deepEqual(computeSentinelFrames({ fps: 60, durationInFrames: 120 }), {
    fps: 60,
    durationInFrames: 120,
    frames: [0, 30, 60, 90, 119],
  });
});
