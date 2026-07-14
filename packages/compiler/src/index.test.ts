import { describe, expect, it } from "vitest";
import { byTestId, defineDemo, defineTargets } from "@democraft/core";
import { compileDemo, inspectIR, parseDurationMs } from "./index";

const targets = defineTargets({
  dashboard: byTestId("dashboard"),
  button: byTestId("button"),
  input: byTestId("input"),
  card: byTestId("card"),
});

describe("compiler", () => {
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
            await scene.click("missing");
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
  });
});
