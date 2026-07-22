#!/usr/bin/env node
/**
 * DemoCraft agent-reliability harness.
 *
 * Deterministic default mode:
 *   doctor -> discover -> score -> result.json
 *
 * Full-flow mode, when a demo artifact is provided:
 *   doctor -> discover -> validate -> render draft -> evaluate -> optional
 *   one repair artifact -> render final -> result.json
 *
 * The harness intentionally accepts externally produced DemoPlan/demo.ts
 * artifacts. It does not call an LLM provider and does not introduce a second
 * DemoCraft authoring API.
 */
import { createServer } from "node:http";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

export const classifications = [
  "success",
  "ENVIRONMENT_SETUP",
  "FIXTURE_FAILURE",
  "DISCOVERY_MISSING_ELEMENT",
  "DISCOVERY_NOISY_OUTPUT",
  "LOCATOR_AMBIGUOUS",
  "LOCATOR_UNSTABLE",
  "PLAN_INVALID",
  "PLAN_POOR_NARRATIVE",
  "AUTHORING_API_MISUSE",
  "VALIDATION_GAP",
  "CAPTURE_FAILURE",
  "TIMELINE_FAILURE",
  "RENDER_FAILURE",
  "VISUAL_QUALITY_FAILURE",
  "REPAIR_INEFFECTIVE",
  "REPAIR_REGRESSION",
  "SKILL_INSTRUCTION_FAILURE",
  "DOCUMENTATION_GAP",
  "PACKAGE_INSTALLATION_FAILURE",
  "UNKNOWN",
];

const commandTimeoutMs = 120_000;

async function main() {
  const options = parseHarnessArgs(process.argv.slice(2));
  if (!options.scenarioDir) {
    console.error(
      "Usage: agent-reliability.mjs <scenario-dir> [--demo <demo.ts>] [--plan <DemoPlan.json>] [--repair-demo <demo.ts>] [--port <n>] [--mode discovery|full]",
    );
    process.exit(2);
  }

  const result = await runReliabilityScenario(options);
  printSummary(result);
  process.exit(result.status === "passed" ? 0 : 1);
}

export function parseHarnessArgs(argv) {
  const options = {
    scenarioDir: undefined,
    demoPath: undefined,
    planPath: undefined,
    repairDemoPath: undefined,
    mode: undefined,
    port: 0,
    skipRender: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--") continue;
    const readValue = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error(`Missing value for ${token}.`);
      }
      index += 1;
      return value;
    };
    if (token === "--demo") options.demoPath = readValue();
    else if (token === "--plan") options.planPath = readValue();
    else if (token === "--repair-demo") options.repairDemoPath = readValue();
    else if (token === "--mode") options.mode = readValue();
    else if (token === "--port") options.port = Number(readValue());
    else if (token === "--skip-render") options.skipRender = true;
    else if (!token.startsWith("-") && !options.scenarioDir) {
      options.scenarioDir = token;
    } else {
      throw new Error(`Unexpected argument ${token}.`);
    }
  }
  return options;
}

export async function runReliabilityScenario(options) {
  const scenarioDir = resolve(process.cwd(), options.scenarioDir);
  const scenario = JSON.parse(
    await readFile(join(scenarioDir, "scenario.json"), "utf8"),
  );
  const rubric = JSON.parse(
    await readFile(join(scenarioDir, scenario.rubricFile), "utf8"),
  );
  const targetApp = JSON.parse(
    await readFile(join(scenarioDir, scenario.fixture.appFile), "utf8"),
  );
  const scenarioIssues = validateScenario(scenario);
  const rubricIssues = validateRubric(rubric);

  const runId = createRunId();
  const runDirectory = join(
    repoRoot,
    "evals",
    "results",
    "agent-reliability",
    scenario.id,
    runId,
  );
  await mkdir(runDirectory, { recursive: true });

  const result = createInitialResult({
    runId,
    scenario,
    rubric,
    runDirectory,
    mode: resolveMode(options),
  });

  if (scenarioIssues.length || rubricIssues.length) {
    result.status = "failed";
    result.classification = "FIXTURE_FAILURE";
    result.failures.push(
      ...scenarioIssues.map((message) => ({
        classification: "FIXTURE_FAILURE",
        stage: "scenario-validation",
        message,
      })),
      ...rubricIssues.map((message) => ({
        classification: "FIXTURE_FAILURE",
        stage: "rubric-validation",
        message,
      })),
    );
    await persistResult(runDirectory, result);
    return result;
  }

  let server;
  try {
    const booted = await bootTargetApp(targetApp, {
      port: options.port,
      healthPath: scenario.fixture.healthPath,
      resetPath: scenario.fixture.resetPath,
    });
    server = booted.server;
    result.artifacts.fixtureUrl = booted.baseUrl;
    result.environment.fixture = {
      baseUrl: booted.baseUrl,
      healthPath: scenario.fixture.healthPath,
      resetPath: scenario.fixture.resetPath,
    };

    await runDoctorStage(result, runDirectory, booted.baseUrl, scenario);
    if (result.failures.length > 0) {
      await persistResult(runDirectory, result);
      return result;
    }

    await runDiscoveryStage(result, runDirectory, booted.baseUrl, scenario);
    if (result.failures.length > 0) {
      await persistResult(runDirectory, result);
      return result;
    }

    applyDiscoveryRubric(result, rubric);

    if (result.workflowMode === "discovery") {
      finishResult(result);
      await persistResult(runDirectory, result);
      return result;
    }

    await runFullFlowStage(
      result,
      runDirectory,
      options,
      booted.baseUrl,
      rubric,
    );
    finishResult(result);
    await persistResult(runDirectory, result);
    return result;
  } catch (error) {
    result.status = "failed";
    result.classification =
      result.classification === "success" ? "UNKNOWN" : result.classification;
    result.failures.push({
      classification: result.classification,
      stage: "harness",
      message: error instanceof Error ? error.message : String(error),
    });
    await persistResult(runDirectory, result);
    return result;
  } finally {
    await new Promise((resolveClose) => server?.close(resolveClose));
  }
}

export function validateScenario(scenario) {
  const issues = [];
  if (scenario.schemaVersion !== 1)
    issues.push("scenario.schemaVersion must be 1.");
  if (!scenario.id) issues.push("scenario.id is required.");
  if (!scenario.title) issues.push("scenario.title is required.");
  if (!scenario.promptFile) issues.push("scenario.promptFile is required.");
  if (!scenario.rubricFile) issues.push("scenario.rubricFile is required.");
  if (!scenario.fixture?.appFile)
    issues.push("scenario.fixture.appFile is required.");
  if (!scenario.fixture?.healthPath)
    issues.push("scenario.fixture.healthPath is required.");
  if (!scenario.budgets?.maximumDurationMs) {
    issues.push("scenario.budgets.maximumDurationMs is required.");
  }
  if (
    scenario.budgets?.maximumRepairRounds !== undefined &&
    scenario.budgets.maximumRepairRounds > 1
  ) {
    issues.push("scenario.budgets.maximumRepairRounds must be <= 1.");
  }
  return issues;
}

export function validateRubric(rubric) {
  const issues = [];
  if (rubric.schemaVersion !== 1)
    issues.push("rubric.schemaVersion must be 1.");
  if (!Array.isArray(rubric.rules) || rubric.rules.length === 0) {
    issues.push("rubric.rules must contain at least one rule.");
  }
  for (const rule of rubric.rules ?? []) {
    if (!rule.id) issues.push("each rubric rule requires id.");
    if (!["must", "should"].includes(rule.level)) {
      issues.push(`rubric rule ${rule.id ?? "(unknown)"} has invalid level.`);
    }
  }
  return issues;
}

export function classifyCommandFailure(stage, command) {
  const output = `${command.stderr}\n${command.stdout}`;
  if (stage === "doctor") return "ENVIRONMENT_SETUP";
  if (output.includes("Cannot find module") || output.includes("ENOENT")) {
    return "PACKAGE_INSTALLATION_FAILURE";
  }
  if (stage === "discover") {
    if (output.includes("DC401") || output.includes("DC402")) {
      return "ENVIRONMENT_SETUP";
    }
    return "DISCOVERY_MISSING_ELEMENT";
  }
  if (stage === "validate") return "AUTHORING_API_MISUSE";
  if (stage === "render") {
    if (output.toLowerCase().includes("target")) return "LOCATOR_UNSTABLE";
    if (output.toLowerCase().includes("timeline")) return "TIMELINE_FAILURE";
    if (output.toLowerCase().includes("capture")) return "CAPTURE_FAILURE";
    return "RENDER_FAILURE";
  }
  return "UNKNOWN";
}

function resolveMode(options) {
  if (options.mode) return options.mode;
  return options.demoPath ? "full" : "discovery";
}

function createRunId() {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .concat(`-${randomBytes(4).toString("hex")}`);
}

function createInitialResult({ runId, scenario, rubric, runDirectory, mode }) {
  return {
    schemaVersion: 1,
    runId,
    scenarioId: scenario.id,
    status: "failed",
    classification: "success",
    workflowMode: mode,
    generatedAt: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      democraftVersion: readRootVersion(),
      agent: "external",
      model: "not-recorded",
    },
    metrics: {
      attempts: 0,
      repairRounds: 0,
      semanticLocatorRatio: 0,
      durationMs: 0,
      evaluationScore: 0,
      humanInterventions: 0,
      validationErrorCount: 0,
      targetResolutionRate: 0,
      captureSucceeded: false,
      renderSucceeded: false,
      unnecessaryRecaptures: 0,
      commandsExecuted: 0,
    },
    artifacts: {
      runDirectory,
    },
    rubric: {
      id: rubric.id,
      score: 0,
      rules: [],
    },
    failures: [],
    repairs: [],
    commands: [],
  };
}

function readRootVersion() {
  try {
    const pkg = JSON.parse(
      existsSync(join(repoRoot, "package.json"))
        ? readFileSync(join(repoRoot, "package.json"), "utf8")
        : "{}",
    );
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function bootTargetApp(spec, options) {
  const state = { resetCount: 0 };
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === options.healthPath) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, resetCount: state.resetCount }));
      return;
    }
    if (url.pathname === options.resetPath) {
      state.resetCount += 1;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, resetCount: state.resetCount }));
      return;
    }
    const page = resolveTargetPage(spec, url.pathname);
    if (page) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderSpecHtml(page, spec));
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  });
  return new Promise((resolveBoot, rejectBoot) => {
    server.once("error", rejectBoot);
    server.listen(options.port, () => {
      const address = server.address();
      resolveBoot({
        server,
        baseUrl: `http://localhost:${address.port}`,
      });
    });
  });
}

function resolveTargetPage(spec, pathname) {
  if (Array.isArray(spec.pages)) {
    return spec.pages.find((page) => page.path === pathname);
  }
  if (pathname === "/" || pathname === "/index.html") return spec;
  return undefined;
}

function renderSpecHtml(page, spec) {
  const regions = (page.regions ?? [])
    .map((region) => {
      const tag = regionTag(region.kind);
      const attrs = region.label
        ? ` aria-label="${escapeAttr(region.label)}"`
        : "";
      const inner = (region.elements ?? [])
        .map((element) => renderElement(element))
        .join("\n");
      return `<${tag}${attrs}>\n${inner}\n</${tag}>`;
    })
    .join("\n");
  const collection = page.collection ? renderCollection(page.collection) : "";
  const dialogs = (page.dialogs ?? [])
    .map((dialog) => renderDialog(dialog))
    .join("\n");
  const successState = page.successState
    ? renderSuccessState(page.successState)
    : "";
  const slowScript = page.slowLoading
    ? `<script>
setTimeout(() => {
  document.querySelectorAll("[data-delayed]").forEach((node) => {
    node.hidden = false;
  });
}, ${Number(page.slowLoading.delayMs ?? 800)});
</script>`
    : "";
  const actionScript = page.successState
    ? `<script>
document.querySelectorAll("[data-action='show-success']").forEach((node) => {
  node.addEventListener("click", () => {
    document.querySelectorAll("[data-success-state]").forEach((success) => {
      success.hidden = false;
    });
  });
});
</script>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeText(page.title ?? spec.title ?? "DemoCraft Eval")}</title>
<style>
body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:24px;line-height:1.45;color:#17202a;background:#fafafa}
header,nav,main,aside,footer,section{margin:0 0 20px}
button,a,input,select{font:inherit;margin:6px 8px 6px 0}
article{border:1px solid #d7dce2;border-radius:8px;padding:12px;margin:8px 0;background:white}
dialog[open]{position:static;margin:24px 0;padding:18px;border:1px solid #aab2bd;border-radius:8px}
.responsive-mobile{display:none}
@media (max-width: 640px){.responsive-desktop{display:none}.responsive-mobile{display:block}}
</style>
</head>
<body>
${regions}
${collection}
${dialogs}
${successState}
${slowScript}
${actionScript}
</body>
</html>`;
}

function regionTag(kind) {
  switch (kind) {
    case "navigation":
      return "nav";
    case "main":
      return "main";
    case "banner":
      return "header";
    case "contentinfo":
      return "footer";
    case "complementary":
      return "aside";
    case "form":
      return "form";
    default:
      return "section";
  }
}

function renderElement(element) {
  const testId = element.testId
    ? ` data-testid="${escapeAttr(element.testId)}"`
    : "";
  const delayed = element.delayed ? " data-delayed hidden" : "";
  const className = element.className
    ? ` class="${escapeAttr(element.className)}"`
    : "";
  const action = element.action
    ? ` data-action="${escapeAction(element.action)}"`
    : "";
  switch (element.kind) {
    case "heading":
      return `<h1${testId}${className}${delayed}>${escapeText(element.name)}</h1>`;
    case "button":
      return `<button type="button"${testId}${className}${action}${delayed}>${escapeText(element.name)}</button>`;
    case "link":
      return `<a href="${escapeAttr(element.href ?? "#")}"${testId}${className}${delayed}>${escapeText(element.name)}</a>`;
    case "textbox":
      return `<label${className}>${escapeText(element.label)}<input type="text"${testId}${delayed}></label>`;
    case "checkbox":
      return `<label${className}><input type="checkbox"${testId}${delayed}>${escapeText(element.label ?? element.name)}</label>`;
    case "combobox":
      return `<label${className}>${escapeText(element.label)}<select${testId}${delayed}><option>${escapeText(element.option ?? "Standard")}</option></select></label>`;
    default:
      return `<span${testId}${className}${delayed}>${escapeText(element.name ?? "")}</span>`;
  }
}

function renderSuccessState(successState) {
  const label = successState.label
    ? ` aria-label="${escapeAttr(successState.label)}"`
    : "";
  const inner = (successState.elements ?? [])
    .map((element) => renderElement(element))
    .join("\n");
  return `<section${label} data-success-state hidden>\n${inner}\n</section>`;
}

function renderDialog(dialog) {
  const label = dialog.label ? ` aria-label="${escapeAttr(dialog.label)}"` : "";
  const open = dialog.open === false ? "" : " open";
  const inner = (dialog.elements ?? [])
    .map((element) => renderElement(element))
    .join("\n");
  return `<dialog${open}${label}>\n${inner}\n</dialog>`;
}

function renderCollection(collection) {
  const count = collection.count ?? 12;
  const items = Array.from({ length: count }, (_, index) => {
    const title = collection.itemName
      ? collection.itemName.replace("{n}", String(index + 1))
      : `Item ${index + 1}`;
    return `<article><h2>${escapeText(title)}</h2><p>${escapeText(collection.detail ?? `Details for ${title}.`)}</p><button type="button">${escapeText(collection.actionName ?? "Open")}</button></article>`;
  }).join("\n");
  return `<main aria-label="${escapeAttr(collection.label ?? "Items")}">\n${items}\n</main>`;
}

function escapeText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value) {
  return escapeText(value).replace(/"/g, "&quot;");
}

function escapeAction(value) {
  return escapeAttr(value === "showSuccess" ? "show-success" : value);
}

async function runDoctorStage(result, runDirectory, baseUrl, scenario) {
  const doctor = await runCliCommand({
    name: "doctor",
    args: [
      "doctor",
      "--url",
      `${baseUrl}${scenario.fixture.healthPath}`,
      "--json",
    ],
    runDirectory,
  });
  recordCommand(result, doctor);
  if (doctor.exitCode !== 0) {
    failResult(
      result,
      classifyCommandFailure("doctor", doctor),
      "doctor",
      doctor.stderr || doctor.stdout,
    );
  }
}

async function runDiscoveryStage(result, runDirectory, baseUrl, scenario) {
  const discovery = await runCliCommand({
    name: "discover",
    args: ["discover", baseUrl, "--json"],
    runDirectory,
  });
  recordCommand(result, discovery);
  if (discovery.exitCode !== 0) {
    failResult(
      result,
      classifyCommandFailure("discover", discovery),
      "discover",
      discovery.stderr || discovery.stdout,
    );
    return;
  }
  const envelope = parseJsonOrUndefined(discovery.stdout);
  result.artifacts.discovery = envelope?.directory;
  result.artifacts.discoveryScreenshot = envelope?.screenshotPath;
  result.discovery = envelope?.discovery;
}

function applyDiscoveryRubric(result, rubric) {
  const discovery = result.discovery;
  const elements = discovery?.elements ?? [];
  const withCandidates = elements.filter(
    (element) => (element.locatorCandidates ?? []).length > 0,
  );
  const semanticPrimary = withCandidates.filter((element) =>
    ["role", "label", "testId"].includes(
      element.locatorCandidates?.[0]?.locator?.kind,
    ),
  );
  const semanticRatio =
    withCandidates.length > 0
      ? semanticPrimary.length / withCandidates.length
      : 0;
  result.metrics.semanticLocatorRatio = Number(semanticRatio.toFixed(3));

  addRule(result, {
    id: "minimumSemanticLocatorRatio",
    passed:
      semanticRatio >=
      Number(rubric.thresholds?.minimumSemanticLocatorRatio ?? 0),
    score: semanticRatio,
    detail: `${semanticPrimary.length}/${withCandidates.length} elements have semantic primary locators.`,
  });
  addRule(result, {
    id: "mustHaveNoEmptyElements",
    passed: elements.every(
      (element) => (element.locatorCandidates ?? []).length > 0,
    ),
    score: elements.length,
    detail: `${elements.length} retained elements.`,
  });
  addRule(result, {
    id: "mustNotUseUnsafeExploration",
    passed: (discovery?.warnings ?? []).every(
      (warning) => warning.code !== "DC401" && warning.code !== "DC402",
    ),
    score: discovery?.warnings?.length ?? 0,
    detail: `${discovery?.warnings?.length ?? 0} discovery warnings.`,
  });
  if (rubric.thresholds?.mustUseCollectionSampling) {
    addRule(result, {
      id: "mustUseCollectionSampling",
      passed:
        (discovery?.collections ?? []).length > 0 &&
        discovery.collections.every(
          (collection) => collection.sampleElementIds.length < collection.count,
        ),
      score: discovery?.collections?.length ?? 0,
      detail: `${discovery?.collections?.length ?? 0} collections aggregated.`,
    });
  }
}

async function runFullFlowStage(
  result,
  runDirectory,
  options,
  baseUrl,
  rubric,
) {
  if (!options.demoPath) {
    failResult(
      result,
      "PLAN_INVALID",
      "artifact-intake",
      "Full workflow mode requires --demo <demo.ts>.",
    );
    return;
  }

  result.metrics.attempts += 1;
  if (options.planPath) {
    await validatePlanArtifact(result, options.planPath);
  }
  if (result.failures.length > 0) return;

  const firstDemo = resolve(process.cwd(), options.demoPath);
  await runValidateRenderAttempt({
    result,
    runDirectory,
    demoPath: firstDemo,
    baseUrl,
    attemptName: "draft",
    skipRender: options.skipRender,
  });

  if (result.status !== "failed") {
    result.artifacts.finalRender = result.artifacts.draftRender;
    return;
  }

  if (!options.repairDemoPath || result.metrics.repairRounds >= 1) return;
  const priorClassification = result.classification;
  const priorFailures = [...result.failures];
  result.metrics.repairRounds = 1;
  result.repairs.push({
    round: 1,
    category: priorClassification,
    priorFailures,
    message: "Running one bounded repair artifact supplied to the harness.",
  });
  result.failures = [];
  result.status = "failed";
  result.classification = "success";
  await runValidateRenderAttempt({
    result,
    runDirectory,
    demoPath: resolve(process.cwd(), options.repairDemoPath),
    baseUrl,
    attemptName: "final",
    skipRender: options.skipRender,
  });
  if (result.status === "failed") {
    result.classification = "REPAIR_INEFFECTIVE";
  }
}

async function validatePlanArtifact(result, planPath) {
  const absolutePlanPath = resolve(process.cwd(), planPath);
  result.artifacts.demoPlan = absolutePlanPath;
  const content = await readFile(absolutePlanPath, "utf8");
  if (!absolutePlanPath.endsWith(".json")) return;
  const plan = JSON.parse(content);
  const required = [
    "objective",
    "audience",
    "scenes",
    "selectedTargets",
    "expectedAssertions",
    "duration",
    "aspectRatio",
    "recaptureRequired",
  ];
  const missing = required.filter((key) => plan[key] === undefined);
  if (missing.length > 0) {
    failResult(
      result,
      "PLAN_INVALID",
      "plan-validation",
      `DemoPlan is missing: ${missing.join(", ")}.`,
    );
  }
}

async function runValidateRenderAttempt({
  result,
  runDirectory,
  demoPath,
  baseUrl,
  attemptName,
  skipRender,
}) {
  const validate = await runCliCommand({
    name: `${attemptName}-validate`,
    args: ["validate", demoPath, "--json"],
    runDirectory,
    env: { EVAL_BASE_URL: baseUrl },
  });
  recordCommand(result, validate);
  const diagnostics = parseJsonOrUndefined(validate.stdout) ?? [];
  result.metrics.validationErrorCount += diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;
  if (validate.exitCode !== 0) {
    failResult(
      result,
      "AUTHORING_API_MISUSE",
      "validate",
      validate.stderr || validate.stdout,
    );
    return;
  }

  if (skipRender) {
    result.metrics.renderSucceeded = true;
    result.status = "passed";
    return;
  }

  const outputFile = join(runDirectory, `${attemptName}.mp4`);
  const captureDir = join(runDirectory, `${attemptName}-capture`);
  const render = await runCliCommand({
    name: `${attemptName}-render`,
    args: [
      "render",
      demoPath,
      "--headless",
      "--output-dir",
      captureDir,
      "-o",
      outputFile,
    ],
    runDirectory,
    env: { EVAL_BASE_URL: baseUrl },
    timeoutMs: commandTimeoutMs * 5,
  });
  recordCommand(result, render);
  if (render.exitCode !== 0) {
    failResult(
      result,
      classifyCommandFailure("render", render),
      "render",
      render.stderr || render.stdout,
    );
    return;
  }
  result.metrics.captureSucceeded = true;
  result.metrics.renderSucceeded = true;
  result.artifacts[`${attemptName}Render`] = outputFile;
  result.artifacts[`${attemptName}Capture`] = captureDir;
  await collectVisualEvidence(result, runDirectory, attemptName, captureDir);
  if (result.failures.length === 0) result.status = "passed";
}

async function collectVisualEvidence(
  result,
  runDirectory,
  attemptName,
  captureDir,
) {
  const manifestPath = join(captureDir, "manifest.json");
  const timelinePath = join(captureDir, "timeline.json");
  if (!existsSync(manifestPath) || !existsSync(timelinePath)) return;
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const timeline = JSON.parse(await readFile(timelinePath, "utf8"));
  const sentinels = computeSentinelFrames(timeline);
  const sentinelPath = join(
    runDirectory,
    `${attemptName}-sentinel-frames.json`,
  );
  await writeFile(sentinelPath, `${JSON.stringify(sentinels, null, 2)}\n`);
  const contactSheetPath = join(
    runDirectory,
    `${attemptName}-contact-sheet.html`,
  );
  await writeFile(
    contactSheetPath,
    renderContactSheetHtml(manifest, captureDir, sentinels),
  );
  result.artifacts[`${attemptName}SentinelFrames`] = sentinelPath;
  result.artifacts[`${attemptName}ContactSheet`] = contactSheetPath;
  evaluateCaptureTargetResolution(result, manifest);
  evaluateTimelineBounds(result, manifest, timeline);
}

export function computeSentinelFrames(timeline) {
  const duration = Number(timeline.durationInFrames ?? 0);
  const points = new Set([0]);
  if (duration > 1) {
    points.add(Math.floor(duration / 4));
    points.add(Math.floor(duration / 2));
    points.add(Math.floor((duration * 3) / 4));
    points.add(duration - 1);
  }
  return {
    fps: timeline.fps,
    durationInFrames: duration,
    frames: Array.from(points).sort((a, b) => a - b),
  };
}

function renderContactSheetHtml(manifest, captureDir, sentinels) {
  const screenshots = (manifest.steps ?? [])
    .slice(0, Math.max(1, sentinels.frames.length))
    .map((step) => {
      const src = step.screenshotPath
        ? join(captureDir, step.screenshotPath)
        : "";
      return `<figure><img src="${escapeAttr(src)}" alt="${escapeAttr(step.id)}"><figcaption>${escapeText(step.id)}</figcaption></figure>`;
    })
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>DemoCraft Contact Sheet</title><style>body{font-family:system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}img{max-width:100%;border:1px solid #ccc}</style></head><body><h1>Contact sheet</h1><main>${screenshots}</main></body></html>\n`;
}

export function evaluateCaptureTargetResolution(result, manifest) {
  const targetSteps = (manifest.steps ?? []).filter((step) =>
    targetSnapshotForStep(step),
  );
  const resolvedSteps = targetSteps.filter((step) => {
    const targetSnapshot = targetSnapshotForStep(step);
    if (targetSnapshot.successfulLocator) return true;
    const attempts = targetSnapshot.attemptedLocators ?? [];
    return attempts.some((attempt) => attempt.success);
  });
  result.metrics.targetResolutionRate =
    targetSteps.length > 0
      ? Number((resolvedSteps.length / targetSteps.length).toFixed(3))
      : 1;

  const diagnostics = (manifest.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.severity === "error",
  );
  const unresolvedSteps = targetSteps.filter((step) => {
    const targetSnapshot = targetSnapshotForStep(step);
    return (
      !targetSnapshot.successfulLocator &&
      !(targetSnapshot.attemptedLocators ?? []).some(
        (attempt) => attempt.success,
      )
    );
  });
  addRule(result, {
    id: "captureTargetsResolve",
    passed: diagnostics.length === 0 && unresolvedSteps.length === 0,
    score: resolvedSteps.length,
    detail: `${resolvedSteps.length}/${targetSteps.length} target-bearing capture steps resolved.`,
  });
  if (diagnostics.length > 0 || unresolvedSteps.length > 0) {
    const unresolvedIds = unresolvedSteps
      .map((step) => targetSnapshotForStep(step)?.targetId)
      .filter(Boolean);
    const diagnosticCodes = diagnostics
      .map((diagnostic) => diagnostic.code)
      .filter(Boolean);
    failResult(
      result,
      "CAPTURE_FAILURE",
      "capture-evaluation",
      [
        "Capture manifest contains unresolved target evidence.",
        unresolvedIds.length > 0
          ? `Unresolved targets: ${[...new Set(unresolvedIds)].join(", ")}.`
          : undefined,
        diagnosticCodes.length > 0
          ? `Diagnostics: ${[...new Set(diagnosticCodes)].join(", ")}.`
          : undefined,
      ]
        .filter(Boolean)
        .join(" "),
    );
  }
}

function targetSnapshotForStep(step) {
  return step.targetSnapshot ?? step.target;
}

function evaluateTimelineBounds(result, manifest, timeline) {
  const width = manifest.viewport?.width ?? manifest.recording?.width ?? 0;
  const height = manifest.viewport?.height ?? manifest.recording?.height ?? 0;
  const boxes = [];
  for (const camera of timeline.camera ?? []) {
    if (camera.boundingBox)
      boxes.push({ source: "camera", box: camera.boundingBox });
  }
  for (const overlay of timeline.overlays ?? []) {
    if (overlay.boundingBox)
      boxes.push({ source: "overlay", box: overlay.boundingBox });
  }
  const outOfBounds = boxes.filter(({ box }) => {
    if (!box || !width || !height) return false;
    return (
      box.x < 0 ||
      box.y < 0 ||
      box.x + box.width > width ||
      box.y + box.height > height
    );
  });
  addRule(result, {
    id: "visualEvidenceWithinBounds",
    passed: outOfBounds.length === 0,
    score: boxes.length - outOfBounds.length,
    detail: `${outOfBounds.length}/${boxes.length} target boxes out of bounds.`,
  });
  if (outOfBounds.length > 0) {
    failResult(
      result,
      "VISUAL_QUALITY_FAILURE",
      "visual-evaluation",
      "Timeline target boxes exceed recorded viewport bounds.",
    );
  }
}

function addRule(result, rule) {
  result.rubric.rules.push(rule);
}

function finishResult(result) {
  const requiredFailures = result.rubric.rules.filter((rule) => !rule.passed);
  if (requiredFailures.length > 0 && result.classification === "success") {
    result.classification = "VISUAL_QUALITY_FAILURE";
    result.failures.push({
      classification: "VISUAL_QUALITY_FAILURE",
      stage: "rubric",
      message: `Rubric failures: ${requiredFailures.map((rule) => rule.id).join(", ")}.`,
    });
  }
  if (result.failures.length > 0) {
    result.status = "failed";
  } else {
    result.status = "passed";
    result.classification = "success";
  }
  const passedRules = result.rubric.rules.filter((rule) => rule.passed).length;
  result.rubric.score =
    result.rubric.rules.length > 0
      ? Number((passedRules / result.rubric.rules.length).toFixed(3))
      : 0;
  result.metrics.evaluationScore = Math.round(result.rubric.score * 100);
}

function failResult(result, classification, stage, message) {
  result.status = "failed";
  result.classification = classification;
  result.failures.push({ classification, stage, message });
}

async function runCliCommand({
  name,
  args,
  runDirectory,
  env = {},
  timeoutMs = commandTimeoutMs,
}) {
  const commandsDir = join(runDirectory, "commands");
  await mkdir(commandsDir, { recursive: true });
  const cliBin = join(repoRoot, "packages", "cli", "dist", "index.js");
  const startedAt = Date.now();
  return new Promise((resolveCommand) => {
    const child = spawn(process.execPath, [cliBin, ...args], {
      cwd: repoRoot,
      env: { ...process.env, ...env },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolveCommand({
        name,
        args,
        exitCode: 1,
        stdout,
        stderr: `${stderr}${error.message}`,
        durationMs: Date.now() - startedAt,
      });
    });
    child.on("close", async (exitCode, signal) => {
      clearTimeout(timer);
      const command = {
        name,
        args,
        exitCode: exitCode ?? 1,
        signal,
        stdout,
        stderr,
        durationMs: Date.now() - startedAt,
      };
      await writeFile(join(commandsDir, `${name}.stdout.txt`), stdout);
      await writeFile(join(commandsDir, `${name}.stderr.txt`), stderr);
      await writeFile(
        join(commandsDir, `${name}.json`),
        `${JSON.stringify(command, null, 2)}\n`,
      );
      resolveCommand(command);
    });
  });
}

function recordCommand(result, command) {
  result.commands.push({
    name: command.name,
    args: command.args,
    exitCode: command.exitCode,
    durationMs: command.durationMs,
  });
  result.metrics.commandsExecuted = result.commands.length;
  result.metrics.durationMs += command.durationMs;
}

function parseJsonOrUndefined(value) {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

async function persistResult(runDirectory, result) {
  const resultPath = join(runDirectory, "result.json");
  const compatibilityReportPath = join(runDirectory, "report.json");
  result.artifacts.result = resultPath;
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  await copyFile(resultPath, compatibilityReportPath);
}

function printSummary(result) {
  const status = result.status === "passed" ? "PASS" : "FAIL";
  console.log(
    `[${status}] ${result.scenarioId}: ${result.classification}, score ${result.metrics.evaluationScore}, mode ${result.workflowMode}`,
  );
  if (result.failures.length > 0) {
    for (const failure of result.failures) {
      console.log(`  - ${failure.stage}: ${failure.message}`);
    }
  }
  console.log(
    `  result: ${result.artifacts.result ?? result.artifacts.runDirectory}`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
