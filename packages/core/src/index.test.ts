import { describe, expect, expectTypeOf, it } from "vitest";
import {
  byRole,
  byTestId,
  defineDemo,
  defineTarget,
  defineTargets,
} from "./index";

describe("targets", () => {
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
});
