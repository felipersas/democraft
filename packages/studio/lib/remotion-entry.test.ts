import {
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
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

  it("generates an entry from the trusted demo module", async () => {
    const workspace = await mkdtemp(
      path.join(tmpdir(), "democraft-workspace-"),
    );
    tempDirs.push(workspace);
    const demo = path.join(workspace, "demo.ts");
    await writeFile(demo, "export default {visuals: {}};");

    const entry = await findRemotionEntry(undefined, workspace, demo);

    expect(entry).toContain(path.join(".democraft", "entries"));
    await expect(readFile(entry, "utf8")).resolves.toContain(
      "visualRegistryFromDefinitions(demo.visuals)",
    );
  });
});
