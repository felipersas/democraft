#!/usr/bin/env node
/**
 * Agent-authoring eval harness.
 *
 * Boots a scenario's target-app, runs `democraft discover <url> --json`, and
 * scores the Page Discovery output against the scenario's rubric. The harness
 * does NOT drive a live agent in MVP — it verifies the discovery contract the
 * agent would consume, so evals are deterministic and CI-runnable. A `--live`
 * mode (drive a real agent through discover → validate → capture → render) is
 * documented but gated behind a flag for scheduled, non-deterministic runs.
 *
 * Usage:
 *   node evals/harness/run-eval.mjs <scenario-dir> [--port 0]
 *
 * Output: writes a scored report to
 *   evals/results/<scenario>/<run-id>/report.json
 * and prints a one-line summary. Exits non-zero when a "must" rubric rule
 * fails, so CI can gate on regression.
 */
import { createServer } from "node:http";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

async function main() {
  const scenarioDir = process.argv[2];
  if (!scenarioDir) {
    console.error("Usage: run-eval.mjs <scenario-dir> [--port <n>]");
    process.exit(2);
  }
  const absoluteScenario = resolve(process.cwd(), scenarioDir);
  const scenarioName = absoluteScenario.split("/").filter(Boolean).pop();
  const portFlagIndex = process.argv.indexOf("--port");
  const port = portFlagIndex > 0 ? Number(process.argv[portFlagIndex + 1]) : 0;

  const rubric = JSON.parse(
    await readFile(join(absoluteScenario, "rubric.json"), "utf8"),
  );
  const targetApp = JSON.parse(
    await readFile(join(absoluteScenario, "target-app", "app.json"), "utf8"),
  );

  const { port: actualPort, server } = await bootTargetApp(targetApp, port);
  try {
    const url = `http://localhost:${actualPort}/`;
    const discovery = await runDiscover(url);
    const report = scoreScenario(scenarioName, url, discovery, rubric);
    await persistReport(scenarioName, report);
    printSummary(report);
    process.exit(report.passed ? 0 : 1);
  } finally {
    server.close();
  }
}

/**
 * Boot the scenario's target-app from its declarative `app.json` spec. The
 * spec lists regions + elements so each eval is self-contained (no separate
 * server file per scenario). HTML is generated deterministically from the
 * spec — the same spec always produces the same DOM, so discovery is stable.
 */
async function bootTargetApp(spec, requestedPort) {
  const html = renderSpecHtml(spec);
  const server = createServer((req, res) => {
    if (req.url === "/" || req.url === "/index.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  });
  return new Promise((resolve) => {
    server.listen(requestedPort, () => {
      const { port } = server.address();
      resolve({ port, server });
    });
  });
}

function renderSpecHtml(spec) {
  const regions = (spec.regions ?? [])
    .map((region) => {
      const tag = regionTag(region.kind);
      const attrs = region.label
        ? ` aria-label="${escapeAttr(region.label)}"`
        : "";
      const inner = (region.elements ?? [])
        .map((el) => renderElement(el))
        .join("\n");
      return `<${tag}${attrs}>\n${inner}\n</${tag}>`;
    })
    .join("\n");
  const collection = spec.collection ? renderCollection(spec.collection) : "";
  const dialogs = (spec.dialogs ?? [])
    .map((dialog) => renderDialog(dialog))
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeText(spec.title ?? "Eval app")}</title>
<style>body{font-family:system-ui;margin:0;padding:24px}h1{font-size:24px}dialog[open]{position:static;margin:24px 0;padding:18px;border:1px solid #bbb}</style>
</head>
<body>
${regions}
${collection}
${dialogs}
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
    default:
      return "section";
  }
}

function renderElement(el) {
  const testId = el.testId ? ` data-testid="${escapeAttr(el.testId)}"` : "";
  switch (el.kind) {
    case "heading":
      return `<h1${testId}>${escapeText(el.name)}</h1>`;
    case "button":
      return `<button${testId}>${escapeText(el.name)}</button>`;
    case "link":
      return `<a href="#"${testId}>${escapeText(el.name)}</a>`;
    case "textbox":
      return `<label>${escapeText(el.label)}<input type="text"${testId}></label>`;
    case "checkbox":
      return `<label><input type="checkbox"${testId}>${escapeText(el.label ?? el.name)}</label>`;
    default:
      return `<span${testId}>${escapeText(el.name ?? "")}</span>`;
  }
}

function renderDialog(dialog) {
  const label = dialog.label ? ` aria-label="${escapeAttr(dialog.label)}"` : "";
  const inner = (dialog.elements ?? [])
    .map((el) => renderElement(el))
    .join("\n");
  return `<dialog open${label}>\n${inner}\n</dialog>`;
}

function renderCollection(collection) {
  const count = collection.count ?? 12;
  const items = Array.from({ length: count }, (_, i) => {
    const title = collection.itemName
      ? collection.itemName.replace("{n}", String(i + 1))
      : `Item ${i + 1}`;
    return `<article><h2>${escapeText(title)}</h2><p>Details for ${escapeText(
      title,
    )}.</p></article>`;
  }).join("\n");
  return `<main aria-label="${escapeAttr(collection.label ?? "Items")}">\n${items}\n</main>`;
}

function escapeText(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(s) {
  return escapeText(s).replace(/"/g, "&quot;");
}

/**
 * Run `democraft discover` against the booted app. Resolves with the parsed
 * PageDiscovery (the `discovery` field of the JSON envelope).
 *
 * Uses async `spawn` (NOT `spawnSync`): the target-app HTTP server lives in
 * this process, and `spawnSync` would block the event loop and freeze the
 * server, causing Playwright's `page.goto` to time out.
 */
async function runDiscover(url) {
  const { spawn } = await import("node:child_process");
  const cliBin = join(repoRoot, "packages", "cli", "dist", "index.js");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliBin, "discover", url, "--json"], {
      cwd: repoRoot,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (status) => {
      if (status !== 0) {
        reject(
          new Error(`discover failed (exit ${status}): ${stderr || stdout}`),
        );
        return;
      }
      try {
        const envelope = JSON.parse(stdout);
        if (!envelope.ok) {
          reject(new Error(`discover returned ok=false: ${envelope.message}`));
          return;
        }
        resolve(envelope.discovery);
      } catch {
        reject(new Error(`discover returned non-JSON output: ${stdout}`));
      }
    });
  });
}

/**
 * Score the discovery output against the rubric. Each rule yields a
 * { id, passed, detail } entry; the scenario passes only if every "must"
 * rule passes. Deterministic: same discovery + rubric → same score.
 */
function scoreScenario(name, url, discovery, rubric) {
  const rules = [];

  const elements = discovery.elements ?? [];

  // Semantic-locator ratio: the fraction of elements whose TOP candidate
  // (the one an agent would actually use) is semantic (role/label/testId),
  // not text. Counting every candidate would penalize the legitimate practice
  // of offering a text fallback alongside a semantic primary.
  const withCandidates = elements.filter(
    (e) => (e.locatorCandidates ?? []).length > 0,
  );
  const semanticPrimary = withCandidates.filter((e) => {
    const top = e.locatorCandidates[0];
    return ["role", "label", "testId"].includes(top.locator.kind);
  });
  const semanticRatio =
    withCandidates.length > 0
      ? semanticPrimary.length / withCandidates.length
      : 0;

  rules.push({
    id: "minimumSemanticLocatorRatio",
    passed: semanticRatio >= (rubric.minimumSemanticLocatorRatio ?? 0),
    detail: `${semanticPrimary.length}/${withCandidates.length} elements have a semantic primary locator (ratio ${semanticRatio.toFixed(2)}, min ${rubric.minimumSemanticLocatorRatio ?? 0})`,
  });

  rules.push({
    id: "mustHaveNoEmptyElements",
    passed: elements.every(
      (e) =>
        Array.isArray(e.locatorCandidates) && e.locatorCandidates.length > 0,
    ),
    detail: `${elements.length} elements, all with at least one candidate`,
  });

  rules.push({
    id: "mustExposeSchemaVersion",
    passed: discovery.schemaVersion === 1,
    detail: `schemaVersion ${discovery.schemaVersion}`,
  });

  rules.push({
    id: "mustUseCollectionSampling",
    passed: !rubric.mustUseCollectionSampling
      ? true
      : (discovery.collections ?? []).length > 0 &&
        (discovery.collections ?? []).every(
          (c) => c.sampleElementIds.length < c.count,
        ),
    detail: `${(discovery.collections ?? []).length} collections aggregated`,
  });

  rules.push({
    id: "mustNotUseUnsafeExploration",
    passed: (discovery.warnings ?? []).every(
      (w) => w.code !== "DC402" && w.code !== "DC401",
    ),
    detail: `${(discovery.warnings ?? []).length} warnings, none unsafe-exploration`,
  });

  const passed = rules.every((r) => r.passed);
  return {
    scenario: name,
    url,
    generatedAt: discovery.generatedAt,
    passed,
    semanticLocatorRatio: Number(semanticRatio.toFixed(3)),
    elementCount: elements.length,
    collectionCount: (discovery.collections ?? []).length,
    warningCount: (discovery.warnings ?? []).length,
    rules,
    discovery,
  };
}

async function persistReport(scenarioName, report) {
  const runId = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .concat(`-${randomBytes(4).toString("hex")}`);
  const dir = join(repoRoot, "evals", "results", scenarioName, runId);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  return dir;
}

function printSummary(report) {
  const status = report.passed ? "PASS" : "FAIL";
  console.log(
    `[${status}] ${report.scenario}: ${report.elementCount} elements, ` +
      `semantic ratio ${report.semanticLocatorRatio}, ` +
      `${report.collectionCount} collections`,
  );
  for (const rule of report.rules) {
    if (!rule.passed) {
      console.log(`  ✗ ${rule.id}: ${rule.detail}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
