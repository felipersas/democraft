import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publish } from "@/lib/event-bus";
import { materializeStudioData } from "@/lib/materialize";
import { compileDemoModuleIsolated } from "../../../lib/compile-demo-isolated";

const capture = vi.hoisted(() => {
  let resolve!: (value: unknown) => void;
  return {
    promise: new Promise((done) => {
      resolve = done;
    }),
    resolve: (value: unknown) => resolve(value),
  };
});

vi.mock("@/lib/staleness", () => ({
  readMeta: vi.fn(async () => ({
    demoPath: "/workspace/demo.ts",
    captureDir: "/workspace/explicit",
    workspaceRoot: "/workspace",
    demoId: "demo",
    capturedAt: 1,
  })),
  loadDemo: vi.fn(async () => ({})),
}));
vi.mock("@/lib/server-data", () => ({
  studioDataDir: vi.fn(() => "/workspace/.democraft/studio-data"),
}));
vi.mock("@/lib/event-bus", () => ({ publish: vi.fn() }));
vi.mock("../../../lib/path-boundary", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/path-boundary")>()),
  resolveExactWritePath: vi.fn(async (candidate: string) => candidate),
  resolveWritePathWithin: vi.fn(
    async (_root: string, candidate: string) => candidate,
  ),
}));
vi.mock("../../../lib/studio-path-authority", () => ({
  trustedCaptureHeadless: vi.fn(() => true),
  trustedDemoPath: vi.fn(async () => "/workspace/demo.ts"),
  trustedWorkspaceRoot: vi.fn(async () => "/workspace"),
  trustedExplicitCaptureDirectory: vi.fn(() => "/workspace/explicit"),
  trustedStorageState: vi.fn(() => undefined),
}));
vi.mock("@/lib/materialize", () => ({
  buildMetaAfterCapture: vi.fn((meta) => meta),
  materializeStudioData: vi.fn(async () => undefined),
  updateMetaAfterCapture: vi.fn(async () => undefined),
}));
vi.mock("../../../lib/compile-demo-isolated", () => ({
  compileDemoModuleIsolated: vi.fn(async () => ({
    ir: { id: "demo" },
    diagnostics: [],
  })),
}));
vi.mock("@democraft/playwright", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@democraft/playwright")>()),
  runDemo: vi.fn(() => capture.promise),
}));
vi.mock("@democraft/timeline", () => ({
  resolveTimeline: vi.fn(() => ({ demoId: "demo" })),
}));

import { POST } from "./route";

beforeEach(() => {
  vi.stubEnv("DEMOCRAFT_STUDIO_SESSION_TOKEN", "test-token");
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/recapture", () => {
  it("rejects a concurrent recapture with 409", async () => {
    const first = POST(request());
    await vi.waitFor(async () => {
      const second = await POST(request());
      expect(second.status).toBe(409);
    });
    capture.resolve({
      schemaVersion: "1",
      demoId: "demo",
      steps: [],
      diagnostics: [],
    });
    expect((await first).status).toBe(200);
    expect(vi.mocked(materializeStudioData)).toHaveBeenCalledWith(
      expect.objectContaining({ meta: expect.any(Object) }),
    );
  });

  it("redacts secrets from JSON and SSE failures", async () => {
    vi.mocked(compileDemoModuleIsolated).mockRejectedValueOnce(
      new Error("Failed https://user:pass@example.test?token=abc&safe=ok"),
    );
    const response = await POST(request());
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed https://[redacted]@example.test?token=[redacted]&safe=ok",
    });
    expect(vi.mocked(publish)).toHaveBeenCalledWith(
      "recapture-progress",
      expect.objectContaining({
        phase: "failed",
        error:
          "Failed https://[redacted]@example.test?token=[redacted]&safe=ok",
      }),
    );
  });
});

function request(): Request {
  return new Request("http://127.0.0.1:3000/api/recapture", {
    method: "POST",
    headers: {
      origin: "http://127.0.0.1:3000",
      "x-democraft-studio-token": "test-token",
    },
  });
}
