import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Studio package scripts", () => {
  it.each(["dev", "start"])("binds %s to IPv4 loopback", async (script) => {
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts[script]).toContain("--hostname 127.0.0.1");
  });
});
