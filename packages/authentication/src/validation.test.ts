import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { AuthenticationValidationBrowser } from "./ports";
import {
  AuthenticationPaths,
  LocalAuthenticationRepository,
} from "./repository";
import { AuthenticationValidationService } from "./validation";

const roots: string[] = [];
afterEach(async () =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  ),
);
async function fixture(
  browser: AuthenticationValidationBrowser,
  expectRule?: { selector: string } | { urlNotMatching: string },
) {
  const root = await mkdtemp(join(tmpdir(), "auth-validation-"));
  roots.push(root);
  const repository = new LocalAuthenticationRepository(
    await AuthenticationPaths.fromWorkspace(root),
    { syncFile: async () => undefined },
  );
  const profile = await repository.create({
    name: "Admin",
    origin: "https://app.test",
    validation: {
      url: "/private",
      ...(expectRule ? { expect: expectRule } : {}),
    },
  });
  await repository.saveState(profile.id, { cookies: [], origins: [] });
  return {
    repository,
    profile,
    service: new AuthenticationValidationService(
      repository,
      repository,
      browser,
      5,
    ),
  };
}
const browser = (
  finalUrl: string,
  failure?: "goto" | "selector",
): AuthenticationValidationBrowser => ({
  async withState(_state, operation) {
    return operation({
      async goto() {
        if (failure === "goto") throw new Error("token=secret timeout");
      },
      url: () => finalUrl,
      async waitForVisible() {
        if (failure === "selector") throw new Error("missing");
      },
    });
  },
});

describe("AuthenticationValidationService", () => {
  it("validates explicit and heuristic sessions", async () => {
    const explicit = await fixture(
      browser("https://app.test/private?token=secret"),
      { selector: "#user" },
    );
    const result = await explicit.service.validate(explicit.profile.id);
    expect(result).toMatchObject({
      reliability: "explicit",
      finalUrl: "https://app.test/private",
    });
    expect(result.profile.status).toBe("authenticated");
    const heuristic = await fixture(browser("https://app.test/private"));
    expect(
      (await heuristic.service.validate(heuristic.profile.id)).reliability,
    ).toBe("less-reliable");
  }, 15_000);

  it("marks login redirects expired", async () => {
    const value = await fixture(browser("https://app.test/login?token=secret"));
    await expect(
      value.service.validate(value.profile.id),
    ).rejects.toMatchObject({
      public: {
        code: "AUTH_SESSION_EXPIRED",
        sanitizedUrl: "https://app.test/login",
      },
    });
    expect((await value.repository.load(value.profile.id)).profile.status).toBe(
      "expired",
    );
  }, 15_000);

  it("classifies timeout and missing selector as validation failures without leaking errors", async () => {
    const timeout = await fixture(browser("https://app.test/private", "goto"));
    await expect(
      timeout.service.validate(timeout.profile.id),
    ).rejects.toMatchObject({ public: { code: "AUTH_VALIDATION_FAILED" } });
    expect(
      (await timeout.repository.load(timeout.profile.id)).profile.status,
    ).toBe("authenticating");
    const selector = await fixture(
      browser("https://app.test/private", "selector"),
      { selector: "#user" },
    );
    await expect(
      selector.service.validate(selector.profile.id),
    ).rejects.toMatchObject({
      public: {
        code: "AUTH_VALIDATION_FAILED",
        criterion: "expected-visible-selector",
      },
    });
  }, 15_000);

  it("rejects malformed URL matching rules", async () => {
    const value = await fixture(browser("https://app.test/private"), {
      urlNotMatching: "[",
    });
    await expect(
      value.service.validate(value.profile.id),
    ).rejects.toMatchObject({
      public: { code: "AUTH_VALIDATION_FAILED", criterion: "url-not-matching" },
    });
  }, 15_000);

  it("rejects empty and non-http final document URLs", async () => {
    for (const finalUrl of ["", "file:///etc/passwd"]) {
      const value = await fixture(browser(finalUrl));
      await expect(
        value.service.validate(value.profile.id),
      ).rejects.toMatchObject({ public: { code: "AUTH_VALIDATION_FAILED" } });
    }
  }, 15_000);
});
