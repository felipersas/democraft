import type { CliResult } from "./types";

export function help(): string {
  return `democraft <command> <demo-module>

Commands:
  inspect   Compile a demo and print readable inspection output
  validate  Run static validation diagnostics
  capture   Run static validation, then execute the browser capture
  targets   List target contracts used by a demo
  timeline  Resolve a render timeline from a demo and capture manifest
  studio    Launch the Democraft Studio (Next.js preview + render UI)
  render    Render an MP4 from manifest and timeline
  preview   (Deprecated) Write a standalone HTML preview

Flags:
  --static             Required for validate in this milestone
  --json               Print JSON output
  --output-dir <path>  Capture output directory
  --manifest <path>    Capture manifest path for timeline
  --timeline <path>    Render timeline path for preview/render
  --output-file <path> Write generated artifact to a file
  --fps <number>       Timeline frames per second
  --scale <number>     Render scale multiplier (default 1, try 2 for sharper)
  --crf <number>       h264 CRF (default 15, lower = better quality)
  --port <number>      Studio dev server port (default 3000)
  --no-capture         Reuse existing capture for studio
  --headless           Run browser headless
  --headed             Run browser headed
  --entry <path>       Advanced Remotion entry override (normally generated from demo.ts)
`;
}

export function ok(stdout: string): CliResult {
  return { exitCode: 0, stdout, stderr: "" };
}

export function fail(stderr: string): CliResult {
  return { exitCode: 1, stdout: "", stderr };
}
