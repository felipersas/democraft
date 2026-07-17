import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authorizeStudioMutation,
  authorizeStudioSessionBootstrap,
  STUDIO_SESSION_TOKEN_ENV,
} from "./request-security";
import { STUDIO_SESSION_TOKEN_HEADER } from "./studio-session-contract";

const TOKEN = "test-session-token";

afterEach(() => vi.unstubAllEnvs());

describe("authorizeStudioMutation", () => {
  describe("accepts an authenticated loopback mutation", () => {
    // The framework-reconstructed request.url is NOT an authorization
    // authority: any combination of loopback aliases, ports, and a matching
    // token must succeed. A same-origin browser also sends Sec-Fetch-Site.
    it.each([
      ["http://127.0.0.1:3000", "http://127.0.0.1:3000"],
      ["http://localhost:3000", "http://127.0.0.1:3000"],
      ["http://127.0.0.1:3000", "http://localhost:3000"],
      ["http://[::1]:3000", "http://[::1]:3000"],
      // Different textual ports between request.url and Origin MUST still pass:
      // Next can reconstruct a different port than the browser sent.
      ["http://127.0.0.1:3000", "http://127.0.0.1:3001"],
      ["http://localhost:3000", "http://localhost:9999"],
    ])("target %s, origin %s", (target, origin) => {
      vi.stubEnv(STUDIO_SESSION_TOKEN_ENV, TOKEN);

      expect(
        authorizeStudioMutation(
          mutationRequest({ target, origin, fetchSite: "same-origin" }),
        ),
      ).toBeUndefined();
    });

    it("accepts when Origin is absent (non-browser caller)", () => {
      vi.stubEnv(STUDIO_SESSION_TOKEN_ENV, TOKEN);

      expect(
        authorizeStudioMutation(
          mutationRequest({ target: "http://127.0.0.1:3000", origin: null }),
        ),
      ).toBeUndefined();
    });

    it("accepts when Sec-Fetch-Site is absent with a valid token", () => {
      vi.stubEnv(STUDIO_SESSION_TOKEN_ENV, TOKEN);

      expect(
        authorizeStudioMutation(
          mutationRequest({
            target: "http://127.0.0.1:3000",
            origin: "http://127.0.0.1:3000",
            fetchSite: null,
          }),
        ),
      ).toBeUndefined();
    });
  });

  describe("rejects", () => {
    it("a non-loopback request target", async () => {
      vi.stubEnv(STUDIO_SESSION_TOKEN_ENV, TOKEN);

      await expectDenial(
        authorizeStudioMutation(
          mutationRequest({ target: "http://studio.example:3000" }),
        ),
        "non_loopback_target",
        403,
      );
    });

    it.each([
      ["https://attacker.example", "non_loopback_origin"],
      ["not a url", "non_loopback_origin"],
    ])("origin %s", async (origin, code) => {
      vi.stubEnv(STUDIO_SESSION_TOKEN_ENV, TOKEN);

      await expectDenial(
        authorizeStudioMutation(
          mutationRequest({ target: "http://127.0.0.1:3000", origin }),
        ),
        code,
        403,
      );
    });

    it.each(["cross-site", "same-site", "none"])(
      "Sec-Fetch-Site: %s",
      async (fetchSite) => {
        vi.stubEnv(STUDIO_SESSION_TOKEN_ENV, TOKEN);

        await expectDenial(
          authorizeStudioMutation(
            mutationRequest({
              target: "http://127.0.0.1:3000",
              origin: "http://127.0.0.1:3000",
              fetchSite,
            }),
          ),
          "cross_site_request",
          403,
        );
      },
    );

    it.each([null, "wrong-token"])("token %s", async (token) => {
      vi.stubEnv(STUDIO_SESSION_TOKEN_ENV, TOKEN);

      await expectDenial(
        authorizeStudioMutation(
          mutationRequest({
            target: "http://127.0.0.1:3000",
            origin: "http://127.0.0.1:3000",
            token,
          }),
        ),
        "invalid_session_token",
        401,
      );
    });

    it("fails closed when the CLI session token is not configured", async () => {
      vi.stubEnv(STUDIO_SESSION_TOKEN_ENV, "");

      await expectDenial(
        authorizeStudioMutation(
          mutationRequest({
            target: "http://127.0.0.1:3000",
            origin: "http://127.0.0.1:3000",
          }),
        ),
        "session_not_configured",
        503,
      );
    });
  });

  it("does not log the session token header in the dev diagnostic", () => {
    vi.stubEnv(STUDIO_SESSION_TOKEN_ENV, TOKEN);
    vi.stubEnv("NODE_ENV", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    authorizeStudioMutation(
      mutationRequest({
        target: "http://127.0.0.1:3000",
        origin: "https://attacker.example",
      }),
    );

    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls[0]![0]).toBe("[studio-security] request denied");
    const serialized = JSON.stringify(warn.mock.calls[0]![1]);
    expect(serialized).not.toContain(TOKEN);
    expect(serialized).not.toContain("x-democraft-studio-token");
  });
});

describe("authorizeStudioSessionBootstrap", () => {
  it.each([
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://[::1]:3000",
  ])("allows a loopback target without Fetch Metadata on %s", (target) => {
    expect(
      authorizeStudioSessionBootstrap(new Request(`${target}/api/session`)),
    ).toBeUndefined();
  });

  it("allows same-origin Fetch Metadata", () => {
    expect(
      authorizeStudioSessionBootstrap(
        new Request("http://127.0.0.1:3000/api/session", {
          headers: { "sec-fetch-site": "same-origin" },
        }),
      ),
    ).toBeUndefined();
  });

  it("rejects a non-loopback target", async () => {
    await expectDenial(
      authorizeStudioSessionBootstrap(
        new Request("http://studio.example/api/session"),
      ),
      "non_loopback_target",
      403,
    );
  });

  it.each(["cross-site", "same-site", "none"])(
    "rejects Sec-Fetch-Site: %s",
    async (fetchSite) => {
      await expectDenial(
        authorizeStudioSessionBootstrap(
          new Request("http://127.0.0.1:3000/api/session", {
            headers: { "sec-fetch-site": fetchSite },
          }),
        ),
        "cross_site_request",
        403,
      );
    },
  );
});

type MutationRequestOptions = {
  target: string;
  origin?: string | null;
  token?: string | null;
  fetchSite?: string | null;
};

function mutationRequest({
  target,
  origin,
  token,
  fetchSite,
}: MutationRequestOptions): Request {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  if (token === undefined) headers.set(STUDIO_SESSION_TOKEN_HEADER, TOKEN);
  else if (token) headers.set(STUDIO_SESSION_TOKEN_HEADER, token);
  if (fetchSite) headers.set("sec-fetch-site", fetchSite);
  return new Request(`${target}/api/render`, { method: "POST", headers });
}

/** Asserts both the HTTP status and the machine-readable denial code body. */
async function expectDenial(
  response: Response | undefined,
  code: string,
  status: number,
): Promise<void> {
  expect(response).toBeDefined();
  expect(response!.status).toBe(status);
  await expect(response!.json()).resolves.toMatchObject({
    error: expect.any(String),
    code,
  });
}
