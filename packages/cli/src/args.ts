import type { ParsedArgs } from "./types";

export function parseArgs(argv: string[]): ParsedArgs {
  const [command, maybeDemoPath, ...rest] = argv;
  const demoPath = maybeDemoPath?.startsWith("--") ? undefined : maybeDemoPath;
  const flags = demoPath ? rest : argv.slice(1);
  const parsed: ParsedArgs = {
    command,
    demoPath,
    json: false,
    staticOnly: false,
  };

  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];

    if (flag === "--json") parsed.json = true;
    else if (flag === "--static") parsed.staticOnly = true;
    else if (flag === "--headed") parsed.headless = false;
    else if (flag === "--headless") parsed.headless = true;
    else if (flag === "--manifest") {
      parsed.manifestPath = flags[index + 1];
      index += 1;
    } else if (flag === "--timeline") {
      parsed.timelinePath = flags[index + 1];
      index += 1;
    } else if (flag === "--output-file") {
      parsed.outputFile = flags[index + 1];
      index += 1;
    } else if (flag === "--fps") {
      parsed.fps = Number(flags[index + 1]);
      index += 1;
    } else if (flag === "--output-dir") {
      parsed.outputDir = flags[index + 1];
      index += 1;
    } else if (flag === "--scale") {
      parsed.scale = Number(flags[index + 1]);
      index += 1;
    } else if (flag === "--crf") {
      parsed.crf = Number(flags[index + 1]);
      index += 1;
    } else if (flag === "--port") {
      parsed.port = Number(flags[index + 1]);
      index += 1;
    } else if (flag === "--no-capture") {
      parsed.noCapture = true;
    } else if (flag === "--recording") {
      parsed.useRecording = true;
    } else if (flag === "--entry") {
      parsed.entryPath = flags[index + 1];
      index += 1;
    }
  }

  return parsed;
}
