import { describe, expect, it } from "vitest";
import { redact, sanitizeUrl } from "./errors";

describe("authentication redaction", () => {
  it("removes structured secrets, headers, JWTs, auth paths and query values", () => {
    const canaries = [
      "hunter2",
      "abc.def.ghi",
      "cookie-value",
      "query-secret",
      "state.json",
    ];
    const raw =
      '{"password":"hunter2","token":"abc.def.ghi"}\nAuthorization: Bearer cookie-value\nhttps://x.test/a?q=query-secret /tmp/.democraft/auth/v1/profiles/auth_x/state.json';
    const safe = redact(raw);
    for (const canary of canaries) expect(safe).not.toContain(canary);
    expect(sanitizeUrl("https://user:pass@x.test/a?q=secret#fragment")).toBe(
      "https://x.test/a",
    );
  });

  it("redacts Playwright's contextual embedded storage-state payload", () => {
    const raw =
      'browser.newContext: storageState: expected object, received {"cookies":[{"name":"sid","value":"cookie-canary","nested":{"token":"nested-token-canary"}}],"origins":[{"origin":"https://private-canary.test","localStorage":[{"name":"session","value":"local-storage-canary"}]}]} at storageState';
    expect(redact(raw)).toBe(
      'browser.newContext: storageState: expected object, received {"cookies":"[redacted]","origins":"[redacted]"} at storageState',
    );
    for (const canary of [
      "cookie-canary",
      "nested-token-canary",
      "private-canary",
      "local-storage-canary",
    ])
      expect(redact(raw)).not.toContain(canary);
  });
});
