import {
  byLabel,
  byRole,
  byTestId,
  defineTarget,
  defineTargets,
} from "@democraft/core";

export default defineTargets({
  dashboard: byTestId("dashboard"),
  "new-project-button": defineTarget({
    id: "new-project-button",
    locators: [
      byRole("button", { name: "New project" }),
      byTestId("new-project"),
    ],
  }),
  "create-project-dialog": byRole("dialog", { name: "Create project" }),
  "project-name-input": byLabel("Project name"),
  "project-template": byLabel("Template"),
  "create-project-button": byRole("button", { name: "Create" }),
  "project-card": byTestId("project-card"),
});
