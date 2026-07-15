import { mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findRemotionEntry } from "./remotion-entry";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

describe("custom Remotion entry", () => {
  it("accepts an entry within the workspace", async () => {
    const workspace = await mkdtemp(
      path.join(tmpdir(), "democraft-workspace-"),
    );
    tempDirs.push(workspace);
    const entry = path.join(workspace, "entry.ts");
    await writeFile(entry, "export {};");

    await expect(findRemotionEntry(entry, workspace)).resolves.toBe(
      await realpath(entry),
    );
  });

  it("rejects an entry symlink that escapes the workspace", async () => {
    const workspace = await mkdtemp(
      path.join(tmpdir(), "democraft-workspace-"),
    );
    const outside = await mkdtemp(path.join(tmpdir(), "democraft-entry-"));
    tempDirs.push(workspace, outside);
    const externalEntry = path.join(outside, "entry.ts");
    const linkedEntry = path.join(workspace, "entry.ts");
    await writeFile(externalEntry, "export {};");
    await symlink(externalEntry, linkedEntry);

    await expect(findRemotionEntry(linkedEntry, workspace)).rejects.toThrow(
      /Custom Remotion entry escapes its allowed root/,
    );
  });
});
