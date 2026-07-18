/**
 * `democraft doctor` — environment health checks.
 *
 * Pure, injectable logic so every check is unit-testable without spawning the
 * binary. The CLI wrapper (`./run.ts`) supplies the environment probes; this
 * module owns the check definitions, severities, and diagnostic codes.
 *
 * Each check yields a stable result the `--json` envelope surfaces:
 *   { id, status: "ok"|"warning"|"error", code, message, suggestion? }
 */
import { diagnosticCodes } from "@democraft/schema";

export type DoctorCheckStatus = "ok" | "warning" | "error";

export type DoctorCheck = {
  id: string;
  status: DoctorCheckStatus;
  /** Stable `DCxxxx` diagnostic code (the `DC405` environment family). */
  code: string;
  message: string;
  suggestion?: string;
};

export type DoctorEnvironment = {
  nodeVersion: string;
  playwrightInstalled: boolean;
  chromiumExecutablePath?: string;
  workspaceRootWritable: boolean;
  workspaceRoot: string;
  appReachable?: { url: string; ok: boolean };
};

export type DoctorOptions = {
  /** Minimum required Node major version (default 20). */
  minNodeMajor?: number;
};

/**
 * Run every doctor check against the supplied environment. Never throws —
 * every problem becomes a `DoctorCheck` so the caller can run all checks
 * before reporting (plan §10.1: "run all checks before exiting").
 */
export function runDoctorChecks(
  env: DoctorEnvironment,
  options: DoctorOptions = {},
): DoctorCheck[] {
  const minNodeMajor = options.minNodeMajor ?? 20;
  const checks: DoctorCheck[] = [];

  checks.push(checkNodeVersion(env.nodeVersion, minNodeMajor));
  checks.push(checkPlaywrightPresent(env.playwrightInstalled));
  checks.push(checkChromium(env));
  checks.push(checkWorkspaceWritable(env));
  if (env.appReachable) {
    checks.push(checkAppReachable(env.appReachable));
  }

  return checks;
}

export function summarizeDoctor(checks: DoctorCheck[]): {
  status: DoctorCheckStatus;
  errorCount: number;
  warningCount: number;
} {
  const errorCount = checks.filter((c) => c.status === "error").length;
  const warningCount = checks.filter((c) => c.status === "warning").length;
  const status: DoctorCheckStatus =
    errorCount > 0 ? "error" : warningCount > 0 ? "warning" : "ok";
  return { status, errorCount, warningCount };
}

function checkNodeVersion(version: string, minMajor: number): DoctorCheck {
  const major = parseNodeMajor(version);
  if (major === null) {
    return {
      id: "node-version",
      status: "warning",
      code: diagnosticCodes.discoveryEnvironment,
      message: `Could not parse Node version "${version}".`,
      suggestion: `Ensure Node.js >= ${minMajor} is installed and on PATH.`,
    };
  }
  if (major < minMajor) {
    return {
      id: "node-version",
      status: "error",
      code: diagnosticCodes.discoveryEnvironment,
      message: `Node ${version} is older than the required >= ${minMajor}.`,
      suggestion: `Upgrade Node.js to ${minMajor} or newer.`,
    };
  }
  return {
    id: "node-version",
    status: "ok",
    code: diagnosticCodes.discoveryEnvironment,
    message: `Node ${version} meets the >= ${minMajor} requirement.`,
  };
}

function checkPlaywrightPresent(installed: boolean): DoctorCheck {
  if (!installed) {
    return {
      id: "playwright",
      status: "error",
      code: diagnosticCodes.discoveryEnvironment,
      message: "The `playwright` package is not installed.",
      suggestion: "Run `pnpm install` (or `npm install`) in the workspace.",
    };
  }
  return {
    id: "playwright",
    status: "ok",
    code: diagnosticCodes.discoveryEnvironment,
    message: "The `playwright` package is installed.",
  };
}

function checkChromium(env: DoctorEnvironment): DoctorCheck {
  if (!env.playwrightInstalled) {
    return {
      id: "chromium",
      status: "error",
      code: diagnosticCodes.discoveryEnvironment,
      message: "Chromium cannot be resolved without Playwright.",
      suggestion: "Install Playwright first.",
    };
  }
  if (!env.chromiumExecutablePath) {
    return {
      id: "chromium",
      status: "error",
      code: diagnosticCodes.discoveryEnvironment,
      message: "Chromium is not installed for Playwright.",
      suggestion: "Run `pnpm exec playwright install chromium`.",
    };
  }
  return {
    id: "chromium",
    status: "ok",
    code: diagnosticCodes.discoveryEnvironment,
    message: `Chromium available at ${env.chromiumExecutablePath}.`,
  };
}

function checkWorkspaceWritable(env: DoctorEnvironment): DoctorCheck {
  if (!env.workspaceRootWritable) {
    return {
      id: "workspace-writable",
      status: "error",
      code: diagnosticCodes.discoveryEnvironment,
      message: `Workspace root ${env.workspaceRoot} is not writable.`,
      suggestion: "Check directory permissions for the workspace root.",
    };
  }
  return {
    id: "workspace-writable",
    status: "ok",
    code: diagnosticCodes.discoveryEnvironment,
    message: `Workspace root ${env.workspaceRoot} is writable.`,
  };
}

function checkAppReachable(target: {
  url: string;
  ok: boolean;
}): DoctorCheck {
  if (!target.ok) {
    return {
      id: "app-reachable",
      status: "warning",
      code: diagnosticCodes.discoveryEnvironment,
      message: `Application at ${target.url} did not respond.`,
      suggestion: "Start the target application before capturing or discovering.",
    };
  }
  return {
    id: "app-reachable",
    status: "ok",
    code: diagnosticCodes.discoveryEnvironment,
    message: `Application at ${target.url} responded.`,
  };
}

function parseNodeMajor(version: string): number | null {
  const match = version.match(/v?(\d+)\./);
  if (!match) return null;
  const major = Number(match[1]);
  return Number.isFinite(major) ? major : null;
}
