import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/render-queue", () => ({ getJob: vi.fn() }));
vi.mock("../../../lib/request-security", () => ({
  authorizeStudioMutation: vi.fn(() => undefined),
}));

import { getJob } from "@/lib/render-queue";
import { POST } from "./route";

beforeEach(() => vi.mocked(getJob).mockReset());

describe("POST /api/open-folder", () => {
  it("does not accept a public filesystem path", async () => {
    const response = await POST(
      new Request("http://localhost/api/open-folder?path=/tmp/private", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    expect(getJob).not.toHaveBeenCalled();
  });

  it("resolves output only through a known job id", async () => {
    vi.mocked(getJob).mockReturnValue(undefined);

    const response = await POST(
      new Request("http://localhost/api/open-folder?jobId=unknown", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(404);
    expect(getJob).toHaveBeenCalledWith("unknown");
  });
});
