import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve, dirname } from "node:path";

/**
 * Resolve a path the way the user expects, regardless of how `pnpm --filter`
 * shuffled the cwd. Two conventions work:
 *
 *   1. workspace-root-relative (`examples/demo-app/src/demo.ts`)
 *   2. cwd-relative (`../../examples/demo-app/src/demo.ts` — the old style)
 *
 * We try workspace root first; if that file doesn't exist, we fall back to
 * the actual cwd. For absolute paths, we return them as-is.
 */
export function userResolve(p: string): string {
  if (isAbsolute(p)) return p;
  const fromRoot = resolve(invocationRoot(), p);
  if (existsSync(fromRoot)) return fromRoot;
  return resolve(process.cwd(), p);
}

/**
 * The directory to use for `.democraft/` artifacts. Prefers the user's
 * invocation directory (workspace root) over the package directory.
 */
export function workspaceRoot(): string {
  return invocationRoot();
}

function invocationRoot(): string {
  const detected = findWorkspaceRoot(process.cwd());
  if (detected) return detected;
  if (process.env.INIT_CWD && process.env.INIT_CWD.trim() !== "") {
    return process.env.INIT_CWD;
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
      (existsSync(`${dir}/package.json`) && hasWorkspaces(`${dir}/package.json`))
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
