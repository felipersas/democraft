import type { ParsedArgs } from "./types";

export function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...tokens] = argv;
  const parsed: ParsedArgs = {
    command,
    demoPath: undefined,
    parseError: undefined,
    json: false,
    staticOnly: false,
  };

  if (command === "auth" && tokens[0] && !tokens[0].startsWith("-")) {
    parsed.authCommand = tokens.shift() as ParsedArgs["authCommand"];
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const flag = tokens[index];

    if (!flag.startsWith("-") && command === "auth") {
      if (!parsed.profileId) {
        parsed.profileId = flag;
        continue;
      }
      parsed.parseError = `Unexpected argument "${flag}".`;
      break;
    } else if (!flag.startsWith("-") && command === "discover") {
      // `discover` takes a positional URL, not a demo path.
      if (!parsed.discoverUrl) {
        parsed.discoverUrl = flag;
        continue;
      }
      parsed.parseError = `Unexpected argument "${flag}".`;
      break;
    } else if (!flag.startsWith("-")) {
      if (!parsed.demoPath) {
        parsed.demoPath = flag;
        continue;
      }
      parsed.parseError = `Unexpected argument "${flag}".`;
      break;
    }

    const readValue = (): string | undefined => {
      const value = tokens[index + 1];
      if (!value || value.startsWith("-")) {
        parsed.parseError = `Missing value for "${flag}".`;
        return undefined;
      }
      index += 1;
      return value;
    };

    if (flag === "--json") parsed.json = true;
    else if (flag === "--help" || flag === "-h") parsed.helpRequested = true;
    else if (flag === "--static") parsed.staticOnly = true;
    else if (flag === "--estimate") parsed.estimate = true;
    else if (flag === "--headed") parsed.headless = false;
    else if (flag === "--headless") parsed.headless = true;
    else if (flag === "--allow-origin") {
      // Repeatable: each occurrence extends the discovery allowlist.
      const value = readValue();
      if (value !== undefined) {
        parsed.allowOrigins = [...(parsed.allowOrigins ?? []), value];
      }
    } else if (flag === "--url") {
      parsed.doctorUrl = readValue();
    } else if (flag === "--manifest") {
      parsed.manifestPath = readValue();
    } else if (flag === "--timeline") {
      parsed.timelinePath = readValue();
    } else if (["--output-file", "--output", "-o"].includes(flag)) {
      parsed.outputFile = readValue();
    } else if (flag === "--fps") {
      const value = readValue();
      if (value !== undefined) parsed.fps = Number(value);
    } else if (flag === "--output-dir") {
      parsed.outputDir = readValue();
    } else if (flag === "--scale") {
      const value = readValue();
      if (value !== undefined) parsed.scale = Number(value);
    } else if (flag === "--crf") {
      const value = readValue();
      if (value !== undefined) parsed.crf = Number(value);
    } else if (flag === "--port") {
      const value = readValue();
      if (value !== undefined) parsed.port = Number(value);
    } else if (flag === "--no-capture") {
      parsed.noCapture = true;
    } else if (flag === "--storage-state") {
      parsed.storageState = readValue();
    } else if (flag === "--name") {
      parsed.name = readValue();
    } else if (flag === "--origin") {
      parsed.origin = readValue();
    } else if (flag === "--validation-url") {
      parsed.validationUrl = readValue();
    } else if (flag === "--selector") {
      parsed.selector = readValue();
    } else if (flag === "--force") {
      parsed.force = true;
    } else if (flag === "--recording") {
      parsed.useRecording = true;
    } else if (flag === "--entry") {
      parsed.entryPath = readValue();
    } else if (flag.startsWith("-")) {
      parsed.parseError = `Unknown option "${flag}".`;
    } else {
      parsed.parseError = `Unexpected argument "${flag}".`;
    }

    if (parsed.parseError) break;
  }

  return parsed;
}
