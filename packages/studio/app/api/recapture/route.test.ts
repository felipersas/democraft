import { describe, expect, it, vi } from "vitest";
import { compileDemo } from "@democraft/compiler";
import { publish } from "@/lib/event-bus";

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
vi.mock("@/lib/materialize", () => ({
  materializeStudioData: vi.fn(async () => undefined),
  updateMetaAfterCapture: vi.fn(async () => undefined),
}));
vi.mock("@democraft/compiler", () => ({
  compileDemo: vi.fn(async () => ({
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

describe("POST /api/recapture", () => {
  it("rejects a concurrent recapture with 409", async () => {
    const first = POST();
    await vi.waitFor(async () => {
      const second = await POST();
      expect(second.status).toBe(409);
    });
    capture.resolve({
      schemaVersion: "1",
      demoId: "demo",
      steps: [],
      diagnostics: [],
    });
    expect((await first).status).toBe(200);
  });

  it("redacts secrets from JSON and SSE failures", async () => {
    vi.mocked(compileDemo).mockRejectedValueOnce(
      new Error("Failed https://user:pass@example.test?token=abc&safe=ok"),
    );
    const response = await POST();
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
