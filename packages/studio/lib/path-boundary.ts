import { realpath } from "node:fs/promises";
import path from "node:path";

export class PathBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathBoundaryError";
  }
}

/** Resolve an existing path and reject traversal or symlink escapes. */
export async function resolveExistingPathWithin(
  root: string,
  candidate: string,
  label = "Path",
): Promise<string> {
  const canonicalRoot = await canonicalizeRoot(root, label);
  const absolute = resolveFromRoot(root, candidate);
  let canonicalCandidate: string;
  try {
    canonicalCandidate = await realpath(absolute);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      throw new PathBoundaryError(`${label} does not exist: ${absolute}`);
    }
    throw error;
  }
  assertContained(canonicalRoot, canonicalCandidate, label);
  return canonicalCandidate;
}

/**
 * Resolve a write target that may not exist yet. Existing ancestors are
 * canonicalized so a symlink cannot redirect the future write outside root.
 */
export async function resolveWritePathWithin(
  root: string,
  candidate: string,
  label = "Write target",
): Promise<string> {
  const canonicalRoot = await canonicalizeRoot(root, label);
  const canonicalCandidate = await resolveExactWritePath(
    resolveFromRoot(root, candidate),
    label,
  );
  assertContained(canonicalRoot, canonicalCandidate, label);
  return canonicalCandidate;
}

/** Canonicalize an exact process-authorized write target, even if absent. */
export async function resolveExactWritePath(
  candidate: string,
  label = "Write target",
): Promise<string> {
  const absolute = path.resolve(candidate);
  const missing: string[] = [];
  let ancestor = absolute;

  while (true) {
    try {
      const canonicalAncestor = await realpath(ancestor);
      const canonicalCandidate = path.join(canonicalAncestor, ...missing);
      return canonicalCandidate;
    } catch (error) {
      if (!isNodeError(error, "ENOENT")) throw error;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) {
        throw new PathBoundaryError(
          `${label} has no existing ancestor: ${absolute}`,
        );
      }
      missing.unshift(path.basename(ancestor));
      ancestor = parent;
    }
  }
}

async function canonicalizeRoot(root: string, label: string): Promise<string> {
  try {
    return await realpath(path.resolve(root));
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      throw new PathBoundaryError(
        `Allowed root for ${label.toLowerCase()} does not exist: ${path.resolve(root)}`,
      );
    }
    throw error;
  }
}

function resolveFromRoot(root: string, candidate: string): string {
  return path.isAbsolute(candidate)
    ? path.resolve(candidate)
    : path.resolve(root, candidate);
}

function assertContained(root: string, candidate: string, label: string): void {
  const relative = path.relative(root, candidate);
  if (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  ) {
    return;
  }
  throw new PathBoundaryError(
    `${label} escapes its allowed root: ${candidate} (root: ${root})`,
  );
}

function isNodeError(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}
