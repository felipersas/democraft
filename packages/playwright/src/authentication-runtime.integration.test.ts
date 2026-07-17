import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { schemaVersion, type DemoIR } from "@democraft/schema";
import {
  AuthenticationExecutionService,
  AuthenticationPaths,
  LocalAuthenticationRepository,
} from "../../authentication/src";
import { createAuthenticationValidationBrowser } from "./authentication-validation";
import { defaultBindings } from "./bindings";
import { runDemo } from "./runner";

const temporary: string[] = [];
let server: Server | undefined;

afterEach(async () => {
  await new Promise<void>(
    (resolve) => server?.close(() => resolve()) ?? resolve(),
  );
  server = undefined;
  await Promise.all(
    temporary.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("protected application authentication runtime", () => {
  it("blocks missing/expired sessions before artifacts and reuses an immutable session across scenes", async () => {
    let sessionValid = true;
    let protectedVisits = 0;
    server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (url.pathname === "/login") {
        response.writeHead(200, { "content-type": "text/html" });
        response.end("<h1>Login</h1>");
        return;
      }
      if (url.pathname === "/dashboard") {
        if (
          !sessionValid ||
          !request.headers.cookie?.includes("session=valid")
        ) {
          response.writeHead(302, { location: "/login" });
          response.end();
          return;
        }
        protectedVisits += 1;
        response.writeHead(200, { "content-type": "text/html" });
        response.end('<main data-testid="protected">Private dashboard</main>');
        return;
      }
      if (url.pathname === "/mutate") {
        response.writeHead(200, {
          "content-type": "text/html",
          "set-cookie": "runtime-change=discarded; Path=/; HttpOnly",
        });
        response.end("<p>Runtime state changed</p>");
        return;
      }
      response.writeHead(404).end();
    });
    await new Promise<void>((resolve) =>
      server!.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing test server address.");
    const origin = `http://127.0.0.1:${address.port}`;
    const workspace = await mkdtemp(join(tmpdir(), "democraft-auth-e2e-"));
    temporary.push(workspace);
    const paths = await AuthenticationPaths.fromWorkspace(workspace);
    const repository = new LocalAuthenticationRepository(paths);
    const browser = createAuthenticationValidationBrowser(defaultBindings);
    const execution = new AuthenticationExecutionService(
      repository,
      repository,
      browser,
    );

    const missingOutput = join(workspace, "missing-capture");
    await expect(
      runDemo(ir(origin, "auth_01arz3ndektsv4rrffq69g5fav"), {
        outputDir: missingOutput,
        authentication: execution,
      }),
    ).rejects.toMatchObject({ public: { code: "AUTH_PROFILE_NOT_FOUND" } });
    await expect(
      readFile(join(missingOutput, "metadata.json")),
    ).rejects.toThrow();

    const profile = await repository.create({
      name: "Protected app",
      origin,
      validation: {
        url: `${origin}/dashboard`,
        expect: { selector: '[data-testid="protected"]' },
      },
    });
    await repository.authenticate(profile.id, async () => ({
      cookies: [{ name: "session", value: "valid", url: origin }],
      origins: [],
    }));
    const loadedBefore = await repository.load(profile.id);
    const baseBefore = Buffer.from(
      await repository.resolve(loadedBefore.state),
    );
    const validOutput = join(workspace, "valid-capture");
    const manifest = await runDemo(ir(origin, profile.id), {
      outputDir: validOutput,
      headless: true,
      environment: { settle: false },
      authentication: execution,
    });

    expect(
      manifest.steps.filter((step) => step.url?.includes("/dashboard")),
    ).toHaveLength(2);
    expect(protectedVisits).toBeGreaterThanOrEqual(3); // preflight + two scenes
    const loadedAfter = await repository.load(profile.id);
    expect(Buffer.from(await repository.resolve(loadedAfter.state))).toEqual(
      baseBefore,
    );
    expect(
      Buffer.from(await repository.resolve(loadedAfter.state)).toString(),
    ).not.toContain("runtime-change");

    sessionValid = false;
    const expiredOutput = join(workspace, "expired-capture");
    await expect(
      runDemo(ir(origin, profile.id), {
        outputDir: expiredOutput,
        authentication: execution,
      }),
    ).rejects.toMatchObject({
      public: {
        code: "AUTH_SESSION_EXPIRED",
        profileId: profile.id,
        actionRequired: "interactive-login",
        status: "expired",
      },
    });
    await expect(
      readFile(join(expiredOutput, "metadata.json")),
    ).rejects.toThrow();
    expect((await repository.list())[0].status).toBe("expired");

    sessionValid = true;
    await repository.authenticate(profile.id, async () => ({
      cookies: [{ name: "session", value: "valid", url: origin }],
      origins: [],
    }));
    await expect(
      runDemo(ir(origin, profile.id), {
        outputDir: join(workspace, "renewed-capture"),
        headless: true,
        environment: { settle: false },
        authentication: execution,
      }),
    ).resolves.toMatchObject({ demoId: "protected-demo" });
  }, 30_000);
});

function ir(origin: string, profileId: string): DemoIR {
  return {
    schemaVersion,
    id: "protected-demo",
    title: "Protected demo",
    definitionHash: `definition-v1:sha256:${"a".repeat(64)}`,
    captureHash: `capture-v1:sha256:${"b".repeat(64)}`,
    source: { baseUrl: origin },
    authentication: { profileId },
    targets: {},
    scenes: [
      {
        id: "first",
        pacing: "normal",
        importance: "primary",
        steps: [
          { kind: "browser.goto", id: "first.goto.1", path: "/dashboard" },
        ],
      },
      {
        id: "second",
        pacing: "normal",
        importance: "primary",
        steps: [
          { kind: "browser.goto", id: "second.goto.1", path: "/dashboard" },
          { kind: "browser.goto", id: "second.goto.2", path: "/mutate" },
        ],
      },
    ],
  };
}
