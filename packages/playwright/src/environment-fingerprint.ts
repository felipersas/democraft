import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { CaptureArtifactMetadata } from "@democraft/schema";
import {
  DEFAULT_SETTLE_STRATEGY,
  type RunDemoOptions,
  type SettleStrategy,
} from "./types";

export const CAPTURE_ENVIRONMENT_HASH_PREFIX = "capture-env-v1:sha256:";

export type CaptureRuntimeIdentity = {
  node: string;
  platform: string;
  arch: string;
  engine: "chromium";
};

export async function resolveCaptureEnvironment(
  options: Pick<RunDemoOptions, "environment" | "headless" | "timeoutMs"> = {},
  runtime: CaptureRuntimeIdentity = {
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    engine: "chromium",
  },
): Promise<{
  environment: CaptureArtifactMetadata["environment"];
  captureEnvironmentHash: string;
}> {
  const configured = options.environment ?? {};
  const settle = resolveSettleStrategy(configured.settle);
  const viewport = configured.viewport ?? { width: 1920, height: 1080 };
  const environment: CaptureArtifactMetadata["environment"] = {
    headless: options.headless ?? true,
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: configured.deviceScaleFactor ?? 2,
    locale: configured.locale ?? "en-US",
    timezone: configured.timezone ?? "UTC",
    settle: settle ?? false,
    timeoutMs: options.timeoutMs ?? 8000,
  };
  const storageStateHash = configured.storageState
    ? sha256(await readFile(configured.storageState))
    : null;
  const fingerprint = JSON.stringify({
    ...environment,
    storageStateHash,
    runtime: {
      node: runtime.node,
      platform: runtime.platform,
      arch: runtime.arch,
      engine: runtime.engine,
    },
  });
  return {
    environment,
    captureEnvironmentHash: `${CAPTURE_ENVIRONMENT_HASH_PREFIX}${sha256(fingerprint)}`,
  };
}

export function resolveSettleStrategy(
  settle: SettleStrategy | false | undefined,
): Required<SettleStrategy> | undefined {
  if (settle === false) return undefined;
  if (settle === undefined) return { ...DEFAULT_SETTLE_STRATEGY };
  return { ...DEFAULT_SETTLE_STRATEGY, ...settle };
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
