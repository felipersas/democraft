import type { CliResult } from "./types";

export function help(command?: string): string {
  if (command === "auth") {
    return `democraft auth <command> [profile-id] [options]

Manage reusable local authentication profiles.

Commands:
  create    Create profile metadata (--name and --origin required)
  list      List profiles and their session status
  login     Open a headed browser; press Enter after completing login
  validate  Validate a saved session against its protected URL
  rename    Rename a profile (--name required)
  remove    Remove a profile (--force when associated with a demo)

Options:
  --name <name>              Profile display name
  --origin <url>             Application origin
  --validation-url <url>     Protected URL (defaults to origin)
  --selector <selector>      Element expected after login
  --force                    Confirm removal of an in-use profile
  --json                     Emit stable machine-readable JSON
`;
  }
  if (command === "discover") {
    return `democraft discover <url> [options]

Produce a semantic Page Discovery map of a live page (read-only snapshot).

The map lists interactive elements, landmark regions, repeated collections,
and best-first locator candidates — the input agents use to author demo.ts.

Options:
  --allow-origin <origin>   Permit an additional origin (repeatable)
  --headless                Run the browser headless (default)
  --headed                  Show the browser
  --json                    Emit stable machine-readable JSON

Exit codes:
  0 ok · 2 missing URL · 64 origin blocked · 65 unsafe scheme
  66 timeout · 130 aborted (Ctrl+C)

Discovery is read-only: it never clicks, fills, or navigates beyond the URL.
`;
  }
  if (command === "doctor") {
    return `democraft doctor [options]

Check that the environment is ready to author, capture, and discover demos.

Checks: Node version, Playwright + Chromium, workspace writability, and
(when --url is given) target-application reachability.

Options:
  --url <url>     Also check that the target application responds
  --json          Emit stable machine-readable JSON

Exit codes: 0 all checks ok · 1 at least one error
`;
  }
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
  auth      Manage reusable authentication profiles

Other commands:
  inspect   Compile a demo and print readable inspection output (--estimate for duration)
  capture   Run static validation, then execute the browser capture
  targets   List target contracts used by a demo
  timeline  Resolve a render timeline from a demo and capture manifest
  discover  Map a live page into a semantic Page Discovery JSON (read-only)
  doctor    Check the environment is ready to author, capture, discover
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
  --storage-state <p>  Playwright storageState for authenticated captures
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
