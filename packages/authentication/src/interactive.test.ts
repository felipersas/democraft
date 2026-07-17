import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InteractiveAuthenticationService } from "./interactive";
import type {
  AuthenticationValidationBrowser,
  InteractiveAuthenticationBrowser,
} from "./ports";
import {
  AuthenticationPaths,
  LocalAuthenticationRepository,
} from "./repository";

const roots: string[] = [];
afterEach(async () =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  ),
);

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "interactive-auth-"));
  roots.push(root);
  const paths = await AuthenticationPaths.fromWorkspace(root);
  const repository = new LocalAuthenticationRepository(paths, {
    syncFile: async () => undefined,
  });
  const profile = await repository.create({
    name: "Admin",
    origin: "https://app.test",
    validation: { url: "/private", expect: { selector: "#account" } },
  });
  return { paths, profile, repository };
}

const validationBrowser = (
  finalUrl = "https://app.test/private",
): AuthenticationValidationBrowser => ({
  async withState(state, operation) {
    const envelope = JSON.parse(Buffer.from(state).toString("utf8")) as {
      data: { cookies: unknown[] };
    };
    expect(envelope.data.cookies).toHaveLength(1);
    return operation({
      goto: async () => undefined,
      url: () => finalUrl,
      waitForVisible: async () => undefined,
    });
  },
});

describe("InteractiveAuthenticationService", () => {
  it("captures, validates in an unrecorded adapter, then persists an authenticated profile", async () => {
    const { profile, repository } = await fixture();
    const phases: string[] = [];
    const interactiveBrowser: InteractiveAuthenticationBrowser = {
      async capture(options) {
        expect(options.initialState).toBeUndefined();
        options.onPhase?.("opening-browser");
        expect((await repository.list())[0]?.status).toBe("authenticating");
        return {
          cookies: [{ name: "session", value: "canary-secret" }],
          origins: [],
        };
      },
    };
    const service = new InteractiveAuthenticationService(
      repository,
      repository,
      interactiveBrowser,
      validationBrowser(),
      { isCi: false },
    );
    const result = await service.login(profile.id, {
      completion: Promise.resolve("complete"),
      onPhase: (phase) => phases.push(phase),
    });
    expect(result).toMatchObject({
      profile: { id: profile.id, status: "authenticated" },
      reliability: "explicit",
      finalUrl: "https://app.test/private",
    });
    expect(JSON.stringify(result)).not.toContain("canary-secret");
    expect(phases).toEqual([
      "opening-browser",
      "validating-session",
      "saving-profile",
    ]);
    const loaded = await repository.load(profile.id);
    expect(
      JSON.parse(
        Buffer.from(await repository.resolve(loaded.state)).toString("utf8"),
      ),
    ).toMatchObject({ data: { cookies: [{ value: "canary-secret" }] } });
  });

  it("renews with prior state but preserves that state when candidate validation fails", async () => {
    const { paths, profile, repository } = await fixture();
    await repository.saveState(profile.id, {
      cookies: [{ name: "old", value: "safe-prior" }],
      origins: [],
    });
    await repository.markValidation(profile.id, "authenticated");
    const before = await repository.load(profile.id);
    const metadataBefore = JSON.parse(
      await readFile(join(paths.profile(profile.id), "metadata.json"), "utf8"),
    ) as Record<string, unknown>;
    let receivedPrior = "";
    const interactiveBrowser: InteractiveAuthenticationBrowser = {
      async capture(options) {
        receivedPrior = Buffer.from(options.initialState ?? []).toString(
          "utf8",
        );
        return {
          cookies: [{ name: "new", value: "rejected-candidate" }],
          origins: [],
        };
      },
    };
    const failingValidation: AuthenticationValidationBrowser = {
      async withState() {
        throw new Error("token=rejected-candidate");
      },
    };
    const service = new InteractiveAuthenticationService(
      repository,
      repository,
      interactiveBrowser,
      failingValidation,
      { isCi: false },
    );
    await expect(
      service.renew(profile.id, { completion: Promise.resolve("complete") }),
    ).rejects.toMatchObject({ public: { code: "AUTH_VALIDATION_FAILED" } });
    expect(receivedPrior).toContain("safe-prior");
    const after = await repository.load(profile.id);
    expect(after.profile).toEqual(before.profile);
    const persisted = Buffer.from(
      await repository.resolve(after.state),
    ).toString("utf8");
    expect(persisted).toContain("safe-prior");
    expect(persisted).not.toContain("rejected-candidate");
    expect(after.state.stateSha256).toBe(before.state.stateSha256);
    const metadataAfter = JSON.parse(
      await readFile(join(paths.profile(profile.id), "metadata.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(metadataAfter).toMatchObject({
      data: metadataBefore.data,
      stateFile: metadataBefore.stateFile,
      stateSha256: metadataBefore.stateSha256,
      lastErrorCode: "AUTH_VALIDATION_FAILED",
    });
    expect(metadataAfter.revision).not.toBe(metadataBefore.revision);
  });

  it.each(["adapter-failure", "cancelled"] as const)(
    "preserves exact renewal metadata and state on %s",
    async (failure) => {
      const { paths, profile, repository } = await fixture();
      await repository.saveState(profile.id, {
        cookies: [{ name: "old", value: "safe-prior" }],
        origins: [],
      });
      await repository.markValidation(profile.id, "authenticated");
      const before = JSON.parse(
        await readFile(
          join(paths.profile(profile.id), "metadata.json"),
          "utf8",
        ),
      ) as Record<string, unknown>;
      const raw = Object.assign(
        new Error("token=must-not-leak"),
        failure === "cancelled"
          ? {
              name: "InteractiveAuthenticationCancelledError",
              reason: "cancelled",
            }
          : {},
      );
      const service = new InteractiveAuthenticationService(
        repository,
        repository,
        {
          async capture() {
            throw raw;
          },
        },
        validationBrowser(),
        { isCi: false },
      );
      await expect(
        service.renew(profile.id, { completion: Promise.resolve("complete") }),
      ).rejects.toMatchObject({ public: { code: "AUTH_OPERATION_FAILED" } });
      const after = JSON.parse(
        await readFile(
          join(paths.profile(profile.id), "metadata.json"),
          "utf8",
        ),
      ) as Record<string, unknown>;
      expect(after).toMatchObject({
        data: before.data,
        stateFile: before.stateFile,
        stateSha256: before.stateSha256,
        lastErrorCode: "AUTH_OPERATION_FAILED",
      });
      expect(after.revision).not.toBe(before.revision);
    },
  );

  it("restores the prior status on cancel and maps timeout without raw errors", async () => {
    for (const reason of ["cancelled", "timeout"] as const) {
      const { profile, repository } = await fixture();
      const error = Object.assign(new Error(`token=secret ${reason}`), {
        name: "InteractiveAuthenticationCancelledError",
        reason,
      });
      const interactiveBrowser: InteractiveAuthenticationBrowser = {
        async capture() {
          throw error;
        },
      };
      const service = new InteractiveAuthenticationService(
        repository,
        repository,
        interactiveBrowser,
        validationBrowser(),
        { isCi: false },
      );
      await expect(
        service.login(profile.id, { completion: Promise.resolve("complete") }),
      ).rejects.toMatchObject({
        public: {
          code: "AUTH_OPERATION_FAILED",
          stage: reason === "cancelled" ? "cancellation" : "timeout",
        },
      });
      expect((await repository.list())[0]?.status).toBe(
        reason === "cancelled" ? "not-configured" : "error",
      );
    }
  });

  it("fails before opening a browser in CI", async () => {
    const { profile, repository } = await fixture();
    const capture = vi.fn(async () => ({ cookies: [], origins: [] }));
    const service = new InteractiveAuthenticationService(
      repository,
      repository,
      { capture },
      validationBrowser(),
      { isCi: true },
    );
    await expect(
      service.login(profile.id, { completion: Promise.resolve("complete") }),
    ).rejects.toMatchObject({
      public: {
        code: "AUTH_UNAVAILABLE_IN_CI",
        actionRequired: "provide-state",
      },
    });
    expect(capture).not.toHaveBeenCalled();
  });

  it("serializes concurrent login attempts with the repository lock", async () => {
    const { profile, repository } = await fixture();
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const browserEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const interactiveBrowser: InteractiveAuthenticationBrowser = {
      async capture() {
        entered();
        await gate;
        return { cookies: [{ name: "session" }], origins: [] };
      },
    };
    const service = new InteractiveAuthenticationService(
      repository,
      repository,
      interactiveBrowser,
      validationBrowser(),
      { isCi: false },
    );
    const first = service.login(profile.id, {
      completion: Promise.resolve("complete"),
    });
    await browserEntered;
    await expect(
      service.login(profile.id, { completion: Promise.resolve("complete") }),
    ).rejects.toMatchObject({ public: { code: "AUTH_PROFILE_BUSY" } });
    release();
    await first;
  });
});
