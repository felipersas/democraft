import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import type { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import { diagnosticSchema, parseDemoIR } from "@democraft/schema";
import type { CompilationResult } from "@democraft/compiler";

const MAX_RESULT_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const require = createRequire(import.meta.url);
const COMPILER_MODULE_URL = pathToFileURL(
  require.resolve("@democraft/compiler"),
).href;

const CHILD_SOURCE = String.raw`
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const send = (value) => writeFileSync(3, JSON.stringify(value));
try {
  const [{ compileDemo }, imported] = await Promise.all([
    import(process.env.DEMOCRAFT_COMPILER_MODULE),
    import(pathToFileURL(process.env.DEMOCRAFT_DEMO_MODULE).href),
  ]);
  if (!imported.default) throw new Error("Demo module must have a default export.");
  send({ ok: true, result: await compileDemo(imported.default) });
} catch (error) {
  send({ ok: false, error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
}
`;

/** Compile in a fresh process so the complete transitive ESM graph is fresh. */
export async function compileDemoModuleIsolated(
  demoPath: string,
  options: { cwd?: string; timeoutMs?: number } = {},
): Promise<CompilationResult> {
  const child = spawn(
    process.execPath,
    ["--input-type=module", "--eval", CHILD_SOURCE],
    {
      cwd: options.cwd ?? process.cwd(),
      env: {
        ...process.env,
        DEMOCRAFT_DEMO_MODULE: demoPath,
        DEMOCRAFT_COMPILER_MODULE: COMPILER_MODULE_URL,
      },
      stdio: ["ignore", "ignore", "pipe", "pipe"],
    },
  );
  const resultStream = child.stdio[3] as Readable | null;
  const errorStream = child.stderr as Readable | null;
  if (!resultStream || !errorStream) {
    child.kill();
    throw new Error("Could not open the isolated compiler result channel.");
  }

  let result = "";
  let stderr = "";
  let outputExceeded = false;
  resultStream.setEncoding("utf8");
  errorStream.setEncoding("utf8");
  resultStream.on("data", (chunk: string) => {
    if (result.length + chunk.length > MAX_RESULT_BYTES) outputExceeded = true;
    else result += chunk;
  });
  errorStream.on("data", (chunk: string) => {
    if (stderr.length + chunk.length > MAX_RESULT_BYTES) outputExceeded = true;
    else stderr += chunk;
  });

  const timeout = setTimeout(
    () => child.kill("SIGKILL"),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  const code = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  }).finally(() => clearTimeout(timeout));
  if (outputExceeded) {
    throw new Error("Isolated compiler output exceeded 5 MiB.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(result);
  } catch {
    throw new Error(
      `Isolated demo compilation produced no valid result${stderr ? `: ${stderr}` : "."}`,
    );
  }
  if (!isSuccess(payload)) {
    const message = isFailure(payload)
      ? payload.error
      : stderr || `compiler exited with code ${code}`;
    throw new Error(`Isolated demo compilation failed: ${message}`);
  }
  return {
    ir: parseDemoIR(payload.result.ir),
    config: parseCompiledConfig(payload.result.config),
    diagnostics: diagnosticSchema.array().parse(payload.result.diagnostics),
  };
}

function parseCompiledConfig(value: unknown): CompilationResult["config"] {
  if (!value || typeof value !== "object" || !("fps" in value)) return {};
  const fps = value.fps;
  if (typeof fps !== "number" || !Number.isFinite(fps) || fps <= 0) {
    throw new Error("Isolated compiler returned an invalid config fps.");
  }
  return { fps };
}

function isSuccess(
  value: unknown,
): value is { ok: true; result: CompilationResult } {
  return Boolean(
    value &&
    typeof value === "object" &&
    "ok" in value &&
    value.ok === true &&
    "result" in value,
  );
}

function isFailure(value: unknown): value is { ok: false; error: string } {
  return Boolean(
    value &&
    typeof value === "object" &&
    "ok" in value &&
    value.ok === false &&
    "error" in value &&
    typeof value.error === "string",
  );
}
