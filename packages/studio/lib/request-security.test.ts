import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authorizeStudioMutation,
  authorizeStudioSessionBootstrap,
  STUDIO_SESSION_TOKEN_ENV,
} from "./request-security";
import { STUDIO_SESSION_TOKEN_HEADER } from "./studio-session-contract";

const TOKEN = "test-session-token";

afterEach(() => vi.unstubAllEnvs());

describe("Studio request security", () => {
  it.each([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
  ])("allows an authenticated same-origin mutation on %s", (origin) => {
    vi.stubEnv(STUDIO_SESSION_TOKEN_ENV, TOKEN);

    expect(authorizeStudioMutation(request(origin))).toBeUndefined();
  });

  it.each([
    ["http://localhost:3000", "http://127.0.0.1:3000"],
    ["http://127.0.0.1:3000", "http://localhost:3000"],
  ])(
    "allows equivalent loopback aliases from %s to %s",
    (requestOrigin, browserOrigin) => {
      vi.stubEnv(STUDIO_SESSION_TOKEN_ENV, TOKEN);

      expect(
        authorizeStudioMutation(request(requestOrigin, browserOrigin)),
      ).toBeUndefined();
    },
  );

  it.each([
    [null, 403],
    ["https://attacker.example", 403],
    ["http://127.0.0.1:4000", 403],
    ["not a url", 403],
  ])("rejects origin %s", (origin, status) => {
    vi.stubEnv(STUDIO_SESSION_TOKEN_ENV, TOKEN);

    expect(
      authorizeStudioMutation(request("http://127.0.0.1:3000", origin)),
    ).toMatchObject({ status });
  });

  it("rejects a non-loopback request target", () => {
    vi.stubEnv(STUDIO_SESSION_TOKEN_ENV, TOKEN);

    expect(
      authorizeStudioMutation(request("http://studio.example")),
    ).toMatchObject({ status: 403 });
    expect(
      authorizeStudioSessionBootstrap(
        new Request("http://studio.example/api/session"),
      ),
    ).toMatchObject({ status: 403 });
  });

  it.each([null, "wrong-token"])("rejects token %s", (token) => {
    vi.stubEnv(STUDIO_SESSION_TOKEN_ENV, TOKEN);

    expect(
      authorizeStudioMutation(
        request("http://127.0.0.1:3000", undefined, token),
      ),
    ).toMatchObject({ status: 401 });
  });

  it("fails closed when the CLI session token is not configured", () => {
    vi.stubEnv(STUDIO_SESSION_TOKEN_ENV, "");

    expect(
      authorizeStudioMutation(request("http://127.0.0.1:3000")),
    ).toMatchObject({ status: 503 });
  });
});

function request(
  origin: string,
  originHeader: string | null | undefined = origin,
  token: string | null | undefined = TOKEN,
): Request {
  const headers = new Headers();
  if (originHeader) headers.set("origin", originHeader);
  if (token) headers.set(STUDIO_SESSION_TOKEN_HEADER, token);
  return new Request(`${origin}/api/render`, { method: "POST", headers });
}
