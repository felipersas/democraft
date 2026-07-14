import { describe, expect, it } from "vitest";
import { byRole, byTestId, defineTarget, defineTargets } from "./index";

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
});
