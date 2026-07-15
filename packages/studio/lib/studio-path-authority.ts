import { realpath } from "node:fs/promises";
import path from "node:path";
import { PathBoundaryError, resolveExistingPathWithin } from "./path-boundary";

const WORKSPACE_ENV = "DEMOCRAFT_STUDIO_WORKSPACE_ROOT";
const DEMO_ENV = "DEMOCRAFT_STUDIO_DEMO_PATH";
const EXPLICIT_CAPTURE_ENV = "DEMOCRAFT_STUDIO_EXPLICIT_CAPTURE_DIR";
const CAPTURE_ENVIRONMENT_HASH_ENV =
  "DEMOCRAFT_STUDIO_CAPTURE_ENVIRONMENT_HASH";
const CAPTURE_HEADLESS_ENV = "DEMOCRAFT_STUDIO_CAPTURE_HEADLESS";

export async function trustedWorkspaceRoot(): Promise<string> {
  return canonicalEnvDirectory(WORKSPACE_ENV, "Studio workspace root");
}

export async function trustedDataDirectory(): Promise<string> {
  return canonicalEnvDirectory(
    "DEMOCRAFT_STUDIO_DATA",
    "Studio data directory",
  );
}

/** The exact canonical demo selected by the CLI at process launch. */
export async function trustedDemoPath(): Promise<string> {
  const configured = requiredEnv(DEMO_ENV, "trusted demo path");
  const canonical = await resolveExistingPathWithin(
    path.dirname(configured),
    configured,
    "Trusted launch demo",
  );
  if (canonical !== path.resolve(configured)) {
    throw new PathBoundaryError(
      `Trusted launch demo changed after Studio startup: ${configured}`,
    );
  }
  return canonical;
}

/** Exact user-authorized output directory, if Studio launched with --output-dir. */
export function trustedExplicitCaptureDirectory(): string | undefined {
  const configured = process.env[EXPLICIT_CAPTURE_ENV]?.trim();
  return configured ? path.resolve(configured) : undefined;
}

export function trustedCaptureEnvironmentHash(): string {
  const configured = requiredEnv(
    CAPTURE_ENVIRONMENT_HASH_ENV,
    "capture environment hash",
  );
  if (!/^capture-env-v1:sha256:[a-f0-9]{64}$/.test(configured)) {
    throw new PathBoundaryError("Invalid capture environment hash.");
  }
  return configured;
}

export function trustedCaptureHeadless(): boolean {
  const configured = requiredEnv(CAPTURE_HEADLESS_ENV, "capture headless mode");
  if (configured === "true") return true;
  if (configured === "false") return false;
  throw new PathBoundaryError("Invalid capture headless mode.");
}

async function canonicalEnvDirectory(name: string, label: string) {
  const configured = requiredEnv(name, label.toLowerCase());
  const canonical = await realpath(configured);
  if (canonical !== path.resolve(configured)) {
    throw new PathBoundaryError(
      `${label} changed after Studio startup: ${configured}`,
    );
  }
  return canonical;
}

function requiredEnv(name: string, label: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new PathBoundaryError(
      `Missing ${label}. Launch Studio through the Democraft CLI.`,
    );
  }
  return value;
}
