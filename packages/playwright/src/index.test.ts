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
        environment: { viewport: { width: 800, height: 600 } },
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
