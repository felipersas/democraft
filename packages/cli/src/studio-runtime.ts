import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

export const STUDIO_LOOPBACK_HOST = "127.0.0.1";

export type StudioRuntime = {
  command: string;
  args: string[];
  cwd: string;
  mode: "production" | "development";
};

export function createStudioRuntime(args: {
  studioDirectory: string;
  nextBin: string;
  port: number;
}): StudioRuntime {
  const productionBuild = existsSync(
    path.join(args.studioDirectory, ".next", "BUILD_ID"),
  );
  const sourceCheckout =
    existsSync(path.join(args.studioDirectory, "next.config.ts")) &&
    existsSync(path.join(args.studioDirectory, "app"));

  if (!productionBuild && !sourceCheckout) {
    throw new Error(
      `The installed @democraft/studio package at ${args.studioDirectory} does not contain a production build. Reinstall @democraft/cli or report a broken package release.`,
    );
  }

  const mode = productionBuild ? "production" : "development";
  return {
    command: process.execPath,
    args: [
      args.nextBin,
      mode === "production" ? "start" : "dev",
      "--hostname",
      STUDIO_LOOPBACK_HOST,
      "--port",
      String(args.port),
    ],
    cwd: args.studioDirectory,
    mode,
  };
}

export function resolveStudioRuntime(port: number): StudioRuntime {
  const cliRequire = createRequire(import.meta.url);
  let studioManifest: string;
  try {
    studioManifest = cliRequire.resolve("@democraft/studio/package.json");
  } catch (cause) {
    throw new Error(
      "Could not resolve @democraft/studio. Reinstall @democraft/cli so its Studio runtime dependency is present.",
      { cause },
    );
  }

  const studioDirectory = path.dirname(studioManifest);
  const studioRequire = createRequire(studioManifest);
  let nextBin: string;
  try {
    nextBin = studioRequire.resolve("next/dist/bin/next");
  } catch (cause) {
    throw new Error(
      "Could not resolve the Next.js runtime bundled with @democraft/studio. Reinstall @democraft/cli.",
      { cause },
    );
  }

  return createStudioRuntime({ studioDirectory, nextBin, port });
}
