import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseArgs, runCli } from "./index";
import { jsonFail, jsonOk } from "./json";
import { runDoctorChecks, summarizeDoctor } from "./doctor";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

describe("discover command", () => {
  it("parses a positional URL and repeatable --allow-origin flags", () => {
    expect(
      parseArgs([
        "discover",
        "http://localhost:3000/dashboard",
        "--allow-origin",
        "http://localhost:3000",
        "--allow-origin",
        "http://localhost:3001",
        "--json",
      ]),
    ).toEqual({
      command: "discover",
      discoverUrl: "http://localhost:3000/dashboard",
      allowOrigins: ["http://localhost:3000", "http://localhost:3001"],
      json: true,
      staticOnly: false,
    });
  });

  it("reports a missing URL with a stable JSON contract and exit 2", async () => {
    const result = await runCli(["discover", "--json"]);
    expect(result.exitCode).toBe(2);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe("DC_DISCOVER_MISSING_URL");
    expect(result.stderr).toBe("");
  });

  it("reports a missing URL with a human message in non-json mode", async () => {
    const result = await runCli(["discover"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Missing page URL");
  });

  it("blocks a non-http(s) URL with exit 65 before any browser launch", async () => {
    const result = await runCli(["discover", "javascript:alert(1)", "--json"]);
    expect(result.exitCode).toBe(65);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe("DC402");
  });

  it("blocks an out-of-allowlist origin with exit 64", async () => {
    const result = await runCli([
      "discover",
      "http://evil.test/x",
      "--allow-origin",
      "http://localhost:3000",
      "--json",
    ]);
    expect(result.exitCode).toBe(64);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe("DC401");
  });

  it("shows command-specific help for discover", async () => {
    const result = await runCli(["discover", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("democraft discover <url>");
    expect(result.stdout).toContain("--allow-origin");
  });
});

describe("json emitter", () => {
  it("produces a stable success envelope on stdout with empty stderr", () => {
    const result = jsonOk({ discovery: { page: { url: "u" } }, runId: "r" });
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const parsed = JSON.parse(result.stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.runId).toBe("r");
  });

  it("produces a failure envelope with a stable code and diagnostics", () => {
    const result = jsonFail({
      code: "DC401",
      message: "blocked",
      exitCode: 64,
      diagnostics: [
        { code: "DC401", severity: "error", message: "blocked" },
      ],
    });
    expect(result.exitCode).toBe(64);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toMatchObject({
      ok: false,
      code: "DC401",
      message: "blocked",
    });
    expect(parsed.diagnostics).toHaveLength(1);
  });
});

describe("doctor checks", () => {
  it("reports ok for a healthy environment", () => {
    const checks = runDoctorChecks({
      nodeVersion: "v20.0.0",
      playwrightInstalled: true,
      chromiumExecutablePath: "/chromium",
      workspaceRootWritable: true,
      workspaceRoot: "/ws",
    });
    expect(checks.every((c) => c.status === "ok")).toBe(true);
    expect(summarizeDoctor(checks).status).toBe("ok");
  });

  it("flags an outdated Node as an error", () => {
    const checks = runDoctorChecks({
      nodeVersion: "v18.0.0",
      playwrightInstalled: true,
      chromiumExecutablePath: "/chromium",
      workspaceRootWritable: true,
      workspaceRoot: "/ws",
    });
    const node = checks.find((c) => c.id === "node-version")!;
    expect(node.status).toBe("error");
    expect(node.message).toContain("18");
  });

  it("flags missing Chromium distinctly from missing Playwright", () => {
    const noChromium = runDoctorChecks({
      nodeVersion: "v20.0.0",
      playwrightInstalled: true,
      chromiumExecutablePath: undefined,
      workspaceRootWritable: true,
      workspaceRoot: "/ws",
    });
    expect(noChromium.find((c) => c.id === "chromium")!.status).toBe("error");
    expect(noChromium.find((c) => c.id === "chromium")!.suggestion).toContain(
      "playwright install chromium",
    );

    const noPlaywright = runDoctorChecks({
      nodeVersion: "v20.0.0",
      playwrightInstalled: false,
      chromiumExecutablePath: undefined,
      workspaceRootWritable: true,
      workspaceRoot: "/ws",
    });
    expect(
      noPlaywright.find((c) => c.id === "playwright")!.status,
    ).toBe("error");
  });

  it("treats an unreachable app as a warning, not an error", () => {
    const checks = runDoctorChecks({
      nodeVersion: "v20.0.0",
      playwrightInstalled: true,
      chromiumExecutablePath: "/chromium",
      workspaceRootWritable: true,
      workspaceRoot: "/ws",
      appReachable: { url: "http://localhost:4173", ok: false },
    });
    const app = checks.find((c) => c.id === "app-reachable")!;
    expect(app.status).toBe("warning");
    expect(summarizeDoctor(checks)).toMatchObject({
      status: "warning",
      errorCount: 0,
      warningCount: 1,
    });
  });

  it("parses Node major versions robustly", () => {
    const checks = (version: string) =>
      runDoctorChecks({
        nodeVersion: version,
        playwrightInstalled: true,
        chromiumExecutablePath: "/chromium",
        workspaceRootWritable: true,
        workspaceRoot: "/ws",
      });
    expect(checks("v20.11.1").find((c) => c.id === "node-version")!.status).toBe(
      "ok",
    );
    expect(checks("22.0.0").find((c) => c.id === "node-version")!.status).toBe(
      "ok",
    );
    expect(
      checks("garbage").find((c) => c.id === "node-version")!.status,
    ).toBe("warning");
  });
});

describe("doctor command", () => {
  it("shows command-specific help", async () => {
    const result = await runCli(["doctor", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("democraft doctor");
    expect(result.stdout).toContain("--url");
  });
});

describe("inspect --estimate", () => {
  it("parses the --estimate flag", () => {
    expect(parseArgs(["inspect", "demo.ts", "--estimate", "--json"])).toMatchObject({
      command: "inspect",
      estimate: true,
      json: true,
    });
  });

  it("returns a duration estimate without rendering or capturing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "democraft-cli-estimate-"));
    tempDirs.push(dir);
    const demoPath = join(dir, "demo.mjs");
    const coreModule = resolve(
      process.cwd(),
      "../../packages/core/dist/index.js",
    );
    await writeFile(
      demoPath,
      `
import {defineDemo, defineTargets, byTestId} from "${coreModule}";
const targets = defineTargets({card: byTestId("card")});
export default defineDemo({
  id: "estimate-fixture",
  title: "Estimate",
  source: {baseUrl: "http://localhost:3000"},
  targets,
  async run({demo}) {
    await demo.scene("intro", async (scene) => {
      await scene.goto("/");
      await scene.establish("card");
      await scene.caption("Welcome to the demo.");
      await scene.hold("1500ms");
    });
  }
});
`,
    );

    const result = await runCli(["inspect", demoPath, "--estimate", "--json"]);
    expect(result.exitCode).toBe(0);
    const estimate = JSON.parse(result.stdout);
    // goto(900) + establish(700) + caption(max(1200, 19*45=855)=1200) + hold(1500) = 4300ms
    expect(estimate.totalMs).toBe(4300);
    expect(estimate.totalSeconds).toBe(4.3);
    expect(estimate.scenes).toHaveLength(1);
    expect(estimate.scenes[0]?.sceneId).toBe("intro");
  });

  it("preserves the bare-IR shape for plain inspect --json (back-compat)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "democraft-cli-inspect-"));
    tempDirs.push(dir);
    const demoPath = join(dir, "demo.mjs");
    const coreModule = resolve(
      process.cwd(),
      "../../packages/core/dist/index.js",
    );
    await writeFile(
      demoPath,
      `
import {defineDemo, defineTargets, byTestId} from "${coreModule}";
const targets = defineTargets({card: byTestId("card")});
export default defineDemo({
  id: "bare-ir",
  title: "Bare",
  source: {baseUrl: "http://localhost:3000"},
  targets,
  async run({demo}) {
    await demo.scene("intro", async (scene) => {
      await scene.goto("/");
    });
  }
});
`,
    );

    const result = await runCli(["inspect", demoPath, "--json"]);
    expect(result.exitCode).toBe(0);
    const ir = JSON.parse(result.stdout);
    // Bare IR at the top level (no wrapper), back-compat with existing consumers.
    expect(ir.id).toBe("bare-ir");
    expect(ir.estimatedDuration).toBeUndefined();
  });
});
