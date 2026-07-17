import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as list } from "./profiles/route";
import { GET as association, PUT as associate } from "./association/route";
import { POST as create } from "./profiles/route";
import {
  PATCH as rename,
  DELETE as remove,
} from "./profiles/[profileId]/route";
import { POST as validate } from "./profiles/[profileId]/validate/route";
import { POST as login } from "./profiles/[profileId]/login/route";
import { POST as complete } from "./login/[operationId]/complete/route";
import { POST as cancel } from "./login/[operationId]/cancel/route";
import { POST as events } from "./login/[operationId]/events/route";

const profileContext = {
  params: Promise.resolve({ profileId: "auth_01arz3ndektsv4rrffq69g5fav" }),
};
const operationContext = {
  params: Promise.resolve({ operationId: "operation" }),
};
beforeEach(() => vi.stubEnv("DEMOCRAFT_STUDIO_SESSION_TOKEN", "test-token"));

describe("authentication route authorization", () => {
  it.each([
    ["profiles", list],
    ["association", association],
  ] as const)("keeps %s reads on loopback", async (_name, handler) => {
    expect(
      (await handler(new Request("https://studio.example/api/auth"))).status,
    ).toBe(403);
  });

  it.each([
    ["create", (request: Request) => create(request)],
    ["associate", (request: Request) => associate(request)],
    ["rename", (request: Request) => rename(request, profileContext)],
    ["remove", (request: Request) => remove(request, profileContext)],
    ["validate", (request: Request) => validate(request, profileContext)],
    ["login", (request: Request) => login(request, profileContext)],
    ["complete", (request: Request) => complete(request, operationContext)],
    ["cancel", (request: Request) => cancel(request, operationContext)],
    ["events", (request: Request) => events(request, operationContext)],
  ])("rejects %s without the Studio token", async (_name, handler) => {
    const request = new Request("http://localhost/api/auth", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: "{}",
    });
    expect((await handler(request)).status).toBe(401);
  });
});
