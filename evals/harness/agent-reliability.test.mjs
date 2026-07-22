import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyCommandFailure,
  classifications,
  computeSentinelFrames,
  evaluateCaptureTargetResolution,
  parseHarnessArgs,
  runReliabilityScenario,
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
      "--auth-profile",
      "auth_01arz3ndektsv4rrffq69g5fav",
      "--no-harness-auth",
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
      authProfileId: "auth_01arz3ndektsv4rrffq69g5fav",
      noHarnessAuth: true,
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

test("classifyCommandFailure keeps auth readiness distinct from render failures", () => {
  assert.ok(classifications.includes("AUTH_READINESS_FAILURE"));
  assert.equal(
    classifyCommandFailure("render", {
      stdout: JSON.stringify({
        ok: false,
        code: "AUTH_PROFILE_NOT_FOUND",
        profileId: "auth_01arz3ndektsv4rrffq69g5fav",
        actionRequired: "choose-profile",
        message: "Authentication profile was not found.",
        stage: "capture-preflight",
      }),
      stderr: "",
    }),
    "AUTH_READINESS_FAILURE",
  );
});

test("authenticated-dashboard full mode preserves frozen artifacts and auth readiness metadata", async () => {
  const scenarioDir =
    "evals/agent-reliability/scenarios/06-authenticated-dashboard";
  const result = await runReliabilityScenario({
    scenarioDir,
    planPath: `${scenarioDir}/expected/DemoPlan.json`,
    demoPath: `${scenarioDir}/expected/demo.ts`,
    mode: "full",
  });

  assert.equal(result.status, "passed");
  assert.equal(result.workflowMode, "full");
  assert.equal(
    result.environment.authentication.mode,
    "ephemeral-harness-profile",
  );
  assert.match(result.artifacts.authProfile, /^auth_[0-9a-hjkmnp-tv-z]{26}$/);
  assert.match(result.artifacts.demoPlan, /DemoPlan\.json$/);
  assert.match(result.artifacts.demoSource, /demo\.ts$/);
  assert.ok(result.artifacts.doctor);
  assert.ok(result.artifacts.discoveryCommand);
  assert.ok(result.artifacts.draftValidation);
  assert.ok(result.artifacts.draftRenderCommand);
  assert.ok(result.artifacts.draftCapture);
  assert.ok(result.artifacts.draftRender);
  assert.ok(result.artifacts.draftSentinelFrames);
  assert.ok(result.artifacts.draftContactSheet);
  assert.ok(result.artifacts.finalRender);
  assert.equal(result.metrics.attempts, 1);
  assert.equal(result.metrics.validationErrorCount, 0);
  assert.equal(result.metrics.captureSucceeded, true);
  assert.equal(result.metrics.renderSucceeded, true);
  assert.equal(result.metrics.targetResolutionRate, 1);
  assert.equal(result.metrics.commandsExecuted, 4);
});

test("authenticated-dashboard full mode classifies missing auth readiness distinctly", async () => {
  const scenarioDir =
    "evals/agent-reliability/scenarios/06-authenticated-dashboard";
  const result = await runReliabilityScenario({
    scenarioDir,
    planPath: `${scenarioDir}/expected/DemoPlan.json`,
    demoPath: `${scenarioDir}/expected/demo.ts`,
    mode: "full",
    noHarnessAuth: true,
  });

  assert.equal(result.status, "failed");
  assert.equal(result.workflowMode, "full");
  assert.equal(result.classification, "AUTH_READINESS_FAILURE");
  assert.equal(result.failures[0].stage, "render");
  assert.match(result.failures[0].message, /AUTH_PROFILE_NOT_FOUND/);
  assert.equal(result.metrics.validationErrorCount, 0);
  assert.equal(result.metrics.captureSucceeded, false);
  assert.equal(result.metrics.renderSucceeded, false);
  assert.equal(result.metrics.commandsExecuted, 4);
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
