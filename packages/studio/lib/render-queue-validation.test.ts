import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArtifactValidationError } from "@democraft/schema";
import { renderDemoVideo } from "@democraft/remotion/server";
import { clearFinished, enqueue, getJob } from "./render-queue";

vi.mock("./server-data", () => ({
  loadStudioData: vi.fn(async () => {
    throw new ArtifactValidationError("render timeline", [
      { path: "$.fps", message: "Expected number", code: "invalid_type" },
    ]);
  }),
}));

vi.mock("@democraft/remotion/server", () => ({
  createRenderArtifact: vi.fn(),
  renderDemoVideo: vi.fn(),
  cancelRenderArtifact: vi.fn(),
  completeRenderArtifact: vi.fn(),
  failRenderArtifact: vi.fn(),
}));

beforeEach(() => {
  clearFinished();
  vi.mocked(renderDemoVideo).mockClear();
});

describe("Studio render queue validation boundary", () => {
  it("does not invoke the renderer when persisted input is invalid", async () => {
    const job = enqueue({});

    await vi.waitFor(() => expect(getJob(job.id)?.status).toBe("failed"));
    expect(getJob(job.id)?.error).toContain("Invalid render timeline");
    expect(renderDemoVideo).not.toHaveBeenCalled();
  });
});
