import { mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  trustedCaptureEnvironmentHash,
  trustedCaptureHeadless,
  trustedDemoPath,
} from "./studio-path-authority";

const roots: string[] = [];

afterEach(async () => {
  delete process.env.DEMOCRAFT_STUDIO_DEMO_PATH;
  delete process.env.DEMOCRAFT_STUDIO_CAPTURE_ENVIRONMENT_HASH;
  delete process.env.DEMOCRAFT_STUDIO_CAPTURE_HEADLESS;
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("Studio launch path authority", () => {
  it("validates the process-owned capture environment authority", () => {
    process.env.DEMOCRAFT_STUDIO_CAPTURE_ENVIRONMENT_HASH = `capture-env-v1:sha256:${"a".repeat(64)}`;
    process.env.DEMOCRAFT_STUDIO_CAPTURE_HEADLESS = "false";

    expect(trustedCaptureEnvironmentHash()).toBe(
      process.env.DEMOCRAFT_STUDIO_CAPTURE_ENVIRONMENT_HASH,
    );
    expect(trustedCaptureHeadless()).toBe(false);
    process.env.DEMOCRAFT_STUDIO_CAPTURE_ENVIRONMENT_HASH = "invalid";
    expect(() => trustedCaptureEnvironmentHash()).toThrow(
      "Invalid capture environment hash",
    );
  });

  it("authorizes the exact launch demo even when it is outside the workspace", async () => {
    const outside = await mkdtemp(
      path.join(tmpdir(), "democraft-demo-outside-"),
    );
    roots.push(outside);
    const demoPath = path.join(outside, "demo.mjs");
    await writeFile(demoPath, "export default {};");
    process.env.DEMOCRAFT_STUDIO_DEMO_PATH = await realpath(demoPath);

    await expect(trustedDemoPath()).resolves.toBe(await realpath(demoPath));
  });

  it("rejects when the launch demo is replaced by a symlink", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "democraft-demo-authority-"),
    );
    const outside = await mkdtemp(
      path.join(tmpdir(), "democraft-demo-replace-"),
    );
    roots.push(root, outside);
    const demoPath = path.join(root, "demo.mjs");
    const replacement = path.join(outside, "replacement.mjs");
    await Promise.all([
      writeFile(demoPath, "export default {};"),
      writeFile(replacement, "export default {};"),
    ]);
    process.env.DEMOCRAFT_STUDIO_DEMO_PATH = await realpath(demoPath);
    await rm(demoPath);
    await symlink(replacement, demoPath);

    await expect(trustedDemoPath()).rejects.toThrow(/escapes its allowed root/);
  });
});
