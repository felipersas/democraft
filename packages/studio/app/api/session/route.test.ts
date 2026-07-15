import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/session", () => {
  it("returns the configured token only on loopback", async () => {
    vi.stubEnv("DEMOCRAFT_STUDIO_SESSION_TOKEN", "session-token");

    const response = await GET(
      new Request("http://127.0.0.1:3000/api/session"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, private");
    await expect(response.json()).resolves.toEqual({ token: "session-token" });
  });

  it("rejects a non-loopback target", async () => {
    vi.stubEnv("DEMOCRAFT_STUDIO_SESSION_TOKEN", "session-token");

    const response = await GET(
      new Request("http://studio.example/api/session"),
    );

    expect(response.status).toBe(403);
  });

  it("fails closed without a CLI-provided token", async () => {
    vi.stubEnv("DEMOCRAFT_STUDIO_SESSION_TOKEN", "");

    const response = await GET(new Request("http://[::1]:3000/api/session"));

    expect(response.status).toBe(503);
  });
});
