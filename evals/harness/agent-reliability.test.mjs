import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyCommandFailure,
  computeSentinelFrames,
  evaluateCaptureTargetResolution,
  parseHarnessArgs,
  recordRepairAttemptOutcome,
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

test("evaluateCaptureTargetResolution fails unresolved target evidence", () => {
  const result = {
    status: "passed",
    classification: "success",
    metrics: { targetResolutionRate: 0 },
    rubric: { rules: [] },
    failures: [],
  };

  evaluateCaptureTargetResolution(result, {
    steps: [
      {
        id: "intro.assert-visible-heading.1",
        targetSnapshot: {
          targetId: "heading",
          successfulLocator: { kind: "role", role: "heading", name: "Billing" },
          attemptedLocators: [
            {
              locator: { kind: "role", role: "heading", name: "Billing" },
              success: true,
            },
          ],
        },
      },
      {
        id: "done.assert-visible-completion.1",
        targetSnapshot: {
          targetId: "completionState",
          attemptedLocators: [
            {
              locator: {
                kind: "role",
                role: "heading",
                name: "Request submitted",
              },
              success: false,
              error: "Timeout 8000ms exceeded.",
            },
          ],
        },
      },
    ],
    diagnostics: [
      {
        severity: "error",
        code: "DC2001",
        message: "Could not resolve target completionState.",
      },
    ],
  });

  assert.equal(result.status, "failed");
  assert.equal(result.classification, "CAPTURE_FAILURE");
  assert.equal(result.metrics.targetResolutionRate, 0.5);
  assert.deepEqual(result.rubric.rules, [
    {
      id: "captureTargetsResolve",
      passed: false,
      score: 1,
      detail: "1/2 target-bearing capture steps resolved.",
    },
  ]);
  assert.match(
    result.failures[0].message,
    /Unresolved targets: completionState/,
  );
});

test("recordRepairAttemptOutcome records effective repaired runs", () => {
  const repair = {
    round: 1,
    category: "CAPTURE_FAILURE",
    priorFailures: [
      {
        classification: "CAPTURE_FAILURE",
        stage: "capture-evaluation",
        message: "Could not resolve target primaryCta.",
      },
    ],
    message: "Running one bounded repair artifact supplied to the harness.",
  };
  const result = {
    status: "passed",
    classification: "success",
    metrics: { repairEffective: null },
  };

  recordRepairAttemptOutcome(result, repair);

  assert.equal(repair.finalStatus, "passed");
  assert.equal(repair.finalClassification, "success");
  assert.equal(repair.effective, true);
  assert.equal(result.metrics.repairEffective, true);
});
