import { describe, expect, it } from "vitest";
import { editAuthenticationProperty } from "./demo-authentication-source";

const first = "auth_01arz3ndektsv4rrffq69g5fav";
const second = "auth_01arz3ndektsv4rrffq69g5faw";

describe("demo authentication source mutation", () => {
  it("adds a profile ID without rewriting authored code", () => {
    const source = `import { defineDemo } from "@democraft/core";\nexport default defineDemo({\n  id: "demo",\n  source: { baseUrl: "https://example.com" },\n  run() {},\n});\n`;
    const next = editAuthenticationProperty(source, first);
    expect(next).toContain(`authentication: { profileId: "${first}" },`);
    expect(next).toContain(`source: { baseUrl: "https://example.com" }`);
  });

  it("updates and removes only the top-level association", () => {
    const source = `import { defineDemo } from "@democraft/core";\nexport default defineDemo({\n  authentication: { profileId: "${first}" },\n  source: { authentication: "untouched" },\n});\n`;
    const updated = editAuthenticationProperty(source, second);
    expect(updated).toContain(`authentication: { profileId: "${second}" }`);
    expect(updated).toContain(`source: { authentication: "untouched" }`);
    const removed = editAuthenticationProperty(updated);
    expect(removed).not.toContain(`profileId:`);
    expect(removed).toContain(`source: { authentication: "untouched" }`);
  });

  it("rejects dynamic and invalid authoring shapes", () => {
    expect(() =>
      editAuthenticationProperty("export default makeDemo(config);", first),
    ).toThrow(/defineDemo call/);
  });

  it("supports aliases, satisfies, quoted properties, spreads, comments, and CRLF", () => {
    const source = `import { defineDemo as demo } from "@democraft/core";\r\nconst shared = { title: "authentication: fake" };\r\nexport default (demo({\r\n  ...shared,\r\n  // authentication inside a comment\r\n  "authentication": { profileId: "${first}" },\r\n  source: { baseUrl: "https://example.com" },\r\n}) satisfies object);\r\n`;
    const updated = editAuthenticationProperty(source, second);
    expect(updated).toContain(`authentication: { profileId: "${second}" }`);
    expect(updated).toContain("authentication inside a comment");
    expect(updated).toContain("authentication: fake");
    expect(updated).toContain("\r\n");
  });

  it("rejects syntax errors without changing source", () => {
    expect(() =>
      editAuthenticationProperty(
        `import {defineDemo} from "@democraft/core"; export default defineDemo({`,
        first,
      ),
    ).toThrow(/syntax errors/);
  });
});
