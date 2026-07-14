#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { parseArgs } from "./args";
import { formatDiagnostics } from "./format";
import { runCli } from "./run";
import type { CliResult } from "./types";

export type { CliResult };
export { parseArgs, formatDiagnostics, runCli };

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
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
