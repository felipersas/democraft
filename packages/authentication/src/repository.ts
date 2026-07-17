import { createHash, randomBytes } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  rmdir,
  unlink,
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import type {
  AuthenticationProfile,
  AuthenticationProfileListEntry,
  AuthenticationStateHandle,
  CreateProfileInput,
  LoadedAuthenticationProfile,
  StoredBrowserState,
} from "./domain";
import { AuthenticationError } from "./errors";
import type {
  AuthenticationAttempt,
  AuthenticationRepository,
  AuthenticationStateResolver,
} from "./ports";
import {
  normalizeOrigin,
  resolveValidationUrl,
  validateSelector,
} from "./urls";

const PROFILE_ID = /^auth_[0-9a-hjkmnp-tv-z]{26}$/;
const HANDLE_TOKEN = Symbol("authentication-state-handle");
type MetadataEnvelope = {
  schemaVersion: 1;
  revision: number;
  stateSha256?: string;
  stateFile?: string;
  lastErrorCode?: string;
  data: AuthenticationProfile;
};
type StateEnvelope = { schemaVersion: 1; data: StoredBrowserState };

type DirectoryIdentity = {
  realpath: string;
  dev: number | bigint;
  ino: number | bigint;
};
export type AuthenticationRepositoryDependencies = {
  now: () => Date;
  monotonicNow: () => number;
  setInterval: (
    callback: () => void,
    milliseconds: number,
  ) => ReturnType<typeof setInterval>;
  clearInterval: (timer: ReturnType<typeof setInterval>) => void;
  sleep: (milliseconds: number) => Promise<void>;
  leaseDurationMs: number;
  heartbeatIntervalMs: number;
  lockWaitMs: number;
  /** Test seam; production always delegates to FileHandle.sync(). */
  syncFile: (handle: { sync(): Promise<void> }) => Promise<void>;
  /** Test seam invoked immediately before a sensitive path-based filesystem operation. */
  beforeSensitiveOperation?: (
    operation: "create-lock" | "write-temp" | "write-open-file" | "commit-file",
    directory: string,
    target: string,
  ) => Promise<void> | void;
};

const defaultDependencies: AuthenticationRepositoryDependencies = {
  now: () => new Date(),
  monotonicNow: () => Date.now(),
  setInterval: (callback, milliseconds) => setInterval(callback, milliseconds),
  clearInterval: (timer) => clearInterval(timer),
  sleep: (milliseconds) =>
    new Promise((resolveWait) => setTimeout(resolveWait, milliseconds)),
  leaseDurationMs: 30_000,
  heartbeatIntervalMs: 10_000,
  lockWaitMs: 250,
  syncFile: (handle) => handle.sync(),
};

export class AuthenticationPaths {
  private constructor(
    readonly workspace: string,
    readonly root: string,
    readonly profiles: string,
    readonly locks: string,
  ) {}
  static async fromWorkspace(workspace: string): Promise<AuthenticationPaths> {
    const canonical = await realpath(resolve(workspace));
    return new AuthenticationPaths(
      canonical,
      join(canonical, ".democraft", "auth", "v1"),
      join(canonical, ".democraft", "auth", "v1", "profiles"),
      join(canonical, ".democraft", "auth", "v1", "locks"),
    );
  }
  profile(id: string): string {
    assertProfileId(id);
    return contained(this.profiles, id);
  }
}

export class LocalAuthenticationRepository
  implements AuthenticationRepository, AuthenticationStateResolver
{
  private readonly dependencies: AuthenticationRepositoryDependencies;
  constructor(
    private readonly paths: AuthenticationPaths,
    dependencies:
      Partial<AuthenticationRepositoryDependencies> | (() => Date) = {},
  ) {
    this.dependencies =
      typeof dependencies === "function"
        ? { ...defaultDependencies, now: dependencies }
        : { ...defaultDependencies, ...dependencies };
  }

  async list(): Promise<AuthenticationProfile[]> {
    return (await this.listEntries()).flatMap((entry) =>
      entry.available ? [entry.profile] : [],
    );
  }

  async listEntries(): Promise<AuthenticationProfileListEntry[]> {
    const profiles = await this.rebuildIndex();
    return profiles.sort((a, b) =>
      (a.available ? a.profile.id : a.profileId).localeCompare(
        b.available ? b.profile.id : b.profileId,
      ),
    );
  }

  async create(input: CreateProfileInput): Promise<AuthenticationProfile> {
    const name = requireName(input.name);
    const origin = normalizeOrigin(input.origin);
    const validationUrl = resolveValidationUrl(origin, input.validation?.url);
    const expect = input.validation?.expect;
    if (expect && "selector" in expect) validateSelector(expect.selector);
    await this.initialize();
    const id = generateProfileId();
    const directory = this.paths.profile(id);
    await mkdir(directory, { mode: 0o700 });
    await chmod(directory, 0o700);
    const timestamp = this.dependencies.now().toISOString();
    const profile: AuthenticationProfile = {
      id,
      name,
      origin,
      strategy: { type: "interactive" },
      status: "not-configured",
      validation: { url: validationUrl, ...(expect ? { expect } : {}) },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    try {
      await atomicJson(
        join(directory, "metadata.json"),
        {
          schemaVersion: 1,
          revision: 1,
          data: profile,
        } satisfies MetadataEnvelope,
        0o600,
        this.dependencies,
      );
    } catch (error) {
      await rmdir(directory).catch(() => undefined);
      throw error;
    }
    await this.writeIndex().catch(() => undefined);
    return profile;
  }

  async rename(
    profileId: string,
    name: string,
  ): Promise<AuthenticationProfile> {
    return this.mutate(profileId, async (envelope) => ({
      ...envelope,
      data: {
        ...envelope.data,
        name: requireName(name),
        updatedAt: this.dependencies.now().toISOString(),
      },
    }));
  }

  async saveState(
    profileId: string,
    state: StoredBrowserState,
  ): Promise<AuthenticationProfile> {
    validateState(state);
    await ensureAuthenticationGitignore(this.paths.workspace);
    return this.withLock(
      profileId,
      async (directoryIdentity, assertOwnership) => {
        const current = await this.readMetadata(profileId);
        const bytes = jsonBytes({
          schemaVersion: 1,
          data: state,
        } satisfies StateEnvelope);
        const nextRevision = current.revision + 1;
        const stateFile = `state.${nextRevision}.${randomBytes(6).toString("hex")}.json`;
        const statePath = join(this.paths.profile(profileId), stateFile);
        assertTransition(current, "authenticating", true, profileId);
        await assertOwnership();
        await atomicBytes(
          statePath,
          bytes,
          0o600,
          this.dependencies,
          directoryIdentity,
          assertOwnership,
        );
        const timestamp = this.dependencies.now().toISOString();
        const next: MetadataEnvelope = {
          ...current,
          revision: nextRevision,
          stateFile,
          stateSha256: sha256(bytes),
          data: {
            ...current.data,
            status: "authenticating",
            updatedAt: timestamp,
          },
        };
        await assertOwnership();
        await atomicJson(
          join(this.paths.profile(profileId), "metadata.json"),
          next,
          0o600,
          this.dependencies,
          directoryIdentity,
          assertOwnership,
        );
        await this.cleanupGenerations(profileId, stateFile);
        await this.writeIndex().catch(() => undefined);
        return next.data;
      },
    );
  }

  async load(profileId: string): Promise<LoadedAuthenticationProfile> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const metadata = await this.readMetadata(profileId);
      try {
        return await this.loadSnapshot(profileId, metadata);
      } catch (error) {
        const latest = await this.readMetadata(profileId).catch(
          () => undefined,
        );
        if (attempt === 0 && latest && latest.revision !== metadata.revision)
          continue;
        throw error;
      }
    }
    throw new AuthenticationError(
      "AUTH_PROFILE_BUSY",
      "Authentication profile changed while loading.",
      { profileId, stage: "load" },
    );
  }

  private async loadSnapshot(
    profileId: string,
    metadata: MetadataEnvelope,
  ): Promise<LoadedAuthenticationProfile> {
    if (!metadata.stateSha256)
      throw corrupt(profileId, "Authentication state is missing.");
    const statePath = statePathFor(
      this.paths.profile(profileId),
      metadata.stateFile,
      profileId,
    );
    const bytes = await secureRead(statePath, profileId).catch((error) => {
      if (isCode(error, "ENOENT"))
        throw corrupt(profileId, "Authentication state is missing.");
      throw error;
    });
    if (sha256(bytes) !== metadata.stateSha256)
      throw corrupt(
        profileId,
        "Authentication state does not match profile metadata.",
      );
    parseState(bytes, profileId);
    const confirmed = await this.readMetadata(profileId);
    if (
      confirmed.revision !== metadata.revision ||
      confirmed.stateSha256 !== metadata.stateSha256
    )
      throw new AuthenticationError(
        "AUTH_PROFILE_BUSY",
        "Authentication profile changed while loading.",
        { profileId, stage: "load" },
      );
    return {
      profile: metadata.data,
      revision: metadata.revision,
      state: {
        profileId,
        revision: metadata.revision,
        stateSha256: metadata.stateSha256,
        token: HANDLE_TOKEN,
      },
    };
  }

  async resolve(handle: AuthenticationStateHandle): Promise<Uint8Array> {
    if (handle.token !== HANDLE_TOKEN)
      throw corrupt(handle.profileId, "Invalid authentication state handle.");
    const metadata = await this.readMetadata(handle.profileId);
    if (
      metadata.revision !== handle.revision ||
      metadata.stateSha256 !== handle.stateSha256
    )
      throw new AuthenticationError(
        "AUTH_PROFILE_BUSY",
        "Authentication state changed after it was loaded.",
        { profileId: handle.profileId, stage: "load" },
      );
    const bytes = await secureRead(
      statePathFor(
        this.paths.profile(handle.profileId),
        metadata.stateFile,
        handle.profileId,
      ),
      handle.profileId,
    );
    if (sha256(bytes) !== handle.stateSha256)
      throw corrupt(
        handle.profileId,
        "Authentication state changed while loading.",
      );
    return bytes.slice();
  }

  async markValidation(
    profileId: string,
    status: AuthenticationProfile["status"],
    at = this.dependencies.now(),
    errorCode?: string,
  ): Promise<AuthenticationProfile> {
    if (
      status !== "authenticated" &&
      status !== "expired" &&
      status !== "error"
    )
      throw new AuthenticationError(
        "AUTH_OPERATION_FAILED",
        "Invalid authentication validation transition.",
        { profileId, stage: "validation" },
      );
    return this.mutate(profileId, async (current) => {
      assertTransition(
        current,
        status,
        Boolean(current.stateSha256 && current.stateFile),
        profileId,
      );
      return {
        ...current,
        lastErrorCode: errorCode,
        data: {
          ...current.data,
          status,
          updatedAt: at.toISOString(),
          ...(status === "authenticated"
            ? { lastValidatedAt: at.toISOString() }
            : {}),
        },
      };
    });
  }

  async recordValidationFailure(
    profileId: string,
    errorCode: string,
  ): Promise<AuthenticationProfile> {
    return this.mutate(profileId, async (current) => ({
      ...current,
      lastErrorCode: errorCode,
      data: {
        ...current.data,
        updatedAt: this.dependencies.now().toISOString(),
      },
    }));
  }

  async authenticate(
    profileId: string,
    operation: (attempt: AuthenticationAttempt) => Promise<StoredBrowserState>,
  ): Promise<AuthenticationProfile> {
    await ensureAuthenticationGitignore(this.paths.workspace);
    return this.withLock(
      profileId,
      async (directoryIdentity, assertOwnership) => {
        const original = await this.readMetadata(profileId);
        assertTransition(
          original,
          "authenticating",
          Boolean(original.stateFile && original.stateSha256),
          profileId,
        );
        const started: MetadataEnvelope = {
          ...original,
          revision: original.revision + 1,
          data: {
            ...original.data,
            status: "authenticating",
            updatedAt: this.dependencies.now().toISOString(),
          },
        };
        await assertOwnership();
        await atomicJson(
          join(this.paths.profile(profileId), "metadata.json"),
          started,
          0o600,
          this.dependencies,
          directoryIdentity,
          assertOwnership,
        );
        await this.writeIndex().catch(() => undefined);

        const previousState =
          original.stateFile && original.stateSha256
            ? {
                profileId,
                revision: started.revision,
                stateSha256: original.stateSha256,
                token: HANDLE_TOKEN,
              }
            : undefined;
        try {
          const state = await operation({
            profile: started.data,
            ...(previousState ? { previousState } : {}),
          });
          validateState(state);
          const bytes = jsonBytes({
            schemaVersion: 1,
            data: state,
          } satisfies StateEnvelope);
          const nextRevision = started.revision + 1;
          const stateFile = `state.${nextRevision}.${randomBytes(6).toString("hex")}.json`;
          await assertOwnership();
          await atomicBytes(
            join(this.paths.profile(profileId), stateFile),
            bytes,
            0o600,
            this.dependencies,
            directoryIdentity,
            assertOwnership,
          );
          const timestamp = this.dependencies.now().toISOString();
          const completed: MetadataEnvelope = {
            schemaVersion: 1,
            revision: nextRevision,
            stateFile,
            stateSha256: sha256(bytes),
            data: {
              ...started.data,
              status: "authenticated",
              updatedAt: timestamp,
              lastValidatedAt: timestamp,
            },
          };
          await assertOwnership();
          await atomicJson(
            join(this.paths.profile(profileId), "metadata.json"),
            completed,
            0o600,
            this.dependencies,
            directoryIdentity,
            assertOwnership,
          );
          await this.cleanupGenerations(profileId, stateFile);
          await this.writeIndex().catch(() => undefined);
          return completed.data;
        } catch (error) {
          const cancelled =
            error instanceof AuthenticationError &&
            error.public.stage === "cancellation";
          const renewing = Boolean(original.stateFile && original.stateSha256);
          const preserveOriginal = cancelled || renewing;
          const failed: MetadataEnvelope = {
            ...started,
            revision: started.revision + 1,
            lastErrorCode:
              error instanceof AuthenticationError
                ? error.public.code
                : "AUTH_OPERATION_FAILED",
            data: preserveOriginal
              ? original.data
              : {
                  ...started.data,
                  status: "error",
                  updatedAt: this.dependencies.now().toISOString(),
                },
          };
          await assertOwnership();
          await atomicJson(
            join(this.paths.profile(profileId), "metadata.json"),
            failed,
            0o600,
            this.dependencies,
            directoryIdentity,
            assertOwnership,
          );
          await this.writeIndex().catch(() => undefined);
          throw error;
        }
      },
    );
  }

  async remove(
    profileId: string,
    options: { force?: boolean } = {},
  ): Promise<void> {
    const profilePath = this.paths.profile(profileId);
    const profileInfo = await lstat(profilePath).catch(() => undefined);
    if (profileInfo?.isSymbolicLink()) {
      if (!options.force)
        throw corrupt(profileId, "Authentication profile directory is unsafe.");
      await unlink(profilePath);
      await this.writeIndex().catch(() => undefined);
      return;
    }
    await this.withLock(profileId, async () => {
      const directory = this.paths.profile(profileId);
      if (!options.force) await this.readMetadata(profileId);
      const names = await import("node:fs/promises").then(({ readdir }) =>
        readdir(directory),
      );
      for (const name of names) {
        if (name === "operation.lock") continue;
        if (
          name !== "metadata.json" &&
          name !== "state.json" &&
          !/^state\.\d+\.[a-f0-9]+\.json$/.test(name) &&
          !/^\.[a-f0-9]+\.tmp$/.test(name)
        )
          throw corrupt(profileId, "Profile contains an unknown file.");
        const target = join(directory, name);
        const info = await lstat(target).catch(() => undefined);
        if (!info) continue;
        if (info.isSymbolicLink()) {
          if (!options.force)
            throw corrupt(profileId, "Profile contains an unsafe file.");
          await unlink(target);
          continue;
        }
        if (!info.isFile())
          throw corrupt(profileId, "Profile contains an unsafe file.");
        await unlink(target);
      }
    });
    await rmdir(this.paths.profile(profileId));
    await this.writeIndex().catch(() => undefined);
  }

  private async mutate(
    profileId: string,
    change: (value: MetadataEnvelope) => Promise<MetadataEnvelope>,
  ): Promise<AuthenticationProfile> {
    return this.withLock(
      profileId,
      async (directoryIdentity, assertOwnership) => {
        const current = await this.readMetadata(profileId);
        const changed = await change(current);
        const next = { ...changed, revision: current.revision + 1 };
        assertStateInvariant(next, profileId);
        await assertOwnership();
        await atomicJson(
          join(this.paths.profile(profileId), "metadata.json"),
          next,
          0o600,
          this.dependencies,
          directoryIdentity,
          assertOwnership,
        );
        await this.writeIndex().catch(() => undefined);
        return next.data;
      },
    );
  }

  private async readMetadata(profileId: string): Promise<MetadataEnvelope> {
    assertProfileId(profileId);
    const target = join(this.paths.profile(profileId), "metadata.json");
    let bytes: Uint8Array;
    try {
      bytes = await secureRead(target, profileId);
    } catch (error) {
      if (isCode(error, "ENOENT"))
        throw new AuthenticationError(
          "AUTH_PROFILE_NOT_FOUND",
          `Authentication profile ${profileId} was not found.`,
          { profileId, stage: "load" },
        );
      throw error;
    }
    let value: unknown;
    try {
      value = JSON.parse(Buffer.from(bytes).toString("utf8"));
    } catch {
      throw corrupt(profileId, "Authentication profile metadata is corrupt.");
    }
    if (!value || typeof value !== "object")
      throw corrupt(profileId, "Authentication profile metadata is corrupt.");
    if ((value as { schemaVersion?: unknown }).schemaVersion !== 1)
      throw new AuthenticationError(
        "AUTH_UNSUPPORTED_VERSION",
        "Authentication profile uses an unsupported version.",
        { profileId, stage: "load" },
      );
    const envelope = value as MetadataEnvelope;
    if (
      !Number.isInteger(envelope.revision) ||
      envelope.revision < 1 ||
      envelope.data?.id !== profileId ||
      !PROFILE_ID.test(envelope.data.id)
    )
      throw corrupt(profileId, "Authentication profile metadata is corrupt.");
    return envelope;
  }

  private async withLock<T>(
    profileId: string,
    operation: (
      directoryIdentity: DirectoryIdentity,
      assertOwnership: () => Promise<void>,
    ) => Promise<T>,
  ): Promise<T> {
    assertProfileId(profileId);
    await this.initialize();
    const directory = this.paths.profile(profileId);
    const directoryInfo = await lstat(directory).catch(() => undefined);
    if (!directoryInfo)
      throw new AuthenticationError(
        "AUTH_PROFILE_NOT_FOUND",
        `Authentication profile ${profileId} was not found.`,
        { profileId, stage: "lock" },
      );
    if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink())
      throw corrupt(profileId, "Authentication profile directory is unsafe.");
    await access(directory, constants.F_OK).catch(() => {
      throw new AuthenticationError(
        "AUTH_PROFILE_NOT_FOUND",
        `Authentication profile ${profileId} was not found.`,
        { profileId, stage: "lock" },
      );
    });
    const directoryIdentity = await verifiedDirectory(directory);
    const lock = join(directory, "operation.lock");
    const nonce = randomBytes(12).toString("hex");
    const lease = createLease(nonce, this.dependencies);
    await acquireLease(
      lock,
      lease,
      profileId,
      this.dependencies,
      directoryIdentity,
    );
    const heartbeat = startHeartbeat(lock, nonce, this.dependencies);
    try {
      await assertSameDirectory(directory, directoryIdentity);
      await heartbeat.assertOwned();
      return await operation(directoryIdentity, heartbeat.assertOwned);
    } finally {
      await heartbeat.stop();
      try {
        const owner = JSON.parse(await readFile(lock, "utf8")) as {
          nonce?: string;
        };
        if (owner.nonce === nonce) await unlink(lock);
      } catch {
        /* replaced lock belongs to another operation */
      }
    }
  }

  private async initialize(): Promise<void> {
    await secureMkdir(join(this.paths.workspace, ".democraft"));
    await secureMkdir(join(this.paths.workspace, ".democraft", "auth"));
    await secureMkdir(this.paths.root);
    await secureMkdir(this.paths.profiles);
    await secureMkdir(this.paths.locks);
  }

  private async writeIndex(): Promise<void> {
    await this.rebuildIndex();
  }

  private async rebuildIndex(): Promise<AuthenticationProfileListEntry[]> {
    await this.initialize();
    const lock = join(this.paths.locks, "index.lock");
    const nonce = randomBytes(12).toString("hex");
    const lease = createLease(nonce, this.dependencies);
    await acquireLease(lock, lease, "index", this.dependencies);
    const heartbeat = startHeartbeat(lock, nonce, this.dependencies);
    try {
      const indexPath = join(this.paths.root, "profiles.json");
      const existing = await readFile(indexPath, "utf8").catch(() => undefined);
      let supported = true;
      if (existing) {
        try {
          supported =
            (JSON.parse(existing) as { schemaVersion?: unknown })
              .schemaVersion === 1;
        } catch {
          /* corrupt cache is rebuildable */
        }
      }
      const entries = await this.scanEntries();
      if (supported) {
        await heartbeat.assertOwned();
        await atomicJson(
          indexPath,
          { schemaVersion: 1, data: entries },
          0o600,
          this.dependencies,
          undefined,
          heartbeat.assertOwned,
        );
      }
      return entries;
    } finally {
      await heartbeat.stop();
      await releaseLease(lock, nonce);
    }
  }

  private async scanEntries(): Promise<AuthenticationProfileListEntry[]> {
    const entries = await import("node:fs/promises").then(({ readdir }) =>
      readdir(this.paths.profiles, { withFileTypes: true }),
    );
    const result: AuthenticationProfileListEntry[] = [];
    for (const entry of entries) {
      if (
        !entry.isDirectory() ||
        entry.isSymbolicLink() ||
        !PROFILE_ID.test(entry.name)
      )
        continue;
      try {
        result.push({
          available: true,
          profile: (await this.readMetadata(entry.name)).data,
        });
      } catch (error) {
        if (
          error instanceof AuthenticationError &&
          (error.public.code === "AUTH_STATE_CORRUPT" ||
            error.public.code === "AUTH_UNSUPPORTED_VERSION")
        )
          result.push({
            available: false,
            profileId: entry.name,
            code: error.public.code,
          });
        else throw error;
      }
    }
    return result;
  }

  private async cleanupGenerations(
    profileId: string,
    keep: string,
  ): Promise<void> {
    const directory = this.paths.profile(profileId);
    const names = await import("node:fs/promises").then(({ readdir }) =>
      readdir(directory),
    );
    await Promise.all(
      names
        .filter(
          (name) =>
            (name.startsWith("state.") &&
              name.endsWith(".json") &&
              name !== keep) ||
            /^\.[a-f0-9]+\.tmp$/.test(name),
        )
        .map((name) => unlink(join(directory, name)).catch(() => undefined)),
    );
  }
}

export async function ensureAuthenticationGitignore(
  workspace: string,
): Promise<void> {
  const target = join(workspace, ".gitignore");
  let current = "";
  try {
    current = await readFile(target, "utf8");
  } catch (error) {
    if (!isCode(error, "ENOENT"))
      throw new AuthenticationError(
        "AUTH_OPERATION_FAILED",
        "Could not protect authentication state from Git.",
        { stage: "gitignore" },
      );
  }
  if (
    current
      .split(/\r?\n/)
      .some((line) => /^\/?\.democraft\/auth\/?$/.test(line.trim()))
  )
    return;
  const newline = current.includes("\r\n") ? "\r\n" : "\n";
  const prefix =
    current.length > 0 && !current.endsWith("\n") && !current.endsWith("\r")
      ? newline
      : "";
  try {
    await atomicBytes(
      target,
      Buffer.from(`${current}${prefix}/.democraft/auth/${newline}`),
      0o644,
      defaultDependencies,
    );
  } catch {
    throw new AuthenticationError(
      "AUTH_OPERATION_FAILED",
      "Could not protect authentication state from Git. Acknowledge this risk before storing a session.",
      { stage: "gitignore" },
    );
  }
}

async function secureMkdir(path: string): Promise<void> {
  await mkdir(path, { mode: 0o700 }).catch((error) => {
    if (!isCode(error, "EEXIST")) throw error;
  });
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error(`Unsafe authentication directory: ${path}`);
  await chmod(path, 0o700);
}
async function secureRead(
  path: string,
  profileId: string,
): Promise<Uint8Array> {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  } catch (error) {
    if (isCode(error, "ELOOP"))
      throw corrupt(
        profileId,
        "Authentication profile contains an unsafe file.",
      );
    throw error;
  }
  try {
    const info = await handle.stat();
    if (!info.isFile())
      throw corrupt(
        profileId,
        "Authentication profile contains an unsafe file.",
      );
    await handle.chmod(0o600);
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}
async function atomicJson(
  path: string,
  value: unknown,
  mode: number,
  dependencies: AuthenticationRepositoryDependencies,
  expectedIdentity?: DirectoryIdentity,
  beforeCommit?: () => Promise<void>,
): Promise<void> {
  await atomicBytes(
    path,
    jsonBytes(value),
    mode,
    dependencies,
    expectedIdentity,
    beforeCommit,
  );
}
async function atomicBytes(
  path: string,
  bytes: Uint8Array,
  mode: number,
  dependencies: AuthenticationRepositoryDependencies,
  expectedIdentity?: DirectoryIdentity,
  beforeCommit?: () => Promise<void>,
): Promise<void> {
  const directory = dirname(path);
  const identity = expectedIdentity ?? (await verifiedDirectory(directory));
  await assertSameDirectory(directory, identity);
  if (/^state\.\d+\.[a-f0-9]+\.json$/.test(basename(path))) {
    await writePinnedExclusive(
      path,
      bytes,
      mode,
      dependencies,
      identity,
      beforeCommit,
    );
    return;
  }
  const temp = join(directory, `.${randomBytes(8).toString("hex")}.tmp`);
  try {
    await dependencies.beforeSensitiveOperation?.(
      "write-temp",
      directory,
      path,
    );
    await assertSameDirectory(directory, identity);
    const handle = await open(temp, "wx", mode);
    try {
      await handle.writeFile(bytes);
      await dependencies.syncFile(handle);
    } finally {
      await handle.close();
    }
    await assertSameDirectory(directory, identity);
    await dependencies.beforeSensitiveOperation?.(
      "commit-file",
      directory,
      path,
    );
    await assertSameDirectory(directory, identity);
    await beforeCommit?.();
    await rename(temp, path);
    await assertSameDirectory(directory, identity);
    await chmod(path, mode);
    const directoryHandle = await open(
      directory,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
    );
    try {
      await dependencies.syncFile(directoryHandle);
    } finally {
      await directoryHandle.close();
    }
    const finalHandle = await open(
      path,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
    );
    try {
      const finalInfo = await finalHandle.stat();
      if (!finalInfo.isFile() || (finalInfo.mode & 0o777) !== mode)
        throw new Error("Authentication atomic write verification failed.");
      const committed = await finalHandle.readFile();
      if (sha256(committed) !== sha256(bytes))
        throw new Error(
          "Authentication atomic write hash verification failed.",
        );
    } finally {
      await finalHandle.close();
    }
  } finally {
    await rm(temp, { force: true });
  }
}
async function writePinnedExclusive(
  path: string,
  bytes: Uint8Array,
  mode: number,
  dependencies: AuthenticationRepositoryDependencies,
  identity: DirectoryIdentity,
  beforeCommit?: () => Promise<void>,
): Promise<void> {
  const directory = dirname(path);
  const handle = await open(path, "wx", mode);
  let safe = false;
  try {
    await dependencies.beforeSensitiveOperation?.(
      "write-open-file",
      directory,
      path,
    );
    await beforeCommit?.();
    await handle.writeFile(bytes);
    await dependencies.syncFile(handle);
    await assertSameDirectory(directory, identity);
    safe = true;
  } finally {
    if (!safe) await handle.truncate(0).catch(() => undefined);
    await handle.close();
    if (!safe) await unlinkIfParentUnchanged(path, identity);
  }
}
async function writeExclusive(
  path: string,
  bytes: Uint8Array,
  mode: number,
  dependencies: AuthenticationRepositoryDependencies,
  expectedIdentity?: DirectoryIdentity,
): Promise<void> {
  const directory = dirname(path);
  const identity = expectedIdentity ?? (await verifiedDirectory(directory));
  await assertSameDirectory(directory, identity);
  const handle = await open(path, "wx", mode);
  let safe = false;
  try {
    await dependencies.beforeSensitiveOperation?.(
      "create-lock",
      directory,
      path,
    );
    await handle.writeFile(bytes);
    await dependencies.syncFile(handle);
    await assertSameDirectory(directory, identity);
    safe = true;
  } finally {
    if (!safe) await handle.truncate(0).catch(() => undefined);
    await handle.close();
    if (!safe) await unlinkIfParentUnchanged(path, identity);
  }
}
async function unlinkIfParentUnchanged(
  path: string,
  expected: DirectoryIdentity,
): Promise<void> {
  try {
    await assertSameDirectory(dirname(path), expected);
    await unlink(path);
  } catch {
    /* zero-byte orphan stays with the displaced original directory */
  }
}
async function acquireLease(
  lock: string,
  lease: { nonce: string; expiresAt: string },
  profileId: string,
  dependencies: AuthenticationRepositoryDependencies,
  expectedIdentity?: DirectoryIdentity,
): Promise<void> {
  const deadline = dependencies.monotonicNow() + dependencies.lockWaitMs;
  for (;;) {
    try {
      await writeExclusive(
        lock,
        jsonBytes(lease),
        0o600,
        dependencies,
        expectedIdentity,
      );
      return;
    } catch (error) {
      if (!isCode(error, "EEXIST")) throw error;
      let existing: { nonce?: string; expiresAt?: string; pid?: number };
      try {
        existing = JSON.parse(
          Buffer.from(await secureRead(lock, profileId)).toString("utf8"),
        ) as typeof existing;
      } catch (readError) {
        if (readError instanceof AuthenticationError) throw readError;
        existing = {};
      }
      if (
        Date.parse(existing.expiresAt ?? "") < dependencies.now().getTime() &&
        !isProcessAlive(existing.pid)
      ) {
        const quarantine = `${lock}.stale.${existing.nonce ?? "invalid"}.${randomBytes(6).toString("hex")}`;
        try {
          await rename(lock, quarantine);
        } catch (renameError) {
          if (!isCode(renameError, "ENOENT")) throw renameError;
          continue;
        }
        try {
          await writeExclusive(
            lock,
            jsonBytes(lease),
            0o600,
            dependencies,
            expectedIdentity,
          );
          return;
        } catch (claimError) {
          if (!isCode(claimError, "EEXIST")) throw claimError;
        } finally {
          await unlink(quarantine).catch(() => undefined);
        }
      }
      if (dependencies.monotonicNow() >= deadline)
        throw new AuthenticationError(
          "AUTH_PROFILE_BUSY",
          `Authentication profile ${profileId} is busy.`,
          {
            profileId: profileId === "index" ? undefined : profileId,
            stage: "lock",
          },
        );
      await dependencies.sleep(10);
    }
  }
}
function isProcessAlive(pid: number | undefined): boolean {
  if (!Number.isInteger(pid) || (pid ?? 0) <= 0) return false;
  try {
    process.kill(pid!, 0);
    return true;
  } catch (error) {
    return isCode(error, "EPERM");
  }
}
async function releaseLease(lock: string, nonce: string): Promise<void> {
  try {
    const owner = JSON.parse(
      Buffer.from(await secureRead(lock, "index")).toString("utf8"),
    ) as { nonce?: string };
    if (owner.nonce === nonce) await unlink(lock);
  } catch {
    /* ownership changed or already released */
  }
}
function startHeartbeat(
  lock: string,
  nonce: string,
  dependencies: AuthenticationRepositoryDependencies,
): { assertOwned(): Promise<void>; stop(): Promise<void> } {
  let pending = Promise.resolve();
  let ownershipLost: unknown;
  const timer = dependencies.setInterval(() => {
    pending = pending
      .then(async () => {
        if (!(await renewLease(lock, nonce, dependencies)))
          ownershipLost = new Error("Authentication lease ownership was lost.");
      })
      .catch((error) => {
        ownershipLost = error;
      });
  }, dependencies.heartbeatIntervalMs);
  timer.unref?.();
  const assertOwned = async () => {
    await pending;
    if (ownershipLost) throw busyLease();
    try {
      const current = JSON.parse(
        Buffer.from(await secureRead(lock, "lease")).toString("utf8"),
      ) as { nonce?: string; expiresAt?: string };
      if (
        current.nonce !== nonce ||
        Date.parse(current.expiresAt ?? "") < dependencies.now().getTime()
      ) {
        ownershipLost = new Error("Authentication lease ownership was lost.");
        throw busyLease();
      }
    } catch (error) {
      ownershipLost = error;
      throw busyLease();
    }
  };
  return {
    assertOwned,
    async stop() {
      dependencies.clearInterval(timer);
      await pending;
    },
  };
}
async function renewLease(
  lock: string,
  nonce: string,
  dependencies: AuthenticationRepositoryDependencies,
): Promise<boolean> {
  const handle = await open(
    lock,
    constants.O_RDWR | (constants.O_NOFOLLOW ?? 0),
  );
  try {
    const info = await handle.stat();
    if (!info.isFile()) return false;
    const current = JSON.parse((await handle.readFile()).toString("utf8")) as {
      nonce?: string;
      pid?: number;
      createdAt?: string;
    };
    if (current.nonce !== nonce) return false;
    const bytes = jsonBytes({
      ...current,
      expiresAt: new Date(
        dependencies.now().getTime() + dependencies.leaseDurationMs,
      ).toISOString(),
    });
    // The handle pins the lease inode. If a contender quarantines it concurrently,
    // this update lands on the quarantined inode and cannot overwrite the new owner.
    await handle.truncate(0);
    await handle.write(bytes, 0, bytes.length, 0);
    await dependencies.syncFile(handle);
    return true;
  } finally {
    await handle.close();
  }
}
function busyLease(): AuthenticationError {
  return new AuthenticationError(
    "AUTH_PROFILE_BUSY",
    "Authentication lease ownership was lost.",
    { stage: "lock" },
  );
}
function createLease(
  nonce: string,
  dependencies: AuthenticationRepositoryDependencies,
) {
  const now = dependencies.now();
  return {
    pid: process.pid,
    nonce,
    createdAt: now.toISOString(),
    expiresAt: new Date(
      now.getTime() + dependencies.leaseDurationMs,
    ).toISOString(),
  };
}
async function verifiedDirectory(path: string): Promise<DirectoryIdentity> {
  const [canonical, info] = await Promise.all([realpath(path), lstat(path)]);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    canonical !== resolve(path)
  )
    throw new Error("Unsafe authentication directory.");
  return { realpath: canonical, dev: info.dev, ino: info.ino };
}
async function assertSameDirectory(
  path: string,
  expected: DirectoryIdentity,
): Promise<void> {
  const actual = await verifiedDirectory(path);
  if (
    actual.realpath !== expected.realpath ||
    actual.dev !== expected.dev ||
    actual.ino !== expected.ino
  )
    throw new Error(
      "Authentication directory changed during a sensitive operation.",
    );
}

const transitions: Record<
  AuthenticationProfile["status"],
  ReadonlySet<AuthenticationProfile["status"]>
> = {
  "not-configured": new Set(["not-configured", "authenticating"]),
  authenticating: new Set([
    "authenticating",
    "authenticated",
    "expired",
    "invalid",
    "error",
  ]),
  authenticated: new Set([
    "authenticating",
    "authenticated",
    "expired",
    "error",
  ]),
  expired: new Set(["authenticating"]),
  invalid: new Set(["authenticating"]),
  error: new Set(["authenticating"]),
};
function assertTransition(
  current: MetadataEnvelope,
  target: AuthenticationProfile["status"],
  statePresent: boolean,
  profileId: string,
): void {
  if (!transitions[current.data.status].has(target))
    throw new AuthenticationError(
      "AUTH_OPERATION_FAILED",
      `Invalid authentication status transition from ${current.data.status} to ${target}.`,
      { profileId, stage: "mutation" },
    );
  assertStateInvariant(
    {
      ...current,
      stateFile: statePresent
        ? (current.stateFile ?? "pending-state")
        : undefined,
      stateSha256: statePresent
        ? (current.stateSha256 ?? "pending-hash")
        : undefined,
      data: { ...current.data, status: target },
    },
    profileId,
  );
}
function assertStateInvariant(
  envelope: MetadataEnvelope,
  profileId: string,
): void {
  const hasFile = typeof envelope.stateFile === "string";
  const hasHash = typeof envelope.stateSha256 === "string";
  if (
    hasFile !== hasHash ||
    ((["authenticated", "expired"] as const).includes(
      envelope.data.status as "authenticated",
    ) &&
      !hasFile)
  )
    throw new AuthenticationError(
      "AUTH_STATE_CORRUPT",
      "Authentication status and state presence disagree.",
      { profileId, status: "invalid", stage: "mutation" },
    );
}
function contained(root: string, child: string): string {
  const target = resolve(root, child);
  const rel = relative(resolve(root), target);
  if (
    !rel ||
    rel.startsWith(`..${sep}`) ||
    rel === ".." ||
    resolve(rel) === rel
  )
    throw new Error("Authentication path escapes its root.");
  return target;
}
function statePathFor(
  directory: string,
  stateFile: string | undefined,
  profileId: string,
): string {
  const name = stateFile ?? "state.json";
  if (name !== "state.json" && !/^state\.\d+\.[a-f0-9]{12}\.json$/.test(name))
    throw corrupt(profileId, "Authentication state filename is invalid.");
  return contained(directory, name);
}
function assertProfileId(id: string): void {
  if (!PROFILE_ID.test(id))
    throw new AuthenticationError(
      "AUTH_PROFILE_NOT_FOUND",
      "Invalid authentication profile ID.",
      { stage: "load" },
    );
}
function requireName(value: string): string {
  const name = value.trim();
  if (!name || name.length > 200)
    throw new AuthenticationError(
      "AUTH_OPERATION_FAILED",
      "Profile name must contain 1 to 200 characters.",
      { stage: "configuration" },
    );
  return name;
}
function generateProfileId(): string {
  const alphabet = "0123456789abcdefghjkmnpqrstvwxyz";
  const bytes = randomBytes(26);
  return `auth_${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")}`;
}
function jsonBytes(value: unknown): Uint8Array {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}
function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
function parseState(bytes: Uint8Array, profileId: string): StateEnvelope {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    throw corrupt(profileId, "Authentication state is corrupt.");
  }
  const envelope = value as StateEnvelope;
  if (envelope?.schemaVersion !== 1)
    throw new AuthenticationError(
      "AUTH_UNSUPPORTED_VERSION",
      "Authentication state uses an unsupported version.",
      { profileId, stage: "load" },
    );
  validateState(envelope.data);
  return envelope;
}
function validateState(value: StoredBrowserState): void {
  if (!value || !Array.isArray(value.cookies) || !Array.isArray(value.origins))
    throw new AuthenticationError(
      "AUTH_STATE_CORRUPT",
      "Authentication state is malformed.",
      { stage: "load" },
    );
}
function corrupt(profileId: string, message: string): AuthenticationError {
  return new AuthenticationError("AUTH_STATE_CORRUPT", message, {
    profileId,
    status: "invalid",
    stage: "load",
  });
}
function isCode(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}
