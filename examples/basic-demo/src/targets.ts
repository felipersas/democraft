import { byLabel, byRole, byTestId, defineTargets } from "@democraft/core";

export default defineTargets({
  dashboard: byTestId("dashboard"),
  "new-project-button": byRole("button", { name: "New project" }),
  "create-project-dialog": byRole("dialog", { name: "Create project" }),
  "project-name-input": byLabel("Project name"),
  "create-project-button": byRole("button", { name: "Create" }),
  "project-card": byTestId("project-card"),
});
