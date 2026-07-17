import { byTestId, defineDemo, defineTargets } from "@democraft/core";

const targets = defineTargets({
  "private-dashboard": byTestId("private-dashboard"),
});

export default defineDemo({
  id: "private-dashboard",
  title: "Authenticated private dashboard",
  source: {
    baseUrl: "http://localhost:4173",
    initialPath: "/private/dashboard",
  },
  // Replace this documented example ID with the ID printed by `democraft auth create`.
  authentication: { profileId: "auth_01arz3ndektsv4rrffq69g5fav" },
  targets,
  async run({ demo }) {
    await demo.scene("private-dashboard", async (scene) => {
      await scene.goto("/private/dashboard");
      await scene.expectVisible("private-dashboard");
      await scene.establish("private-dashboard");
      await scene.caption("A reusable profile opened this private page.");
    });
  },
});
