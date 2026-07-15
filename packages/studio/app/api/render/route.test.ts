import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ enqueue: vi.fn() }));

vi.mock("@/lib/render-queue", () => ({
  enqueue: mocks.enqueue,
  listJobs: vi.fn(() => []),
  serializeJob: vi.fn((job) => job),
}));

import { POST } from "./route";

beforeEach(() => mocks.enqueue.mockReset());

describe("POST /api/render", () => {
  it.each([
    [null, "$"],
    [{ width: 0 }, "$.width"],
    [{ crf: 52 }, "$.crf"],
    [{ frameRange: [10, 1] }, "$.frameRange"],
    [{ entryPath: "" }, "$.entryPath"],
  ])("rejects invalid request %#", async (body, path) => {
    const response = await POST(jsonRequest(body));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      kind: "studio render request",
      issues: [expect.objectContaining({ path })],
    });
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      issues: [{ path: "$", code: "invalid_json" }],
    });
  });

  it("enqueues a valid bounded request", async () => {
    mocks.enqueue.mockReturnValueOnce({ id: "job-1", status: "pending" });
    const body = {
      width: 1920,
      height: 1080,
      scale: 1,
      crf: 20,
      frameRange: [0, 10],
      entryPath: "entry.ts",
      captionOverrides: { caption: "Updated" },
    };

    const response = await POST(jsonRequest(body));

    expect(response.status).toBe(200);
    expect(mocks.enqueue).toHaveBeenCalledWith(body);
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/render", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
