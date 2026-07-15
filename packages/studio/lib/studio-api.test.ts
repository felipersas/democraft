import { afterEach, describe, expect, it, vi } from "vitest";
import { STUDIO_SESSION_TOKEN_HEADER } from "./studio-session-contract";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("Studio mutation requests", () => {
  it("bootstraps same-origin and sends the token only in a header", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ token: "session-token" }, { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { studioMutationFetch } = await import("./studio-api");

    await studioMutationFetch("/api/render", {
      method: "POST",
      body: "{}",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/session", {
      cache: "no-store",
    });
    const [mutationUrl, mutationInit] = fetchMock.mock.calls[1]!;
    expect(mutationUrl).toBe("/api/render");
    expect(String(mutationUrl)).not.toContain("session-token");
    expect(
      new Headers(mutationInit?.headers).get(STUDIO_SESSION_TOKEN_HEADER),
    ).toBe("session-token");
  });

  it("turns a non-2xx response into an error with the API reason", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ token: "session-token" }))
      .mockResolvedValueOnce(
        Response.json(
          { error: "A re-capture is already running." },
          { status: 409 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { studioMutationRequest } = await import("./studio-api");

    await expect(
      studioMutationRequest(
        "/api/recapture",
        { method: "POST" },
        "Re-capture request failed.",
      ),
    ).rejects.toThrow("A re-capture is already running.");
  });

  it("propagates bootstrap and mutation network failures to callers", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ token: "session-token" }))
      .mockRejectedValueOnce(new Error("connection closed"));
    vi.stubGlobal("fetch", fetchMock);
    const { studioMutationRequest } = await import("./studio-api");

    await expect(
      studioMutationRequest(
        "/api/render/jobs",
        { method: "DELETE" },
        "Clear finished renders failed.",
      ),
    ).rejects.toThrow("connection closed");
  });
});
