import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

let workspace = "";
let demoPath = "";
vi.mock("./studio-path-authority", () => ({
  trustedWorkspaceRoot: vi.fn(async () => workspace),
  trustedDemoPath: vi.fn(async () => demoPath),
}));
import { setCurrentDemoAuthentication } from "./demo-authentication-source";
import { compileDemoModuleIsolated } from "./compile-demo-isolated";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("demo authentication source integration", () => {
  it("writes, compiles, and reads back the exact profile reference", async () => {
    workspace = await mkdtemp(
      path.join(process.cwd(), ".democraft-auth-source-"),
    );
    roots.push(workspace);
    demoPath = path.join(workspace, "demo.ts");
    await writeFile(
      demoPath,
      `import { defineDemo } from "@democraft/core";\nexport default defineDemo({ id: "demo", title: "Demo", source: { baseUrl: "https://example.com" }, async run() {} });\n`,
    );
    const profileId = "auth_01arz3ndektsv4rrffq69g5fav";
    await expect(setCurrentDemoAuthentication(profileId)).resolves.toEqual({
      demoId: "demo",
      profileId,
    });
    const compiled = await compileDemoModuleIsolated(demoPath, {
      cwd: workspace,
    });
    expect(compiled.ir.authentication).toEqual({ profileId });
    expect(await readFile(demoPath, "utf8")).toContain(profileId);
  }, 20_000);

  it("serializes concurrent writes and leaves a compilable final source", async () => {
    workspace = await mkdtemp(
      path.join(process.cwd(), ".democraft-auth-source-"),
    );
    roots.push(workspace);
    demoPath = path.join(workspace, "demo.ts");
    await writeFile(
      demoPath,
      `import { defineDemo } from "@democraft/core"; export default defineDemo({ id: "demo", title: "Demo", source: { baseUrl: "https://example.com" }, async run() {} });`,
    );
    const first = "auth_01arz3ndektsv4rrffq69g5fav";
    const second = "auth_01arz3ndektsv4rrffq69g5faw";
    await Promise.all([
      setCurrentDemoAuthentication(first),
      setCurrentDemoAuthentication(second),
    ]);
    expect(
      (await compileDemoModuleIsolated(demoPath, { cwd: workspace })).ir
        .authentication?.profileId,
    ).toBe(second);
  }, 20_000);

  it("rolls source back when post-write compilation is invalid", async () => {
    workspace = await mkdtemp(
      path.join(process.cwd(), ".democraft-auth-source-"),
    );
    roots.push(workspace);
    demoPath = path.join(workspace, "demo.ts");
    const original = `import { defineDemo } from "@democraft/core"; export default defineDemo({ id: "demo", title: "", source: { baseUrl: "https://example.com" }, async run() {} });`;
    await writeFile(demoPath, original);
    await expect(
      setCurrentDemoAuthentication("auth_01arz3ndektsv4rrffq69g5fav"),
    ).rejects.toThrow(/required/);
    expect(await readFile(demoPath, "utf8")).toBe(original);
  }, 20_000);
});
