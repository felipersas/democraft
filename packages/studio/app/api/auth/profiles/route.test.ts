import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../lib/authentication-server", () => ({
  listStudioAuthenticationProfiles: vi.fn(async () => [
    {
      id: "auth_safe",
      name: "Admin",
      origin: "https://app.example",
      status: "authenticated",
      strategy: { type: "interactive" },
      validation: { url: "https://app.example" },
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      usage: [],
    },
  ]),
  createStudioAuthenticationProfile: vi.fn(async () => ({
    id: "auth_safe",
    name: "Admin",
    origin: "https://app.example",
    status: "not-configured",
  })),
}));

import { GET, POST } from "./route";

beforeEach(() => vi.stubEnv("DEMOCRAFT_STUDIO_SESSION_TOKEN", "test-token"));

describe("authentication profile routes", () => {
  it("keeps reads loopback-only and returns metadata without state", async () => {
    expect(
      (await GET(new Request("http://studio.example/api/auth/profiles")))
        .status,
    ).toBe(403);
    const response = await GET(
      new Request("http://127.0.0.1:3000/api/auth/profiles"),
    );
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("Admin");
    expect(text).not.toMatch(
      /cookies|localStorage|stateSha256|stateFile|token/i,
    );
  });

  it("requires same-origin session authorization for creation", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/profiles", {
        method: "POST",
        headers: {
          origin: "http://localhost",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Admin", origin: "https://app.example" }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("creates through the server application service", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/profiles", {
        method: "POST",
        headers: {
          origin: "http://localhost",
          "x-democraft-studio-token": "test-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Admin", origin: "https://app.example" }),
      }),
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      profile: { name: "Admin", status: "not-configured" },
    });
  });
});
