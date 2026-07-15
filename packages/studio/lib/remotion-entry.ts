import { existsSync } from "node:fs";
import path from "node:path";
import { resolveExistingPathWithin } from "./path-boundary";
import { materializeDemoEntry } from "@democraft/remotion/server";

/**
 * Resolve the Remotion entry file (`registerRoot`) for bundling.
 *
 * Resolution order:
 * 1. If `userEntryPath` is provided (e.g. from `--entry` or a render job's
 *    `options.entryPath`), validate and return it — this lets users register
 *    custom visual components from their own entry file.
 * 2. If `demoPath` is provided, generate an entry from that author module.
 * 3. Otherwise, walk up from `process.cwd()` looking for
 *    `node_modules/@democraft/remotion/dist/entry.js` (the built-in entry).
 *    This walk is needed inside the Next.js dev server where `import.meta.url`
 *    is rewritten and the default resolution in `@democraft/remotion` gives
 *    the wrong path.
 */
export async function findRemotionEntry(
  userEntryPath?: string,
  workspaceRoot = process.cwd(),
  demoPath?: string,
): Promise<string> {
  if (userEntryPath) {
    const resolved = path.isAbsolute(userEntryPath)
      ? userEntryPath
      : path.resolve(process.cwd(), userEntryPath);
    if (!existsSync(resolved)) {
      throw new Error(
        `Remotion entry not found: ${resolved}. Check the --entry path.`,
      );
    }
    return resolveExistingPathWithin(
      workspaceRoot,
      resolved,
      "Custom Remotion entry",
    );
  }

  if (demoPath) {
    return materializeDemoEntry(demoPath);
  }

  let dir = process.cwd();
  for (let i = 0; i < 20; i += 1) {
    const candidate = path.join(
      dir,
      "node_modules",
      "@democraft",
      "remotion",
      "dist",
      "entry.js",
    );
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    "Could not find @democraft/remotion/dist/entry.js. Run `pnpm install`.",
  );
}
