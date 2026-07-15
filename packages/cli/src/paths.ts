import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve, dirname } from "node:path";

/**
 * Resolve a path the way the user expects, regardless of how `pnpm --filter`
 * shuffled the cwd. Two conventions work:
 *
 *   1. workspace-root-relative (`examples/demo-app/src/demo.ts`)
 *   2. cwd-relative (`../../examples/demo-app/src/demo.ts` — the old style)
 *
 * We try the invocation directory first, then the containing workspace root
 * for compatibility with `pnpm --filter`, which changes the process cwd.
 */
export function userResolve(p: string): string {
  if (isAbsolute(p)) return p;
  const fromInvocation = resolve(invocationRoot(), p);
  if (existsSync(fromInvocation)) return fromInvocation;
  const detectedRoot = findWorkspaceRoot(process.cwd());
  const fromWorkspace = detectedRoot ? resolve(detectedRoot, p) : undefined;
  return fromWorkspace && existsSync(fromWorkspace)
    ? fromWorkspace
    : fromInvocation;
}

/**
 * The directory to use for `.democraft/` artifacts. Prefers the user's
 * invocation directory (workspace root) over the package directory.
 */
export function workspaceRoot(): string {
  return invocationRoot();
}

const CONVENTIONAL_DEMO_PATHS = [
  "demo.ts",
  "demo.tsx",
  "src/demo.ts",
  "src/demo.tsx",
] as const;

/** Resolve an explicit demo path or discover one unambiguous conventional file. */
export function resolveDemoPath(
  explicitPath?: string,
  root = invocationRoot(),
): string {
  if (explicitPath) {
    if (isAbsolute(explicitPath)) return explicitPath;
    const fromInvocation = resolve(root, explicitPath);
    if (existsSync(fromInvocation)) return fromInvocation;
    const detectedRoot = findWorkspaceRoot(root);
    const fromWorkspace = detectedRoot
      ? resolve(detectedRoot, explicitPath)
      : undefined;
    return fromWorkspace && existsSync(fromWorkspace)
      ? fromWorkspace
      : fromInvocation;
  }

  const matches = CONVENTIONAL_DEMO_PATHS.map((candidate) =>
    resolve(root, candidate),
  ).filter((candidate) => existsSync(candidate));

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(
      `Multiple demo modules found:\n${matches.map((match) => `  - ${match}`).join("\n")}\nPass the one to use explicitly.`,
    );
  }

  throw new Error(
    `No demo module found in ${root}.\nCreate demo.ts or src/demo.ts, or pass a path explicitly.`,
  );
}

function invocationRoot(): string {
  if (process.env.INIT_CWD && process.env.INIT_CWD.trim() !== "") {
    return resolve(process.env.INIT_CWD);
  }
  return process.cwd();
}

/**
 * Walk upward from `start`, returning the first directory that looks like a
 * workspace root. A workspace root has either `pnpm-workspace.yaml` or a
 * `package.json` with a `workspaces` field.
 */
function findWorkspaceRoot(start: string): string | undefined {
  let dir = start;
  for (let i = 0; i < 20; i += 1) {
    if (
      existsSync(`${dir}/pnpm-workspace.yaml`) ||
      (existsSync(`${dir}/package.json`) &&
        hasWorkspaces(`${dir}/package.json`))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

function hasWorkspaces(pkgJsonPath: string): boolean {
  try {
    const text = readFileSync(pkgJsonPath, "utf8");
    const pkg = JSON.parse(text) as { workspaces?: unknown };
    return Array.isArray(pkg.workspaces) || typeof pkg.workspaces === "string";
  } catch {
    return false;
  }
}
