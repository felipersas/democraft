import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acquireCaptureLeaseLock,
  captureNamespace,
  completeCaptureArtifact,
  createCaptureArtifact,
  failCaptureArtifact,
  redactCaptureErrorMessage,
  resolveLatestCompletedCapture,
  startCaptureArtifact,
  writeCaptureManifestAtomic,
} from "./capture-artifacts";

const tempDirs: string[] = [];
const environment = {
  headless: true,
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
  locale: "en-US",
  timezone: "UTC",
  settle: false as const,
  timeoutMs: 8000,
};

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    tempDirs.map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
  tempDirs.length = 0;
});

describe("capture artifacts", () => {
  it("creates unique managed directories under a sanitized demo slug", async () => {
    const root = await temporaryDirectory();
    const now = () => new Date("2026-07-15T12:00:00.000Z");
    const ids = ["same", "same", "different"];

    const first = await createCaptureArtifact(
      { rootDirectory: root, demoId: "Olá / Checkout", environment },
      { now, randomId: () => ids.shift()! },
    );
    const second = await createCaptureArtifact(
      { rootDirectory: root, demoId: "Olá / Checkout", environment },
      { now, randomId: () => ids.shift()! },
    );

    expect(path.dirname(first.directory)).toBe(
      path.join(root, captureNamespace("Olá / Checkout")),
    );
    expect(second.directory).not.toBe(first.directory);
    expect(second.captureRunId).toContain("different");
  });

  it("allocates concurrent captures without collisions", async () => {
    const root = await temporaryDirectory();
    const captures = await Promise.all(
      Array.from({ length: 12 }, () =>
        createCaptureArtifact({
          rootDirectory: root,
          demoId: "demo",
          environment,
        }),
      ),
    );
    expect(new Set(captures.map((capture) => capture.directory))).toHaveLength(
      12,
    );
    expect(
      new Set(captures.map((capture) => capture.captureRunId)),
    ).toHaveLength(12);
  });

  it("uses a raw-id digest to prevent normalized slug aliases", async () => {
    const root = await temporaryDirectory();
    const first = await createCaptureArtifact({
      rootDirectory: root,
      demoId: "Olá",
      environment,
    });
    const second = await createCaptureArtifact({
      rootDirectory: root,
      demoId: "ola",
      environment,
    });
    expect(path.dirname(first.directory)).not.toBe(
      path.dirname(second.directory),
    );
  });

  it("validates metadata before creating the managed root", async () => {
    const parent = await temporaryDirectory();
    const root = path.join(parent, "does-not-exist");
    await expect(
      createCaptureArtifact({
        rootDirectory: root,
        demoId: "demo",
        environment: { ...environment, viewport: { width: 0, height: 1080 } },
      }),
    ).rejects.toThrow("viewport.width");
    await expect(access(root)).rejects.toThrow();
  });

  it("adds an attempt timestamp when failing from created", async () => {
    const root = await temporaryDirectory();
    const artifact = await createCaptureArtifact({
      rootDirectory: root,
      demoId: "demo",
      environment,
    });
    await failCaptureArtifact(artifact, new Error("launch failed"));
    const metadata = JSON.parse(await readFile(artifact.metadataPath, "utf8"));
    expect(metadata.startedAt).toEqual(expect.any(String));
    expect(metadata.status).toBe("failed");
  });

  it("updates latest atomically to the newest completed capture only", async () => {
    const root = await temporaryDirectory();
    const first = await createCapture(root, "first");
    const second = await createCapture(root, "second");
    await Promise.all([
      completeCaptureArtifact(first, {
        now: new Date("2026-07-15T12:00:01.000Z"),
      }),
      completeCaptureArtifact(second, {
        now: new Date("2026-07-15T12:00:02.000Z"),
      }),
    ]);

    const latest = await resolveLatestCompletedCapture(root, "demo");
    expect(latest).toMatchObject({
      captureDir: second.directory,
      captureRunId: second.captureRunId,
      legacy: false,
    });
    const pointer = JSON.parse(
      await readFile(
        path.join(root, captureNamespace("demo"), "latest.json"),
        "utf8",
      ),
    );
    expect(pointer.captureDirectory).toBe(path.basename(second.directory));
  });

  it("does not trust a valid pointer when a newer completed run exists", async () => {
    const root = await temporaryDirectory();
    const older = await createCapture(root, "older");
    const newer = await createCapture(root, "newer");
    await completeCaptureArtifact(older, {
      now: new Date("2026-07-15T12:00:01.000Z"),
    });
    await completeCaptureArtifact(newer, {
      now: new Date("2026-07-15T12:00:02.000Z"),
    });
    const pointerPath = path.join(
      root,
      captureNamespace("demo"),
      "latest.json",
    );
    await writeFile(
      pointerPath,
      JSON.stringify({
        schemaVersion: 1,
        demoId: "demo",
        captureRunId: older.captureRunId,
        captureDirectory: path.basename(older.directory),
        completedAt: "2026-07-15T12:00:01.000Z",
      }),
    );

    await expect(
      resolveLatestCompletedCapture(root, "demo"),
    ).resolves.toMatchObject({
      captureDir: newer.directory,
    });
    expect(JSON.parse(await readFile(pointerPath, "utf8"))).toMatchObject({
      captureRunId: newer.captureRunId,
    });
  });

  it("persists launch-style failures without moving latest", async () => {
    const root = await temporaryDirectory();
    const completed = await createCapture(root, "complete");
    await completeCaptureArtifact(completed);
    const failed = await createCapture(root, "failed");
    await failCaptureArtifact(
      failed,
      new Error(`launch failed in ${failed.directory}/secret`),
    );

    const metadata = JSON.parse(await readFile(failed.metadataPath, "utf8"));
    expect(metadata).toMatchObject({
      status: "failed",
      error: { message: "launch failed in [capture]/secret" },
    });
    expect(await resolveLatestCompletedCapture(root, "demo")).toMatchObject({
      captureDir: completed.directory,
    });
  });

  it("scans completed runs and repairs a corrupt latest pointer", async () => {
    const root = await temporaryDirectory();
    const completed = await createCapture(root, "repair");
    await completeCaptureArtifact(completed, {
      now: new Date("2026-07-15T12:00:03.000Z"),
    });
    const pointerPath = path.join(
      root,
      captureNamespace("demo"),
      "latest.json",
    );
    await writeFile(pointerPath, "not-json");

    await expect(
      resolveLatestCompletedCapture(root, "demo"),
    ).resolves.toMatchObject({
      captureDir: completed.directory,
    });
    expect(JSON.parse(await readFile(pointerPath, "utf8"))).toMatchObject({
      captureRunId: completed.captureRunId,
    });
  });

  it("reads completed runs from the pre-digest branch namespace", async () => {
    const root = await temporaryDirectory();
    const completed = await createCapture(root, "old-branch");
    await completeCaptureArtifact(completed);
    const oldNamespace = path.join(root, "demo");
    await rename(path.dirname(completed.directory), oldNamespace);
    const movedCapture = path.join(
      oldNamespace,
      path.basename(completed.directory),
    );
    await expect(
      resolveLatestCompletedCapture(root, "demo"),
    ).resolves.toMatchObject({
      captureDir: movedCapture,
      captureRunId: completed.captureRunId,
    });
  });

  it("uses an explicit output directory exactly and does not create latest", async () => {
    const root = await temporaryDirectory();
    const outputDirectory = path.join(root, "exact-output");
    const artifact = await createCaptureArtifact({
      rootDirectory: path.join(root, "managed"),
      outputDirectory,
      demoId: "demo",
      environment,
    });
    await startCaptureArtifact(artifact);
    await writeCaptureManifestAtomic(artifact, "{}\n");
    await completeCaptureArtifact(artifact);

    expect(artifact.directory).toBe(outputDirectory);
    await artifact.releaseLock?.();
    await expect(
      readFile(path.join(root, "managed", "demo", "latest.json")),
    ).rejects.toThrow();
  });

  it("serializes explicit writers and invalidates a stale manifest", async () => {
    const root = await temporaryDirectory();
    const outputDirectory = path.join(root, "exact-output");
    await mkdir(outputDirectory);
    await writeFile(path.join(outputDirectory, "manifest.json"), "stale");
    const first = await createCaptureArtifact({
      rootDirectory: root,
      outputDirectory,
      demoId: "demo",
      environment,
    });
    await expect(
      access(path.join(outputDirectory, "manifest.json")),
    ).rejects.toThrow();
    await expect(
      createCaptureArtifact({
        rootDirectory: root,
        outputDirectory,
        demoId: "demo",
        environment,
        lockOptions: { maxAttempts: 2, retryMs: 1 },
      }),
    ).rejects.toThrow("Timed out acquiring capture lock");
    await first.releaseLock?.();
  });

  it("releases an explicit lock when manifest invalidation fails", async () => {
    const root = await temporaryDirectory();
    const outputDirectory = path.join(root, "invalidation-failure");
    await mkdir(path.join(outputDirectory, "manifest.json"), {
      recursive: true,
    });
    await expect(
      createCaptureArtifact({
        rootDirectory: root,
        outputDirectory,
        demoId: "demo",
        environment,
      }),
    ).rejects.toThrow();
    await rm(path.join(outputDirectory, "manifest.json"), { recursive: true });
    const artifact = await createCaptureArtifact({
      rootDirectory: root,
      outputDirectory,
      demoId: "demo",
      environment,
      lockOptions: { maxAttempts: 2, retryMs: 1 },
    });
    await artifact.releaseLock?.();
  });

  it("recovers an expired explicit writer lease", async () => {
    const root = await temporaryDirectory();
    const outputDirectory = path.join(root, "expired-lock");
    await mkdir(outputDirectory);
    await writeFile(
      path.join(outputDirectory, ".capture.lock"),
      JSON.stringify({
        token: "dead",
        pid: 99_999_999,
        createdAt: 1,
        expiresAt: 2,
      }),
    );
    const artifact = await createCaptureArtifact({
      rootDirectory: root,
      outputDirectory,
      demoId: "demo",
      environment,
    });
    expect(artifact.metadata.status).toBe("created");
    await artifact.releaseLock?.();
  });

  it("rejects takeover while the owner pid is alive beyond the lease", async () => {
    const root = await temporaryDirectory();
    const lockPath = path.join(root, "heartbeat.lock");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
    const owner = await acquireCaptureLeaseLock(lockPath, {
      leaseMs: 1000,
    });
    vi.setSystemTime(new Date("2026-07-15T12:00:00.800Z"));
    expect(await owner.refresh()).toBe(true);
    vi.setSystemTime(new Date("2026-07-15T12:00:01.200Z"));
    await expect(
      acquireCaptureLeaseLock(lockPath, {
        leaseMs: 1000,
        maxAttempts: 1,
        retryMs: 1,
      }),
    ).rejects.toThrow("Timed out acquiring capture lock");
    await owner();
    vi.useRealTimers();
  });

  it("does not steal a recent partial lock but recovers old malformed state", async () => {
    const root = await temporaryDirectory();
    const lockPath = path.join(root, "partial.lock");
    await writeFile(lockPath, "");
    await expect(
      acquireCaptureLeaseLock(lockPath, {
        malformedStaleMs: 1000,
        maxAttempts: 1,
        retryMs: 1,
      }),
    ).rejects.toThrow("Timed out acquiring capture lock");
    const old = new Date(Date.now() - 5000);
    await utimes(lockPath, old, old);
    const recovered = await acquireCaptureLeaseLock(lockPath, {
      malformedStaleMs: 1000,
      maxAttempts: 3,
      retryMs: 1,
    });
    await recovered();
  });

  it("recovers an orphaned recovery marker", async () => {
    const root = await temporaryDirectory();
    const lockPath = path.join(root, "orphan.lock");
    await writeFile(
      lockPath,
      JSON.stringify({
        token: "old",
        pid: 99_999_999,
        createdAt: 1,
        expiresAt: 2,
      }),
    );
    await writeFile(
      `${lockPath}.recovery`,
      JSON.stringify({
        token: "orphan",
        pid: 99_999_999,
        createdAt: 1,
        expiresAt: 2,
      }),
    );
    const recovered = await acquireCaptureLeaseLock(lockPath, {
      malformedStaleMs: 10,
      maxAttempts: 3,
      retryMs: 1,
    });
    await recovered();
  });

  it("does not recover an operation guard owned by a live pid", async () => {
    const root = await temporaryDirectory();
    const lockPath = path.join(root, "live-operation.lock");
    await writeFile(
      `${lockPath}.operation`,
      JSON.stringify({
        token: "live-guard",
        pid: process.pid,
        createdAt: 1,
        expiresAt: 2,
      }),
    );

    await expect(
      acquireCaptureLeaseLock(lockPath, {
        malformedStaleMs: 10,
        maxAttempts: 1,
        retryMs: 1,
      }),
    ).rejects.toThrow("Timed out acquiring capture lock");
    await expect(readFile(lockPath, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("recovers orphaned operation guard state", async () => {
    const root = await temporaryDirectory();
    const lockPath = path.join(root, "orphan-operation.lock");
    const guardPath = `${lockPath}.operation`;
    await writeFile(
      guardPath,
      JSON.stringify({
        token: "dead-guard",
        pid: 99_999_999,
        createdAt: 1,
        expiresAt: 2,
      }),
    );
    await writeFile(
      `${guardPath}.recovery`,
      JSON.stringify({
        token: "dead-recovery",
        pid: 99_999_999,
        createdAt: 1,
        expiresAt: 2,
      }),
    );

    const acquired = await acquireCaptureLeaseLock(lockPath, {
      malformedStaleMs: 10,
      maxAttempts: 4,
      retryMs: 1,
    });
    await acquired();
    await expect(readFile(guardPath, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(
      readFile(`${guardPath}.recovery`, "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("recovers an old malformed operation guard", async () => {
    const root = await temporaryDirectory();
    const lockPath = path.join(root, "malformed-operation.lock");
    const guardPath = `${lockPath}.operation`;
    await writeFile(guardPath, "");
    const old = new Date(Date.now() - 5000);
    await utimes(guardPath, old, old);

    const acquired = await acquireCaptureLeaseLock(lockPath, {
      malformedStaleMs: 1000,
      maxAttempts: 3,
      retryMs: 1,
    });
    await acquired();
  });

  it("serializes a third acquirer while release holds the operation guard", async () => {
    const root = await temporaryDirectory();
    const lockPath = path.join(root, "release-race.lock");
    const entered = deferred<void>();
    const allow = deferred<void>();
    const owner = await acquireCaptureLeaseLock(lockPath, {
      insideReleaseGuard: async () => {
        entered.resolve();
        await allow.promise;
      },
    });
    const releasing = owner();
    await entered.promise;
    let thirdSettled = false;
    const thirdPromise = acquireCaptureLeaseLock(lockPath, {
      maxAttempts: 100,
      retryMs: 1,
    }).then((lock) => {
      thirdSettled = true;
      return lock;
    });
    await Promise.resolve();
    expect(thirdSettled).toBe(false);
    allow.resolve();
    await releasing;
    const third = await thirdPromise;
    await third();
  });

  it("serializes a third acquirer while recovery holds the operation guard", async () => {
    const root = await temporaryDirectory();
    const lockPath = path.join(root, "recovery-race.lock");
    await writeFile(
      lockPath,
      JSON.stringify({
        token: "dead",
        pid: 99_999_999,
        createdAt: 1,
        expiresAt: 2,
      }),
    );
    const entered = deferred<void>();
    const allow = deferred<void>();
    const recoveringPromise = acquireCaptureLeaseLock(lockPath, {
      maxAttempts: 100,
      retryMs: 1,
      insideRecoveryGuard: async () => {
        entered.resolve();
        await allow.promise;
      },
    });
    await entered.promise;
    let thirdSettled = false;
    const thirdPromise = acquireCaptureLeaseLock(lockPath, {
      maxAttempts: 100,
      retryMs: 1,
    }).then((lock) => {
      thirdSettled = true;
      return lock;
    });
    await Promise.resolve();
    expect(thirdSettled).toBe(false);
    allow.resolve();
    const recovering = await recoveringPromise;
    await Promise.resolve();
    expect(thirdSettled).toBe(false);
    await recovering();
    const third = await thirdPromise;
    await third();
  });

  it("does not unlink a canonical lock when the release token mismatches", async () => {
    const root = await temporaryDirectory();
    const lockPath = path.join(root, "token-mismatch.lock");
    const replacement = {
      token: "replacement",
      pid: process.pid,
      createdAt: Date.now(),
      expiresAt: Date.now() + 10_000,
    };
    const owner = await acquireCaptureLeaseLock(lockPath, {
      insideReleaseGuard: async () => {
        await writeFile(lockPath, JSON.stringify(replacement));
      },
    });
    await owner();
    expect(JSON.parse(await readFile(lockPath, "utf8"))).toEqual(replacement);
  });

  it("waits for a busy operation guard before releasing", async () => {
    const root = await temporaryDirectory();
    const lockPath = path.join(root, "busy-release.lock");
    const owner = await acquireCaptureLeaseLock(lockPath, {
      maxAttempts: 100,
      retryMs: 1,
    });
    const guardPath = `${lockPath}.operation`;
    await writeFile(
      guardPath,
      JSON.stringify({
        token: "busy-guard",
        pid: process.pid,
        createdAt: Date.now(),
        expiresAt: Date.now() + 10_000,
      }),
      { flag: "wx" },
    );

    const releasing = owner();
    await Promise.resolve();
    await expect(readFile(lockPath, "utf8")).resolves.toContain("token");
    await rm(guardPath);
    await releasing;
    await expect(readFile(lockPath, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("redacts URL credentials and sensitive query parameters", () => {
    expect(
      redactCaptureErrorMessage(
        new Error(
          "Failed https://user:password@example.test/cb?token=abc&code=xyz&safe=ok",
        ),
      ),
    ).toBe(
      "Failed https://[redacted]@example.test/cb?token=[redacted]&code=[redacted]&safe=ok",
    );
  });

  it("redacts complete authorization and cookie headers", () => {
    const message = redactCaptureErrorMessage(
      new Error(
        "Authorization: Bearer supersecret\nProxy-Authorization: Basic c2VjcmV0\nCookie: session=supersecret\nSet-Cookie: auth=supersecret; HttpOnly\nRequest failed at browser.launch",
      ),
    );
    expect(message).toContain("Authorization: [redacted]");
    expect(message).toContain("Proxy-Authorization: [redacted]");
    expect(message).toContain("Cookie: [redacted]");
    expect(message).toContain("Set-Cookie: [redacted]");
    expect(message).toContain("Request failed at browser.launch");
    expect(message).not.toContain("supersecret");
    expect(message).not.toContain("c2VjcmV0");
  });

  it("falls back to the untouched legacy directory", async () => {
    const root = await temporaryDirectory();
    const legacy = path.join(root, "legacy-demo");
    await writeFile(path.join(root, ".keep"), "");
    await mkdir(legacy, { recursive: true });
    await writeFile(
      path.join(legacy, "manifest.json"),
      `${JSON.stringify({ schemaVersion: "1", demoId: "legacy-demo", steps: [], diagnostics: [] })}\n`,
    );

    await expect(
      resolveLatestCompletedCapture(root, "legacy-demo"),
    ).resolves.toEqual({
      captureDir: legacy,
      manifestPath: path.join(legacy, "manifest.json"),
      legacy: true,
    });
  });

  it("rejects managed and legacy directory symlinks outside the runs root", async () => {
    const root = await temporaryDirectory();
    const outside = await temporaryDirectory();
    await createCapture(outside, "outside-run");
    await symlink(
      path.join(outside, captureNamespace("demo")),
      path.join(root, captureNamespace("demo")),
    );
    const legacyOutside = path.join(outside, "legacy-demo");
    await mkdir(legacyOutside);
    await writeFile(
      path.join(legacyOutside, "manifest.json"),
      JSON.stringify({
        schemaVersion: "1",
        demoId: "legacy-demo",
        steps: [],
        diagnostics: [],
      }),
    );
    await symlink(legacyOutside, path.join(root, "legacy-demo"));

    await expect(
      resolveLatestCompletedCapture(root, "demo"),
    ).resolves.toBeUndefined();
    await expect(
      resolveLatestCompletedCapture(root, "legacy-demo"),
    ).resolves.toBeUndefined();
  });

  it("rejects a legacy manifest symlink outside the capture directory", async () => {
    const root = await temporaryDirectory();
    const outside = await temporaryDirectory();
    const legacy = path.join(root, "legacy-demo");
    const outsideManifest = path.join(outside, "manifest.json");
    await mkdir(legacy);
    await writeFile(
      outsideManifest,
      JSON.stringify({
        schemaVersion: "1",
        demoId: "legacy-demo",
        steps: [],
        diagnostics: [],
      }),
    );
    await symlink(outsideManifest, path.join(legacy, "manifest.json"));

    await expect(
      resolveLatestCompletedCapture(root, "legacy-demo"),
    ).resolves.toBeUndefined();
  });
});

async function createCapture(root: string, id: string) {
  const artifact = await createCaptureArtifact(
    { rootDirectory: root, demoId: "demo", environment },
    {
      now: () => new Date("2026-07-15T12:00:00.000Z"),
      randomId: () => id,
    },
  );
  await startCaptureArtifact(artifact);
  await writeCaptureManifestAtomic(
    artifact,
    `${JSON.stringify({
      schemaVersion: "1",
      demoId: "demo",
      captureRunId: artifact.captureRunId,
      steps: [],
      diagnostics: [],
    })}\n`,
  );
  return artifact;
}

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "democraft-capture-"));
  tempDirs.push(directory);
  return directory;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
