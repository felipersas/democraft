import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { DemoIR, Locator } from "@democraft/schema";
import { schemaVersion } from "@democraft/schema";
import {
  resolveTarget,
  runDemoWithBindings,
  type PlaywrightBindings,
} from "./index";

const tempDirs: string[] = [];

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
        code: "MD201",
        details: {
          attemptedLocators: [
            { locator: { kind: "testId", id: "button" }, success: false },
          ],
        },
        message: 'Target "button" could not be resolved.',
        stepId: "scene.browser-click-button.2",
        targetId: "button",
      }),
    );
    expect(manifest.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "MD201",
        stepId: "scene.assert-visible-button.3",
        targetId: "button",
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
      evaluate: async <T>(_fn: () => T | Promise<T>): Promise<T> => {
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
    await waitForSettled(fakePage as any, {
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
    await waitForSettled(fakePage as any, {
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
    await waitForSettled(fakePage as any, {
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
            stop: async () => undefined,
          },
        }),
      }),
    },
  };
}
