import { defineDemo } from "@democraft/core";
import targets from "./targets";

export default defineDemo({
  id: "create-project-live",
  title: "Create a project live",
  source: {
    baseUrl: "http://localhost:4173",
    initialPath: "/dashboard",
  },
  targets,
  async run({ demo }) {
    await demo.scene("introduction", async (scene) => {
      await scene.goto("/dashboard");
      await scene.expectVisible("dashboard");
      await scene.establish("dashboard");
      await scene.caption("Create a workspace in seconds.", {
        renderer: "remocn.kinetic-title",
      });
      await scene.hold("5000ms");
    });

    await demo.scene("configure-project", async (scene) => {
      await scene.click("new-project-button");
      await scene.expectVisible("create-project-dialog");
      await scene.focus("create-project-dialog");
      await scene.fill("project-name-input", "Oddworks");
      await scene.select("project-template", "Product launch");
      await scene.click("create-project-button");
    });

    await demo.scene("project-created", async (scene) => {
      await scene.expectVisible("project-card");
      await scene.focus("project-card");
      await scene.callout("project-card", {
        title: "Your project is ready",
        description: "The browser journey produced this card.",
        renderer: "remocn.glass-callout",
      });
      await scene.hold("1s");
    });
  },
});
