import { copyFile, lstat, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { resolveWritePathWithin } from "./path-boundary";

export async function writeFileContainedAtomic(
  root: string,
  target: string,
  contents: string | Buffer,
  label: string,
): Promise<void> {
  await promoteContained(root, target, label, (temp) =>
    writeFile(temp, contents, { flag: "wx" }),
  );
}

export async function copyFileContainedAtomic(
  root: string,
  source: string,
  target: string,
  label: string,
): Promise<void> {
  await promoteContained(root, target, label, (temp) => copyFile(source, temp));
}

async function promoteContained(
  root: string,
  target: string,
  label: string,
  createTemp: (temp: string) => Promise<unknown>,
) {
  const safeTarget = await resolveWritePathWithin(root, target, label);
  await rejectSymlink(safeTarget, label);
  const temp = path.join(
    path.dirname(safeTarget),
    `.${path.basename(safeTarget)}.${process.pid}-${randomBytes(6).toString("hex")}.tmp`,
  );
  try {
    await createTemp(temp);
    const revalidated = await resolveWritePathWithin(root, safeTarget, label);
    if (revalidated !== safeTarget)
      throw new Error(`${label} changed during write.`);
    await rejectSymlink(safeTarget, label);
    await rename(temp, safeTarget);
  } finally {
    await rm(temp, { force: true }).catch(() => undefined);
  }
}

async function rejectSymlink(target: string, label: string) {
  try {
    if ((await lstat(target)).isSymbolicLink()) {
      throw new Error(`${label} must not be a symbolic link: ${target}`);
    }
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return;
    throw error;
  }
}

function isNodeError(error: unknown, code: string) {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}
