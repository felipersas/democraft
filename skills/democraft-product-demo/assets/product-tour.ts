/**
 * product-tour.ts — multi-scene product tour template.
 *
 * Replace targets with Discovery locator candidates and keep only scenes that
 * support the user's objective.
 */
import { byRole, byTestId, defineDemo, defineTargets } from "@democraft/core";

const targets = defineTargets({
  appShell: byTestId("app-shell"),
  primaryNavigation: byRole("navigation", { name: "Primary navigation" }),
  dashboardHeading: byRole("heading", { name: "Dashboard" }),
  primaryAction: byRole("button", { name: "New project" }),
});

export default defineDemo({
  id: "product-tour",
  title: "Product tour",
  source: { baseUrl: "http://localhost:3000" },
  targets,
  async run({ demo }) {
    await demo.scene("context", async (scene) => {
      await scene.goto("/");
      await scene.expectVisible("appShell");
      await scene.establish("appShell");
      await scene.caption("Start with the workspace your team uses every day.");
    });

    await demo.scene("navigation", async (scene) => {
      await scene.focus("primaryNavigation");
      await scene.caption("Navigation keeps the key workflows close.");
    });

    await demo.scene("primary-action", async (scene) => {
      await scene.focus("primaryAction");
      await scene.caption("The main action is ready when the team is.");
    });
  },
});
