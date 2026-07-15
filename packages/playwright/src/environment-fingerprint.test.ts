import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveCaptureEnvironment } from "./environment-fingerprint";

const roots: string[] = [];
const runtime = {
  node: "22.0.0",
  platform: "test",
  arch: "test",
  engine: "chromium" as const,
};

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("capture environment fingerprint", () => {
  it("uses fully resolved defaults deterministically", async () => {
    const first = await resolveCaptureEnvironment({}, runtime);
    const second = await resolveCaptureEnvironment({}, runtime);

    expect(first).toEqual(second);
    expect(first.environment).toMatchObject({
      headless: true,
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2,
      locale: "en-US",
      timezone: "UTC",
      settle: { idleWindowMs: 350, timeoutMs: 4000, signal: "both" },
      timeoutMs: 8000,
    });
    expect(first.captureEnvironmentHash).toMatch(
      /^capture-env-v1:sha256:[a-f0-9]{64}$/,
    );
  });

  it("is independent of input object key order", async () => {
    const first = await resolveCaptureEnvironment(
      { environment: { viewport: { width: 1280, height: 720 } } },
      runtime,
    );
    const viewport = { height: 720, width: 1280 };
    const second = await resolveCaptureEnvironment(
      { environment: { viewport } },
      { engine: "chromium", arch: "test", platform: "test", node: "22.0.0" },
    );

    expect(first.captureEnvironmentHash).toBe(second.captureEnvironmentHash);
  });

  it("changes when storage state contents or runtime change", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "democraft-env-"));
    roots.push(root);
    const storageState = path.join(root, "storage.json");
    await writeFile(storageState, '{"cookies":[]}');
    const first = await resolveCaptureEnvironment(
      { environment: { storageState } },
      runtime,
    );
    await writeFile(storageState, '{"cookies":[{"name":"session"}]}');
    const second = await resolveCaptureEnvironment(
      { environment: { storageState } },
      runtime,
    );
    const third = await resolveCaptureEnvironment(
      { environment: { storageState } },
      { ...runtime, node: "23.0.0" },
    );

    expect(first.captureEnvironmentHash).not.toBe(
      second.captureEnvironmentHash,
    );
    expect(second.captureEnvironmentHash).not.toBe(
      third.captureEnvironmentHash,
    );
  });
});
