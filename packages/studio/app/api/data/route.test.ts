import { describe, expect, it, vi } from "vitest";
import { ArtifactValidationError } from "@democraft/schema";

vi.mock("@/lib/fs", () => ({ existsDir: vi.fn(async () => true) }));
vi.mock("@/lib/server-data", () => ({
  studioDataDir: vi.fn(() => "/workspace/.democraft/studio-data"),
  loadStudioData: vi.fn(async () => {
    throw new ArtifactValidationError("render timeline", [
      { path: "$.fps", message: "Expected number", code: "invalid_type" },
    ]);
  }),
}));

import { GET } from "./route";

describe("GET /api/data", () => {
  it("returns structured 422 for invalid persisted artifacts", async () => {
    const response = await GET();

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      kind: "render timeline",
      issues: [{ path: "$.fps", code: "invalid_type" }],
    });
  });
});
