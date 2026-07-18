/**
 * feature-walkthrough.ts — a slightly richer template.
 *
 * Shows establish → focus → click → caption → callout → hold, the typical
 * shape of a feature walkthrough. Replace targets and steps from Discovery.
 */
import {
  byRole,
  byTestId,
  defineDemo,
  defineTargets,
} from "@democraft/core";

const targets = defineTargets({
  dashboard: byTestId("dashboard"),
  newProject: byRole("button", { name: "New project" }),
  projectName: byRole("textbox", { name: "Project name" }),
  createButton: byRole("button", { name: "Create project" }),
});

export default defineDemo({
  id: "create-project-walkthrough",
  title: "Create a project",
  source: { baseUrl: "http://localhost:3000" },
  targets,
  async run({ demo }) {
    await demo.scene("establish", async (scene) => {
      await scene.goto("/dashboard");
      await scene.expectVisible("dashboard");
      await scene.establish("dashboard");
      await scene.caption("From the dashboard, start something new.");
    });

    await demo.scene("open-form", async (scene) => {
      await scene.focus("newProject");
      await scene.click("newProject");
    });

    await demo.scene("fill", async (scene) => {
      await scene.expectVisible("projectName");
      await scene.focus("projectName");
      await scene.fill("projectName", "Launch v2");
      await scene.callout("projectName", {
        title: "Named",
        description: "The project name is the only required field.",
      });
    });

    await demo.scene("submit", async (scene) => {
      await scene.focus("createButton");
      await scene.hold(500);
    });
  },
});
