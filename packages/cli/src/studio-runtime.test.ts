import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createStudioRuntime } from "./studio-runtime";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("Studio runtime", () => {
  it("starts a packaged production build through Node", async () => {
    const studioDirectory = await temporaryStudio();
    await mkdir(path.join(studioDirectory, ".next"));
    await writeFile(path.join(studioDirectory, ".next", "BUILD_ID"), "build");
    const nextBin = path.join(
      studioDirectory,
      "node_modules",
      "next",
      "dist",
      "bin",
      "next",
    );

    expect(
      createStudioRuntime({ studioDirectory, nextBin, port: 4310 }),
    ).toEqual({
      command: process.execPath,
      args: [nextBin, "start", "--hostname", "127.0.0.1", "--port", "4310"],
      cwd: studioDirectory,
      mode: "production",
    });
  });

  it("uses development mode only for a source checkout", async () => {
    const studioDirectory = await temporaryStudio();
    await mkdir(path.join(studioDirectory, "app"));
    await writeFile(
      path.join(studioDirectory, "next.config.ts"),
      "export default {};",
    );

    expect(
      createStudioRuntime({ studioDirectory, nextBin: "/next", port: 3000 }),
    ).toMatchObject({
      args: ["/next", "dev", "--hostname", "127.0.0.1", "--port", "3000"],
      mode: "development",
    });
  });

  it("does not run a stale production build from a source checkout", async () => {
    const studioDirectory = await temporaryStudio();
    await mkdir(path.join(studioDirectory, "app"));
    await writeFile(
      path.join(studioDirectory, "next.config.ts"),
      "export default {};",
    );
    await mkdir(path.join(studioDirectory, ".next"));
    await writeFile(
      path.join(studioDirectory, ".next", "BUILD_ID"),
      "stale-build",
    );

    expect(
      createStudioRuntime({ studioDirectory, nextBin: "/next", port: 3000 }),
    ).toMatchObject({
      args: ["/next", "dev", "--hostname", "127.0.0.1", "--port", "3000"],
      mode: "development",
    });
  });

  it("rejects an installed package without a production build", async () => {
    const studioDirectory = await temporaryStudio();

    expect(() =>
      createStudioRuntime({ studioDirectory, nextBin: "/next", port: 3000 }),
    ).toThrow("does not contain a production build");
  });
});

async function temporaryStudio(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "democraft-studio-runtime-"));
  roots.push(root);
  return root;
}
