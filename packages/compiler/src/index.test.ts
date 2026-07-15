import { describe, expect, it } from "vitest";
import { byTestId, defineDemo, defineTargets } from "@democraft/core";
import type { DemoIR } from "@democraft/schema";
import { schemaVersion } from "@democraft/schema";
import {
  compileDemo,
  compileDemoResult,
  createCaptureHash,
  createDefinitionHash,
  inspectIR,
  parseDurationMs,
} from "./index";

const targets = defineTargets({
  dashboard: byTestId("dashboard"),
  button: byTestId("button"),
  input: byTestId("input"),
  card: byTestId("card"),
});

describe("compiler", () => {
  it("carries serializable definition config without changing the IR", async () => {
    const result = await compileDemo(
      defineDemo({
        id: "configured-demo",
        title: "Configured demo",
        config: { fps: 30 },
        source: { baseUrl: "http://localhost:3000" },
        targets,
        async run() {},
      }),
    );

    expect(result.config).toEqual({ fps: 30 });
    expect(result.ir).not.toHaveProperty("config");
  });

  it("rejects invalid definition fps", async () => {
    const result = await compileDemo(
      defineDemo({
        id: "configured-demo",
        title: "Configured demo",
        config: { fps: 0 },
        source: { baseUrl: "http://localhost:3000" },
        targets,
        async run() {},
      }),
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "DC001",
        severity: "error",
        message: "Config fps must be a finite number greater than 0.",
      }),
    );
  });

  it("returns a discriminated operation result", async () => {
    const valid = await compileDemoResult(
      defineDemo({
        id: "valid-demo",
        title: "Valid demo",
        source: { baseUrl: "http://localhost:3000" },
        targets,
        async run() {},
      }),
    );
    const invalid = await compileDemoResult(
      defineDemo({
        id: "invalid-demo",
        title: "Invalid demo",
        source: { baseUrl: "http://localhost:3000" },
        targets,
        async run({ demo }) {
          await demo.scene("broken", async (scene) => {
            await scene.click("missing" as never);
          });
        },
      }),
    );

    expect(valid).toMatchObject({
      ok: true,
      value: { ir: { id: "valid-demo" }, config: {} },
      diagnostics: [],
    });
    expect(invalid).toMatchObject({
      ok: false,
      diagnostics: [expect.objectContaining({ code: "DC101" })],
    });
    expect(invalid).not.toHaveProperty("value");
  });

  it("captures scenes and generates stable step IDs", async () => {
    const result = await compileDemo(
      defineDemo({
        id: "demo",
        title: "Demo",
        source: { baseUrl: "http://localhost:3000" },
        targets,
        async run({ demo }) {
          await demo.scene("intro", async (scene) => {
            await scene.goto("/dashboard");
            await scene.expectVisible("dashboard");
            await scene.hold("1s");
          });
        },
      }),
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.ir.scenes[0]?.steps.map((step) => step.id)).toEqual([
      "intro.browser-goto-dashboard.1",
      "intro.assert-visible-dashboard.2",
      "intro.timeline-hold.3",
    ]);
    expect(result.ir.scenes[0]?.steps[2]).toMatchObject({
      kind: "timeline.hold",
      durationMs: 1000,
    });
  });

  it("normalizes duration strings", () => {
    expect(parseDurationMs("250ms")).toBe(250);
    expect(parseDurationMs("1s")).toBe(1000);
    expect(parseDurationMs("1.5s")).toBe(1500);
    expect(parseDurationMs("-1s")).toBeNull();
    expect(parseDurationMs("soon")).toBeNull();
  });

  it("returns unknown target diagnostics", async () => {
    const result = await compileDemo(
      defineDemo({
        id: "demo",
        title: "Demo",
        source: { baseUrl: "http://localhost:3000" },
        targets,
        async run({ demo }) {
          await demo.scene("broken", async (scene) => {
            // Runtime validation still protects JavaScript and widened inputs.
            await scene.click("missing" as never);
          });
        },
      }),
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "DC101",
        sceneId: "broken",
        targetId: "missing",
      }),
    );
  });

  it("returns duplicate scene diagnostics", async () => {
    const result = await compileDemo(
      defineDemo({
        id: "demo",
        title: "Demo",
        source: { baseUrl: "http://localhost:3000" },
        targets,
        async run({ demo }) {
          await demo.scene("same", async () => {});
          await demo.scene("same", async () => {});
        },
      }),
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "DC002",
        sceneId: "same",
      }),
    );
  });

  it("reports empty author ids and targets without locators", async () => {
    const result = await compileDemo(
      defineDemo({
        id: "",
        title: "Demo",
        source: { baseUrl: "http://localhost:3000" },
        targets: defineTargets({ empty: { locators: [] }, "": byTestId("x") }),
        async run({ demo }) {
          await demo.scene("", async (scene) => {
            await scene.click("", { id: "" });
          });
        },
      }),
    );

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "DC001", severity: "error" }),
        expect.objectContaining({
          code: "DC106",
          message: expect.stringContaining("at least one locator"),
        }),
        expect.objectContaining({
          code: "DC106",
          message: "Target ids must be non-empty.",
        }),
        expect.objectContaining({
          code: "DC103",
          message: "Scene ids must be non-empty.",
        }),
        expect.objectContaining({
          code: "DC104",
          message: "Step ids must be non-empty.",
        }),
        expect.objectContaining({
          code: "DC106",
          message: "Step target ids must be non-empty.",
        }),
      ]),
    );
  });

  it("serializes and inspects compiled IR", async () => {
    const result = await compileDemo(
      defineDemo({
        id: "demo",
        title: "Create a project",
        source: { baseUrl: "http://localhost:3000" },
        targets,
        async run({ demo }) {
          await demo.scene("configure-project", async (scene) => {
            await scene.click("button");
            await scene.expectVisible("card");
            await scene.focus("card");
            await scene.fill("input", "Oddworks");
          });
        },
      }),
    );

    expect(JSON.parse(JSON.stringify(result.ir))).toEqual(result.ir);
    expect(inspectIR(result.ir)).toContain('1. Click target "button"');
    expect(inspectIR(result.ir)).toContain(
      '4. Fill target "input" with "Oddworks"',
    );
  });

  it("produces deterministic output", async () => {
    const demo = defineDemo({
      id: "demo",
      title: "Demo",
      source: { baseUrl: "http://localhost:3000" },
      targets,
      async run({ demo }) {
        await demo.scene("intro", async (scene) => {
          await scene.click("button");
          await scene.hold("1.5s");
        });
      },
    });

    const first = await compileDemo(demo);
    const second = await compileDemo(demo);

    expect(JSON.stringify(first.ir)).toBe(JSON.stringify(second.ir));
    expect(first.ir.definitionHash).toMatch(
      /^definition-v1:sha256:[a-f0-9]{64}$/,
    );
    expect(first.ir.captureHash).toMatch(/^capture-v1:sha256:[a-f0-9]{64}$/);
  });

  it("canonicalizes object keys but preserves array order", () => {
    const first = definitionFixture();
    const second = definitionFixture();
    second.targets = {
      card: second.targets.card!,
      button: second.targets.button!,
    };

    expect(createDefinitionHash(first)).toBe(
      "definition-v1:sha256:0cc98dc3bf328a97cea7b91f77c97e205e9337187398074247ab58cbbe4107a0",
    );
    expect(createDefinitionHash(second)).toBe(createDefinitionHash(first));
    expect(createCaptureHash(first)).toBe(
      "capture-v1:sha256:3f95eae985ce66697115a0f3f82dec276ca668bfb18a6183ced9fc2d1226b50f",
    );

    second.scenes[0]!.steps.reverse();
    expect(createDefinitionHash(second)).not.toBe(createDefinitionHash(first));
  });

  it("keeps the human demo id outside the structural hash", () => {
    const first = definitionFixture();
    const second = { ...definitionFixture(), id: "renamed-demo" };

    expect(createDefinitionHash(second)).toBe(createDefinitionHash(first));
  });

  it("separates presentation-only changes from capture-affecting changes", () => {
    const original = definitionFixture();
    const presentationOnly = definitionFixture();
    presentationOnly.title = "A new presentation title";

    expect(createDefinitionHash(presentationOnly)).not.toBe(
      createDefinitionHash(original),
    );
    expect(createCaptureHash(presentationOnly)).toBe(
      createCaptureHash(original),
    );

    const rendererOnly = definitionFixture();
    const renderedCaption = rendererOnly.scenes[0]!.steps[0]!;
    if (renderedCaption.kind === "overlay.caption") {
      renderedCaption.renderer = "kinetic";
    }
    expect(createDefinitionHash(rendererOnly)).not.toBe(
      createDefinitionHash(original),
    );
    expect(createCaptureHash(rendererOnly)).toBe(createCaptureHash(original));

    const captureUnused = definitionFixture();
    captureUnused.source.initialPath = "/another-entry";
    captureUnused.targets.button!.description = "Updated author hint";
    captureUnused.targets.button!.framing = {
      preferredPadding: 120,
      safeArea: "top",
    };
    expect(createDefinitionHash(captureUnused)).not.toBe(
      createDefinitionHash(original),
    );
    expect(createCaptureHash(captureUnused)).toBe(createCaptureHash(original));

    const captureAffecting = definitionFixture();
    const caption = captureAffecting.scenes[0]!.steps[0]!;
    if (caption.kind === "overlay.caption") caption.text = "Longer wait";
    expect(createCaptureHash(captureAffecting)).not.toBe(
      createCaptureHash(original),
    );
  });

  it.each([
    ["title", (ir: DemoIR) => void (ir.title = "Changed title")],
    [
      "source",
      (ir: DemoIR) => void (ir.source.baseUrl = "http://localhost:4000"),
    ],
    [
      "target",
      (ir: DemoIR) => void (ir.targets.button!.description = "Changed"),
    ],
    ["scene id", (ir: DemoIR) => void (ir.scenes[0]!.id = "changed")],
    ["scene metadata", (ir: DemoIR) => void (ir.scenes[0]!.pacing = "slow")],
    [
      "step payload",
      (ir: DemoIR) => {
        const step = ir.scenes[0]!.steps[0]!;
        if (step.kind === "overlay.caption") step.text = "Changed";
      },
    ],
  ])("changes when the %s changes", (_field, mutate) => {
    const original = definitionFixture();
    const changed = definitionFixture();
    mutate(changed);

    expect(createDefinitionHash(changed)).not.toBe(
      createDefinitionHash(original),
    );
  });
});

function definitionFixture(): DemoIR {
  return {
    schemaVersion,
    id: "demo",
    title: "Demo",
    source: {
      baseUrl: "http://localhost:3000",
      initialPath: "/dashboard",
    },
    targets: {
      button: {
        id: "button",
        locators: [{ kind: "testId", id: "button" }],
      },
      card: {
        id: "card",
        locators: [{ kind: "role", role: "article", name: "Summary" }],
      },
    },
    scenes: [
      {
        id: "intro",
        purpose: "Introduce the dashboard",
        pacing: "normal",
        importance: "primary",
        steps: [
          {
            id: "intro.caption.1",
            kind: "overlay.caption",
            text: "Welcome",
          },
          {
            id: "intro.click.2",
            kind: "browser.click",
            target: "button",
          },
        ],
      },
    ],
  };
}
