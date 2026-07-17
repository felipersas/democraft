import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DemoIR, Locator } from "@democraft/schema";
import { schemaVersion } from "@democraft/schema";
import {
  resolveTarget,
  runDemoWithBindings,
  type PlaywrightBindings,
} from "./index";
import type { PageLike } from "./types";

const tempDirs: string[] = [];
const DEFINITION_HASH = `definition-v1:sha256:${"a".repeat(64)}`;
const CAPTURE_HASH = `capture-v1:sha256:${"b".repeat(64)}`;

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

describe("playwright runtime", () => {
  it("resolves targets with ordered locator fallbacks", async () => {
    const page = createMockPage({
      role: { visible: false },
      testId: { visible: true, box: { x: 1, y: 2, width: 3, height: 4 } },
    });

    const result = await resolveTarget(
      createIR([
        { kind: "role", role: "button", name: "Create" },
        { kind: "testId", id: "create" },
      ]),
      page,
      "button",
    );

    expect(result.snapshot.attemptedLocators).toEqual([
      {
        locator: { kind: "role", role: "button", name: "Create" },
        success: false,
      },
      { locator: { kind: "testId", id: "create" }, success: true },
    ]);
    expect(result.snapshot.successfulLocator).toEqual({
      kind: "testId",
      id: "create",
    });
    expect(result.snapshot.boundingBox).toEqual({
      x: 1,
      y: 2,
      width: 3,
      height: 4,
    });
  });

  it("executes browser steps and writes a manifest", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "democraft-"));
    tempDirs.push(outputDir);

    const page = createMockPage({
      testId: {
        visible: true,
        text: "Created",
        box: { x: 1, y: 2, width: 3, height: 4 },
      },
    });
    const bindings = createBindings(page);

    const manifest = await runDemoWithBindings(
      createIR([{ kind: "testId", id: "button" }]),
      bindings,
      {
        outputDir,
        // Disable settling: this test asserts an exact call/wait sequence from
        // the fixed-hold path. Settle behavior is covered by its own tests.
        // Short step timeout keeps the non-navigating click (mock URL never
        // changes) from waiting the full default nav timeout.
        timeoutMs: 200,
        environment: { viewport: { width: 800, height: 600 }, settle: false },
      },
    );

    expect(page.calls).toEqual([
      "goto:http://localhost:3000/dashboard",
      "isVisible",
      "click",
      "isVisible",
      "isVisible",
      "textContent",
    ]);
    expect(page.waits).toEqual([700, 650, 300, 300]);
    expect(manifest.recording).toEqual({
      path: "video.webm",
      width: 800,
      height: 600,
    });
    expect(manifest.tracePath).toBe(join(outputDir, "trace.zip"));
    expect(manifest.steps.map((step) => step.kind)).toEqual([
      "browser.goto",
      "browser.click",
      "assert.visible",
      "assert.text",
    ]);
    expect(manifest.diagnostics).toEqual([]);

    const manifestJson = JSON.parse(
      await readFile(join(outputDir, "manifest.json"), "utf8"),
    );
    expect(manifestJson.demoId).toBe("demo");
    expect(manifestJson.definitionHash).toBe(DEFINITION_HASH);
    expect(manifestJson.captureHash).toBe(CAPTURE_HASH);
    expect(manifestJson.captureEnvironmentHash).toMatch(
      /^capture-env-v1:sha256:[a-f0-9]{64}$/,
    );
    const metadataJson = JSON.parse(
      await readFile(join(outputDir, "metadata.json"), "utf8"),
    );
    expect(metadataJson.captureEnvironmentHash).toBe(
      manifestJson.captureEnvironmentHash,
    );
  });

  it("rejects invalid IR before launching a browser or writing a manifest", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "democraft-"));
    tempDirs.push(outputDir);
    const launch = vi.fn(createBindings(createMockPage({})).chromium.launch);
    const invalid = { ...createIR([]), id: "" };

    await expect(
      runDemoWithBindings(invalid, { chromium: { launch } }, { outputDir }),
    ).rejects.toThrow("$.id");
    expect(launch).not.toHaveBeenCalled();
    await expect(readFile(join(outputDir, "manifest.json"))).rejects.toThrow();
  });

  it("completes authentication preflight before creating capture artifacts", async () => {
    const parent = await mkdtemp(join(tmpdir(), "democraft-auth-preflight-"));
    tempDirs.push(parent);
    const outputDir = join(parent, "capture");
    const launch = vi.fn(createBindings(createMockPage({})).chromium.launch);
    const ir = {
      ...createIR([{ kind: "testId", id: "button" }]),
      authentication: { profileId: "auth_01arz3ndektsv4rrffq69g5fav" },
    };
    const failure = Object.assign(new Error("Session expired"), {
      public: {
        code: "AUTH_SESSION_EXPIRED",
        profileId: ir.authentication.profileId,
        actionRequired: "interactive-login",
        message: "Session expired",
        stage: "capture-preflight",
      },
    });

    await expect(
      runDemoWithBindings(
        ir,
        { chromium: { launch } },
        {
          outputDir,
          authentication: { prepare: async () => Promise.reject(failure) },
        },
      ),
    ).rejects.toBe(failure);
    expect(launch).not.toHaveBeenCalled();
    await expect(readFile(join(outputDir, "metadata.json"))).rejects.toThrow();
  });

  it("restores one immutable profile snapshot into one context for all scenes", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "democraft-auth-runtime-"));
    tempDirs.push(outputDir);
    const page = createMockPage({});
    const base = createIR([{ kind: "testId", id: "button" }]);
    const ir = {
      ...base,
      authentication: { profileId: "auth_01arz3ndektsv4rrffq69g5fav" },
      scenes: [base.scenes[0], { ...base.scenes[0], id: "second" }],
    };
    const contextOptions: Record<string, unknown>[] = [];
    const bindings = createBindings(page);
    const originalLaunch = bindings.chromium.launch;
    bindings.chromium.launch = async (options) => {
      const browser = await originalLaunch(options);
      const originalNewContext = browser.newContext;
      browser.newContext = async (context) => {
        contextOptions.push(context ?? {});
        return originalNewContext(context);
      };
      return browser;
    };
    const prepare = vi.fn(async () => ({
      state: Buffer.from(
        JSON.stringify({
          schemaVersion: 1,
          data: {
            cookies: [{ name: "session", value: "secret" }],
            origins: [],
          },
        }),
      ),
      stateSha256: "c".repeat(64),
    }));

    await runDemoWithBindings(ir, bindings, {
      outputDir,
      environment: { settle: false },
      authentication: { prepare },
    });

    expect(prepare).toHaveBeenCalledOnce();
    expect(contextOptions).toHaveLength(1);
    expect(contextOptions[0].storageState).toEqual({
      cookies: [{ name: "session", value: "secret" }],
      origins: [],
    });
  });

  it("rejects profile and legacy storage state together before side effects", async () => {
    const parent = await mkdtemp(join(tmpdir(), "democraft-auth-conflict-"));
    tempDirs.push(parent);
    const outputDir = join(parent, "capture");
    const launch = vi.fn(createBindings(createMockPage({})).chromium.launch);
    const ir = {
      ...createIR([{ kind: "testId", id: "button" }]),
      authentication: { profileId: "auth_01arz3ndektsv4rrffq69g5fav" },
    };
    await expect(
      runDemoWithBindings(
        ir,
        { chromium: { launch } },
        {
          outputDir,
          environment: { storageState: "legacy.json" },
          authentication: {
            prepare: async () => ({
              state: new Uint8Array(),
              stateSha256: "x",
            }),
          },
        },
      ),
    ).rejects.toMatchObject({ code: "AUTH_NOT_CONFIGURED" });
    expect(launch).not.toHaveBeenCalled();
    await expect(readFile(join(outputDir, "metadata.json"))).rejects.toThrow();
  });

  it.each([
    [{ width: 0, height: 600 }, "viewport.width"],
    [{ width: 800, height: Number.NaN }, "viewport.height"],
  ])("rejects invalid viewport before launch", async (viewport, message) => {
    const outputDir = await mkdtemp(join(tmpdir(), "democraft-"));
    tempDirs.push(outputDir);
    const launch = vi.fn(createBindings(createMockPage({})).chromium.launch);

    await expect(
      runDemoWithBindings(
        createIR([{ kind: "testId", id: "button" }]),
        { chromium: { launch } },
        { outputDir, environment: { viewport } },
      ),
    ).rejects.toThrow(message);
    expect(launch).not.toHaveBeenCalled();
    await expect(readFile(join(outputDir, "manifest.json"))).rejects.toThrow();
  });

  it("rejects invalid deviceScaleFactor before launch", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "democraft-"));
    tempDirs.push(outputDir);
    const launch = vi.fn(createBindings(createMockPage({})).chromium.launch);

    await expect(
      runDemoWithBindings(
        createIR([{ kind: "testId", id: "button" }]),
        { chromium: { launch } },
        { outputDir, environment: { deviceScaleFactor: 0 } },
      ),
    ).rejects.toThrow("deviceScaleFactor");
    expect(launch).not.toHaveBeenCalled();
    await expect(readFile(join(outputDir, "manifest.json"))).rejects.toThrow();
  });

  it("honors an already-aborted signal with zero filesystem or browser side effects", async () => {
    const parent = await mkdtemp(join(tmpdir(), "democraft-abort-"));
    tempDirs.push(parent);
    const outputDir = join(parent, "capture");
    const launch = vi.fn(createBindings(createMockPage({})).chromium.launch);
    const controller = new AbortController();
    controller.abort();

    await expect(
      runDemoWithBindings(
        createIR([{ kind: "testId", id: "button" }]),
        { chromium: { launch } },
        { outputDir, signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(launch).not.toHaveBeenCalled();
    await expect(readFile(join(outputDir, "metadata.json"))).rejects.toThrow();
  });

  it("records browser launch failures as terminal metadata", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "democraft-launch-"));
    tempDirs.push(outputDir);
    const launch = vi.fn(async () => {
      throw new Error(`Chromium missing at ${outputDir}/browser`);
    });

    await expect(
      runDemoWithBindings(
        createIR([{ kind: "testId", id: "button" }]),
        { chromium: { launch } },
        { outputDir },
      ),
    ).rejects.toThrow("Chromium missing");
    expect(
      JSON.parse(await readFile(join(outputDir, "metadata.json"), "utf8")),
    ).toMatchObject({
      status: "failed",
      error: { message: "Chromium missing at [capture]/browser" },
    });
    await expect(readFile(join(outputDir, "manifest.json"))).rejects.toThrow();
  });

  it("does not classify an arbitrary AbortError name as cancellation", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "democraft-abort-name-"));
    tempDirs.push(outputDir);
    const launch = vi.fn(async () => {
      const error = new Error("browser protocol abort");
      error.name = "AbortError";
      throw error;
    });
    await expect(
      runDemoWithBindings(
        createIR([{ kind: "testId", id: "button" }]),
        { chromium: { launch } },
        { outputDir },
      ),
    ).rejects.toThrow("browser protocol abort");
    expect(
      JSON.parse(await readFile(join(outputDir, "metadata.json"), "utf8")),
    ).toMatchObject({ status: "failed" });
  });

  it("closes context and browser when trace startup fails", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "democraft-trace-"));
    tempDirs.push(outputDir);
    const contextClose = vi.fn(async () => undefined);
    const browserClose = vi.fn(async () => undefined);

    await expect(
      runDemoWithBindings(
        createIR([{ kind: "testId", id: "button" }]),
        {
          chromium: {
            launch: async () => ({
              close: browserClose,
              newContext: async () => ({
                newPage: async () => createMockPage({}),
                close: contextClose,
                tracing: {
                  start: async () => {
                    throw new Error("trace unavailable");
                  },
                  stop: async () => undefined,
                },
              }),
            }),
          },
        },
        { outputDir },
      ),
    ).rejects.toThrow("trace unavailable");
    expect(contextClose).toHaveBeenCalledOnce();
    expect(browserClose).toHaveBeenCalledOnce();
    expect(
      JSON.parse(await readFile(join(outputDir, "metadata.json"), "utf8")),
    ).toMatchObject({ status: "failed" });
  });

  it("cancels between steps and always stops trace and closes resources", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "democraft-cancel-"));
    tempDirs.push(outputDir);
    const controller = new AbortController();
    const page = createMockPage({});
    page.goto = async (url: string) => {
      page.calls.push(`goto:${url}`);
      controller.abort();
    };
    const traceStop = vi.fn(async () => undefined);
    const contextClose = vi.fn(async () => undefined);
    const browserClose = vi.fn(async () => undefined);
    const bindings: PlaywrightBindings = {
      chromium: {
        launch: async () => ({
          close: browserClose,
          newContext: async () => ({
            newPage: async () => page,
            close: contextClose,
            tracing: {
              start: async () => undefined,
              stop: traceStop,
            },
          }),
        }),
      },
    };

    await expect(
      runDemoWithBindings(
        createIR([{ kind: "testId", id: "button" }]),
        bindings,
        {
          outputDir,
          signal: controller.signal,
          environment: { settle: false },
        },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(traceStop).toHaveBeenCalledWith({
      path: join(outputDir, "trace.zip"),
    });
    expect(contextClose).toHaveBeenCalledOnce();
    expect(browserClose).toHaveBeenCalledOnce();
    expect(
      JSON.parse(await readFile(join(outputDir, "metadata.json"), "utf8")),
    ).toMatchObject({ status: "cancelled" });
    await expect(readFile(join(outputDir, "manifest.json"))).rejects.toThrow();
  });

  it("validates the produced manifest before writing or returning it", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "democraft-"));
    tempDirs.push(outputDir);
    const page = createMockPage({
      testId: {
        visible: true,
        text: "Created",
        box: { x: 1, y: 2, width: Number.NaN, height: 4 },
      },
    });

    await expect(
      runDemoWithBindings(
        createIR([{ kind: "testId", id: "button" }]),
        createBindings(page),
        { outputDir, timeoutMs: 10, environment: { settle: false } },
      ),
    ).rejects.toThrow("boundingBox.width");
    await expect(readFile(join(outputDir, "manifest.json"))).rejects.toThrow();
  });

  it("records assertion diagnostics without throwing opaque errors", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "democraft-"));
    tempDirs.push(outputDir);

    const page = createMockPage({
      testId: { visible: false, text: "Nope" },
    });

    const manifest = await runDemoWithBindings(
      createIR([{ kind: "testId", id: "button" }]),
      createBindings(page),
      {
        outputDir,
        timeoutMs: 200,
        environment: { settle: false },
      },
    );

    expect(manifest.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "DC201",
        details: {
          attemptedLocators: [
            { locator: { kind: "testId", id: "button" }, success: false },
          ],
        },
        message: 'Target "button" could not be resolved.',
        path: "scenes.scene.steps.scene.browser-click-button.2.target",
        suggestion: expect.stringContaining("locators"),
        stepId: "scene.browser-click-button.2",
        targetId: "button",
      }),
    );
    expect(manifest.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "DC201",
        stepId: "scene.assert-visible-button.3",
        targetId: "button",
      }),
    );
  });

  it("records screenshot failures without declaring a screenshot path", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "democraft-screenshot-"));
    tempDirs.push(outputDir);
    const page = createMockPage({
      testId: { visible: true, text: "Created" },
    });
    page.screenshot = async () => {
      throw new Error("disk full");
    };
    const manifest = await runDemoWithBindings(
      createIR([{ kind: "testId", id: "button" }]),
      createBindings(page),
      { outputDir, timeoutMs: 10, environment: { settle: false } },
    );
    expect(manifest.steps.every((step) => !step.screenshotPath)).toBe(true);
    expect(manifest.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        message: "Screenshot failed: disk full",
      }),
    );
  });

  it("waits for client-side navigation after a navigating click", async () => {
    const { waitForClientNavigation } = await import("./execute");

    // Emulate an SPA: the URL changes a tick after the click resolves. The
    // wait should notice the new URL and call waitForLoadState to settle the
    // incoming view.
    const calls: string[] = [];
    let currentUrl = "http://localhost:3000/dashboard";
    const urlBefore = currentUrl;
    setTimeout(() => {
      currentUrl = "http://localhost:3000/dashboard/new";
    }, 30);

    await waitForClientNavigation(
      {
        url: () => currentUrl,
        waitForLoadState: async (state?: string) => {
          calls.push(state ?? "load");
        },
      },
      urlBefore,
      1000,
    );

    expect(calls).toContain("domcontentloaded");
  });

  it("does not stall when a click does not navigate", async () => {
    const { waitForClientNavigation } = await import("./execute");

    const start = Date.now();
    // URL never changes — emulate a dialog/toggle click. Must resolve on its
    // own (the timeout) without throwing. Short timeout keeps the test fast.
    await waitForClientNavigation(
      { url: () => "http://localhost:3000/same" },
      "http://localhost:3000/same",
      300,
    );
    // Resolves within the timeout budget (not much longer).
    expect(Date.now() - start).toBeLessThan(1500);
  });

  it("settle: waits for DOM mutations to quiet down", async () => {
    const { waitForSettled } = await import("./settle");
    const { DEFAULT_SETTLE_STRATEGY } = await import("./types");

    // Simulate a page that mutates for a bit, then stops. Each evaluate call
    // returns the mutation count since the last read; the settle gate should
    // keep going until a clean idle window elapses with zero mutations.
    let mutationBurstRemaining = 3; // 3 noisy reads, then quiet
    const evaluateCalls: string[] = [];
    const fakePage = {
      url: () => "http://localhost:3000/x",
      evaluate: async <T>(fn: () => T | Promise<T>): Promise<T> => {
        void fn;
        evaluateCalls.push("evaluate");
        // The settle gate reads the mutation counter (which our helper does in
        // the page). The mock can't run the real MutationObserver, so it models
        // the *outcome*: return the remaining burst count, decrementing.
        const count = mutationBurstRemaining > 0 ? 1 : 0;
        mutationBurstRemaining = Math.max(0, mutationBurstRemaining - 1);
        return count as unknown as T;
      },
    };

    const start = Date.now();
    await waitForSettled(fakePage as unknown as PageLike, {
      ...DEFAULT_SETTLE_STRATEGY,
      idleWindowMs: 60,
      timeoutMs: 2000,
      signal: "dom",
    });
    const elapsed = Date.now() - start;

    // It polled more than once and eventually resolved (didn't time out).
    expect(evaluateCalls.length).toBeGreaterThan(1);
    expect(elapsed).toBeLessThan(2000);
  });

  it("settle: gives up at timeout without throwing (best-effort)", async () => {
    const { waitForSettled } = await import("./settle");
    const { DEFAULT_SETTLE_STRATEGY } = await import("./types");

    // A page that NEVER quiets (every visual sample differs). Must resolve at
    // the timeout without throwing.
    let n = 0;
    const fakePage = {
      url: () => "http://localhost:3000/x",
      screenshot: async () => Buffer.from(`frame-${n++}`), // always different
    };

    const start = Date.now();
    await waitForSettled(fakePage as unknown as PageLike, {
      ...DEFAULT_SETTLE_STRATEGY,
      idleWindowMs: 50,
      timeoutMs: 300,
      signal: "visual",
    });
    const elapsed = Date.now() - start;

    // Resolved around the timeout (not immediately, not far past it).
    expect(elapsed).toBeGreaterThanOrEqual(250);
    expect(elapsed).toBeLessThan(1500);
  });

  it("settle: visual signal detects stable frame", async () => {
    const { waitForSettled } = await import("./settle");
    const { DEFAULT_SETTLE_STRATEGY } = await import("./types");

    // Page whose screenshot is identical on every call (stable frame).
    const stable = Buffer.from("identical-frame");
    const fakePage = {
      url: () => "http://localhost:3000/x",
      screenshot: async () => stable,
    };

    const start = Date.now();
    await waitForSettled(fakePage as unknown as PageLike, {
      ...DEFAULT_SETTLE_STRATEGY,
      idleWindowMs: 50,
      timeoutMs: 2000,
      signal: "visual",
    });
    const elapsed = Date.now() - start;

    // Stable from the start → resolves quickly (well under timeout).
    expect(elapsed).toBeLessThan(500);
  });
});

function createIR(locators: Locator[]): DemoIR {
  return {
    schemaVersion,
    id: "demo",
    definitionHash: DEFINITION_HASH,
    captureHash: CAPTURE_HASH,
    title: "Demo",
    source: { baseUrl: "http://localhost:3000" },
    targets: {
      button: {
        id: "button",
        locators,
      },
    },
    scenes: [
      {
        id: "scene",
        pacing: "normal",
        importance: "primary",
        steps: [
          {
            kind: "browser.goto",
            id: "scene.browser-goto-dashboard.1",
            path: "/dashboard",
          },
          {
            kind: "browser.click",
            id: "scene.browser-click-button.2",
            target: "button",
          },
          {
            kind: "assert.visible",
            id: "scene.assert-visible-button.3",
            target: "button",
          },
          {
            kind: "assert.text",
            id: "scene.assert-text-button.4",
            target: "button",
            text: "Created",
          },
        ],
      },
    ],
  };
}

type LocatorState = {
  visible: boolean;
  text?: string;
  box?: { x: number; y: number; width: number; height: number };
};

function createMockPage(
  states: Partial<Record<Locator["kind"], LocatorState>>,
) {
  const calls: string[] = [];
  const waits: number[] = [];
  const locatorFor = (kind: Locator["kind"]) => ({
    click: async () => {
      calls.push("click");
    },
    fill: async (value: string) => {
      calls.push(`fill:${value}`);
    },
    selectOption: async (value: string) => {
      calls.push(`select:${value}`);
    },
    boundingBox: async () => states[kind]?.box ?? null,
    isVisible: async () => {
      calls.push("isVisible");
      return states[kind]?.visible ?? false;
    },
    textContent: async () => {
      calls.push("textContent");
      return states[kind]?.text ?? "";
    },
  });

  return {
    calls,
    waits,
    goto: async (url: string) => {
      calls.push(`goto:${url}`);
    },
    url: () => "http://localhost:3000/dashboard",
    locator: () => locatorFor("text"),
    getByRole: () => locatorFor("role"),
    getByLabel: () => locatorFor("label"),
    getByTestId: () => locatorFor("testId"),
    getByText: () => locatorFor("text"),
    video: () => ({
      path: async () => "video.webm",
    }),
    screenshot: async () => Buffer.from(""),
    waitForTimeout: async (durationMs: number) => {
      waits.push(durationMs);
    },
  };
}

function createBindings(
  page: ReturnType<typeof createMockPage>,
): PlaywrightBindings {
  return {
    chromium: {
      launch: async () => ({
        close: async () => undefined,
        newContext: async () => ({
          newPage: async () => page,
          close: async () => undefined,
          tracing: {
            start: async () => undefined,
            stop: async (options?: Record<string, unknown>) => {
              if (typeof options?.path === "string") {
                await writeFile(options.path, "trace");
              }
            },
          },
        }),
      }),
    },
  };
}
