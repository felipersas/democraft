import { describe, expect, expectTypeOf, it } from "vitest";
import {
  byRole,
  byTestId,
  defineDemo,
  defineTarget,
  defineTargets,
  defineVisual,
} from "./index";
import type { Duration } from "./index";

describe("targets", () => {
  it("types supported durations and normalizes target-free demos", () => {
    const seconds: Duration = "1.5s";
    const milliseconds: Duration = "250ms";
    // @ts-expect-error Durations require an ms or s suffix.
    const invalid: Duration = "soon";
    const definition = defineDemo({
      id: "title-card",
      title: "Title card",
      source: { baseUrl: "http://localhost:3000" },
      async run({ demo }) {
        await demo.scene("intro", async (scene) => {
          await scene.hold(seconds);
          await scene.transition({ duration: milliseconds });
          // @ts-expect-error A target-free demo has no valid target ids.
          await scene.click("missing");
        });
      },
    });

    expect(invalid).toBe("soon");
    expect(definition.targets).toEqual({});
  });

  it("defines a single locator target", () => {
    const targets = defineTargets({
      dashboard: byTestId("dashboard"),
    });

    expect(targets.dashboard).toEqual({
      id: "dashboard",
      locators: [{ kind: "testId", id: "dashboard" }],
    });
  });

  it("preserves ordered locator fallbacks", () => {
    const target = defineTarget({
      id: "new-project-button",
      locators: [
        byRole("button", { name: "New project" }),
        byTestId("new-project"),
      ],
    });

    const targets = defineTargets({
      "new-project-button": target,
    });

    expect(targets["new-project-button"].locators).toEqual([
      { kind: "role", role: "button", name: "New project" },
      { kind: "testId", id: "new-project" },
    ]);
  });

  it("preserves literal target ids in scene methods", () => {
    const targets = defineTargets({ save: byRole("button", { name: "Save" }) });

    expectTypeOf<keyof typeof targets>().toEqualTypeOf<"save">();

    const definition = defineDemo({
      id: "save-profile",
      title: "Save profile",
      source: { baseUrl: "http://localhost:3000" },
      targets,
      async run({ demo }) {
        await demo.scene("save", async (scene) => {
          await scene.click("save");
          // @ts-expect-error Target "missing" is not declared by this demo.
          await scene.click("missing");
        });
      },
    });

    expect(definition.targets.save.id).toBe("save");
  });

  it("normalizes inline targets in a single-file definition", () => {
    const definition = defineDemo({
      id: "save-profile",
      title: "Save profile",
      source: { baseUrl: "http://localhost:3000" },
      targets: { save: byRole("button", { name: "Save" }) },
      async run({ demo }) {
        await demo.scene("save", async (scene) => {
          await scene.click("save");
          // @ts-expect-error Target "missing" is not declared by this demo.
          await scene.click("missing");
        });
      },
    });

    expectTypeOf<keyof typeof definition.targets>().toEqualTypeOf<"save">();
    expect(definition.targets.save).toEqual({
      id: "save",
      locators: [{ kind: "role", role: "button", name: "Save" }],
    });
  });

  it("keeps pre-normalized definitions unchanged", () => {
    const targets = defineTargets({ dashboard: byTestId("dashboard") });
    const input = {
      id: "dashboard",
      title: "Dashboard",
      source: { baseUrl: "http://localhost:3000" },
      targets,
      async run() {},
    };

    expect(defineDemo(input)).toBe(input);
  });

  it("infers visual ids and component props in the scene API", () => {
    const LaunchTitle = ({ text }: { text: string; speed?: number }) => text;
    const launchTitle = defineVisual(LaunchTitle);

    const definition = defineDemo({
      id: "visual-demo",
      title: "Visual demo",
      source: { baseUrl: "http://localhost:3000" },
      visuals: { "local.launch-title": launchTitle },
      async run({ demo }) {
        await demo.scene("intro", async (scene) => {
          await scene.visual(
            "local.launch-title",
            { text: "New analytics", speed: 1.2 },
            { duration: "1.5s" },
          );
          // @ts-expect-error Visual props are inferred from the component.
          await scene.visual("local.launch-title", { speed: 1.2 });
          // @ts-expect-error Visual ids come from the demo visuals map.
          await scene.visual("local.missing", { text: "Missing" });
        });
      },
    });

    expect(definition.visuals).toEqual({
      "local.launch-title": launchTitle,
    });
  });
});
