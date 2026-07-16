import type { CliResult } from "./types";

export function help(command?: string): string {
  if (command === "render") {
    return `democraft render [demo.ts] [options]

Capture the demo, resolve its timeline, and render an MP4.

The demo path is optional when demo.ts or src/demo.ts is unambiguous.

Options:
  -o, --output <path>    Write the MP4 to this path
  --fps <number>         Timeline frames per second
  --scale <number>       Render scale multiplier (default 1)
  --crf <number>         h264 CRF (default 15, lower is better)
  --headed               Show the browser during capture
  --headless             Hide the browser during capture
  --recording            Render the raw browser recording

Advanced artifact mode:
  democraft render [demo.ts] --manifest <manifest.json> --timeline <timeline.json>
`;
  }

  return `democraft <command> [demo.ts] [options]

Common workflows:
  studio    Capture and open the interactive Studio
  render    Capture, resolve, and render an MP4
  validate  Validate a demo without opening a browser

Other commands:
  inspect   Compile a demo and print readable inspection output
  capture   Run static validation, then execute the browser capture
  targets   List target contracts used by a demo
  timeline  Resolve a render timeline from a demo and capture manifest
  preview   (Deprecated) Write a standalone HTML preview

The demo path is optional when demo.ts or src/demo.ts is unambiguous.

Common options:
  -o, --output <path>  Write the generated artifact to a file
  --json               Print JSON output
  --output-dir <path>  Capture output directory
  --fps <number>       Timeline frames per second
  --scale <number>     Render scale multiplier (default 1, try 2 for sharper)
  --crf <number>       h264 CRF (default 15, lower = better quality)
  --port <number>      Studio server port (default 3000)
  --no-capture         Reuse existing capture for studio
  --headless           Run browser headless
  --headed             Run browser headed

Run democraft <command> --help for command details.
`;
}

export function ok(stdout: string): CliResult {
  return { exitCode: 0, stdout, stderr: "" };
}

export function fail(stderr: string): CliResult {
  return { exitCode: 1, stdout: "", stderr };
}
