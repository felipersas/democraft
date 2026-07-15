#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./args";
import { formatDiagnostics } from "./format";
import { runCli } from "./run";
import type { CliResult } from "./types";

export type { CliResult };
export { parseArgs, formatDiagnostics, runCli };

if (isDirectInvocation()) {
  runCli()
    .then((result) => {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
      process.exitCode = result.exitCode;
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    });
}

function isDirectInvocation(): boolean {
  if (!process.argv[1]) return false;
  try {
    const invokedPath = realpathSync(process.argv[1]);
    const modulePath = realpathSync(fileURLToPath(import.meta.url));
    return invokedPath === modulePath;
  } catch {
    return false;
  }
}
