import {
  mkdtemp,
  mkdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PathBoundaryError,
  resolveExactWritePath,
  resolveExistingPathWithin,
  resolveWritePathWithin,
} from "./path-boundary";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

async function fixture() {
  const base = await mkdtemp(path.join(tmpdir(), "democraft-boundary-"));
  tempDirs.push(base);
  const root = path.join(base, "root");
  const outside = path.join(base, "outside");
  await Promise.all([
    mkdir(path.join(root, "nested"), { recursive: true }),
    mkdir(outside, { recursive: true }),
  ]);
  await writeFile(path.join(root, "nested", "inside.txt"), "inside");
  await writeFile(path.join(outside, "secret.txt"), "secret");
  return { root, outside };
}

describe("filesystem path boundary", () => {
  it("returns the canonical path for an existing file within root", async () => {
    const { root } = await fixture();

    await expect(
      resolveExistingPathWithin(root, "nested/inside.txt", "Capture asset"),
    ).resolves.toBe(await realpath(path.join(root, "nested", "inside.txt")));
  });

  it("rejects lexical traversal outside root", async () => {
    const { root } = await fixture();

    await expect(
      resolveExistingPathWithin(root, "../outside/secret.txt", "Capture asset"),
    ).rejects.toThrow(/Capture asset escapes its allowed root/);
  });

  it("rejects an existing file reached through an escaping symlink", async () => {
    const { root, outside } = await fixture();
    await symlink(outside, path.join(root, "linked"));

    await expect(
      resolveExistingPathWithin(root, "linked/secret.txt", "Capture asset"),
    ).rejects.toBeInstanceOf(PathBoundaryError);
  });

  it("allows a non-existent write target below a real ancestor", async () => {
    const { root } = await fixture();

    await expect(
      resolveWritePathWithin(
        root,
        "nested/new/deep/file.json",
        "Studio output",
      ),
    ).resolves.toBe(
      path.join(await realpath(root), "nested", "new", "deep", "file.json"),
    );
  });

  it("canonicalizes an exact authorized target with missing directory leaves", async () => {
    const { outside } = await fixture();

    await expect(
      resolveExactWritePath(
        path.join(outside, "new", "capture"),
        "Explicit capture directory",
      ),
    ).resolves.toBe(path.join(await realpath(outside), "new", "capture"));
  });

  it("rejects a non-existent write target below an escaping symlink", async () => {
    const { root, outside } = await fixture();
    await symlink(outside, path.join(root, "linked"));

    await expect(
      resolveWritePathWithin(root, "linked/new/file.json", "Studio output"),
    ).rejects.toThrow(/Studio output escapes its allowed root/);
  });
});
