import {
  defineDemo,
  defineTargets,
  byLabel,
  byRole,
  byTestId,
} from "@democraft/core";

export function createProjectTargets() {
  return defineTargets({
    dashboard: byTestId("dashboard"),
    "new-project-button": byRole("button", { name: "New project" }),
    "create-project-dialog": byRole("dialog", { name: "Create project" }),
    "project-name-input": byLabel("Project name"),
    "project-template": byLabel("Template"),
    "create-project-button": byRole("button", { name: "Create" }),
    "project-card": byTestId("project-card"),
  });
}

export function createProjectDemo() {
  const targets = createProjectTargets();

  return defineDemo({
    id: "create-project",
    title: "Create a project",
    source: {
      baseUrl: "http://localhost:3000",
      initialPath: "/dashboard",
    },
    targets,
    async run({ demo }) {
      await demo.scene("introduction", async (scene) => {
        await scene.goto("/dashboard");
        await scene.expectVisible("dashboard");
        await scene.establish("dashboard");
        await scene.caption("Create a workspace in seconds.");
        await scene.hold("1s");
      });

      await demo.scene("configure-project", async (scene) => {
        await scene.click("new-project-button");
        await scene.expectVisible("create-project-dialog");
        await scene.focus("create-project-dialog");
        await scene.fill("project-name-input", "Oddworks");
        await scene.click("create-project-button");
      });

      await demo.scene("project-created", async (scene) => {
        await scene.expectVisible("project-card");
        await scene.focus("project-card");
        await scene.callout("project-card", {
          title: "Your project is ready",
        });
        await scene.hold("1.5s");
      });
    },
  });
}
