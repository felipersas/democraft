import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { AuthenticationError } from "./errors";
import {
  AuthenticationPaths,
  LocalAuthenticationRepository,
} from "./repository";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
async function setup() {
  const root = await mkdtemp(join(tmpdir(), "democraft-auth-"));
  roots.push(root);
  const paths = await AuthenticationPaths.fromWorkspace(root);
  return {
    root,
    paths,
    repository: new LocalAuthenticationRepository(paths, {
      syncFile: async () => undefined,
    }),
  };
}

describe("LocalAuthenticationRepository", () => {
  it("creates, renames, lists, persists, loads, resolves and removes a profile", async () => {
    const { root, paths, repository } = await setup();
    const created = await repository.create({
      name: " Admin ",
      origin: "HTTPS://Example.COM:443/path",
      validation: { url: "/dashboard", expect: { selector: "#user" } },
    });
    expect(created).toMatchObject({
      name: "Admin",
      origin: "https://example.com",
      status: "not-configured",
    });
    expect(created.id).toMatch(/^auth_[0-9a-hjkmnp-tv-z]{26}$/);
    await repository.saveState(created.id, {
      cookies: [{ name: "canary-secret" }],
      origins: [],
    });
    expect(await readFile(join(root, ".gitignore"), "utf8")).toBe(
      "/.democraft/auth/\n",
    );
    const loaded = await repository.load(created.id);
    expect(loaded.profile.status).toBe("authenticating");
    expect(JSON.stringify(loaded)).not.toContain("canary-secret");
    expect(
      Buffer.from(await repository.resolve(loaded.state)).toString(),
    ).toContain("canary-secret");
    expect((await repository.rename(created.id, "Operator")).name).toBe(
      "Operator",
    );
    expect((await repository.list()).map((profile) => profile.name)).toEqual([
      "Operator",
    ]);
    const createdState = (
      await (
        await import("node:fs/promises")
      ).readdir(paths.profile(created.id))
    ).find((name) => name.startsWith("state."))!;
    expect(
      (await lstat(join(paths.profile(created.id), createdState))).mode & 0o777,
    ).toBe(0o600);
    expect((await lstat(paths.profile(created.id))).mode & 0o777).toBe(0o700);
    await repository.remove(created.id);
    await expect(repository.load(created.id)).rejects.toMatchObject({
      public: { code: "AUTH_PROFILE_NOT_FOUND" },
    });
  });

  it("keeps profiles isolated and detects missing, corrupt, mismatched and unknown state", async () => {
    const { paths, repository } = await setup();
    const a = await repository.create({ name: "A", origin: "https://a.test" });
    const b = await repository.create({ name: "B", origin: "https://b.test" });
    await repository.saveState(a.id, {
      cookies: [{ value: "alpha" }],
      origins: [],
    });
    await repository.saveState(b.id, {
      cookies: [{ value: "bravo" }],
      origins: [],
    });
    expect(
      Buffer.from(
        await repository.resolve((await repository.load(a.id)).state),
      ).toString(),
    ).not.toContain("bravo");
    const stateName = (
      await (await import("node:fs/promises")).readdir(paths.profile(a.id))
    ).find((name) => name.startsWith("state."))!;
    await rm(join(paths.profile(a.id), stateName));
    await expect(repository.load(a.id)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
    await writeFile(join(paths.profile(a.id), stateName), "not-json", {
      mode: 0o600,
    });
    await expect(repository.load(a.id)).rejects.toMatchObject({
      public: { code: "AUTH_STATE_CORRUPT" },
    });
    const metadataPath = join(paths.profile(b.id), "metadata.json");
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    metadata.schemaVersion = 77;
    await writeFile(metadataPath, JSON.stringify(metadata), { mode: 0o600 });
    await expect(repository.load(b.id)).rejects.toMatchObject({
      public: { code: "AUTH_UNSUPPORTED_VERSION" },
    });
  });

  it("rejects traversal IDs, symlinks, unsafe locks, and live contention", async () => {
    const { paths, repository } = await setup();
    await expect(repository.load("../outside")).rejects.toMatchObject({
      public: { code: "AUTH_PROFILE_NOT_FOUND" },
    });
    const profile = await repository.create({
      name: "A",
      origin: "http://localhost:3000",
    });
    const metadata = join(paths.profile(profile.id), "metadata.json");
    await rename(metadata, `${metadata}.real`);
    await symlink(`${metadata}.real`, metadata);
    await expect(repository.load(profile.id)).rejects.toMatchObject({
      public: { code: "AUTH_STATE_CORRUPT" },
    });
    await rm(metadata);
    await rename(`${metadata}.real`, metadata);
    await writeFile(
      join(paths.profile(profile.id), "operation.lock"),
      JSON.stringify({
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
      { mode: 0o600 },
    );
    await expect(repository.rename(profile.id, "busy")).rejects.toMatchObject({
      public: { code: "AUTH_PROFILE_BUSY" },
    });
  });

  it("repairs permissive file modes without creating secret backups", async () => {
    const { paths, repository } = await setup();
    const profile = await repository.create({
      name: "A",
      origin: "https://a.test",
    });
    await repository.saveState(profile.id, { cookies: [], origins: [] });
    const stateName = (
      await (
        await import("node:fs/promises")
      ).readdir(paths.profile(profile.id))
    ).find((name) => name.startsWith("state."))!;
    const state = join(paths.profile(profile.id), stateName);
    await chmod(state, 0o644);
    await repository.load(profile.id);
    expect((await lstat(state)).mode & 0o777).toBe(0o600);
    await expect(
      (await import("node:fs/promises")).readdir(paths.profile(profile.id)),
    ).resolves.toEqual(
      expect.not.arrayContaining([expect.stringMatching(/backup|\.bak$/)]),
    );
  });

  it("binds state handles to an immutable revision and hash", async () => {
    const { repository } = await setup();
    const profile = await repository.create({
      name: "A",
      origin: "https://a.test",
    });
    await repository.saveState(profile.id, {
      cookies: [{ value: "old" }],
      origins: [],
    });
    const old = await repository.load(profile.id);
    await repository.saveState(profile.id, {
      cookies: [{ value: "new" }],
      origins: [],
    });
    await expect(repository.resolve(old.state)).rejects.toMatchObject({
      public: { code: "AUTH_PROFILE_BUSY" },
    });
  });

  it("reports unavailable index entries and force-removes unknown versions", async () => {
    const { paths, repository } = await setup();
    const profile = await repository.create({
      name: "A",
      origin: "https://a.test",
    });
    const metadataPath = join(paths.profile(profile.id), "metadata.json");
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    metadata.schemaVersion = 99;
    await writeFile(metadataPath, JSON.stringify(metadata), { mode: 0o600 });
    expect(await repository.listEntries()).toContainEqual({
      available: false,
      profileId: profile.id,
      code: "AUTH_UNSUPPORTED_VERSION",
    });
    const index = JSON.parse(
      await readFile(join(paths.root, "profiles.json"), "utf8"),
    );
    expect(index.data).toContainEqual({
      available: false,
      profileId: profile.id,
      code: "AUTH_UNSUPPORTED_VERSION",
    });
    await expect(repository.remove(profile.id)).rejects.toMatchObject({
      public: { code: "AUTH_UNSUPPORTED_VERSION" },
    });
    await repository.remove(profile.id, { force: true });
    await expect(repository.load(profile.id)).rejects.toMatchObject({
      public: { code: "AUTH_PROFILE_NOT_FOUND" },
    });
  });

  it("recovers cache, crash leftovers, and competing stale-lock stealers", async () => {
    const { paths, repository } = await setup();
    const profile = await repository.create({
      name: "A",
      origin: "https://a.test",
    });
    await repository.saveState(profile.id, { cookies: [], origins: [] });
    const pendingProfile = (await repository.load(profile.id)).profile;
    expect(pendingProfile.status).toBe("authenticating");
    expect("lastValidatedAt" in pendingProfile).toBe(false);
    await writeFile(join(paths.root, "profiles.json"), "corrupt", {
      mode: 0o600,
    });
    expect(await repository.list()).toHaveLength(1);
    expect(
      JSON.parse(await readFile(join(paths.root, "profiles.json"), "utf8"))
        .schemaVersion,
    ).toBe(1);
    await writeFile(
      join(paths.profile(profile.id), "state.999.deadbeef.json"),
      "orphan",
      { mode: 0o600 },
    );
    await writeFile(
      join(paths.profile(profile.id), ".deadbeef.tmp"),
      "partial",
      { mode: 0o600 },
    );
    await repository.saveState(profile.id, {
      cookies: [{ value: "committed" }],
      origins: [],
    });
    const names = await (
      await import("node:fs/promises")
    ).readdir(paths.profile(profile.id));
    expect(names).not.toContain("state.999.deadbeef.json");
    expect(names).not.toContain(".deadbeef.tmp");
    await writeFile(
      join(paths.profile(profile.id), "operation.lock"),
      JSON.stringify({ nonce: "old", expiresAt: new Date(0).toISOString() }),
      { mode: 0o600 },
    );
    const results = await Promise.allSettled([
      repository.rename(profile.id, "first"),
      repository.rename(profile.id, "second"),
    ]);
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
    expect((await repository.load(profile.id)).profile.name).toMatch(
      /first|second/,
    );
  });

  it("rejects symlink-swapped secret generations and force-removes them without following", async () => {
    const { root, paths, repository } = await setup();
    const profile = await repository.create({
      name: "A",
      origin: "https://a.test",
    });
    await repository.saveState(profile.id, { cookies: [], origins: [] });
    const stateName = (
      await (
        await import("node:fs/promises")
      ).readdir(paths.profile(profile.id))
    ).find((name) => name.startsWith("state."))!;
    const outside = join(root, "outside-secret");
    await writeFile(outside, "outside", { mode: 0o600 });
    await rm(join(paths.profile(profile.id), stateName));
    await symlink(outside, join(paths.profile(profile.id), stateName));
    await expect(repository.load(profile.id)).rejects.toMatchObject({
      public: { code: "AUTH_STATE_CORRUPT" },
    });
    await repository.remove(profile.id, { force: true });
    expect(await readFile(outside, "utf8")).toBe("outside");
  });

  it("rejects cross-profile state filenames from metadata", async () => {
    const { paths, repository } = await setup();
    const a = await repository.create({ name: "A", origin: "https://a.test" });
    const b = await repository.create({ name: "B", origin: "https://b.test" });
    await repository.saveState(a.id, { cookies: [], origins: [] });
    await repository.saveState(b.id, { cookies: [], origins: [] });
    const metadataPath = join(paths.profile(a.id), "metadata.json");
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    metadata.stateFile = `../${b.id}/${metadata.stateFile}`;
    await writeFile(metadataPath, JSON.stringify(metadata), { mode: 0o600 });
    await expect(repository.load(a.id)).rejects.toMatchObject({
      public: { code: "AUTH_STATE_CORRUPT" },
    });
  });

  it("preserves an unsupported index and performs its scan while holding the index lock", async () => {
    const { paths, repository } = await setup();
    const profile = await repository.create({
      name: "A",
      origin: "https://a.test",
    });
    const indexPath = join(paths.root, "profiles.json");
    const unsupported = '{"schemaVersion":99,"future":"must-survive"}\n';
    await writeFile(indexPath, unsupported, { mode: 0o600 });
    const entries = await repository.listEntries();
    expect(entries).toContainEqual(
      expect.objectContaining({
        available: true,
        profile: expect.objectContaining({ id: profile.id }),
      }),
    );
    expect(await readFile(indexPath, "utf8")).toBe(unsupported);
  });

  it("fails closed when the profile directory is swapped before a secret write", async () => {
    const { root, paths } = await setup();
    let armed = false;
    let swapped = false;
    let profileDirectory = "";
    const outside = join(root, "outside");
    await mkdir(outside);
    const repository = new LocalAuthenticationRepository(paths, {
      async beforeSensitiveOperation(operation, directory, target) {
        if (
          !armed ||
          swapped ||
          operation !== "write-open-file" ||
          directory !== profileDirectory
        )
          return;
        swapped = true;
        await rename(directory, `${directory}.original`);
        await symlink(outside, directory);
        await writeFile(
          join(outside, target.slice(directory.length + 1)),
          "outside-state-canary",
          { mode: 0o600 },
        );
      },
    });
    const profile = await repository.create({
      name: "A",
      origin: "https://a.test",
    });
    profileDirectory = paths.profile(profile.id);
    armed = true;
    await expect(
      repository.saveState(profile.id, {
        cookies: [{ value: "never-outside" }],
        origins: [],
      }),
    ).rejects.toThrow(/directory|unsafe|ownership/i);
    const outsideNames = await (
      await import("node:fs/promises")
    ).readdir(outside);
    expect(outsideNames).toHaveLength(1);
    expect(await readFile(join(outside, outsideNames[0]), "utf8")).toBe(
      "outside-state-canary",
    );
    expect(
      JSON.stringify(
        await (
          await import("node:fs/promises")
        ).readdir(root, { recursive: true }),
      ),
    ).not.toContain("never-outside");
  });

  it("does not unlink a same-basename outside lock victim after a directory swap", async () => {
    const { root, paths } = await setup();
    let armed = false;
    let swapped = false;
    let profileDirectory = "";
    const outside = join(root, "outside-lock");
    await mkdir(outside);
    const repository = new LocalAuthenticationRepository(paths, {
      async beforeSensitiveOperation(operation, directory, target) {
        if (
          !armed ||
          swapped ||
          operation !== "create-lock" ||
          directory !== profileDirectory
        )
          return;
        swapped = true;
        await rename(directory, `${directory}.original`);
        await symlink(outside, directory);
        await writeFile(
          join(outside, target.slice(directory.length + 1)),
          "outside-lock-canary",
          { mode: 0o600 },
        );
      },
    });
    const profile = await repository.create({
      name: "A",
      origin: "https://a.test",
    });
    profileDirectory = paths.profile(profile.id);
    armed = true;
    await expect(repository.rename(profile.id, "unsafe")).rejects.toThrow(
      /directory|unsafe|ownership/i,
    );
    expect(await readFile(join(outside, "operation.lock"), "utf8")).toBe(
      "outside-lock-canary",
    );
  });

  it("enforces the complete status transition and state-presence invariants under mutation lock", async () => {
    const { paths, repository } = await setup();
    const profile = await repository.create({
      name: "A",
      origin: "https://a.test",
    });
    await expect(
      repository.markValidation(profile.id, "authenticated"),
    ).rejects.toMatchObject({ public: { code: "AUTH_OPERATION_FAILED" } });
    await repository.saveState(profile.id, { cookies: [], origins: [] });
    expect(
      (await repository.markValidation(profile.id, "expired")).status,
    ).toBe("expired");
    await repository.saveState(profile.id, { cookies: [], origins: [] });
    expect(
      (await repository.markValidation(profile.id, "authenticated")).status,
    ).toBe("authenticated");
    expect(
      (await repository.markValidation(profile.id, "expired")).status,
    ).toBe("expired");
    await expect(
      repository.markValidation(profile.id, "authenticated"),
    ).rejects.toMatchObject({ public: { code: "AUTH_OPERATION_FAILED" } });
    const metadataPath = join(paths.profile(profile.id), "metadata.json");
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    delete metadata.stateFile;
    delete metadata.stateSha256;
    await writeFile(metadataPath, JSON.stringify(metadata), { mode: 0o600 });
    await expect(repository.rename(profile.id, "unsafe")).rejects.toMatchObject(
      { public: { code: "AUTH_STATE_CORRUPT" } },
    );
  });

  it("renews ownership beyond lease expiry, rejects a live contender, and never overlaps mutations", async () => {
    const { paths } = await setup();
    let active = 0;
    let maximum = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolveGate) => {
      release = resolveGate;
    });
    let block = false;
    const dependencies = {
      now: () => new Date(),
      monotonicNow: () => Date.now(),
      leaseDurationMs: 40,
      heartbeatIntervalMs: 10,
      lockWaitMs: 25,
      async beforeSensitiveOperation(
        operation:
          "create-lock" | "write-temp" | "write-open-file" | "commit-file",
        directory: string,
        target: string,
      ) {
        if (
          !block ||
          operation !== "commit-file" ||
          !directory.startsWith(paths.profiles) ||
          !target.endsWith("metadata.json")
        )
          return;
        active += 1;
        maximum = Math.max(maximum, active);
        await gate;
        active -= 1;
      },
    };
    const first = new LocalAuthenticationRepository(paths, dependencies);
    const second = new LocalAuthenticationRepository(paths, dependencies);
    const profile = await first.create({ name: "A", origin: "https://a.test" });
    block = true;
    const owner = first.rename(profile.id, "owner");
    await new Promise((resolveWait) => setTimeout(resolveWait, 80));
    await expect(second.rename(profile.id, "contender")).rejects.toMatchObject({
      public: { code: "AUTH_PROFILE_BUSY" },
    });
    release();
    await owner;
    expect(maximum).toBe(1);
  });

  it("serializes simultaneous contenders for a stale lease", async () => {
    const { paths } = await setup();
    let active = 0;
    let maximum = 0;
    let entered!: () => void;
    let release!: () => void;
    let armed = false;
    let blocked = false;
    const winnerEntered = new Promise<void>((resolveEntered) => {
      entered = resolveEntered;
    });
    const gate = new Promise<void>((resolveGate) => {
      release = resolveGate;
    });
    const dependencies = {
      lockWaitMs: 25,
      async beforeSensitiveOperation(
        operation:
          "create-lock" | "write-temp" | "write-open-file" | "commit-file",
        directory: string,
        target: string,
      ) {
        if (
          !armed ||
          blocked ||
          operation !== "commit-file" ||
          !directory.startsWith(paths.profiles) ||
          !target.endsWith("metadata.json")
        )
          return;
        blocked = true;
        active += 1;
        maximum = Math.max(maximum, active);
        entered();
        await gate;
        active -= 1;
      },
    };
    const first = new LocalAuthenticationRepository(paths, dependencies);
    const second = new LocalAuthenticationRepository(paths, dependencies);
    const profile = await first.create({ name: "A", origin: "https://a.test" });
    armed = true;
    await writeFile(
      join(paths.profile(profile.id), "operation.lock"),
      JSON.stringify({ nonce: "stale", expiresAt: new Date(0).toISOString() }),
      { mode: 0o600 },
    );
    const operations = [
      first.rename(profile.id, "one"),
      second.rename(profile.id, "two"),
    ];
    const resultsPromise = Promise.allSettled(operations);
    await winnerEntered;
    await new Promise((resolveWait) => setTimeout(resolveWait, 40));
    release();
    const results = await resultsPromise;
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toEqual([
      expect.objectContaining({
        reason: expect.objectContaining({
          public: expect.objectContaining({ code: "AUTH_PROFILE_BUSY" }),
        }),
      }),
    ]);
    expect(maximum).toBe(1);
    const names = await (
      await import("node:fs/promises")
    ).readdir(paths.profile(profile.id));
    expect(
      names.filter(
        (name) =>
          name.includes(".stale.") ||
          name.endsWith(".tmp") ||
          name === "operation.lock",
      ),
    ).toEqual([]);
  });

  it("preserves exact renewal metadata and state when candidate persistence fails", async () => {
    const { paths } = await setup();
    let armed = false;
    let failed = false;
    const repository = new LocalAuthenticationRepository(paths, {
      async beforeSensitiveOperation(operation, _directory, target) {
        if (
          armed &&
          !failed &&
          operation === "write-open-file" &&
          /state\.\d+\.[a-f0-9]+\.json$/.test(target)
        ) {
          failed = true;
          throw new Error("token=persistence-canary");
        }
      },
    });
    const profile = await repository.create({
      name: "A",
      origin: "https://a.test",
    });
    await repository.saveState(profile.id, {
      cookies: [{ value: "safe-prior" }],
      origins: [],
    });
    await repository.markValidation(profile.id, "authenticated");
    const metadataPath = join(paths.profile(profile.id), "metadata.json");
    const before = JSON.parse(await readFile(metadataPath, "utf8"));
    armed = true;
    await expect(
      repository.authenticate(profile.id, async () => ({
        cookies: [{ value: "candidate" }],
        origins: [],
      })),
    ).rejects.toThrow("persistence-canary");
    const after = JSON.parse(await readFile(metadataPath, "utf8"));
    expect(after).toMatchObject({
      data: before.data,
      stateFile: before.stateFile,
      stateSha256: before.stateSha256,
      lastErrorCode: "AUTH_OPERATION_FAILED",
    });
    expect(after.revision).not.toBe(before.revision);
    const loaded = await repository.load(profile.id);
    const state = Buffer.from(await repository.resolve(loaded.state)).toString(
      "utf8",
    );
    expect(state).toContain("safe-prior");
    expect(state).not.toContain("candidate");
    const names = await (
      await import("node:fs/promises")
    ).readdir(paths.profile(profile.id));
    expect(
      names.filter(
        (name) => name.endsWith(".tmp") || name === "operation.lock",
      ),
    ).toEqual([]);
  });

  it("aborts a commit when the event loop misses renewal past lease expiry", async () => {
    const { paths } = await setup();
    let now = Date.now();
    let armed = false;
    const repository = new LocalAuthenticationRepository(paths, {
      now: () => new Date(now),
      monotonicNow: () => now,
      leaseDurationMs: 30,
      setInterval: () =>
        ({ unref() {} }) as unknown as ReturnType<typeof setInterval>,
      clearInterval: () => undefined,
      async beforeSensitiveOperation(operation, _directory, target) {
        if (
          armed &&
          operation === "commit-file" &&
          target.endsWith("metadata.json")
        )
          now += 31;
      },
    });
    const profile = await repository.create({
      name: "A",
      origin: "https://a.test",
    });
    armed = true;
    await expect(
      repository.rename(profile.id, "must-not-commit"),
    ).rejects.toMatchObject({ public: { code: "AUTH_PROFILE_BUSY" } });
    expect(
      JSON.parse(
        await readFile(
          join(paths.profile(profile.id), "metadata.json"),
          "utf8",
        ),
      ).data.name,
    ).toBe("A");
  });

  it("aborts immediately when the lease is stolen before metadata commit", async () => {
    const { paths } = await setup();
    let armed = false;
    let stolen = false;
    const repository = new LocalAuthenticationRepository(paths, {
      async beforeSensitiveOperation(operation, directory, target) {
        if (
          !armed ||
          stolen ||
          operation !== "commit-file" ||
          !target.endsWith("metadata.json")
        )
          return;
        stolen = true;
        const lock = join(directory, "operation.lock");
        await rename(lock, `${lock}.stolen`);
        await writeFile(
          lock,
          JSON.stringify({
            nonce: "contender",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          }),
          { mode: 0o600 },
        );
      },
    });
    const profile = await repository.create({
      name: "A",
      origin: "https://a.test",
    });
    armed = true;
    await expect(
      repository.rename(profile.id, "must-not-commit"),
    ).rejects.toMatchObject({ public: { code: "AUTH_PROFILE_BUSY" } });
    expect(
      JSON.parse(
        await readFile(
          join(paths.profile(profile.id), "metadata.json"),
          "utf8",
        ),
      ).data.name,
    ).toBe("A");
  });
});
