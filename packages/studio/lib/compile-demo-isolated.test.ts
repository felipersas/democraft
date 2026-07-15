import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compileDemoModuleIsolated } from "./compile-demo-isolated";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("isolated demo compilation", () => {
  it("reloads edited transitive ESM imports", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "democraft-isolated-"));
    roots.push(root);
    const helper = path.join(root, "helper.mjs");
    const demo = path.join(root, "demo.mjs");
    await writeFile(helper, 'export const title = "First";\n');
    await writeFile(demo, demoSource());

    const first = await compileDemoModuleIsolated(demo);
    await writeFile(helper, 'export const title = "Second";\n');
    const second = await compileDemoModuleIsolated(demo);

    expect(first.ir.title).toBe("First");
    expect(second.ir.title).toBe("Second");
    expect(second.ir.definitionHash).not.toBe(first.ir.definitionHash);
  });
});

function demoSource(): string {
  return `
import { title } from "./helper.mjs";
export default {
  id: "demo",
  title,
  source: { baseUrl: "http://localhost:3000" },
  targets: {},
  async run() {},
};
`;
}
